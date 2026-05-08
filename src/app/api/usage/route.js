import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getEffectivePlan, getDmLimit } from '@/lib/plans';

/**
 * GET /api/usage
 * Returns the current user's DM usage for the current calendar month.
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    try {
        // Plan + cached monthly counter live on the same row.
        const { data: userPlan } = await supabase
            .from('user_plans')
            .select('plan, plan_expires_at, trial_ends_at, monthly_dm_count, dm_count_month')
            .eq('user_id', user.id)
            .maybeSingle();

        const effectivePlan = getEffectivePlan(userPlan);
        const dmLimit       = getDmLimit(effectivePlan);

        const currentMonth = new Date().toISOString().slice(0, 7);
        const count = userPlan?.dm_count_month === currentMonth
            ? (userPlan.monthly_dm_count || 0)
            : 0;

        const unlimited = dmLimit === null;
        const pct       = unlimited ? 0 : Math.round((count / dmLimit) * 100);
        const remaining  = unlimited ? null : Math.max(0, dmLimit - count);

        return NextResponse.json({
            count,
            limit:     dmLimit,
            unlimited,
            remaining,
            pct,
            plan:      effectivePlan,
            // Raw paid-pro expiry (null when on free or trial). Used by the
            // pricing page to disable re-purchase while a paid period is
            // active and to display the active-until date.
            planExpiresAt: userPlan?.plan_expires_at || null,
            month:     currentMonth,
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
