import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

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
                const url =
                    `https://graph.instagram.com/v21.0/${account.ig_user_id}/subscribed_apps` +
                    `?subscribed_fields=comments%2Cmessages%2Cmentions` +
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
                    `https://graph.facebook.com/v21.0/${account.fb_page_id}/subscribed_apps` +
                    `?subscribed_fields=instagram_comments%2Cmessages%2Cfeed` +
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
