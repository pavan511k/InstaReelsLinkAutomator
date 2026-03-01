import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/accounts/disconnect
 * Soft-disconnect: clears token and sets is_active = false
 * Posts and automations are preserved for reconnection
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let accountId;
    try {
        const body = await request.json();
        accountId = body.accountId;
    } catch {
        // No body provided
    }

    // Build the update query
    let query = supabase
        .from('connected_accounts')
        .update({
            is_active: false,
            access_token: 'revoked',
            fb_page_access_token: null,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

    // If specific account ID provided, disconnect only that one
    if (accountId) {
        query = query.eq('id', accountId);
    }

    const { error } = await query;

    if (error) {
        console.error('Failed to disconnect account:', error);
        return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Account disconnected. Your posts and automations are preserved.' });
}
