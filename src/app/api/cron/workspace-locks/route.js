import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { enforceWorkspaceLocks } from '@/lib/workspace-locks';

/**
 * GET /api/cron/workspace-locks
 *
 * External cron (cron-job.org) — daily sweep that reconciles every
 * user's workspaces.is_locked state against their current effective
 * plan. Catches:
 *   - Trial expirations (plan dropped from 'trial' → 'free' silently)
 *   - Paid subscription lapses (plan_expires_at passed)
 *   - Anything missed by the payment webhook (rare, but defensive)
 *
 * Sweep covers only users who own >1 workspace, since users with
 * exactly 1 workspace can never need locking (1 ≤ every plan's limit).
 *
 * Cron-job.org config:
 *   URL:        https://<your-domain>/api/cron/workspace-locks
 *   Method:     GET
 *   Headers:    Authorization: Bearer <CRON_SECRET>
 *   Schedule:   daily (any time)
 */
export async function GET(request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    // Find every user who owns more than one workspace. A single-workspace
    // user can never need locking (the workspace fits under any plan limit
    // of 1+). Pulled distinct owner_ids in a single query.
    const { data: rows, error } = await supabase
        .from('workspaces')
        .select('owner_id');
    if (error) {
        console.error('[CronLocks] Initial scan failed:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const counts = new Map();
    for (const r of (rows || [])) counts.set(r.owner_id, (counts.get(r.owner_id) || 0) + 1);
    const candidates = Array.from(counts.entries())
        .filter(([, c]) => c > 1)
        .map(([userId]) => userId);

    const results = { swept: 0, lockedCount: 0, unlockedCount: 0, errors: 0 };

    for (const userId of candidates) {
        try {
            const out = await enforceWorkspaceLocks(supabase, userId);
            results.swept += 1;
            results.lockedCount   += out.locked.length;
            results.unlockedCount += out.unlocked.length;
        } catch (err) {
            results.errors += 1;
            console.warn(`[CronLocks] enforce failed for ${userId}:`, err.message);
        }
    }

    console.log('[CronLocks] Done', results);
    return NextResponse.json({ success: true, ...results });
}
