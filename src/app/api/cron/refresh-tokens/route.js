import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { refreshInstagramToken } from '@/lib/meta-oauth';
import { sendReconnectRequiredEmail } from '@/lib/email';

/**
 * GET /api/cron/refresh-tokens
 *
 * External cron (cron-job.org) — runs once per day.
 *
 * Instagram long-lived tokens last 60 days. This job renews active IG
 * connections whose token expires within REFRESH_WINDOW_DAYS via the
 * ig_refresh_token grant, so automations never silently die at the 60-day
 * mark. If a token can't be renewed (already expired / permission revoked) and
 * it's actually running low, we email the owner ONCE to reconnect — deduped via
 * `connected_accounts.token_expiry_notified_at`, which is re-armed (set NULL)
 * on the next successful refresh.
 *
 * Facebook is intentionally skipped: Page access tokens derived from a
 * long-lived user token don't expire the same way (and FB connect is gated),
 * so refreshing them here would only produce false "reconnect" alarms.
 *
 * Cron-job.org config:
 *   URL: https://<your-domain>/api/cron/refresh-tokens
 *   Method: GET
 *   Headers: Authorization: Bearer <CRON_SECRET>
 *   Schedule: daily (dedup + idempotent refresh make repeat runs safe)
 */

export const maxDuration = 60;

const REFRESH_WINDOW_DAYS = 10;   // renew once the token is within this many days of expiry
const WARN_WITHIN_DAYS    = 3;    // only warn-to-reconnect when this close (or already expired)
const IG_TOKEN_TTL_SEC    = 60 * 24 * 60 * 60; // 60 days — fallback if Meta omits expires_in
const MAX_BATCH           = 200;
const DAY_MS              = 24 * 60 * 60 * 1000;

export async function GET(request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[RefreshTokens] CRON_SECRET not configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const now    = new Date();
    const cutoff = new Date(now.getTime() + REFRESH_WINDOW_DAYS * DAY_MS);

    // Active Instagram (IG Business Login) accounts whose token is expiring
    // soon or already expired. FB Page rows use fb_page_access_token and are
    // intentionally skipped (see the header note).
    const { data: accounts, error } = await supabase
        .from('connected_accounts')
        .select('id, user_id, ig_username, access_token, token_expires_at, token_expiry_notified_at')
        .eq('is_active', true)
        .eq('platform', 'instagram')
        .neq('access_token', '')
        .not('token_expires_at', 'is', null)
        .lt('token_expires_at', cutoff.toISOString())
        .limit(MAX_BATCH);

    if (error) {
        console.error('[RefreshTokens] Lookup failed:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = { checked: accounts?.length || 0, refreshed: 0, warned: 0, skipped: 0, failed: 0 };

    for (const acct of (accounts || [])) {
        const daysLeft = (new Date(acct.token_expires_at) - now) / DAY_MS;

        // Try to renew while the token is still valid — an expired token can't
        // be refreshed.
        if (daysLeft > 0) {
            try {
                const refreshed = await refreshInstagramToken(acct.access_token);
                if (refreshed?.access_token) {
                    const newExpiry = new Date(now.getTime() + (refreshed.expires_in || IG_TOKEN_TTL_SEC) * 1000);
                    await supabase
                        .from('connected_accounts')
                        .update({
                            access_token:             refreshed.access_token,
                            token_expires_at:         newExpiry.toISOString(),
                            token_expiry_notified_at: null, // healthy again — re-arm warnings
                            updated_at:               new Date().toISOString(),
                        })
                        .eq('id', acct.id);
                    results.refreshed++;
                    continue;
                }
            } catch (err) {
                console.warn(`[RefreshTokens] Refresh failed for account ${acct.id}:`, err.message);
                // fall through to the maybe-warn logic below
            }
        }

        // Refresh wasn't possible (expired) or failed. Only warn when we're
        // genuinely running low, and only once — so a transient failure with
        // runway left just retries tomorrow, and we never spam the user.
        if (daysLeft <= WARN_WITHIN_DAYS && !acct.token_expiry_notified_at) {
            try {
                const { data: userResp } = await supabase.auth.admin.getUserById(acct.user_id);
                const email = userResp?.user?.email;
                if (!email) { results.skipped++; continue; }

                await sendReconnectRequiredEmail({
                    to:       email,
                    name:     userResp.user.user_metadata?.full_name || null,
                    platform: 'Instagram',
                    handle:   acct.ig_username || '',
                });

                await supabase
                    .from('connected_accounts')
                    .update({ token_expiry_notified_at: new Date().toISOString() })
                    .eq('id', acct.id);

                results.warned++;
            } catch (err) {
                console.error(`[RefreshTokens] Warn email failed for account ${acct.id}:`, err.message);
                results.failed++;
            }
        } else {
            results.skipped++;
        }
    }

    console.log(`[RefreshTokens] checked=${results.checked} refreshed=${results.refreshed} warned=${results.warned} skipped=${results.skipped} failed=${results.failed}`);
    return NextResponse.json(results);
}
