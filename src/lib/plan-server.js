/**
 * Server-side plan enforcement helpers.
 *
 * Usage in any API route:
 *
 *   import { getUserEffectivePlan, requirePro } from '@/lib/plan-server';
 *
 *   const plan = await getUserEffectivePlan(supabase, user.id);
 *   const gate = requirePro(plan);
 *   if (gate) return gate; // returns a 403 NextResponse if not Pro/Trial
 */

import { NextResponse } from 'next/server';
import { getEffectivePlan } from '@/lib/plans';

/**
 * Fetches and returns the effective plan string for a user.
 * Reads from user_plans (single source of truth).
 *
 * @param {object} supabase  - authenticated Supabase client (any role)
 * @param {string} userId    - auth.users UUID
 * @returns {Promise<'free' | 'trial' | 'pro' | 'business'>}
 */
export async function getUserEffectivePlan(supabase, userId) {
    try {
        const { data } = await supabase
            .from('user_plans')
            .select('plan, plan_expires_at, trial_ends_at')
            .eq('user_id', userId)
            .maybeSingle();
        return getEffectivePlan(data);
    } catch {
        return 'free';
    }
}

/**
 * Returns a 403 NextResponse if the user is not on a Pro/Trial/Business plan.
 * Returns null if the user IS on a qualifying plan (gate passes).
 *
 * Usage:
 *   const gate = requirePro(effectivePlan, 'Templates require Pro');
 *   if (gate) return gate;
 *
 * @param {string} effectivePlan
 * @param {string} [message]
 * @returns {NextResponse|null}
 */
export function requirePro(effectivePlan, message = 'This feature requires a Pro plan.') {
    if (effectivePlan === 'pro' || effectivePlan === 'trial' || effectivePlan === 'business') {
        return null; // gate passes
    }
    return NextResponse.json({ error: message, upgradeRequired: true }, { status: 403 });
}
