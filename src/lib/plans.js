/**
 * Central plan configuration.
 * Single source of truth for DM limits, plan-tier checks, trial logic, and expiry.
 *
 * Plan data is stored in the `user_plans` table (keyed on auth.users.id).
 * connected_accounts has NO plan columns — it stores only Instagram/Facebook credentials.
 */

export const FREE_DM_LIMIT = 3000;
export const PRO_DM_LIMIT  = null; // unlimited

export const TRIAL_DAYS    = 30;   // days of free Pro trial for new signups
export const PRO_PRICE_INR = 299;  // monthly price in INR

/**
 * Carousel slide caps per plan.
 */
export const FREE_SLIDE_LIMIT = 3;

/**
 * Given a user_plans row (or any object with the same shape), returns the
 * effective plan considering:
 *   1. Paid pro + not expired       → 'pro'
 *   2. Trial active                 → 'trial'  (same features as pro)
 *   3. Everything else              → 'free'
 *
 * @param {{ plan: string, plan_expires_at: string|null, trial_ends_at: string|null }|null} userPlan
 * @returns {'pro' | 'trial' | 'free'}
 */
export function getEffectivePlan(userPlan) {
    if (!userPlan) return 'free';

    const now = new Date();

    // 1. Paid pro — check it hasn't expired
    if (userPlan.plan === 'pro' || userPlan.plan === 'business') {
        // No expiry set → treat as active (e.g. manually granted plan)
        if (!userPlan.plan_expires_at) return userPlan.plan;
        if (new Date(userPlan.plan_expires_at) > now) return userPlan.plan;
        // Subscription lapsed — fall through to trial/free check
    }

    // 2. Active trial
    if (userPlan.trial_ends_at && new Date(userPlan.trial_ends_at) > now) {
        return 'trial';
    }

    return 'free';
}

/**
 * Returns how many days remain in the current trial (0 if no active trial).
 * @param {{ trial_ends_at: string|null }|null} userPlan
 * @returns {number}
 */
export function trialDaysRemaining(userPlan) {
    if (!userPlan?.trial_ends_at) return 0;
    const diff = new Date(userPlan.trial_ends_at) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Returns the monthly DM limit for an effective plan string.
 * Returns null for unlimited plans (pro / trial / business).
 * @param {'free' | 'trial' | 'pro' | 'business'} effectivePlan
 * @returns {number|null}
 */
export function getDmLimit(effectivePlan) {
    if (effectivePlan === 'pro' || effectivePlan === 'business' || effectivePlan === 'trial') {
        return PRO_DM_LIMIT; // unlimited
    }
    return FREE_DM_LIMIT;
}

/**
 * Returns true if the effective plan has no monthly DM cap.
 * @param {'free' | 'trial' | 'pro' | 'business'} effectivePlan
 */
export function isUnlimited(effectivePlan) {
    return effectivePlan === 'pro' || effectivePlan === 'business' || effectivePlan === 'trial';
}

/**
 * Returns true if the effective plan has access to Pro features
 * (Follow Gate, templates, unlimited slides, A/B testing, etc.)
 * @param {'free' | 'trial' | 'pro' | 'business'} effectivePlan
 */
export function isProOrTrial(effectivePlan) {
    return effectivePlan === 'pro' || effectivePlan === 'business' || effectivePlan === 'trial';
}
