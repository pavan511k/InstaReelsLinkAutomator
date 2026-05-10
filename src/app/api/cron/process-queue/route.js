import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendAutomatedDM } from '@/lib/send-dm';
import { getDmLimit, getEffectivePlan } from '@/lib/plans';
import { getMonthlyDmCount } from '@/lib/plan-server';

/**
 * GET /api/cron/process-queue
 * Drains the dm_queue at a controlled pace.
 * Runs every 1 minute via the external scheduler.
 *
 * Per-account rate limiting:
 *   - Reads connected_accounts.rate_limit_per_hour (default 200)
 *   - Per 1-minute window budget = max(1, floor(rate_limit_per_hour / 60))
 *   - Counts items we've sent FOR THIS ACCOUNT in this cron run as the window counter
 *     (avoids an expensive cross-join query; good enough for a 1-min window)
 *
 * Note: story-mention DMs are sent synchronously in the webhook and do NOT
 * pass through this queue, so the rate limit does not apply to them. Story
 * mentions are low-volume in practice and bounded by Meta's own per-account
 * messaging caps.
 *
 * Processing order: priority ASC, created_at ASC (lower number = processed first)
 * Priority values: overflow=5, upsell=7, backfill=8
 */

const WINDOW_MINUTES = 1;
const MAX_ITEMS_PER_RUN = 200;
const MAX_ATTEMPTS = 3;

// Rows stuck in 'processing' for longer than this are assumed to be from a
// crashed / killed cron run and get reset to 'pending' on the next sweep.
// `attempts` was already incremented when locking, so we don't bump it again
// — the row keeps its remaining retries.
const STUCK_PROCESSING_MINUTES = 5;

function db() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

export const maxDuration = 60;

