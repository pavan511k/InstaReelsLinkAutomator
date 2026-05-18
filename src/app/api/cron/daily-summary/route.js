import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendPushToUser } from '@/lib/push-sender';

/**
 * GET /api/cron/daily-summary
 * Run once per day (cron-job.org schedule, typically 08:00 UTC).
 *
 * For every user with a registered Expo push token, count yesterday's
 * activity (DMs sent + leads captured) and fire a single "yesterday
 * in AutoDM" push. Users with no activity are silently skipped so the
 * notification never feels like noise.
 *
 * Bearer auth via Authorization: Bearer ${CRON_SECRET} (same as every
 * other cron route).
 *
 * No state tracking: the cron schedule is the dedup mechanism. A
 * manual second invocation in the same day will double-push — that's
 * the cost of skipping a `last_daily_summary_at` column. For our
 * scale, acceptable.
 */

export const dynamic = 'force-dynamic';

function db() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

export async function GET(request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[DailySummary] CRON_SECRET not configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = db();
    const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const results = { checked: 0, pushed: 0, skipped: 0 };

    try {
        // Pull distinct user_ids that have at least one push token. Only
        // mobile-installed users get the summary; everyone else doesn't
        // have a device to push to anyway.
        const { data: tokenRows, error } = await admin
            .from('expo_push_tokens')
            .select('user_id');
        if (error) {
            console.error('[DailySummary] Failed to fetch tokens:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const uniqueUserIds = [...new Set((tokenRows ?? []).map((r) => r.user_id))];

        for (const userId of uniqueUserIds) {
            results.checked++;

            const [leadsRes, dmsRes] = await Promise.all([
                admin.from('email_leads').select('id', { count: 'exact', head: true })
                    .eq('user_id', userId).gte('confirmed_at', yesterdayIso),
                admin.from('dm_sent_log').select('id', { count: 'exact', head: true })
                    .eq('user_id', userId).eq('status', 'sent').gte('sent_at', yesterdayIso),
            ]);
            const leads = leadsRes.count ?? 0;
            const dms   = dmsRes.count   ?? 0;

            // Quiet day — skip rather than send a "0 DMs sent" push.
            if (leads === 0 && dms === 0) {
                results.skipped++;
                continue;
            }

            const body = leads > 0
                ? `${dms} DM${dms === 1 ? '' : 's'} sent · ${leads} new lead${leads === 1 ? '' : 's'} captured`
                : `${dms} DM${dms === 1 ? '' : 's'} sent yesterday`;

            await sendPushToUser(userId, {
                title: '📊 Yesterday in AutoDM',
                body,
                data: { kind: 'daily_summary' },
            });
            results.pushed++;
        }

        console.log('[DailySummary]', results);
        return NextResponse.json({ success: true, ...results });
    } catch (err) {
        console.error('[DailySummary] Fatal:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
