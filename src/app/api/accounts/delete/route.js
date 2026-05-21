import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { graphBase } from '@/lib/meta-graph';

/**
 * DELETE /api/accounts/delete
 * Hard-delete: removes ALL user data and the auth account itself.
 * This is irreversible — the user is fully erased from AutoDM.
 *
 * Deletion order (respects FK constraints):
 *
 *  Per-automation data (must come before dm_automations):
 *    dm_analytics, dm_sent_log (via dm_automation IDs + global_automation IDs),
 *    dm_followup_queue, dm_link_codes, click_events, email_collect_queue, email_leads
 *
 *  Per-account data:
 *    dm_automations, instagram_posts, global_automations, dm_queue, broadcast_jobs
 *
 *  Per-user data:
 *    connected_accounts, dm_templates, alert_preferences, payment_orders,
 *    user_plans, data_deletion_requests
 *
 *  Finally: auth.users (cascades anything remaining)
 */

function createServiceClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

/** Silently attempt a deletion — log errors but don't abort the whole flow */
async function tryDelete(label, fn) {
    try {
        await fn();
    } catch (err) {
        console.warn(`[AccountDelete] ${label} — non-fatal error:`, err.message);
    }
}

export async function DELETE(request) {
    // Two auth paths:
    //   - Web: cookie session via supabase-server createClient()
    //   - Mobile: Authorization: Bearer <JWT> header. Cookie client
    //     wouldn't see the JWT, so resolve via admin client.
    let user = null;
    let supabase = null;

    const authHeader = request?.headers?.get?.('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (bearer) {
        const admin = createServiceClient();
        const { data, error } = await admin.auth.getUser(bearer);
        if (error || !data?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        user = data.user;
        // No cookie-bound supabase client available on mobile, but
        // the auth.signOut() below isn't strictly needed since the
        // admin.auth.admin.deleteUser() invalidates all sessions for
        // this user across devices. Mobile clears its own session on
        // the client side after the request returns.
        supabase = null;
    } else {
        supabase = await createClient();
        ({ data: { user } } = await supabase.auth.getUser());
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
    }

    const db = createServiceClient();

    try {
        // ── 1. Collect IDs ──────────────────────────────────────────────────

        // Connected account IDs + full row (tokens needed for Meta-side
        // cleanup below — must fetch BEFORE we scrub/delete the rows).
        const { data: accounts } = await db
            .from('connected_accounts')
            .select('id, ig_user_id, fb_page_id, access_token, fb_page_access_token, default_config')
            .eq('user_id', user.id);
        const accountIds = (accounts || []).map((a) => a.id);

        // ── 1a. Meta-side cleanup BEFORE we scrub the tokens ────────────
        // Currently only Ice Breakers persist on Meta after our row delete.
        // Without this DELETE, the openers we pushed to messenger_profile
        // keep rendering in the fan's Instagram inbox until manually
        // removed. Best-effort — failure here doesn't block delete.
        for (const acc of (accounts || [])) {
            const hasIceBreakers = Array.isArray(acc.default_config?.iceBreakers)
                && acc.default_config.iceBreakers.length > 0;
            if (!hasIceBreakers) continue;
            const token    = acc.fb_page_access_token || acc.access_token;
            const pageOrIg = acc.fb_page_id || acc.ig_user_id;
            // useIgApi=false → graph.facebook.com (FB Page Access Token path)
            // useIgApi=true  → graph.instagram.com (IG Business Login token path)
            const base     = graphBase(!acc.fb_page_access_token);
            if (!token || !pageOrIg) continue;
            try {
                const url =
                    `${base}/${pageOrIg}/messenger_profile` +
                    `?platform=instagram` +
                    `&access_token=${encodeURIComponent(token)}`;
                const res = await fetch(url, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fields: ['ice_breakers'] }),
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    console.warn('[AccountDelete] Meta ice_breakers DELETE failed for',
                        acc.id, ':', body.error?.message || res.status);
                } else {
                    console.log('[AccountDelete] Meta ice_breakers cleared for', acc.id);
                }
            } catch (err) {
                console.warn('[AccountDelete] Meta ice_breakers DELETE threw for',
                    acc.id, ':', err.message);
            }
        }

        // Instagram post IDs
        let postIds = [];
        if (accountIds.length > 0) {
            const { data: posts } = await db
                .from('instagram_posts').select('id')
                .in('account_id', accountIds);
            postIds = (posts || []).map((p) => p.id);
        }

        // ALL DM automation IDs for this user — post-bound AND post-less.
        // Previously this only fetched post-bound rows via `.in('post_id', postIds)`,
        // which missed DM Auto-Responder / Email Collector / Any-Post automations
        // (all of which have post_id=NULL). That left their related per-automation
        // rows (dm_sent_log, email_leads, dm_link_codes, ...) orphaned after delete.
        const { data: allDmAutos } = await db
            .from('dm_automations').select('id')
            .eq('user_id', user.id);
        const dmAutomationIds = (allDmAutos || []).map((a) => a.id);

        // Global automation IDs (dm_sent_log also references these)
        const { data: globalAutos } = await db
            .from('global_automations').select('id')
            .eq('user_id', user.id);
        const globalAutomationIds = (globalAutos || []).map((a) => a.id);

        // All automation IDs for dm_sent_log cleanup
        const allAutomationIds = [...dmAutomationIds, ...globalAutomationIds];

        // Broadcast job IDs
        const { data: broadcastJobs } = await db
            .from('broadcast_jobs').select('id')
            .eq('user_id', user.id);
        const broadcastJobIds = (broadcastJobs || []).map((j) => j.id);

        // ── 2. Delete per-automation data ───────────────────────────────────

        if (allAutomationIds.length > 0) {
            await tryDelete('dm_sent_log', () =>
                db.from('dm_sent_log').delete().in('automation_id', allAutomationIds)
            );
            await tryDelete('dm_followup_queue', () =>
                db.from('dm_followup_queue').delete().in('automation_id', allAutomationIds)
            );
            await tryDelete('email_collect_queue', () =>
                db.from('email_collect_queue').delete().in('automation_id', allAutomationIds)
            );
            await tryDelete('email_leads', () =>
                db.from('email_leads').delete().in('automation_id', allAutomationIds)
            );
            await tryDelete('dm_link_codes', () =>
                db.from('dm_link_codes').delete().in('automation_id', allAutomationIds)
            );
            // click_events cascade from dm_link_codes/dm_automations — but be explicit
            await tryDelete('click_events', () =>
                db.from('click_events').delete().in('automation_id', allAutomationIds)
            );
            await tryDelete('dm_analytics', () =>
                db.from('dm_analytics').delete().in('automation_id', allAutomationIds)
            );
        }

        // ── 3. Delete per-post / per-account data ───────────────────────────

        // Delete ALL dm_automations by user_id (not by post_id). Post-bound
        // and post-less automations both belong to this user, and missing
        // post-less rows was the root cause of "I deleted my account but
        // my DM Auto-Responder / Email Collector automations are still there"
        // after re-signup with the same email.
        await tryDelete('dm_automations', () =>
            db.from('dm_automations').delete().eq('user_id', user.id)
        );

        if (accountIds.length > 0) {
            await tryDelete('instagram_posts', () =>
                db.from('instagram_posts').delete().in('account_id', accountIds)
            );
            await tryDelete('dm_queue (by account)', () =>
                db.from('dm_queue').delete().in('account_id', accountIds)
            );
        }

        // ── 4. Delete per-user data ─────────────────────────────────────────

        await tryDelete('global_automations', () =>
            db.from('global_automations').delete().eq('user_id', user.id)
        );
        await tryDelete('dm_queue (by user)', () =>
            db.from('dm_queue').delete().eq('user_id', user.id)
        );
        await tryDelete('connected_accounts', () =>
            db.from('connected_accounts').delete().eq('user_id', user.id)
        );
        await tryDelete('dm_templates', () =>
            db.from('dm_templates').delete().eq('user_id', user.id)
        );
        await tryDelete('alert_preferences', () =>
            db.from('alert_preferences').delete().eq('user_id', user.id)
        );
        await tryDelete('payment_orders', () =>
            db.from('payment_orders').delete().eq('user_id', user.id)
        );
        await tryDelete('user_plans', () =>
            db.from('user_plans').delete().eq('user_id', user.id)
        );

        if (broadcastJobIds.length > 0) {
            await tryDelete('broadcast_recipients', () =>
                db.from('broadcast_recipients').delete().in('job_id', broadcastJobIds)
            );
        }
        await tryDelete('broadcast_jobs', () =>
            db.from('broadcast_jobs').delete().eq('user_id', user.id)
        );
        await tryDelete('data_deletion_requests', () =>
            db.from('data_deletion_requests').delete().eq('user_id', user.id)
        );

        // ── 5. Sign out + delete auth user ──────────────────────────────────
        // Auth user delete cascades any remaining rows with ON DELETE CASCADE FKs.
        // CRITICAL: if this fails and we return success, the user signs back in
        // with the same email -> same user_id -> sees all their old data again.
        // That's the "I deleted my account but everything is still there" bug.
        // Surface the failure so the user knows their account wasn't fully wiped.

        // Web flow signs out the cookie-bound session; mobile has no
        // cookie session here, so the deleteUser call below is what
        // invalidates the bearer token (it kills every session for this
        // user across devices). Mobile clears local Supabase state
        // client-side after this request returns.
        if (supabase) {
            await supabase.auth.signOut();
        }

        const { error: deleteAuthError } = await db.auth.admin.deleteUser(user.id);
        if (deleteAuthError) {
            console.error('[AccountDelete] Failed to delete auth user:', deleteAuthError);
            return NextResponse.json({
                error:
                    'Your data was deleted but removing your login account failed. ' +
                    'Please contact support@autodm.pro so we can finish the cleanup.',
                details: deleteAuthError.message,
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Account and all associated data have been permanently deleted.',
        });
    } catch (err) {
        console.error('[AccountDelete] Fatal error:', err);
        return NextResponse.json({ error: `Failed to delete account: ${err.message}` }, { status: 500 });
    }
}
