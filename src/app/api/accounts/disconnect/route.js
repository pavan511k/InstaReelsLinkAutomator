import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * POST /api/accounts/disconnect
 *
 * Meta-compliant disconnect:
 * - HARD DELETES all Platform Data (posts, media URLs, profile info, tokens)
 *   as required by Meta Platform Terms Section 3(d)(i)
 * - PRESERVES DM automation configs (user-created data, not Platform Data)
 *   but pauses them
 * - CLEARS pending queue items that can never be fulfilled (dm_queue,
 *   dm_followup_queue, email_collect_queue) since the account is being removed
 * - PAUSES global automations for the account so they don't fire if reconnected
 *   to a different account
 * - Scrubs Platform Data fields from connected_accounts row and deactivates it
 */

function createServiceClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const workspaceId = await getActiveWorkspaceId(supabase);
    if (!workspaceId) {
        return NextResponse.json({ error: 'No active workspace' }, { status: 400 });
    }

    let accountId;
    try {
        const body = await request.json();
        accountId = body.accountId;
    } catch {
        // No body
    }

    const db = createServiceClient();

    try {
        // 1. Find the account(s) to disconnect — scoped to active workspace
        let accountQuery = db
            .from('connected_accounts').select('id')
            .eq('workspace_id', workspaceId).eq('is_active', true);

        if (accountId) accountQuery = accountQuery.eq('id', accountId);

        const { data: accounts, error: findError } = await accountQuery;

        if (findError) {
            console.error('[Disconnect] Failed to find accounts:', findError);
            return NextResponse.json({ error: 'Failed to find accounts' }, { status: 500 });
        }

        const accountIds = (accounts || []).map((a) => a.id);

        if (accountIds.length === 0) {
            return NextResponse.json({ error: 'No active accounts found' }, { status: 404 });
        }

        // 2. Find all post IDs for these accounts
        const { data: posts } = await db
            .from('instagram_posts').select('id')
            .in('account_id', accountIds);
        const postIds = (posts || []).map((p) => p.id);

        // 2a. Meta-side ice-breakers cleanup BEFORE we scrub the tokens.
        //     Without this DELETE, the openers we pushed to messenger_profile
        //     keep rendering in the fan's Instagram inbox after disconnect.
        //     Best-effort — failure here doesn't block disconnect.
        const { data: accountsForCleanup } = await db
            .from('connected_accounts')
            .select('id, ig_user_id, fb_page_id, access_token, fb_page_access_token, default_config')
            .in('id', accountIds);
        for (const acc of (accountsForCleanup || [])) {
            const hasIceBreakers = Array.isArray(acc.default_config?.iceBreakers)
                && acc.default_config.iceBreakers.length > 0;
            if (!hasIceBreakers) continue;
            const token    = acc.fb_page_access_token || acc.access_token;
            const pageOrIg = acc.fb_page_id || acc.ig_user_id;
            const base     = acc.fb_page_access_token
                ? 'https://graph.facebook.com/v21.0'
                : 'https://graph.instagram.com/v21.0';
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
                    console.warn('[Disconnect] Meta ice_breakers DELETE failed for',
                        acc.id, ':', body.error?.message || res.status);
                } else {
                    console.log('[Disconnect] Meta ice_breakers cleared for', acc.id);
                }
            } catch (err) {
                console.warn('[Disconnect] Meta ice_breakers DELETE threw for',
                    acc.id, ':', err.message);
            }
        }

        // 3. PAUSE every dm_automation in THIS workspace. Previously this
        //    only paused post-bound rows via `.in('post_id', postIds)`, but
        //    post-less automations (DM Auto-Responder, Email Collector via
        //    DM, any-post Comment-to-DM) survived as `is_active=true` and
        //    could keep firing — or, after reconnect with a different
        //    platform, fire with a stale stored platform value. Pausing
        //    them all keeps the config (re-activate via the toggle) but
        //    stops execution until the user explicitly resumes. Scoped to
        //    the active workspace so disconnecting from one workspace
        //    doesn't pause automations in the user's other workspaces.
        await db.from('dm_automations')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('workspace_id', workspaceId);

        // 4. PAUSE all global automations for this account
        //    (keep the config — user may reconnect — but disable so they don't fire)
        await db.from('global_automations')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .in('account_id', accountIds);

        // 5. CLEAR pending queue items that can never be fulfilled
        //    — dm_queue: DMs waiting to be sent via this account's credentials
        await db.from('dm_queue')
            .delete()
            .in('account_id', accountIds)
            .in('status', ['pending', 'processing']);

        // 6. CLEAR in-flight gate flows
        //    — dm_followup_queue covers two gate states:
        //        'awaiting_confirmation' → follow-gate (user asked to follow first)
        //        'awaiting_opening_tap'  → opening-message button gate
        //      Both are partial-unique-indexed; leaving rows behind blocks the
        //      same (automation, recipient) pair from re-entering the flow on
        //      reconnect via PG 23505.
        await db.from('dm_followup_queue')
            .delete()
            .in('account_id', accountIds)
            .in('status', ['awaiting_confirmation', 'awaiting_opening_tap']);

        // 7. CLEAR in-flight email collection flows
        //    — email_collect_queue: users who were asked for their email but haven't replied
        await db.from('email_collect_queue')
            .delete()
            .in('account_id', accountIds)
            .eq('status', 'awaiting_email');

        // 8. DELETE Platform Data — posts fetched from Meta APIs
        const { error: deletePostsError } = await db
            .from('instagram_posts').delete().in('account_id', accountIds);

        if (deletePostsError) {
            console.error('[Disconnect] Failed to delete posts:', deletePostsError);
        }

        // 9. SCRUB Platform Data from connected_accounts and deactivate
        //    Preserves the row so user can reconnect; clears all Meta credentials
        const { error: scrubError } = await db
            .from('connected_accounts')
            .update({
                is_active:              false,
                access_token:           '',     // NOT NULL column — empty string
                fb_page_access_token:   null,
                ig_user_id:             null,
                ig_username:            null,
                ig_profile_picture_url: null,
                fb_page_id:             null,
                fb_page_name:           null,
                scopes:                 null,
                updated_at:             new Date().toISOString(),
            })
            .in('id', accountIds);

        if (scrubError) {
            console.error('[Disconnect] Failed to scrub account:', scrubError);
            return NextResponse.json({ error: 'Failed to deactivate account' }, { status: 500 });
        }

        console.log(
            `[Disconnect] ✅ Disconnected ${accountIds.length} account(s), ` +
            `deleted ${postIds.length} posts, cleared pending queue items`
        );

        return NextResponse.json({
            success: true,
            message: 'Account disconnected. Platform Data deleted per Meta policy. DM configs preserved but paused.',
            deletedPosts: postIds.length,
        });
    } catch (err) {
        console.error('[Disconnect] Error:', err);
        return NextResponse.json({ error: `Disconnect failed: ${err.message}` }, { status: 500 });
    }
}
