import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendAutomatedDM } from '@/lib/send-dm';
import { getDmLimit, getEffectivePlan } from '@/lib/plans';
import { getMonthlyDmCount } from '@/lib/plan-server';

/**
 * GET /api/cron/sendback
 * External cron (cron-job.org) — runs every 1 hour.
 *
 * Retries DMs that failed on the first attempt. Per-row backoff between
 * retries: RETRY_BACKOFF_HOURS = [1, 4, 12] (hour granularity matches the
 * cron interval).
 */

const MAX_RETRIES         = 3;
const RETRY_BACKOFF_HOURS = [1, 4, 12];

function supabase() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

export async function GET(request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[Sendback] CRON_SECRET not configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = supabase();
    const results = { retried: 0, succeeded: 0, failed: 0, skipped: 0 };

    try {
        const now = new Date();
        const cutoffHours = RETRY_BACKOFF_HOURS[0];
        const cutoff = new Date(now.getTime() - cutoffHours * 3_600_000).toISOString();

        const { data: failedRows, error: fetchErr } = await db
            .from('dm_sent_log')
            .select('id, automation_id, recipient_ig_id, recipient_username, recipient_first_name, comment_id, comment_text, retry_count, last_retry_at, platform')
            .eq('status', 'failed')
            .lt('retry_count', MAX_RETRIES)
            .or(`last_retry_at.is.null,last_retry_at.lt.${cutoff}`)
            .order('sent_at', { ascending: true })
            .limit(100);

        if (fetchErr) {
            console.error('[SendBack] Failed to fetch failed DMs:', fetchErr.message);
            return NextResponse.json({ error: fetchErr.message }, { status: 500 });
        }

        if (!failedRows || failedRows.length === 0) {
            console.log('[SendBack] No retryable DMs found');
            return NextResponse.json({ ...results, message: 'No retryable DMs' });
        }

        console.log(`[SendBack] Found ${failedRows.length} retryable DMs`);

        for (const row of failedRows) {
            results.retried++;

            try {
                const retryNum   = row.retry_count;
                const backoffH   = RETRY_BACKOFF_HOURS[retryNum] || RETRY_BACKOFF_HOURS.at(-1);
                const earliestAt = row.last_retry_at
                    ? new Date(new Date(row.last_retry_at).getTime() + backoffH * 3_600_000)
                    : new Date(0);

                if (now < earliestAt) { results.skipped++; continue; }

                // Skip if already sent successfully
                const { data: successRow } = await db
                    .from('dm_sent_log').select('id')
                    .eq('automation_id', row.automation_id)
                    .eq('recipient_ig_id', row.recipient_ig_id)
                    .eq('status', 'sent').limit(1).maybeSingle();

                if (successRow) {
                    await db.from('dm_sent_log')
                        .update({ retry_count: MAX_RETRIES, last_retry_at: now.toISOString() })
                        .eq('id', row.id);
                    results.skipped++;
                    continue;
                }

                // Fetch automation + account credentials (no plan column).
                // platform column on connected_accounts is needed so we can
                // route the retry through the correct API base + sender ID.
                const { data: automation } = await db
                    .from('dm_automations')
                    .select('*, connected_accounts!inner(access_token, fb_page_access_token, ig_user_id, fb_page_id, platform)')
                    .eq('id', row.automation_id)
                    .eq('is_active', true)
                    .maybeSingle();

                if (!automation) {
                    await db.from('dm_sent_log')
                        .update({ retry_count: MAX_RETRIES, last_retry_at: now.toISOString() })
                        .eq('id', row.id);
                    results.skipped++;
                    continue;
                }

                // ── Monthly billing gate — plan from user_plans ───────────────
                const account  = automation.connected_accounts;
                const { data: userPlanRow } = await db
                    .from('user_plans').select('plan, plan_expires_at, trial_ends_at')
                    .eq('user_id', automation.user_id).maybeSingle();
                const userPlan = getEffectivePlan(userPlanRow);
                const dmLimit  = getDmLimit(userPlan);

                if (dmLimit !== null) {
                    const monthlyCount = await getMonthlyDmCount(db, automation.user_id);
                    if (monthlyCount >= dmLimit) {
                        console.log(`[SendBack] Monthly limit reached for user ${automation.user_id} — skipping`);
                        results.skipped++;
                        continue;
                    }
                }

                const token = account.fb_page_access_token || account.access_token;

                // Retry on the same platform as the original failed send.
                // The platform column on dm_sent_log gives us this directly;
                // pre-platform-column rows default to 'instagram'.
                const retryPlatform = row.platform || 'instagram';

                // Match process-queue's routing rules:
                //   - useIgApi = true when account has only an IG Business
                //     Login token; that token must hit graph.instagram.com.
                //   - For Facebook DMs the sender must be the FB Page ID,
                //     not the IG user ID — Meta returns 'invalid sender'
                //     otherwise.
                const useIgApi = !account.fb_page_access_token;
                const senderId = (retryPlatform === 'facebook' && account.fb_page_id)
                    ? account.fb_page_id
                    : account.ig_user_id;

                // Friendly fallback when recipient_username / first_name
                // weren't captured on the original send. Never use
                // recipient_ig_id here — it's a numeric IGSID and would
                // render as "Hey 178414012…!" in the message body.
                const usernameForRetry  = row.recipient_username || 'there';
                const firstNameForRetry = row.recipient_first_name || 'there';
                const context  = {
                    username:   usernameForRetry,
                    first_name: firstNameForRetry,
                    comment_id: row.comment_id || '',
                };

                await sendAutomatedDM(
                    automation,
                    row.recipient_ig_id,
                    token,
                    senderId,
                    context,
                    retryPlatform,
                    {},
                    userPlan,
                    useIgApi,
                );

                await db.from('dm_sent_log').insert({
                    automation_id:        row.automation_id,
                    post_id:              null,
                    recipient_ig_id:      row.recipient_ig_id,
                    recipient_username:   row.recipient_username,
                    recipient_first_name: row.recipient_first_name,
                    comment_id:           row.comment_id,
                    comment_text:         row.comment_text,
                    status:               'sent',
                    platform:             retryPlatform,
                    sent_at:              now.toISOString(),
                });

                await db.from('dm_sent_log')
                    .update({ retry_count: row.retry_count + 1, last_retry_at: now.toISOString() })
                    .eq('id', row.id);

                console.log(`[SendBack] ✅ Retry succeeded for ${row.recipient_ig_id} (automation ${row.automation_id})`);
                results.succeeded++;

            } catch (err) {
                console.error(`[SendBack] ❌ Retry failed for ${row.recipient_ig_id}:`, err.message);
                await db.from('dm_sent_log')
                    .update({
                        retry_count:   row.retry_count + 1,
                        last_retry_at: now.toISOString(),
                        error_message: err.message,
                    })
                    .eq('id', row.id);
                results.failed++;
            }
        }

        console.log('[SendBack] Run complete:', results);
        return NextResponse.json({ success: true, ...results });

    } catch (err) {
        console.error('[SendBack] Cron error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
