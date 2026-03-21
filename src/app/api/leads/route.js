import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getUserEffectivePlan, requirePro } from '@/lib/plan-server';

/**
 * GET /api/leads
 * Returns all email leads captured for the current user's automations,
 * ordered by most recent first.
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const plan = await getUserEffectivePlan(supabase, user.id);
    const gate = requirePro(plan, 'Email Leads require a Pro plan.');
    if (gate) return gate;

    try {
        const { data: leads, error } = await supabase
            .from('email_leads')
            .select('id, email, recipient_ig_id, confirmed_at, automation_id')
            .eq('user_id', user.id)
            .order('confirmed_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ leads: leads || [] });
    } catch (err) {
        console.error('[Leads] Fetch error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
