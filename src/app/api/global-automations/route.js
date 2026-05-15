import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getUserEffectivePlan, requirePro } from '@/lib/plan-server';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * GET /api/global-automations
 * Returns all global automations for the authenticated user.
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const workspaceId = await getActiveWorkspaceId(supabase);
    if (!workspaceId) return NextResponse.json({ automations: [] });

    try {
        const { data, error } = await supabase
            .from('global_automations')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ automations: data || [] });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/global-automations
 * Create a new global automation — Pro / Trial only.
 *
 * GET / PATCH / DELETE are intentionally NOT plan-gated so a user who
 * downgrades from Pro can still pause or remove their existing globals.
 * Runtime sends are blocked separately in the webhook (processGlobalTriggers).
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const workspaceId = await getActiveWorkspaceId(supabase);
    if (!workspaceId) return NextResponse.json({ error: 'No active workspace' }, { status: 400 });

    const plan = await getUserEffectivePlan(supabase, user.id);
    const gate = requirePro(plan, 'Global Triggers require a Pro plan.');
    if (gate) return gate;

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
        // Verify account belongs to this workspace
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('id')
            .eq('id', accountId)
            .eq('workspace_id', workspaceId)
            .maybeSingle();

        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

        const { data, error } = await supabase
            .from('global_automations')
            .insert({
                user_id:      user.id,
                workspace_id: workspaceId,
                account_id:   accountId,
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
    const workspaceId = await getActiveWorkspaceId(supabase);
    if (!workspaceId) return NextResponse.json({ error: 'No active workspace' }, { status: 400 });

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
            .eq('workspace_id', workspaceId);

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
    const workspaceId = await getActiveWorkspaceId(supabase);
    if (!workspaceId) return NextResponse.json({ error: 'No active workspace' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    try {
        const { error } = await supabase
            .from('global_automations')
            .delete()
            .eq('id', id)
            .eq('workspace_id', workspaceId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
