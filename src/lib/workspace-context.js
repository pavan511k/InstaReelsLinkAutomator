import { cookies } from 'next/headers';

const COOKIE_NAME = 'active_workspace_id';
const COOKIE_OPTS = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
};

/**
 * Resolves the active workspace for the current request.
 *
 * Strategy:
 *   1. Read the `active_workspace_id` cookie.
 *   2. Verify the cookie value points to a workspace owned by the
 *      authenticated user. If not, fall through.
 *   3. Fall back to the user's oldest workspace (their "Default").
 *      Auto-creates one if none exists (shouldn't normally happen
 *      because /auth/callback provisions it, but defensive for
 *      legacy accounts).
 *   4. Returns null when there is no authenticated user.
 *
 * @param {*} supabase  request-scoped Supabase client (RSC / route handler)
 * @returns {Promise<{ id: string, name: string, slug: string, is_locked: boolean } | null>}
 */
export async function getActiveWorkspace(supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const cookieStore = await cookies();
    const requestedId = cookieStore.get(COOKIE_NAME)?.value;

    if (requestedId) {
        const { data } = await supabase
            .from('workspaces')
            .select('id, name, slug, is_locked')
            .eq('id', requestedId)
            .eq('owner_id', user.id)
            .maybeSingle();
        if (data) return data;
    }

    // Fallback: oldest workspace owned by this user.
    const { data: fallback } = await supabase
        .from('workspaces')
        .select('id, name, slug, is_locked')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
    if (fallback) return fallback;

    return null;
}

/**
 * Same as getActiveWorkspace but returns just the id, or null.
 * Convenience for hot paths that only need the id to scope a query.
 */
export async function getActiveWorkspaceId(supabase) {
    const ws = await getActiveWorkspace(supabase);
    return ws?.id || null;
}

/**
 * Sets the active workspace cookie. Call from a route handler that
 * has access to the cookies API (route handlers and server actions,
 * not from Server Components).
 *
 * @param {string} workspaceId
 */
export async function setActiveWorkspace(workspaceId) {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, workspaceId, COOKIE_OPTS);
}

export const WORKSPACE_COOKIE_NAME = COOKIE_NAME;
