import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/accounts/disconnect
 * Removes the connected account for the current user
 */
export async function POST() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { error } = await supabase
        .from('connected_accounts')
        .delete()
        .eq('user_id', user.id);

    if (error) {
        console.error('Failed to disconnect account:', error);
        return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
