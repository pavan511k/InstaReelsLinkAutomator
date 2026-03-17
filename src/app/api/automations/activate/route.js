import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const auth = request.headers.get('authorization');
        if (auth !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
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

        const readyIds = ready.map((a) => a.id);

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

        console.log(`[Activate Cron] Activated ${ready.length} automation(s):`, readyIds);
        return NextResponse.json({ activated: ready.length, ids: readyIds });

    } catch (err) {
        console.error('[Activate Cron] Unexpected error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
