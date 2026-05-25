import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getUserEffectivePlan } from '@/lib/plan-server';
import { isProOrTrial } from '@/lib/plans';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * Shared auth resolver — cookie OR bearer + ?workspace_id=. Mirrors
 * the helper in /api/ice-breakers/route.js. Returns { error } on
 * failure so callers can early-return; on success returns the
 * supabase client, user, and resolved workspaceId.
 */
async function resolveAuth(request) {
    const authHeader = request?.headers?.get?.('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (bearer) {
        const admin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
        );
        const { data, error } = await admin.auth.getUser(bearer);
        if (error || !data?.user) {
            return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
        }
        const user = data.user;

        const { searchParams } = new URL(request.url);
        const requestedWs = searchParams.get('workspace_id');
        let workspaceId = null;
        if (requestedWs) {
            const { data: owned } = await admin
                .from('workspaces').select('id')
                .eq('owner_id', user.id).eq('id', requestedWs).maybeSingle();
            if (owned?.id) workspaceId = owned.id;
            if (!workspaceId) {
                const { data: member } = await admin
                    .from('workspace_members').select('workspace_id')
                    .eq('user_id', user.id).eq('workspace_id', requestedWs)
                    .in('role', ['owner', 'admin']).maybeSingle();
                if (member?.workspace_id) workspaceId = member.workspace_id;
            }
        }
        if (!workspaceId) {
            const { data: oldest } = await admin
                .from('workspaces').select('id')
                .eq('owner_id', user.id).order('created_at', { ascending: true })
                .limit(1).maybeSingle();
            workspaceId = oldest?.id ?? null;
        }
        if (!workspaceId) return { error: NextResponse.json({ error: 'No active workspace' }, { status: 400 }) };
        return { user, workspaceId, supabase: admin };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
    const workspaceId = await getActiveWorkspaceId(supabase);
    if (!workspaceId) return { error: NextResponse.json({ error: 'No active workspace' }, { status: 400 }) };
    return { user, workspaceId, supabase };
}

/**
 * GET /api/accounts/config
 * Get the default configuration for the workspace's active account.
 * Supports cookie (web) and bearer (mobile) auth.
 */
export async function GET(request) {
    const auth = await resolveAuth(request);
    if (auth.error) return auth.error;
    const { workspaceId, supabase } = auth;

    try {
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('id, default_config')
            .eq('workspace_id', workspaceId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        return NextResponse.json({
            accountId: account?.id ?? null,
            config:    account?.default_config || {},
        });
    } catch {
        return NextResponse.json({ accountId: null, config: {} });
    }
}

/**
 * POST /api/accounts/config
 * Save default configuration for a connected account. Body: { accountId, config }
 */
export async function POST(request) {
    const auth = await resolveAuth(request);
    if (auth.error) return auth.error;
    const { user, workspaceId, supabase } = auth;

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
