import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendAutomatedDM } from '@/lib/send-dm';
import { getDmLimit, getEffectivePlan } from '@/lib/plans';

/**
 * GET /api/cron/process-queue
 * Drains the dm_queue at a controlled pace.
 * Runs every 5 minutes via Vercel cron.
 *
 * Per-account rate limiting:
 *   - Reads connected_accounts.rate_limit_per_hour (default 200)
 *   - Per 5-minute window budget = floor(rate_limit_per_hour / 12)
 *   - Counts items we've sent FOR THIS ACCOUNT in this cron run as the window counter
 *     (avoids an expensive cross-join query; good enough for the 5-min window)
 *
 * Processing order: priority ASC, created_at ASC (lower number = processed first)
 * Priority values: overflow=5, upsell=7, backfill=8
 */

const WINDOW_MINUTES = 5;
const MAX_ITEMS_PER_RUN = 200;
const MAX_ATTEMPTS = 3;

function db() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

export const maxDuration = 60;

export async function GET(request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = db();
    const now = new Date();
    const results = { processed: 0, sent: 0, failed: 0, skipped: 0, rateLimited: 0 };

    try {
        // ── Fetch pending items ready to process ──────────────────────────
        const { data: items, error: fetchErr } = await supabase
            .from('dm_queue')
            .select('*, connected_accounts!inner(access_token, fb_page_access_token, ig_user_id, fb_page_id, rate_limit_per_hour)')
            .eq('status', 'pending')
            .lte('scheduled_after', now.toISOString())
            .lt('attempts', MAX_ATTEMPTS)
            .order('priority', { ascending: true })
            .order('created_at', { ascending: true })
            .limit(MAX_ITEMS_PER_RUN);

        if (fetchErr) throw fetchErr;
        if (!items || items.length === 0) {
            return NextResponse.json({ ...results, message: 'Queue empty' });
        }

        console.log(`[Queue] Processing ${items.length} pending items`);

        // ── Group by account ──────────────────────────────────────────────
        const byAccount = {};
        for (const item of items) {
            if (!byAccount[item.account_id]) byAccount[item.account_id] = [];
            byAccount[item.account_id].push(item);
        }

        for (const [accountId, accountItems] of Object.entries(byAccount)) {
            const account      = accountItems[0].connected_accounts;
            const ratePerHour  = account.rate_limit_per_hour || 200;
            const windowsPerHour = 60 / WINDOW_MINUTES; // = 12
            const budgetThisWindow = Math.max(1, Math.floor(ratePerHour / windowsPerHour));

            // ── Monthly billing limit — plan from user_plans ───────────────
            const { data: userPlanRow } = await supabase
                .from('user_plans').select('plan, plan_expires_at, trial_ends_at')
                .eq('user_id', accountItems[0].user_id).maybeSingle();
            const userPlan = getEffectivePlan(userPlanRow);
            const dmLimit  = getDmLimit(userPlan);
            let monthlyUsed = 0;

            if (dmLimit !== null) {
                const startOfMonth = new Date();
                startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

                // Count by joining through dm_automations to scope to this account's user
                // Approximation: count by account_id directly on dm_queue (sent items this month)
                const { count } = await supabase
                    .from('dm_queue')
                    .select('id', { count: 'exact', head: true })
                    .eq('account_id', accountId)
                    .eq('status', 'sent')
                    .gte('processed_at', startOfMonth.toISOString());

                // Also count dm_sent_log for this account's automations
                const { data: accountAutomations } = await supabase
                    .from('dm_automations')
                    .select('id')
                    .eq('user_id', accountItems[0].user_id);
                const autoIds = (accountAutomations || []).map((a) => a.id);

                let logCount = 0;
                if (autoIds.length > 0) {
                    const { count: c } = await supabase
                        .from('dm_sent_log')
                        .select('id', { count: 'exact', head: true })
                        .in('automation_id', autoIds)
                        .eq('status', 'sent')
                        .gte('sent_at', startOfMonth.toISOString());
                    logCount = c || 0;
                }

                monthlyUsed = Math.max((count || 0), logCount);

                if (monthlyUsed >= dmLimit) {
                    console.log(`[Queue] Monthly limit reached for account ${accountId} — skipping all`);
                    await supabase
                        .from('dm_queue')
                        .update({ status: 'skipped', processed_at: now.toISOString() })
                        .in('id', accountItems.map((i) => i.id));
                    results.skipped += accountItems.length;
                    continue;
                }
            }

            // ── Process up to this window's budget ────────────────────────
            // Track sends in this run for this account (no extra DB query needed)
            let sentThisRun = 0;
            const toProcess = accountItems.slice(0, budgetThisWindow);

            const token    = account.fb_page_access_token || account.access_token;
            const igSender = account.ig_user_id;

            for (const item of toProcess) {
                if (sentThisRun >= budgetThisWindow) {
                    // Budget exhausted mid-account — defer remaining
                    results.rateLimited += (toProcess.length - sentThisRun);
                    break;
                }

                results.processed++;

                // Optimistic lock — only update if still pending
                const { error: lockErr } = await supabase
                    .from('dm_queue')
                    .update({ status: 'processing', attempts: item.attempts + 1 })
                    .eq('id', item.id)
                    .eq('status', 'pending');

                if (lockErr) {
                    console.warn(`[Queue] Failed to lock item ${item.id}:`, lockErr.message);
                    results.skipped++;
                    continue;
                }

                // Re-check monthly budget per item
                if (dmLimit !== null && monthlyUsed >= dmLimit) {
                    await supabase
                        .from('dm_queue')
                        .update({ status: 'skipped', processed_at: now.toISOString() })
                        .eq('id', item.id);
                    results.skipped++;
                    continue;
                }

                try {
                    const fakeAutomation = { dm_type: item.dm_type, dm_config: item.dm_config };
                    const trackingMap    = item.tracking_map || {};
                    const context        = {
                        username:   item.recipient_ig_id,
                        first_name: item.recipient_ig_id,
                        comment_id: item.comment_id || '',
                    };

                    await sendAutomatedDM(
                        fakeAutomation,
                        item.recipient_ig_id,
                        token,
                        igSender,
                        context,
                        item.platform || 'instagram',
                        trackingMap,
                        item.user_plan || 'free',
                    );

                    // Log the successful send.
                    // flow_step = 0 for initial DMs in flow automations (signals flow-steps cron to proceed)
                    // flow_step = N for subsequent steps
                    // flow_step = null for non-flow automations
                    let flowStepValue = null;
                    if (item.queue_reason === 'overflow' && item.automation_id) {
                        // Check if this automation has flow steps configured
                        try {
                            const { data: autoForFlow } = await supabase
                                .from('dm_automations').select('settings_config')
                                .eq('id', item.automation_id).maybeSingle();
                            const steps = autoForFlow?.settings_config?.flowSteps;
                            if (Array.isArray(steps) && steps.length > 0) flowStepValue = 0;
                        } catch { /* non-fatal */ }
                    } else if (item.flow_step_index != null) {
                        flowStepValue = item.flow_step_index;
                    }

                    await supabase.from('dm_sent_log').insert({
                        automation_id:   item.automation_id,
                        post_id:         item.post_id,
                        recipient_ig_id: item.recipient_ig_id,
                        comment_id:      item.comment_id,
                        comment_text:    item.comment_text,
                        status:          'sent',
                        flow_step:       flowStepValue,
                        sent_at:         now.toISOString(),
                    });

                    // Mark queue item done
                    await supabase
                        .from('dm_queue')
                        .update({ status: 'sent', processed_at: now.toISOString() })
                        .eq('id', item.id);

                    // Update source log when this was an upsell
                    if (item.is_upsell && item.source_log_id) {
                        await supabase.from('dm_sent_log').update({ upsell_status: 'sent' }).eq('id', item.source_log_id);
                    }

                    // Update source log when this was a flow step — advance flow_step counter
                    if (item.queue_reason === 'flow_step' && item.source_log_id && item.flow_step_index != null) {
                        await supabase.from('dm_sent_log').update({ flow_step: item.flow_step_index }).eq('id', item.source_log_id);
                    }

                    monthlyUsed++;
                    sentThisRun++;
                    results.sent++;
                    console.log(`[Queue] ✅ Sent to ${item.recipient_ig_id} (${item.queue_reason})`);

                } catch (err) {
                    console.error(`[Queue] ❌ Failed for ${item.recipient_ig_id}:`, err.message);

                    const newAttempts = item.attempts + 1;
                    const isFinal     = newAttempts >= MAX_ATTEMPTS;
                    const backoffMins = [15, 60, 240][Math.min(newAttempts - 1, 2)];

                    await supabase
                        .from('dm_queue')
                        .update({
                            status:          isFinal ? 'failed' : 'pending',
                            attempts:        newAttempts,
                            error_message:   err.message,
                            processed_at:    isFinal ? now.toISOString() : null,
                            scheduled_after: isFinal ? null
                                : new Date(now.getTime() + backoffMins * 60_000).toISOString(),
                        })
                        .eq('id', item.id);

                    results.failed++;
                }
            }

            // Items beyond budget stay as 'pending' for next cron run
            if (accountItems.length > toProcess.length) {
                results.rateLimited += accountItems.length - toProcess.length;
            }
        }

        console.log('[Queue] Run complete:', results);
        return NextResponse.json({ success: true, ...results });

    } catch (err) {
        console.error('[Queue] Cron error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
