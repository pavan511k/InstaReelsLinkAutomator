export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const MONTHLY_DM_LIMIT = 1000;

/**
 * GET /api/usage
 * Returns the current user's DM usage for the current calendar month.
 * Used by the alerts gauge in Settings and potentially the dashboard.
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    try {
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

        const pct      = Math.round((count / MONTHLY_DM_LIMIT) * 100);
        const remaining = Math.max(0, MONTHLY_DM_LIMIT - count);

        return NextResponse.json({
            count,
            limit:     MONTHLY_DM_LIMIT,
            remaining,
            pct,
            month:     new Date().toISOString().slice(0, 7), // 'YYYY-MM'
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
