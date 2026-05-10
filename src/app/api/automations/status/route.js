import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/automations/status
 * Toggle the active/paused status of a DM automation
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { id, postId, isActive } = body;

    if ((!id && !postId) || typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'id (or postId) and isActive are required' }, { status: 400 });
    }

    // Prefer id when provided — it's unambiguous even when multiple
    // automations share a post (which the new builder allows).
    try {
        let q = supabase
            .from('dm_automations')
            .update({ is_active: isActive, updated_at: new Date().toISOString() })
            .eq('user_id', user.id);
        q = id ? q.eq('id', id) : q.eq('post_id', postId);

        const { data, error } = await q.select('is_active').single();

        if (error) {
            console.error('Failed to update automation status:', error);
            return NextResponse.json({ error: 'Failed to update automation status' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            isActive: data.is_active,
        });
    } catch (err) {
        console.error('Automation status update error:', err);
        return NextResponse.json({ error: `Status update failed: ${err.message}` }, { status: 500 });
    }
}
