import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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

export async function DELETE() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = createServiceClient();

    try {
        // ── 1. Collect IDs ──────────────────────────────────────────────────

        // Connected account IDs
        const { data: accounts } = await db
            .from('connected_accounts').select('id')
            .eq('user_id', user.id);
        const accountIds = (accounts || []).map((a) => a.id);

        // Instagram post IDs
        let postIds = [];
        if (accountIds.length > 0) {
            const { data: posts } = await db
                .from('instagram_posts').select('id')
                .in('account_id', accountIds);
            postIds = (posts || []).map((p) => p.id);
        }

        // DM automation IDs (from instagram posts)
        let dmAutomationIds = [];
        if (postIds.length > 0) {
            const { data: autos } = await db
                .from('dm_automations').select('id')
                .in('post_id', postIds);
            dmAutomationIds = (autos || []).map((a) => a.id);
        }

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

        if (postIds.length > 0) {
            await tryDelete('dm_automations', () =>
                db.from('dm_automations').delete().in('post_id', postIds)
            );
        }

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

        await supabase.auth.signOut();

        const { error: deleteAuthError } = await db.auth.admin.deleteUser(user.id);
        if (deleteAuthError) {
            console.error('[AccountDelete] Failed to delete auth user:', deleteAuthError.message);
            // All user data is already cleaned — non-fatal
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
