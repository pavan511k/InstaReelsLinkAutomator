import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getUserEffectivePlan, requirePro } from '@/lib/plan-server';
import { runBackfill } from '@/lib/backfill';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * POST /api/automations/backfill
 *
 * Manual re-trigger from the UI: re-fetches historical comments on a post
 * and enqueues DMs for any that match the automation's trigger.
 *
 * The "fire on save" path is no longer this route — POST /api/automations
 * now calls runBackfill() directly via Next's `after()` so save→backfill
 * doesn't depend on a server-to-server HTTP fetch.
 *
 * Body: { automationId: string, postId: string }
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const workspaceId = await getActiveWorkspaceId(supabase);
    if (!workspaceId) return NextResponse.json({ error: 'No active workspace' }, { status: 400 });

    // Pro gate
    const plan = await getUserEffectivePlan(supabase, user.id);
    const gate = requirePro(plan, 'Backfilling DMs to previous comments requires a Pro plan.');
    if (gate) return gate;

    const body = await request.json();
    const { automationId, postId } = body;

    if (!automationId || !postId) {
        return NextResponse.json({ error: 'automationId and postId are required' }, { status: 400 });
    }

    // Verify ownership using RLS-aware client. runBackfill itself uses the
    // service-role client so this check is the only thing preventing a user
    // from triggering backfill against another user's automation.
    const { data: owns } = await supabase
        .from('dm_automations')
        .select('id')
        .eq('id', automationId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

    if (!owns) {
        return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    try {
        const result = await runBackfill({ automationId, postId });
        return NextResponse.json({ success: true, ...result });
    } catch (err) {
        console.error('[Backfill] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
