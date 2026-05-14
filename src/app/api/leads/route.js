import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getUserEffectivePlan, requirePro } from '@/lib/plan-server';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT     = 500;

/**
 * GET /api/leads?limit=100&offset=0
 * Returns email leads captured for the current user's automations,
 * ordered by most recent first. Paginated to keep payloads bounded.
 */
export async function GET(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const plan = await getUserEffectivePlan(supabase, user.id);
    const gate = requirePro(plan, 'Email Leads require a Pro plan.');
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const limit  = Math.min(parseInt(searchParams.get('limit')  || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    try {
        const { data: leads, error, count } = await supabase
            .from('email_leads')
            .select(
                'id, email, recipient_ig_id, recipient_first_name, recipient_username,' +
                ' confirmed_at, automation_id',
                { count: 'exact' },
            )
            .eq('user_id', user.id)
            .order('confirmed_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        return NextResponse.json({
            leads: leads || [],
            total: count ?? 0,
            limit,
            offset,
        });
    } catch (err) {
        console.error('[Leads] Fetch error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
