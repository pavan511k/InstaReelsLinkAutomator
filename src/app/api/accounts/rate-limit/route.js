export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/accounts/rate-limit
 * Get the current rate limit for the user's connected account
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('rate_limit_per_hour')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .limit(1)
            .single();

        return NextResponse.json({
            rateLimitPerHour: account?.rate_limit_per_hour || 200,
        });
    } catch {
        return NextResponse.json({ rateLimitPerHour: 200 });
    }
}

/**
 * POST /api/accounts/rate-limit
 * Update the rate limit for a connected account
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, rateLimitPerHour } = body;

    if (!accountId || typeof rateLimitPerHour !== 'number') {
        return NextResponse.json({ error: 'Account ID and rate limit are required' }, { status: 400 });
    }

    if (rateLimitPerHour < 10 || rateLimitPerHour > 1000) {
        return NextResponse.json({ error: 'Rate limit must be between 10 and 1000' }, { status: 400 });
    }

    try {
        const { error } = await supabase
            .from('connected_accounts')
            .update({
                rate_limit_per_hour: rateLimitPerHour,
                updated_at: new Date().toISOString(),
            })
            .eq('id', accountId)
            .eq('user_id', user.id);

        if (error) {
            console.error('Failed to update rate limit:', error);
            return NextResponse.json({ error: 'Failed to update rate limit' }, { status: 500 });
        }

        return NextResponse.json({ success: true, rateLimitPerHour });
    } catch (err) {
        console.error('Rate limit update error:', err);
        return NextResponse.json({ error: `Update failed: ${err.message}` }, { status: 500 });
    }
}
