import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getEffectivePlan } from '@/lib/plans';

/**
 * GET /api/cron/upsell
 * Runs every 6 hours.
 *
 * For each sent DM where:
 *   - The automation has upsell enabled (settings_config.upsell.enabled = true)
 *   - upsell_status IS NULL (never processed)
 *   - sent_at is older than upsell.delayHours ago
 *   - The recipient has NOT clicked any link from this automation
 *
 * → Enqueues an upsell DM in dm_queue with is_upsell=true
 * → Updates dm_sent_log.upsell_status = 'pending'
 *
 * If the recipient DID click → upsell_status = 'skipped' (no upsell needed)
 */

function db() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

const DEFAULT_DELAY_HOURS = 24;
const BATCH_SIZE          = 200;

export async function GET(request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = db();
    const now      = new Date();
    const results  = { checked: 0, queued: 0, skipped: 0 };

    try {
        // ── Fetch sent DMs that haven't been through upsell processing ────
        // Join to dm_automations to get the upsell config and account info.
        const { data: sentRows, error: fetchErr } = await supabase
            .from('dm_sent_log')
            .select(`
                id, automation_id, recipient_ig_id, post_id, sent_at,
                dm_automations!inner(
                    id, user_id, settings_config, dm_type, dm_config,
                    connected_accounts!inner(id, access_token, ig_user_id)
                )
            `)
            .eq('status', 'sent')
            .is('upsell_status', null)
            .not('automation_id', 'is', null)
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

            const delayHours = upsellCfg.delayHours || DEFAULT_DELAY_HOURS;
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

            // ── Resolve plan for this user ─────────────────────────────────
            const account = automation.connected_accounts;
            const { data: userPlanRow } = await supabase
                .from('user_plans').select('plan, plan_expires_at, trial_ends_at')
                .eq('user_id', automation.user_id).maybeSingle();
            const item_user_plan = getEffectivePlan(userPlanRow);

            // ── Build upsell DM config ────────────────────────────────────
            const dmType  = upsellCfg.dmType  || 'message_template';
            const dmConfig = upsellCfg.dmConfig || { message: upsellCfg.message, type: dmType };
            // Ensure the type field is set inside dmConfig
            dmConfig.type = dmType;

            // ── Enqueue the upsell DM ─────────────────────────────────────
            const { error: insertErr } = await supabase.from('dm_queue').insert({
                user_id:         automation.user_id,
                account_id:      account.id,
                automation_id:   row.automation_id,
                post_id:         row.post_id,
                recipient_ig_id: row.recipient_ig_id,
                comment_id:      null,
                comment_text:    '[upsell]',
                platform:        'instagram',
                dm_type:         dmType,
                dm_config:       dmConfig,
                tracking_map:    {},
                user_plan:       item_user_plan,
                queue_reason:    'upsell',
                is_upsell:       true,
                source_log_id:   row.id,
                priority:        7,
                status:          'pending',
                scheduled_after: now.toISOString(),
            });

            if (insertErr) {
                console.error(`[Upsell] Failed to enqueue for ${row.recipient_ig_id}:`, insertErr.message);
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
