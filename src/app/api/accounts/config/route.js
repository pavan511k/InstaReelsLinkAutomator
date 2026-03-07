export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/accounts/config
 * Get the default configuration for user's connected account
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
            .select('default_config')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .limit(1)
            .single();

        return NextResponse.json({
            config: account?.default_config || {},
        });
    } catch {
        return NextResponse.json({ config: {} });
    }
}

/**
 * POST /api/accounts/config
 * Save default configuration for a connected account
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, config } = body;

    if (!accountId || !config) {
        return NextResponse.json({ error: 'Account ID and config are required' }, { status: 400 });
    }

    try {
        const { error } = await supabase
            .from('connected_accounts')
            .update({
                default_config: config,
                updated_at: new Date().toISOString(),
            })
            .eq('id', accountId)
            .eq('user_id', user.id);

        if (error) {
            console.error('Failed to save config:', error);
            return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Config save error:', err);
        return NextResponse.json({ error: `Save failed: ${err.message}` }, { status: 500 });
    }
}
