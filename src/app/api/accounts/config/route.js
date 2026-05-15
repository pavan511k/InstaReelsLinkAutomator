import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getUserEffectivePlan } from '@/lib/plan-server';
import { isProOrTrial } from '@/lib/plans';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * GET /api/accounts/config
 * Get the default configuration for user's connected account
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const workspaceId = await getActiveWorkspaceId(supabase);
        if (!workspaceId) return NextResponse.json({ config: {} });
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('default_config')
            .eq('workspace_id', workspaceId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        return NextResponse.json({
            config: account?.default_config || {},
        });
    } catch {
        return NextResponse.json({ config: {} });
    }
}

/**
 * POST /api/accounts/config
 * Save default configuration for a connected account
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, config } = body;

    if (!accountId || !config) {
        return NextResponse.json({ error: 'Account ID and config are required' }, { status: 400 });
    }

    // Field-level Pro gate. The endpoint is shared between Free-tier universal
    // triggers and the Pro-tier Story Mention Auto-DM, so we can't lock the
    // whole route. Only block save when a non-Pro user is enabling
    // mentionDm — any other config change is fine.
    if (config?.mentionDm?.enabled) {
        const plan = await getUserEffectivePlan(supabase, user.id);
        if (!isProOrTrial(plan)) {
            return NextResponse.json(
                { error: 'Story Mention Auto-DM requires a Pro plan.', upgradeRequired: true },
                { status: 403 }
            );
        }
    }

    try {
        const workspaceId = await getActiveWorkspaceId(supabase);
        if (!workspaceId) {
            return NextResponse.json({ error: 'No active workspace' }, { status: 400 });
        }
        const { error } = await supabase
            .from('connected_accounts')
            .update({
                default_config: config,
                updated_at: new Date().toISOString(),
            })
            .eq('id', accountId)
            .eq('workspace_id', workspaceId);

        if (error) {
            console.error('Failed to save config:', error);
            return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Config save error:', err);
        return NextResponse.json({ error: `Save failed: ${err.message}` }, { status: 500 });
    }
}
