import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getUserEffectivePlan, canCreateMoreWorkspaces } from '@/lib/plan-server';
import { setActiveWorkspace } from '@/lib/workspace-context';

const MAX_NAME_LENGTH = 60;

/**
 * Sanitize a workspace name into a URL-safe slug. Deduped per owner at
 * insert time — if the slug collides with another of this user's
 * workspaces we append a short suffix.
 */
function buildSlug(name) {
    const base = (name || '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    return base || 'workspace';
}

/**
 * GET /api/workspaces
 *
 * Returns every workspace owned by the current user, plus the current
 * plan's workspace limit and whether the user is at cap.
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id, name, slug, is_locked, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });

    const plan = await getUserEffectivePlan(supabase, user.id);
    const { current, limit, allowed } = await canCreateMoreWorkspaces(supabase, user.id, plan);

    return NextResponse.json({
        workspaces: workspaces || [],
        plan,
        limit,
        current,
        canCreate: allowed,
    });
}

/**
 * POST /api/workspaces
 *
 * Body: { name: string }
 *
 * Creates a new workspace for the current user, makes them the owner
 * via workspace_members, and switches the active-workspace cookie to
 * the new workspace. Plan-gated: free=1, pro/trial=5, business=10.
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

    const name = (body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    if (name.length > MAX_NAME_LENGTH) {
        return NextResponse.json({ error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }, { status: 400 });
    }

    const plan = await getUserEffectivePlan(supabase, user.id);
    const { allowed, current, limit } = await canCreateMoreWorkspaces(supabase, user.id, plan);
    if (!allowed) {
        return NextResponse.json(
            {
                error: `You're on the ${plan} plan, limited to ${limit} workspace${limit === 1 ? '' : 's'}. Upgrade for more.`,
                upgradeRequired: true,
                limit,
                current,
            },
            { status: 403 },
        );
    }

    // Slug uniqueness is enforced by UNIQUE(owner_id, slug). If the
    // base collides (e.g., user creates "Marketing" twice), append the
    // current millisecond-suffix to disambiguate.
    let slug = buildSlug(name);
    const { data: existingSlug } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .eq('slug', slug)
        .maybeSingle();
    if (existingSlug) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const { data: created, error: createErr } = await supabase
        .from('workspaces')
        .insert({ owner_id: user.id, name, slug })
        .select('id, name, slug, is_locked, created_at')
        .single();

    if (createErr || !created) {
        console.error('[Workspaces] Create failed:', createErr?.message);
        return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
    }

    const { error: memberErr } = await supabase
        .from('workspace_members')
        .insert({ workspace_id: created.id, user_id: user.id, role: 'owner' });
    if (memberErr) {
        console.warn('[Workspaces] Membership insert failed:', memberErr.message);
        // Not fatal — the owner check via workspaces.owner_id still grants
        // access. Future team-invite flow will rely on memberships though.
    }

    // Auto-switch the user into the freshly-created workspace so they
    // can immediately start connecting an account / building automations.
    await setActiveWorkspace(created.id);

    return NextResponse.json({ workspace: created });
}
