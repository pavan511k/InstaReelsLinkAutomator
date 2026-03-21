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
        // Plan comes from user_plans — the single source of truth
        const { data: userPlan } = await supabase
            .from('user_plans')
            .select('plan, plan_expires_at, trial_ends_at')
            .eq('user_id', user.id)
            .maybeSingle();

        const effectivePlan = getEffectivePlan(userPlan);
        const dmLimit       = getDmLimit(effectivePlan);

        // All automation IDs for this user
        const { data: userAutomations } = await supabase
            .from('dm_automations')
            .select('id')
            .eq('user_id', user.id);

        const allIds = (userAutomations || []).map((a) => a.id);

        let count = 0;
        if (allIds.length > 0) {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const { count: monthlyCount } = await supabase
                .from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .in('automation_id', allIds)
                .eq('status', 'sent')
                .gte('sent_at', startOfMonth.toISOString());

            count = monthlyCount || 0;
        }

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
            month:     new Date().toISOString().slice(0, 7),
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
