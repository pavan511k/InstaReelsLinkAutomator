import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendProExpiringEmail, sendTrialExpiringEmail } from '@/lib/email';

/**
 * GET /api/cron/expiring-soon
 *
 * External cron (cron-job.org) — runs once per day.
 *
 * Sends two kinds of expiry reminder, both within EXPIRING_WINDOW_DAYS:
 *   1. PAID: users on `pro` / `business` whose `plan_expires_at` is in window
 *      → `sendProExpiringEmail` (renewal reminder)
 *   2. TRIAL: users still on free who have an active `trial_ends_at` in window
 *      → `sendTrialExpiringEmail` (upgrade reminder; their Pro features stop
 *      firing the moment trial ends)
 *
 * Dedup: `user_plans.expiring_soon_emailed_for_expiry` stores the timestamp
 * we last emailed for. For paid users that's `plan_expires_at`; for trial
 * users it's `trial_ends_at`. The dedup naturally re-arms whenever either
 * timestamp moves forward (renewal / new trial).
 *
 * Cron-job.org config:
 *   URL: https://<your-domain>/api/cron/expiring-soon
 *   Method: GET
 *   Headers: Authorization: Bearer <CRON_SECRET>
 *   Schedule: daily, e.g. 09:00 IST (any time of day works — dedup means
 *             multiple runs in a day are safe)
 */

const EXPIRING_WINDOW_DAYS = 7;
const MAX_BATCH = 200;            // safety cap so a backlog can't fan out wildly

export async function GET(request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[ExpiringSoon] CRON_SECRET not configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const now      = new Date();
    const cutoff   = new Date(now);
    cutoff.setDate(cutoff.getDate() + EXPIRING_WINDOW_DAYS);

    const results = { checked: 0, sent: 0, skipped: 0, failed: 0 };

    // ── 1. PAID — pro/business subscriptions expiring within window ─────
    const { data: paidCandidates, error: paidErr } = await supabase
        .from('user_plans')
        .select('user_id, plan, plan_expires_at, expiring_soon_emailed_for_expiry')
        .in('plan', ['pro', 'business'])
        .gt('plan_expires_at', now.toISOString())
        .lt('plan_expires_at', cutoff.toISOString())
        .limit(MAX_BATCH);

    if (paidErr) {
        console.error('[ExpiringSoon] Paid lookup failed:', paidErr.message);
        return NextResponse.json({ error: paidErr.message }, { status: 500 });
    }

    const paidDue = (paidCandidates || []).filter(
        (r) => r.expiring_soon_emailed_for_expiry !== r.plan_expires_at,
    );
    results.checked += paidCandidates?.length || 0;

    for (const row of paidDue) {
        try {
            const { data: userResp, error: userErr } = await supabase.auth.admin.getUserById(row.user_id);
            if (userErr || !userResp?.user?.email) {
                results.skipped++;
                continue;
            }
            const email     = userResp.user.email;
            const name      = userResp.user.user_metadata?.full_name || null;
            const expiresAt = new Date(row.plan_expires_at);
            const daysLeft  = Math.max(1, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)));

            await sendProExpiringEmail({ to: email, name, daysLeft, expiresAt: row.plan_expires_at });

            await supabase
                .from('user_plans')
                .update({ expiring_soon_emailed_for_expiry: row.plan_expires_at })
                .eq('user_id', row.user_id);

            results.sent++;
        } catch (err) {
            console.error(`[ExpiringSoon] Paid send failed for ${row.user_id}:`, err.message);
            results.failed++;
        }
    }

    // ── 2. TRIAL — non-paid users with trial ending within window ───────
    // Only target users who haven't already converted to paid (plan ∈
    // ['free', null] — we don't want to email people who upgraded
    // mid-trial). Dedup uses the same column; since trial_ends_at and
    // plan_expires_at are different timestamps, there's no collision.
    const { data: trialCandidates, error: trialErr } = await supabase
        .from('user_plans')
        .select('user_id, plan, trial_ends_at, expiring_soon_emailed_for_expiry')
        .or('plan.eq.free,plan.is.null')
        .not('trial_ends_at', 'is', null)
        .gt('trial_ends_at', now.toISOString())
        .lt('trial_ends_at', cutoff.toISOString())
        .limit(MAX_BATCH);

    if (trialErr) {
        console.error('[ExpiringSoon] Trial lookup failed:', trialErr.message);
        // Paid emails already sent — don't fail the whole request.
        return NextResponse.json(results);
    }

    const trialDue = (trialCandidates || []).filter(
        (r) => r.expiring_soon_emailed_for_expiry !== r.trial_ends_at,
    );
    results.checked += trialCandidates?.length || 0;

    for (const row of trialDue) {
        try {
            const { data: userResp, error: userErr } = await supabase.auth.admin.getUserById(row.user_id);
            if (userErr || !userResp?.user?.email) {
                results.skipped++;
                continue;
            }
            const email     = userResp.user.email;
            const name      = userResp.user.user_metadata?.full_name || null;
            const trialEnds = new Date(row.trial_ends_at);
            const daysLeft  = Math.max(1, Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24)));

            await sendTrialExpiringEmail({ to: email, name, daysLeft, trialEndsAt: row.trial_ends_at });

            await supabase
                .from('user_plans')
                .update({ expiring_soon_emailed_for_expiry: row.trial_ends_at })
                .eq('user_id', row.user_id);

            results.sent++;
        } catch (err) {
            console.error(`[ExpiringSoon] Trial send failed for ${row.user_id}:`, err.message);
            results.failed++;
        }
    }

    console.log(`[ExpiringSoon] checked=${results.checked} sent=${results.sent} skipped=${results.skipped} failed=${results.failed}`);
    return NextResponse.json(results);
}
