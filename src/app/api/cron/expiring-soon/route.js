import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendProExpiringEmail } from '@/lib/email';

/**
 * GET /api/cron/expiring-soon
 *
 * External cron (cron-job.org) — runs once per day.
 *
 * Finds users whose paid Pro subscription is within EXPIRING_WINDOW_DAYS of
 * expiry and sends them a renewal-reminder email — once per expiry value.
 *
 * Dedup: `user_plans.expiring_soon_emailed_for_expiry` stores the
 * `plan_expires_at` value at the time we emailed. If the user renews, their
 * plan_expires_at moves forward and the dedup naturally allows the next
 * reminder for the new expiry date.
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

    // Find candidates: paid plan, expiring within window, not yet emailed
    // (or emailed for a different expiry value, indicating they renewed
    // since we last emailed and we should remind again).
    const { data: candidates, error } = await supabase
        .from('user_plans')
        .select('user_id, plan, plan_expires_at, expiring_soon_emailed_for_expiry')
        .in('plan', ['pro', 'business'])
        .gt('plan_expires_at', now.toISOString())
        .lt('plan_expires_at', cutoff.toISOString())
        .limit(MAX_BATCH);

    if (error) {
        console.error('[ExpiringSoon] Lookup failed:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const due = (candidates || []).filter(
        (r) => r.expiring_soon_emailed_for_expiry !== r.plan_expires_at,
    );

    if (due.length === 0) {
        return NextResponse.json({ checked: candidates?.length || 0, sent: 0, skipped: 0, failed: 0 });
    }

    // Look up emails (auth.users) and any name we can find.
    // user_plans doesn't carry the email — we go through the auth admin API.
    const results = { checked: candidates.length, sent: 0, skipped: 0, failed: 0 };

    for (const row of due) {
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

            // Mark as emailed for THIS specific expiry value. Future renewals
            // will move plan_expires_at forward and the dedup check above
            // will allow another reminder.
            await supabase
                .from('user_plans')
                .update({ expiring_soon_emailed_for_expiry: row.plan_expires_at })
                .eq('user_id', row.user_id);

            results.sent++;
        } catch (err) {
            console.error(`[ExpiringSoon] Send failed for ${row.user_id}:`, err.message);
            results.failed++;
        }
    }

    console.log(`[ExpiringSoon] checked=${results.checked} sent=${results.sent} skipped=${results.skipped} failed=${results.failed}`);
    return NextResponse.json(results);
}
