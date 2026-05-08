import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

/**
 * GET /api/automations/expire
 *
 * Cron endpoint — called hourly by Vercel.
 * Finds every active automation whose expires_at has passed
 * and sets is_active = false on all of them.
 *
 * Secured by CRON_SECRET env variable when set.
 */
export async function GET(request) {
    // Verify cron secret — fail closed if not configured
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[Expire] CRON_SECRET not configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();

    try {
        // Find all active automations that have passed their expiry date
        const { data: expired, error: fetchErr } = await supabase
            .from('dm_automations')
            .select('id, post_id, user_id, expires_at')
            .eq('is_active', true)
            .not('expires_at', 'is', null)
            .lte('expires_at', now);

        if (fetchErr) {
            console.error('[Expire Cron] Fetch error:', fetchErr.message);
            return NextResponse.json({ error: fetchErr.message }, { status: 500 });
        }

        if (!expired || expired.length === 0) {
            console.log('[Expire Cron] No expired automations found');
            return NextResponse.json({ expired: 0 });
        }

        const expiredIds = expired.map((a) => a.id);

        // Pause all of them in one update. Clear expires_at so the row
        // doesn't get auto-paused again on the next hourly sweep if the
        // user re-activates without updating the expiry date — mirrors
        // how /automations/activate clears scheduled_start_at on activation.
        const { error: updateErr } = await supabase
            .from('dm_automations')
            .update({
                is_active:  false,
                expires_at: null,
                updated_at: now,
            })
            .in('id', expiredIds);

        if (updateErr) {
            console.error('[Expire Cron] Update error:', updateErr.message);
            return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        console.log(`[Expire Cron] Paused ${expired.length} expired automation(s):`, expiredIds);
        return NextResponse.json({ expired: expired.length, ids: expiredIds });

    } catch (err) {
        console.error('[Expire Cron] Unexpected error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
