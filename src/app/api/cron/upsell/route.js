import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getEffectivePlan } from '@/lib/plans';

/**
 * GET /api/cron/upsell
 * Runs every 6 hours (cron-job.org schedule).
 *
 * For each sent DM where:
 *   - The automation has upsell enabled (settings_config.upsell.enabled = true)
 *   - upsell_status IS NULL (never processed)
 *   - sent_at is older than upsell.delayHours ago
 *
 * → Skips recipients who already clicked (per-recipient attribution via
 *    `?r=<igsid>` appended at send time; see lib/click-tracking.js)
 * → Enqueues a follow-up DM in dm_queue with is_upsell=true
 * → Updates dm_sent_log.upsell_status = 'pending'
 */

function db() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

const DEFAULT_DELAY_HOURS = 24;
const BATCH_SIZE          = 200;

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        // Fail closed — never allow public invocation. cron-job.org passes
        // Authorization: Bearer <CRON_SECRET>. If the env var is missing,
        // this is a misconfiguration, not a free pass to the endpoint.
        console.error('[Upsell] CRON_SECRET not configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = db();
    const now      = new Date();
    const results  = { checked: 0, queued: 0, skipped: 0 };

    try {
        // Lower bound on sent_at: only fetch rows old enough that the shortest
        // configured delay could have elapsed. We don't know per-row delay
        // without reading the JSON, so we pre-filter at 1 hour (well below
        // the typical 24h default). Without this, freshly-sent rows starve
        // older eligible rows when the batch is sized at 200 + ASC ordering.
        const minAgeIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

        // ── Fetch sent DMs that haven't been through upsell processing ────
        // Join to dm_automations to get the upsell config and account info.
        const { data: sentRows, error: fetchErr } = await supabase
            .from('dm_sent_log')
            .select(`
                id, automation_id, recipient_ig_id, recipient_username, recipient_first_name,
                post_id, sent_at,
                dm_automations!inner(
                    id, user_id, settings_config, dm_type, dm_config,
                    connected_accounts!inner(id, access_token, ig_user_id)
                )
            `)
            .eq('status', 'sent')
            .is('upsell_status', null)
            .not('automation_id', 'is', null)
            .lt('sent_at', minAgeIso)
            .order('sent_at', { ascending: true })
            .limit(BATCH_SIZE);

        if (fetchErr) throw fetchErr;
        if (!sentRows || sentRows.length === 0) {
            return NextResponse.json({ ...results, message: 'No rows to process' });
        }

        for (const row of sentRows) {
            results.checked++;

            const automation = row.dm_automations;
            if (!automation) {
                await markUpsellStatus(supabase, row.id, 'skipped');
                results.skipped++;
                continue;
            }

            const upsellCfg = automation.settings_config?.upsell;

            // Skip if upsell not configured or not enabled
            if (!upsellCfg?.enabled || !upsellCfg?.message?.trim()) {
                await markUpsellStatus(supabase, row.id, 'skipped');
                results.skipped++;
                continue;
            }

            // Use ?? not || so a legit 0-hour delay isn't replaced by the default.
            const delayHours = upsellCfg.delayHours ?? DEFAULT_DELAY_HOURS;
            const eligibleAt = new Date(new Date(row.sent_at).getTime() + delayHours * 3_600_000);

            // Not yet old enough
            if (now < eligibleAt) {
                // Leave upsell_status null — we'll check again next run
                continue;
            }

            // ── Check if upsell already queued for this row ───────────────
            const { data: alreadyQueued } = await supabase
                .from('dm_queue')
                .select('id')
                .eq('automation_id', row.automation_id)
                .eq('recipient_ig_id', row.recipient_ig_id)
                .eq('is_upsell', true)
                .in('status', ['pending', 'processing', 'sent'])
                .limit(1)
                .maybeSingle();

            if (alreadyQueued) {
                await markUpsellStatus(supabase, row.id, 'pending');
                results.skipped++;
                continue;
            }

            // ── Click gate: skip recipients who already clicked ────────────
            // We attribute clicks per-recipient via the `?r=<igsid>` param
            // appended at send time (see lib/click-tracking.js / /r/[code]).
            // If we have a click row for this (automation, recipient), the
            // upsell is unnecessary — they already converted. Legacy DMs
            // without ?r= log NULL; those still upsell as before.
            const { data: clickedRow } = await supabase
                .from('click_events')
                .select('id')
                .eq('automation_id', row.automation_id)
                .eq('recipient_ig_id', row.recipient_ig_id)
                .limit(1)
                .maybeSingle();

            if (clickedRow) {
                await markUpsellStatus(supabase, row.id, 'skipped');
                results.skipped++;
                console.log(`[Upsell] ✋ Skipping ${row.recipient_ig_id} — already clicked`);
                continue;
            }

            // ── Resolve plan for this user ─────────────────────────────────
            const account = automation.connected_accounts;
            const { data: userPlanRow } = await supabase
                .from('user_plans').select('plan, plan_expires_at, trial_ends_at')
                .eq('user_id', automation.user_id).maybeSingle();
            const item_user_plan = getEffectivePlan(userPlanRow);

            // ── Pro-only gate ─────────────────────────────────────────────
            // Send-follow-up upsell is a Pro feature. If the user
            // downgraded after building the automation, mark these rows
            // skipped so we don't keep checking them every 6h.
            const planAllowsPro = item_user_plan === 'pro' || item_user_plan === 'business' || item_user_plan === 'trial';
            if (!planAllowsPro) {
                await markUpsellStatus(supabase, row.id, 'skipped');
                results.skipped++;
                console.log(`[Upsell] Skipping — user ${automation.user_id} is on ${item_user_plan}`);
                continue;
            }

            // ── Build upsell DM config ────────────────────────────────────
            const dmType  = upsellCfg.dmType  || 'message_template';
            const dmConfig = upsellCfg.dmConfig || { message: upsellCfg.message, type: dmType };
            // Ensure the type field is set inside dmConfig
            dmConfig.type = dmType;

            // ── Enqueue the upsell DM ─────────────────────────────────────
            const { error: insertErr } = await supabase.from('dm_queue').insert({
                user_id:              automation.user_id,
                account_id:           account.id,
                automation_id:        row.automation_id,
                post_id:              row.post_id,
                recipient_ig_id:      row.recipient_ig_id,
                recipient_username:   row.recipient_username,
                recipient_first_name: row.recipient_first_name,
                comment_id:           null,
                comment_text:         '[upsell]',
                platform:             'instagram',
                dm_type:              dmType,
                dm_config:            dmConfig,
                tracking_map:         {},
                user_plan:            item_user_plan,
                queue_reason:         'upsell',
                is_upsell:            true,
                source_log_id:        row.id,
                priority:             7,
                status:               'pending',
                scheduled_after:      now.toISOString(),
            });

            if (insertErr) {
                // Postgres unique-violation (idx_dm_queue_flow_upsell_dedup) — another
                // overlapping cron run beat us to it. Mark as pending (queue exists)
                // and continue.
                if (insertErr.code === '23505') {
                    await markUpsellStatus(supabase, row.id, 'pending');
                    results.skipped++;
                    continue;
                }
                // Other errors — mark skipped so we don't retry every 6 hours forever.
                console.error(`[Upsell] Failed to enqueue for ${row.recipient_ig_id} — marking skipped:`, insertErr.message);
                await markUpsellStatus(supabase, row.id, 'skipped');
                results.skipped++;
                continue;
            }

            await markUpsellStatus(supabase, row.id, 'pending');
            results.queued++;
            console.log(`[Upsell] ✅ Queued upsell for ${row.recipient_ig_id} (automation ${row.automation_id})`);
        }

        console.log('[Upsell] Run complete:', results);
        return NextResponse.json({ success: true, ...results });

    } catch (err) {
        console.error('[Upsell] Cron error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function markUpsellStatus(supabase, logId, status) {
    await supabase
        .from('dm_sent_log')
        .update({ upsell_status: status })
        .eq('id', logId);
}
