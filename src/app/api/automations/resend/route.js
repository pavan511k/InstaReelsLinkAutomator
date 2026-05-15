import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { runBackfill } from '@/lib/backfill';
import { getUserEffectivePlan } from '@/lib/plan-server';
import { isProOrTrial } from '@/lib/plans';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * POST /api/automations/resend
 *
 * Body: { id: <automation-uuid> }
 *
 * Replays the automation against historical comments on its bound
 * post — only commenters with no DM sent AND no DM queued, AND only
 * comments still inside Instagram's 7-day Private Reply window. The
 * "reply to all comments" mode used to live here too, but in
 * practice it produced the same set of recipients (IG dedups on
 * comment_id and rejects out-of-window sends), so the simpler
 * single-mode endpoint is what's left.
 *
 * Constraints:
 *   - Requires the automation to be bound to a specific post
 *     (postTargetMode='specific'). Re-running an 'any-post'
 *     automation against a single post doesn't make sense.
 *   - Pro / Trial only — same gate the normal backfill uses since
 *     this is the same Graph traffic + queue load.
 *   - Runs the backfill in `after()` so the response returns
 *     immediately and the work survives the function's normal exit.
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

    const id = body?.id;
    if (!id) return NextResponse.json({ error: 'Automation id is required' }, { status: 400 });

    // Plan gate — backfill is Pro-only, same as the original
    // sendToPreviousComments flag.
    const plan = await getUserEffectivePlan(supabase, user.id);
    if (!isProOrTrial(plan)) {
        return NextResponse.json(
            { error: 'Resending DMs to past comments requires a Pro plan.', upgradeRequired: true },
            { status: 403 },
        );
    }

    const workspaceId = await getActiveWorkspaceId(supabase);
    if (!workspaceId) return NextResponse.json({ error: 'No active workspace' }, { status: 400 });

    // Verify ownership + bound-to-post + active.
    const { data: automation } = await supabase
        .from('dm_automations')
        .select('id, workspace_id, post_id, is_active, trigger_config')
        .eq('id', id)
        .single();

    if (!automation || automation.workspace_id !== workspaceId) {
        return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }
    if (!automation.post_id) {
        return NextResponse.json(
            { error: 'This automation isn\'t bound to a specific post yet — resend isn\'t available for Next Post / Any Post modes.' },
            { status: 400 },
        );
    }
    if (!automation.is_active) {
        return NextResponse.json(
            { error: 'Activate the automation before resending so the new DMs actually fire.' },
            { status: 400 },
        );
    }

    // Block FB-bound automations: reading past comments from a Page post
    // requires the pages_read_engagement scope, which we don't request.
    // Defense in depth — the UI already hides the action for FB users.
    const { data: post } = await supabase
        .from('instagram_posts')
        .select('account_id, connected_accounts!inner(platform)')
        .eq('id', automation.post_id)
        .maybeSingle();
    if (post?.connected_accounts?.platform === 'facebook') {
        return NextResponse.json(
            { error: 'Resend isn\'t available for Facebook automations.' },
            { status: 400 },
        );
    }

    // Run async via after() so we respond fast. runBackfill itself
    // is idempotent — already-sent recipients are filtered out and
    // out-of-window comments (>7 days old) are skipped inline.
    after(async () => {
        try {
            await runBackfill({ automationId: id, postId: automation.post_id });
        } catch (err) {
            console.warn('[Resend] runBackfill failed:', err.message);
        }
    });

    return NextResponse.json({ success: true });
}