export async function GET(request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[ProcessQueue] CRON_SECRET not configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = db();
    const now = new Date();
    const results = { processed: 0, sent: 0, failed: 0, skipped: 0, rateLimited: 0, recovered: 0 };

    try {
        // ── Recover stuck 'processing' rows from a crashed prior run ──────
        // Healthy rows leave 'processing' within seconds. Anything stuck
        // there for several minutes is from a killed cron lambda. We use
        // created_at as a coarse proxy since dm_queue has no updated_at
        // column — this is fine because rows freshly created and immediately
        // locked will still pass this filter on a later sweep.
        const stuckCutoff = new Date(now.getTime() - STUCK_PROCESSING_MINUTES * 60_000).toISOString();
        const { data: recovered } = await supabase
            .from('dm_queue')
            .update({ status: 'pending' })
            .eq('status', 'processing')
            .lt('created_at', stuckCutoff)
            .select('id');
        if (recovered?.length) {
            results.recovered = recovered.length;
            console.log(`[Queue] Recovered ${recovered.length} stuck 'processing' rows`);
        }

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

        // ── Pre-fetch flow-step flags for all automations in this batch ──
        // The previous code ran a SELECT on `dm_automations` per successfully
        // sent overflow item just to read `settings_config.flowSteps` and
        // decide if `flow_step` should be 0. On a 200-item batch with mixed
        // automations that's up to 200 round-trips. Single batched lookup
        // here, served by the existing PK-on-id index → one query, O(distinct
        // automation count). Result is a Set of automation IDs that have
        // flow steps configured; lookup inside the loop is now O(1).
        const flowAutoIds = new Set();
        const overflowAutoIds = [
            ...new Set(
                items
                    .filter((it) => it.queue_reason === 'overflow' && it.automation_id)
                    .map((it) => it.automation_id),
            ),
        ];
        if (overflowAutoIds.length > 0) {
            try {
                const { data: autos } = await supabase
                    .from('dm_automations')
                    .select('id, settings_config')
                    .in('id', overflowAutoIds);
                for (const a of (autos || [])) {
                    const steps = a.settings_config?.flowSteps;
                    if (Array.isArray(steps) && steps.length > 0) flowAutoIds.add(a.id);
                }
            } catch { /* non-fatal — fall through and items just won't get flow_step=0 */ }
        }

        // ── Group by account ──────────────────────────────────────────────
        const byAccount = {};
        for (const item of items) {
            if (!byAccount[item.account_id]) byAccount[item.account_id] = [];
            byAccount[item.account_id].push(item);
        }

        for (const [accountId, accountItems] of Object.entries(byAccount)) {
            const account      = accountItems[0].connected_accounts;
            const ratePerHour  = account.rate_limit_per_hour || 200;
            const windowsPerHour = 60 / WINDOW_MINUTES; // = 60
            const budgetThisWindow = Math.max(1, Math.floor(ratePerHour / windowsPerHour));

            // ── Monthly billing limit — plan from user_plans ───────────────
            const { data: userPlanRow } = await supabase
                .from('user_plans').select('plan, plan_expires_at, trial_ends_at')
                .eq('user_id', accountItems[0].user_id).maybeSingle();
            const userPlan = getEffectivePlan(userPlanRow);
            const dmLimit  = getDmLimit(userPlan);
            let monthlyUsed = 0;

            if (dmLimit !== null) {
                monthlyUsed = await getMonthlyDmCount(supabase, accountItems[0].user_id);

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
            // Instagram Business Login tokens must use graph.instagram.com for DM sending
            const useIgApi = !account.fb_page_access_token;

            // Debug-only routing trace — gated so the cron logs aren't
            // noisy every minute. Set DEBUG_QUEUE=1 in env to re-enable
            // when troubleshooting IG vs FB token routing.
            if (process.env.DEBUG_QUEUE) {
                console.log(`[Queue:debug] account=${accountId} ig_user_id=${account.ig_user_id} fb_page_id=${account.fb_page_id || 'none'} has_fb_token=${!!account.fb_page_access_token} useIgApi=${useIgApi}`);
            }

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
                    // Use the captured username when available; fall back to a
                    // friendly 'there' so we never substitute the numeric IGSID
                    // into a user-facing message ("Hey 17841405...").
                    // {first_name} prefers the fetched display-name first word
                    // (recipient_first_name), then the username, then 'there'.
                    const usernameForCtx  = item.recipient_username || 'there';
                    const firstNameForCtx = item.recipient_first_name || 'there';
                    const context  = {
                        username:   usernameForCtx,
                        first_name: firstNameForCtx,
                        comment_id: item.comment_id || '',
                    };

                    // Facebook DMs must be sent FROM the Page ID, not the IG user ID.
                    // Instagram DMs use ig_user_id as the sender.
                    const senderForItem = (item.platform === 'facebook' && account.fb_page_id)
                        ? account.fb_page_id
                        : account.ig_user_id;

                    // Per-item routing trace — same DEBUG_QUEUE gate.
                    if (process.env.DEBUG_QUEUE) {
                        console.log(`[Queue:debug] sending → platform=${item.platform || 'instagram'} sender=${senderForItem} recipient=${item.recipient_ig_id} dm_type=${item.dm_type} useIgApi=${useIgApi}`);
                    }

                    await sendAutomatedDM(
                        fakeAutomation,
                        item.recipient_ig_id,
                        token,
                        senderForItem,
                        context,
                        item.platform || 'instagram',
                        trackingMap,
                        item.user_plan || 'free',
                        useIgApi,
                    );

                    // Log the successful send.
                    // flow_step = 0 for initial DMs in flow automations (signals flow-steps cron to proceed)
                    // flow_step = N for subsequent steps
                    // flow_step = null for non-flow automations
                    let flowStepValue = null;
                    if (item.queue_reason === 'overflow' && item.automation_id) {
                        // O(1) lookup against the Set we built once per batch
                        // (replaces the per-item SELECT that was here before).
                        if (flowAutoIds.has(item.automation_id)) flowStepValue = 0;
                    } else if (item.flow_step_index != null) {
                        flowStepValue = item.flow_step_index;
                    }

                    await supabase.from('dm_sent_log').insert({
                        automation_id:        item.automation_id,
                        post_id:              item.post_id,
                        recipient_ig_id:      item.recipient_ig_id,
                        recipient_username:   item.recipient_username,
                        recipient_first_name: item.recipient_first_name,
                        comment_id:           item.comment_id,
                        comment_text:         item.comment_text,
                        status:               'sent',
                        flow_step:            flowStepValue,
                        platform:             item.platform || 'instagram',
                        sent_at:              now.toISOString(),
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
