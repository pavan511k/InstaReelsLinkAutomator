import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/automations/duplicate
 * Body: { sourcePostId, targetPostId }
 *
 * Copies dm_config, trigger_config, settings_config from the source
 * automation to a new automation on the target post.
 * The duplicate starts as is_active: false so the user can review
 * before going live.
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { sourcePostId, targetPostId } = body;

    if (!sourcePostId || !targetPostId) {
        return NextResponse.json({ error: 'sourcePostId and targetPostId are required' }, { status: 400 });
    }

    if (sourcePostId === targetPostId) {
        return NextResponse.json({ error: 'Source and target post cannot be the same' }, { status: 400 });
    }

    try {
        // 1. Fetch the source automation — must belong to this user
        const { data: source, error: sourceErr } = await supabase
            .from('dm_automations')
            .select('dm_type, dm_config, trigger_config, settings_config')
            .eq('post_id', sourcePostId)
            .eq('user_id', user.id)
            .single();

        if (sourceErr || !source) {
            return NextResponse.json({ error: 'Source automation not found' }, { status: 404 });
        }

        // 2. Verify the target post belongs to this user
        const { data: targetPost, error: targetErr } = await supabase
            .from('instagram_posts')
            .select('id, connected_accounts!inner(user_id)')
            .eq('id', targetPostId)
            .single();

        if (targetErr || !targetPost) {
            return NextResponse.json({ error: 'Target post not found' }, { status: 404 });
        }

        if (targetPost.connected_accounts.user_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // 3. Check the target post doesn't already have an automation
        const { data: existing } = await supabase
            .from('dm_automations')
            .select('id')
            .eq('post_id', targetPostId)
            .maybeSingle();

        if (existing) {
            return NextResponse.json(
                { error: 'Target post already has an automation. Edit it instead.' },
                { status: 409 },
            );
        }

        // 4. Write the duplicate — starts paused (is_active: false)
        const { data: newAuto, error: insertErr } = await supabase
            .from('dm_automations')
            .insert({
                user_id:        user.id,
                post_id:        targetPostId,
                dm_type:        source.dm_type,
                dm_config:      source.dm_config,
                trigger_config: source.trigger_config,
                settings_config: source.settings_config || {},
                is_active:      false, // starts paused — user reviews before activating
                updated_at:     new Date().toISOString(),
            })
            .select('id, post_id')
            .single();

        if (insertErr) {
            console.error('[Duplicate] Insert failed:', insertErr);
            return NextResponse.json({ error: 'Failed to duplicate automation' }, { status: 500 });
        }

        return NextResponse.json({ success: true, automationId: newAuto.id, postId: newAuto.post_id });

    } catch (err) {
        console.error('[Duplicate] Error:', err);
        return NextResponse.json({ error: `Duplicate failed: ${err.message}` }, { status: 500 });
    }
}
