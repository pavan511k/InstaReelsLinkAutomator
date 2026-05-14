import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { GRAPH_FB_BASE, GRAPH_IG_BASE } from '@/lib/meta-graph';

/**
 * GET /api/accounts/resubscribe
 *
 * Browser-friendly diagnostic: queries Meta to see which webhook fields are
 * currently subscribed for each connected account. Use this to confirm
 * messaging_postbacks / messages are actually wired up before assuming the
 * handler is broken.
 *
 * Add `?force=1` to re-issue the subscribe POST for all accounts.
 */
export async function GET(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    if (searchParams.get('force') === '1') {
        // Reuse the POST path so behaviour stays consistent.
        return POST();
    }

    const db = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data: accounts } = await db
        .from('connected_accounts')
        .select('id, platform, ig_user_id, fb_page_id, access_token, fb_page_access_token, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);

    if (!accounts?.length) {
        return NextResponse.json({ error: 'No active accounts found' }, { status: 404 });
    }

    const results = [];
    for (const account of accounts) {
        try {
            let url, base;
            if (account.platform === 'instagram' && account.ig_user_id && account.access_token) {
                base = 'graph.instagram.com';
                url  = `${GRAPH_IG_BASE}/${account.ig_user_id}/subscribed_apps` +
                       `?access_token=${encodeURIComponent(account.access_token)}`;
            } else if (account.fb_page_id && account.fb_page_access_token) {
                base = 'graph.facebook.com';
                url  = `${GRAPH_FB_BASE}/${account.fb_page_id}/subscribed_apps` +
                       `?access_token=${encodeURIComponent(account.fb_page_access_token)}`;
            } else {
                results.push({ accountId: account.id, error: 'Missing token or id' });
                continue;
            }

            const res  = await fetch(url, { method: 'GET' });
            const data = await res.json();
            // Meta returns `{ data: [{ subscribed_fields: [...], name, link }] }`
            const fields = Array.isArray(data?.data)
                ? data.data.flatMap((app) => app.subscribed_fields || [])
                : [];
            results.push({
                accountId:        account.id,
                platform:         account.platform,
                base,
                igUserId:         account.ig_user_id,
                pageId:           account.fb_page_id,
                subscribedFields: fields,
                hasMessages:      fields.includes('messages'),
                hasPostbacks:     fields.includes('messaging_postbacks'),
                hasFeed:          fields.includes('feed'),
                hasComments:      fields.includes('comments') || fields.includes('instagram_comments'),
                raw:              data,
            });
        } catch (err) {
            results.push({ accountId: account.id, error: err.message });
        }
    }

    return NextResponse.json({
        hint: 'To force a resubscribe, hit this URL with ?force=1',
        results,
    });
}

/**
 * POST /api/accounts/resubscribe
 *
 * Re-subscribes all active connected accounts to Meta webhook events.
 * Useful for accounts that connected before subscribeToWebhookEvents() was
 * added to the OAuth callback, or after webhook configuration changes.
 *
 * Returns a per-account result so you can see which succeeded or failed.
 */
export async function POST() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data: accounts, error } = await db
        .from('connected_accounts')
        .select('id, platform, ig_user_id, fb_page_id, access_token, fb_page_access_token')
        .eq('user_id', user.id)
        .eq('is_active', true);

    if (error || !accounts?.length) {
        return NextResponse.json({ error: 'No active accounts found' }, { status: 404 });
    }

    const results = [];

    for (const account of accounts) {
        try {
            if (account.platform === 'instagram' && account.ig_user_id && account.access_token) {
                // Instagram Business Login — subscribe via graph.instagram.com
                // messaging_postbacks: required for button-template tap events
                // (follow-gate, opening-message, ice-breaker taps).
                const url =
                    `${GRAPH_IG_BASE}/${account.ig_user_id}/subscribed_apps` +
                    `?subscribed_fields=comments%2Cmessages%2Cmessaging_postbacks%2Cmentions` +
                    `&access_token=${encodeURIComponent(account.access_token)}`;
                const res  = await fetch(url, { method: 'POST' });
                const data = await res.json();
                results.push({
                    accountId: account.id,
                    platform:  'instagram',
                    igUserId:  account.ig_user_id,
                    success:   res.ok && data.success === true,
                    response:  data,
                });

            } else if (account.fb_page_id && account.fb_page_access_token) {
                // Facebook Login — subscribe the Page via graph.facebook.com
                const url =
                    `${GRAPH_FB_BASE}/${account.fb_page_id}/subscribed_apps` +
                    `?subscribed_fields=instagram_comments%2Cmessages%2Cmessaging_postbacks%2Cfeed` +
                    `&access_token=${encodeURIComponent(account.fb_page_access_token)}`;
                const res  = await fetch(url, { method: 'POST' });
                const data = await res.json();
                results.push({
                    accountId: account.id,
                    platform:  account.platform,
                    pageId:    account.fb_page_id,
                    success:   res.ok && data.success === true,
                    response:  data,
                });

            } else {
                results.push({
                    accountId: account.id,
                    platform:  account.platform,
                    success:   false,
                    response:  { error: 'Missing token or account ID' },
                });
            }
        } catch (err) {
            results.push({
                accountId: account.id,
                platform:  account.platform,
                success:   false,
                response:  { error: err.message },
            });
        }
    }

    const allOk = results.every((r) => r.success);
    console.log('[Resubscribe] Results:', JSON.stringify(results));

    return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 });
}
