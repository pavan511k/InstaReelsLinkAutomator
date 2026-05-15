import { getEffectivePlan, getWorkspaceLimit } from '@/lib/plans';

/**
 * Reconcile workspaces.is_locked for one user against their current plan.
 *
 * Lock policy (decided in Phase 1 design):
 *   - Free / Pro / Trial / Business each have a workspace limit
 *     (see getWorkspaceLimit).
 *   - The OLDEST N workspaces stay unlocked (where N = limit).
 *   - Anything past that is locked.
 *   - Upgrading reverses this: previously-locked workspaces unlock when
 *     the plan covers them again.
 *
 * Locked workspaces are read-only:
 *   - No new active automations can be created
 *   - Existing automations can't be activated
 *   - (Other queries still work, so the user can review + decide to
 *     upgrade or delete.)
 *
 * Idempotent. Safe to call from multiple sites (payment webhook, OAuth
 * callback, cron sweep). The helper only writes when state needs to
 * change, so re-running on an already-correct user is a no-op SELECT.
 *
 * @param {*} supabase  Service-role client preferred. Anon will work
 *                      against this user's own row thanks to the
 *                      "Owners manage own workspaces" RLS policy.
 * @param {string} userId  The auth.users id whose workspaces to reconcile.
 * @returns {Promise<{ locked: string[], unlocked: string[], limit: number, plan: string }>}
 */
export async function enforceWorkspaceLocks(supabase, userId) {
    if (!userId) return { locked: [], unlocked: [], limit: 0, plan: 'free' };

    // Read the user's plan + workspaces in parallel. Both reads are tiny.
    const [{ data: planRow }, { data: workspaces }] = await Promise.all([
        supabase
            .from('user_plans')
            .select('plan, plan_expires_at, trial_ends_at')
            .eq('user_id', userId)
            .maybeSingle(),
        supabase
            .from('workspaces')
            .select('id, is_locked, created_at')
            .eq('owner_id', userId)
            .order('created_at', { ascending: true }),
    ]);

    const plan  = getEffectivePlan(planRow);
    const limit = getWorkspaceLimit(plan);
    const all   = workspaces || [];

    // First `limit` workspaces (oldest first) should be unlocked.
    // Everything else should be locked.
    const shouldLock   = [];
    const shouldUnlock = [];
    all.forEach((ws, idx) => {
        const expectedLocked = idx >= limit;
        if (expectedLocked && !ws.is_locked) shouldLock.push(ws.id);
        if (!expectedLocked && ws.is_locked) shouldUnlock.push(ws.id);
    });

    if (shouldLock.length > 0) {
        const { error } = await supabase
            .from('workspaces')
            .update({ is_locked: true, updated_at: new Date().toISOString() })
            .in('id', shouldLock);
        if (error) console.warn('[WorkspaceLocks] Lock update failed:', error.message);
    }
    if (shouldUnlock.length > 0) {
        const { error } = await supabase
            .from('workspaces')
            .update({ is_locked: false, updated_at: new Date().toISOString() })
            .in('id', shouldUnlock);
        if (error) console.warn('[WorkspaceLocks] Unlock update failed:', error.message);
    }

    return {
        locked:   shouldLock,
        unlocked: shouldUnlock,
        limit,
        plan,
    };
}
