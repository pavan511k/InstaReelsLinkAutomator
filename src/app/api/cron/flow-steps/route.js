import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getDmLimit, getEffectivePlan } from '@/lib/plans';

/**
 * GET /api/cron/flow-steps
 * Runs every hour.
 *
 * Processes multi-step DM flows. When an automation has
 * settings_config.flowSteps configured, each step sends a follow-up
 * DM to the same recipient after a configured delay.
 *
 * Flow step data structure (stored in settings_config.flowSteps):
 *   [
 *     { id: '...', message: 'Hey!', delayHours: 24 },  // step 1 — 24h after initial DM
 *     { id: '...', message: 'Last chance!', delayHours: 24 }, // step 2 — 24+24=48h after initial
 *   ]
 *
 * NOTE: delayHours is SEQUENTIAL — each step's delay is added to the previous cumulative total.
 * Step 1 fires at: initial_sent_at + step[0].delayHours
 * Step 2 fires at: initial_sent_at + step[0].delayHours + step[1].delayHours
 *
 * dm_sent_log.flow_step tracks progress:
 *   0   = initial DM was sent; next to process is flowSteps[0]
 *   1   = flowSteps[0] enqueued; next to process is flowSteps[1]
 *   null = sequence complete or not a flow automation
 */

const BATCH_SIZE = 300;

function db() {
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

    const supabase = db();
    const now      = new Date();
    const results  = { checked: 0, enqueued: 0, skipped: 0 };

    try {
        const { data: logRows, error: fetchErr } = await supabase
            .from('dm_sent_log')
            .select(`
                id, automation_id, recipient_ig_id, post_id, sent_at, flow_step,
                dm_automations!inner(
                    id, user_id, settings_config,
                    connected_accounts!inner(id, access_token, ig_user_id)
                )
            `)
            .eq('status', 'sent')
            .not('flow_step', 'is', null)
            .order('sent_at', { ascending: true })
            .limit(BATCH_SIZE);

        if (fetchErr) throw fetchErr;
        if (!logRows || logRows.length === 0) {
            return NextResponse.json({ ...results, message: 'No flow rows to process' });
        }

        for (const row of logRows) {
            results.checked++;

            const automation = row.dm_automations;
            if (!automation) { results.skipped++; continue; }

            const flowSteps = automation.settings_config?.flowSteps;
            if (!Array.isArray(flowSteps) || flowSteps.length === 0) {
                await supabase.from('dm_sent_log').update({ flow_step: null }).eq('id', row.id);
                results.skipped++;
                continue;
            }

            const nextStepIdx = row.flow_step ?? 0;

            if (nextStepIdx >= flowSteps.length) {
                await supabase.from('dm_sent_log').update({ flow_step: null }).eq('id', row.id);
                results.skipped++;
                continue;
            }

            const step = flowSteps[nextStepIdx];
            const stepDelayHours = step?.delayHours ?? step?.delay;
            if (!step?.message?.trim() || !stepDelayHours) { results.skipped++; continue; }

            // Cumulative delay — each step's delay is sequential from the initial send
            const cumulativeDelayHours = flowSteps
                .slice(0, nextStepIdx + 1)
                .reduce((sum, s) => sum + (s.delayHours ?? s.delay ?? 0), 0);

            const eligibleAt = new Date(
                new Date(row.sent_at).getTime() + cumulativeDelayHours * 3_600_000
            );

            if (now < eligibleAt) { results.skipped++; continue; }

            // Guard: don't double-enqueue — only block on in-flight items
            const { data: inFlight } = await supabase
                .from('dm_queue').select('id')
                .eq('source_log_id', row.id).eq('queue_reason', 'flow_step')
                .in('status', ['pending', 'processing']).maybeSingle();

            if (inFlight) { results.skipped++; continue; }

            // ── Billing gate — plan from user_plans ───────────────────────
            const account  = automation.connected_accounts;
            const { data: userPlanRow } = await supabase
                .from('user_plans').select('plan, plan_expires_at, trial_ends_at')
                .eq('user_id', automation.user_id).maybeSingle();
            const userPlan = getEffectivePlan(userPlanRow);
            const dmLimit  = getDmLimit(userPlan);

            if (dmLimit !== null) {
                const startOfMonth = new Date();
                startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

                const { data: autoIds } = await supabase
                    .from('dm_automations').select('id').eq('user_id', automation.user_id);
                const allIds = (autoIds || []).map((a) => a.id);

                const { count: monthlyCount } = await supabase
                    .from('dm_sent_log').select('id', { count: 'exact', head: true })
                    .in('automation_id', allIds).eq('status', 'sent')
                    .gte('sent_at', startOfMonth.toISOString());

                if ((monthlyCount || 0) >= dmLimit) {
                    console.log(`[FlowSteps] Monthly limit reached for user ${automation.user_id} — skipping`);
                    results.skipped++;
                    continue;
                }
            }

            const rawMessage = step.message
                .replace(/{first_name}/g, row.recipient_ig_id)
                .replace(/{username}/g, row.recipient_ig_id);

            const { error: insertErr } = await supabase.from('dm_queue').insert({
                user_id:         automation.user_id,
                account_id:      account.id,
                automation_id:   automation.id,
                post_id:         row.post_id,
                recipient_ig_id: row.recipient_ig_id,
                comment_id:      null,
                comment_text:    `[flow step ${nextStepIdx + 1}]`,
                platform:        'instagram',
                dm_type:         'message_template',
                dm_config:       { type: 'message_template', message: rawMessage },
                tracking_map:    {},
                user_plan:       userPlan,
                queue_reason:    'flow_step',
                is_upsell:       false,
                source_log_id:   row.id,
                priority:        6,
                status:          'pending',
                scheduled_after: now.toISOString(),
            });

            if (insertErr) {
                console.error(`[FlowSteps] Failed to enqueue step ${nextStepIdx + 1} for ${row.recipient_ig_id}:`, insertErr.message);
                results.skipped++;
                continue;
            }

            await supabase.from('dm_sent_log')
                .update({ flow_step: nextStepIdx + 1 }).eq('id', row.id);

            results.enqueued++;
            console.log(
                `[FlowSteps] ✅ Enqueued step ${nextStepIdx + 1}/${flowSteps.length}` +
                ` for ${row.recipient_ig_id}` +
                ` (fires ${cumulativeDelayHours}h after initial, automation ${automation.id})`
            );
        }

        console.log('[FlowSteps] Run complete:', results);
        return NextResponse.json({ success: true, ...results });

    } catch (err) {
        console.error('[FlowSteps] Cron error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
