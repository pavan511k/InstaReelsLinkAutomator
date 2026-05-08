import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEffectivePlan, isProOrTrial } from '@/lib/plans';

function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

/**
 * GET /api/automations/activate
 *
 * Cron endpoint — called hourly by Vercel.
 * Finds every inactive automation whose scheduled_start_at has arrived
 * and activates them. Clears scheduled_start_at after activation so the
 * cron won't re-activate a subsequently-paused automation.
 *
 * Secured by CRON_SECRET env variable when set.
 */
export async function GET(request) {
    // Verify cron secret — fail closed if not configured
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[Activate] CRON_SECRET not configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();

    try {
        // Find all inactive automations whose scheduled start time has passed
        const { data: ready, error: fetchErr } = await supabase
            .from('dm_automations')
            .select('id, post_id, user_id, scheduled_start_at')
            .eq('is_active', false)
            .not('scheduled_start_at', 'is', null)
            .lte('scheduled_start_at', now);

        if (fetchErr) {
            console.error('[Activate Cron] Fetch error:', fetchErr.message);
            return NextResponse.json({ error: fetchErr.message }, { status: 500 });
        }

        if (!ready || ready.length === 0) {
            console.log('[Activate Cron] No automations ready to start');
            return NextResponse.json({ activated: 0 });
        }

        // ── Runtime Pro gate ─────────────────────────────────────────────
        // Schedule-start is a Pro feature. If a user was Pro when they saved
        // the schedule and has since downgraded to Free, we must NOT auto-
        // activate. We still clear scheduled_start_at on the row so the cron
        // doesn't keep retrying — they can manually activate from the UI.
        const userIds = [...new Set(ready.map((a) => a.user_id))];
        const { data: plans } = await supabase
            .from('user_plans')
            .select('user_id, plan, plan_expires_at, trial_ends_at')
            .in('user_id', userIds);
        const planByUser = new Map((plans || []).map((p) => [p.user_id, getEffectivePlan(p)]));

        const eligible = [];
        const skipped  = [];
        for (const row of ready) {
            const plan = planByUser.get(row.user_id) || 'free';
            if (isProOrTrial(plan)) eligible.push(row.id);
            else skipped.push(row.id);
        }

        // Clear scheduled_start_at on skipped rows so the cron stops retrying
        // them on every run — the user must take a manual action to enable.
        if (skipped.length > 0) {
            await supabase
                .from('dm_automations')
                .update({ scheduled_start_at: null, updated_at: now })
                .in('id', skipped);
            console.log(`[Activate Cron] Skipped ${skipped.length} non-Pro automation(s); cleared scheduled_start_at`);
        }

        if (eligible.length === 0) {
            return NextResponse.json({ activated: 0, skipped: skipped.length });
        }

        const readyIds = eligible;

        // Activate them and clear scheduled_start_at to prevent re-activation
        // if the user later manually pauses the automation
        const { error: updateErr } = await supabase
            .from('dm_automations')
            .update({
                is_active:          true,
                scheduled_start_at: null,   // cleared — activation is one-shot
                updated_at:         now,
            })
            .in('id', readyIds);

        if (updateErr) {
            console.error('[Activate Cron] Update error:', updateErr.message);
            return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        console.log(`[Activate Cron] Activated ${eligible.length} automation(s):`, readyIds);
        return NextResponse.json({ activated: eligible.length, skipped: skipped.length, ids: readyIds });

    } catch (err) {
        console.error('[Activate Cron] Unexpected error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
