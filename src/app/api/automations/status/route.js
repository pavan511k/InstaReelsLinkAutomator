import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

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
    const workspaceId = await getActiveWorkspaceId(supabase);
    if (!workspaceId) {
        return NextResponse.json({ error: 'No active workspace' }, { status: 400 });
    }

    const body = await request.json();
    const { id, postId, isActive } = body;

    if ((!id && !postId) || typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'id (or postId) and isActive are required' }, { status: 400 });
    }

    // Activation guard: refuse to flip an automation to active if the
    // current workspace has no connected account OR if the workspace is
    // soft-locked (paid user downgraded below their workspace count, so
    // the excess workspaces became read-only).
    if (isActive) {
        // Workspace soft-lock check first — independent of connection state.
        const { data: workspace } = await supabase
            .from('workspaces')
            .select('is_locked, name')
            .eq('id', workspaceId)
            .maybeSingle();
        if (workspace?.is_locked) {
            return NextResponse.json(
                {
                    error:
                        `"${workspace.name}" is locked because your plan no longer covers this many workspaces. ` +
                        `Upgrade your plan or delete other workspaces to unlock it.`,
                    workspaceLocked: true,
                },
                { status: 423 },
            );
        }

        // After a user disconnects and reconnects with a DIFFERENT platform,
        // the OLD automation can otherwise be re-activated and send via
        // stale credentials — yielding "Invalid OAuth 2.0 Access Token" /
        // "Object with ID 'null'..." errors at cron time. Pausing
        // (isActive=false) is always allowed regardless of connection state.
        const { data: activeAccounts } = await supabase
            .from('connected_accounts')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('is_active', true)
            .limit(1);
        if (!activeAccounts || activeAccounts.length === 0) {
            return NextResponse.json(
                {
                    error:
                        'Connect an Instagram or Facebook account before activating automations. ' +
                        'Head to the Dashboard to connect, then resume from here.',
                    needsConnection: true,
                },
                { status: 409 },
            );
        }
    }

    // Prefer id when provided — it's unambiguous even when multiple
    // automations share a post (which the new builder allows).
    try {
        let q = supabase
            .from('dm_automations')
            .update({ is_active: isActive, updated_at: new Date().toISOString() })
            .eq('workspace_id', workspaceId);
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
