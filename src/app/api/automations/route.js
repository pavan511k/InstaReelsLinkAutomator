export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/automations
 * Create or update a DM automation for a post
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { postId, dmConfig, triggerConfig, settingsConfig } = body;

    // Validate required fields
    if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    if (!dmConfig || !triggerConfig) {
        return NextResponse.json({ error: 'DM and trigger configurations are required' }, { status: 400 });
    }

    if (!triggerConfig.keywords || triggerConfig.keywords.length === 0) {
        return NextResponse.json({ error: 'At least one trigger keyword is required' }, { status: 400 });
    }

    try {
        // Verify the post belongs to this user (via their connected accounts)
        const { data: post, error: postError } = await supabase
            .from('instagram_posts')
            .select('id, account_id, connected_accounts!inner(user_id)')
            .eq('id', postId)
            .single();

        if (postError || !post) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        if (post.connected_accounts.user_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Upsert the automation (one automation per post)
        const { data: automation, error: upsertError } = await supabase
            .from('dm_automations')
            .upsert({
                user_id: user.id,
                post_id: postId,
                dm_type: dmConfig.type,
                dm_config: dmConfig,
                trigger_config: triggerConfig,
                settings_config: settingsConfig || {},
                is_active: true,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'post_id',
            })
            .select()
            .single();

        if (upsertError) {
            console.error('Failed to save automation:', upsertError);
            return NextResponse.json({ error: 'Failed to save automation' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            automation: {
                id: automation.id,
                postId: automation.post_id,
                isActive: automation.is_active,
            },
        });
    } catch (err) {
        console.error('Automation save error:', err);
        return NextResponse.json({ error: `Save failed: ${err.message}` }, { status: 500 });
    }
}

/**
 * GET /api/automations
 * List user's DM automations
 */
export async function GET(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    try {
        let query = supabase
            .from('dm_automations')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (postId) {
            query = query.eq('post_id', postId);
        }

        const { data: automations, error } = await query;

        if (error) {
            console.error('Failed to fetch automations:', error);
            return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 });
        }

        return NextResponse.json({ automations: automations || [] });
    } catch (err) {
        console.error('Automations fetch error:', err);
        return NextResponse.json({ error: `Fetch failed: ${err.message}` }, { status: 500 });
    }
}

/**
 * DELETE /api/automations
 * Delete a DM automation
 */
export async function DELETE(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    try {
        const { error } = await supabase
            .from('dm_automations')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', user.id);

        if (error) {
            console.error('Failed to delete automation:', error);
            return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Automation delete error:', err);
        return NextResponse.json({ error: `Delete failed: ${err.message}` }, { status: 500 });
    }
}
