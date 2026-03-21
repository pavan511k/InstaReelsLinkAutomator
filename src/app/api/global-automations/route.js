import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/global-automations
 * Returns all global automations for the authenticated user.
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    try {
        const { data, error } = await supabase
            .from('global_automations')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ automations: data || [] });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/global-automations
 * Create a new global automation — available on all plans
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const {
        accountId, name, dmType = 'message_template',
        dmConfig = {}, triggerConfig = {},
        sendOncePerUser = true, skipIfPostHasAutomation = true,
    } = body;

    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!triggerConfig.keywords?.length && triggerConfig.type !== 'all_comments') {
        return NextResponse.json({ error: 'At least one keyword is required (or use "all_comments" type)' }, { status: 400 });
    }

    try {
        // Verify account belongs to this user
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('id')
            .eq('id', accountId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

        const { data, error } = await supabase
            .from('global_automations')
            .insert({
                user_id:    user.id,
                account_id: accountId,
                name:       name.trim(),
                dm_type:    dmType,
                dm_config:  dmConfig,
                trigger_config:           triggerConfig,
                send_once_per_user:        sendOncePerUser,
                skip_if_post_has_automation: skipIfPostHasAutomation,
                is_active:  true,
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, automation: data });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * PATCH /api/global-automations
 * Update an existing global automation.
 * Body: { id, ...fields }
 */
export async function PATCH(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    // Map camelCase to snake_case
    const dbUpdates = {};
    if (updates.name          !== undefined) dbUpdates.name           = updates.name;
    if (updates.dmType        !== undefined) dbUpdates.dm_type        = updates.dmType;
    if (updates.dmConfig      !== undefined) dbUpdates.dm_config      = updates.dmConfig;
    if (updates.triggerConfig !== undefined) dbUpdates.trigger_config = updates.triggerConfig;
    if (updates.isActive      !== undefined) dbUpdates.is_active      = updates.isActive;
    if (updates.sendOncePerUser !== undefined) dbUpdates.send_once_per_user = updates.sendOncePerUser;
    if (updates.skipIfPostHasAutomation !== undefined) dbUpdates.skip_if_post_has_automation = updates.skipIfPostHasAutomation;
    dbUpdates.updated_at = new Date().toISOString();

    try {
        const { error } = await supabase
            .from('global_automations')
            .update(dbUpdates)
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * DELETE /api/global-automations?id=xxx
 * Delete a global automation.
 */
export async function DELETE(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    try {
        const { error } = await supabase
            .from('global_automations')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
