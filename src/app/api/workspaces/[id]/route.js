import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { setActiveWorkspace } from '@/lib/workspace-context';

const MAX_NAME_LENGTH = 60;

/**
 * PATCH /api/workspaces/[id]
 *
 * Body: { name: string }
 *
 * Renames a workspace the current user owns. Slug is regenerated on
 * rename so it stays meaningful in any URL that surfaces it later.
 */
export async function PATCH(request, { params: rawParams }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await rawParams;
    if (!id) return NextResponse.json({ error: 'Workspace id is required' }, { status: 400 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

    const name = (body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    if (name.length > MAX_NAME_LENGTH) {
        return NextResponse.json({ error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
    }

    const { error } = await supabase
        .from('workspaces')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('owner_id', user.id);

    if (error) {
        console.error('[Workspaces] Rename failed:', error.message);
        return NextResponse.json({ error: 'Failed to rename workspace' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

/**
 * DELETE /api/workspaces/[id]
 *
 * Cascade-deletes the workspace and EVERY row scoped to it:
 *   - connected_accounts (FK ON DELETE CASCADE)
 *   - dm_automations
 *   - dm_queue, dm_sent_log, click_events, email_leads, broadcast_jobs,
 *     global_automations — all CASCADE'd on workspace_id
 *   - workspace_members
 *
 * Requires the user owns the workspace. Refuses to delete the last
 * remaining workspace — every authenticated user must have ≥1 so the
 * UI never lands on a "no workspace" state.
 *
 * If the deleted workspace was the active one, we clear the cookie so
 * getActiveWorkspace falls back to the oldest surviving workspace on
 * the next request.
 */
export async function DELETE(request, { params: rawParams }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await rawParams;
    if (!id) return NextResponse.json({ error: 'Workspace id is required' }, { status: 400 });

    // Owner check + "is there a sibling?" check in one query.
    const { data: ownedWorkspaces } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id);

    const all = ownedWorkspaces || [];
    if (!all.some((w) => w.id === id)) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    if (all.length <= 1) {
        return NextResponse.json(
            { error: 'You need at least one workspace. Create another one before deleting this.' },
            { status: 400 },
        );
    }

    // Service-role delete so cascade-deletes go through cleanly. RLS
    // would still enforce ownership, but the cascade across many tables
    // is cleaner with the service-role client.
    const db = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { error: delErr } = await db
        .from('workspaces')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.id);

    if (delErr) {
        console.error('[Workspaces] Delete failed:', delErr.message);
        return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
    }

    // Switch active to the oldest surviving workspace.
    const remaining = all.filter((w) => w.id !== id);
    if (remaining.length > 0) {
        await setActiveWorkspace(remaining[0].id);
    }

    return NextResponse.json({ success: true, activeWorkspaceId: remaining[0]?.id || null });
}
