import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { setActiveWorkspace } from '@/lib/workspace-context';

/**
 * POST /api/workspaces/switch
 *
 * Body: { workspaceId: string }
 *
 * Sets the active_workspace_id cookie so subsequent requests scope
 * queries to the chosen workspace. Verifies the target workspace is
 * owned by the current user before switching.
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

    const workspaceId = body?.workspaceId;
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

    const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .eq('id', workspaceId)
        .eq('owner_id', user.id)
        .maybeSingle();

    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    await setActiveWorkspace(workspaceId);
    return NextResponse.json({ success: true, workspaceId });
}
