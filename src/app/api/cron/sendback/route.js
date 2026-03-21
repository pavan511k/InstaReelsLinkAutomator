import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendAutomatedDM } from '@/lib/send-dm';
import { getDmLimit, getEffectivePlan } from '@/lib/plans';

/**
 * GET /api/cron/sendback
 * Vercel cron job — runs every 6 hours.
 * Retries DMs that failed on the first attempt.
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
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
            .select('id, automation_id, recipient_ig_id, comment_id, comment_text, retry_count, last_retry_at')
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

                // Fetch automation + account credentials (no plan column)
                const { data: automation } = await db
                    .from('dm_automations')
                    .select('*, connected_accounts!inner(access_token, fb_page_access_token, ig_user_id, fb_page_id)')
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
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

                    const { data: userAutomations } = await db
                        .from('dm_automations').select('id').eq('user_id', automation.user_id);
                    const allIds = (userAutomations || []).map((a) => a.id);

                    const { count: monthlyCount } = await db
                        .from('dm_sent_log').select('id', { count: 'exact', head: true })
                        .in('automation_id', allIds).eq('status', 'sent')
                        .gte('sent_at', startOfMonth.toISOString());

                    if ((monthlyCount || 0) >= dmLimit) {
                        console.log(`[SendBack] Monthly limit reached for user ${automation.user_id} — skipping`);
                        results.skipped++;
                        continue;
                    }
                }

                const token    = account.fb_page_access_token || account.access_token;
                const senderId = account.ig_user_id;
                const context  = {
                    username:   row.recipient_ig_id,
                    first_name: row.recipient_ig_id,
                    comment_id: row.comment_id || '',
                };

                await sendAutomatedDM(
                    automation,
                    row.recipient_ig_id,
                    token,
                    senderId,
                    context,
                    'instagram',
                    {},
                    userPlan,
                );

                await db.from('dm_sent_log').insert({
                    automation_id:   row.automation_id,
                    post_id:         null,
                    recipient_ig_id: row.recipient_ig_id,
                    comment_id:      row.comment_id,
                    comment_text:    row.comment_text,
                    status:          'sent',
                    sent_at:         now.toISOString(),
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
