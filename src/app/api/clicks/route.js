import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getUserEffectivePlan, requirePro } from '@/lib/plan-server';

/**
 * GET /api/clicks?automationId=xxx
 *
 * Returns click stats for a single automation including A/B breakdown
 * when the automation has abEnabled = true in its dm_config.
 */
export async function GET(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const automationId = searchParams.get('automationId');

    if (!automationId) {
        return NextResponse.json({ error: 'automationId is required' }, { status: 400 });
    }

    const plan = await getUserEffectivePlan(supabase, user.id);
    const gate = requirePro(plan, 'Click analytics require a Pro plan.');
    if (gate) return gate;

    try {
        // Verify automation belongs to user, fetch dm_config for A/B info
        const { data: automation } = await supabase
            .from('dm_automations')
            .select('id, dm_type, dm_config')
            .eq('id', automationId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (!automation) {
            return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
        }

        const isAB     = !!automation.dm_config?.abEnabled;
        const abWinner = automation.dm_config?.abWinner || null;

        // ── Fetch click events ──────────────────────────────────────
        const { data: events } = await supabase
            .from('click_events')
            .select('code, ip_hash, clicked_at')
            .eq('automation_id', automationId)
            .order('clicked_at', { ascending: false });

        // ── Fetch link codes (includes ab_variant) ─────────────────
        const { data: linkCodes } = await supabase
            .from('dm_link_codes')
            .select('code, original_url, ab_variant')
            .eq('automation_id', automationId);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

        const codeToUrl     = {};
        const codeToShort   = {};
        const codeToVariant = {};
        for (const lc of (linkCodes || [])) {
            codeToUrl[lc.code]     = lc.original_url;
            codeToShort[lc.code]   = `${appUrl}/r/${lc.code}`;
            codeToVariant[lc.code] = lc.ab_variant;
        }

        const allEvents    = events || [];
        const totalClicks  = allEvents.length;
        const uniqueClicks = new Set(allEvents.map((e) => e.ip_hash)).size;

        // ── Per-link breakdown ─────────────────────────────────────
        const linkMap = {};
        for (const ev of allEvents) {
            const url = codeToUrl[ev.code] || `[code: ${ev.code}]`;
            if (!linkMap[ev.code]) {
                linkMap[ev.code] = {
                    code:        ev.code,
                    originalUrl: url,
                    shortUrl:    codeToShort[ev.code] || '',
                    abVariant:   codeToVariant[ev.code] || null,
                    clicks:      0,
                };
            }
            linkMap[ev.code].clicks++;
        }
        const byLink = Object.values(linkMap).sort((a, b) => b.clicks - a.clicks);

        // ── Clicks by day (last 30 days) ───────────────────────────
        const dayMap   = {};
        const dayMapA  = {};
        const dayMapB  = {};
        const cutoff   = new Date();
        cutoff.setDate(cutoff.getDate() - 29);
        cutoff.setHours(0, 0, 0, 0);

        for (const ev of allEvents) {
            const d = new Date(ev.clicked_at);
            if (d < cutoff) continue;
            const key     = d.toISOString().split('T')[0];
            const variant = codeToVariant[ev.code];
            dayMap[key]   = (dayMap[key]  || 0) + 1;
            if (variant === 'A') dayMapA[key] = (dayMapA[key] || 0) + 1;
            if (variant === 'B') dayMapB[key] = (dayMapB[key] || 0) + 1;
        }

        const byDay = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const key   = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            byDay.push({
                date:    key,
                label,
                clicks:  dayMap[key]  || 0,
                clicksA: dayMapA[key] || 0,
                clicksB: dayMapB[key] || 0,
            });
        }

        // ── A/B stats ──────────────────────────────────────────────
        let abStats = null;
        if (isAB) {
            // Sends per variant from dm_sent_log
            const { data: sentRows } = await supabase
                .from('dm_sent_log')
                .select('ab_variant')
                .eq('automation_id', automationId)
                .in('ab_variant', ['A', 'B'])
                .eq('status', 'sent');

            const sendsA = (sentRows || []).filter((r) => r.ab_variant === 'A').length;
            const sendsB = (sentRows || []).filter((r) => r.ab_variant === 'B').length;

            // Clicks per variant
            let clicksA = 0, clicksB = 0;
            for (const ev of allEvents) {
                if (codeToVariant[ev.code] === 'A') clicksA++;
                if (codeToVariant[ev.code] === 'B') clicksB++;
            }

            const ctrA = sendsA > 0 ? Math.round((clicksA / sendsA) * 100) : 0;
            const ctrB = sendsB > 0 ? Math.round((clicksB / sendsB) * 100) : 0;

            const AB_MIN_SENDS = 50;
            const hasEnoughData = sendsA >= AB_MIN_SENDS && sendsB >= AB_MIN_SENDS;

            abStats = {
                isAB,
                winner:       abWinner,
                hasEnoughData,
                minSends:     AB_MIN_SENDS,
                variantA: {
                    sends:  sendsA,
                    clicks: clicksA,
                    ctr:    ctrA,
                },
                variantB: {
                    sends:  sendsB,
                    clicks: clicksB,
                    ctr:    ctrB,
                },
            };
        }

        return NextResponse.json({
            automationId,
            isAB,
            abStats,
            totalClicks,
            uniqueClicks,
            byLink,
            byDay,
        });

    } catch (err) {
        console.error('[Clicks API]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
