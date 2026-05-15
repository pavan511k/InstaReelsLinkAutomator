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
export const PRO_PRICE_INR = 299;  // monthly price in INR (kept for legacy refs)

/**
 * Automation count cap on free tier. Hitting this should funnel users
 * into the Pricing modal — checked client-side (UI gating) AND server-side
 * (POST /api/automations/builder). Counts only `dm_automations` rows
 * owned by the user; archived/deleted rows do not count.
 */
export const FREE_AUTOMATION_LIMIT = 5;
export const PRO_AUTOMATION_LIMIT  = null; // unlimited

/**
 * Carousel slide caps per plan.
 */
export const FREE_SLIDE_LIMIT = 3;

/**
 * Workspace count caps per plan.
 * Free: 1 (just the default workspace).
 * Pro / Trial: 5 separate workspaces.
 * Business: 10 separate workspaces.
 *
 * When a paid user downgrades, excess workspaces are soft-locked
 * (read-only, no automation activations). See workspaces.is_locked.
 */
export const FREE_WORKSPACE_LIMIT     = 1;
export const PRO_WORKSPACE_LIMIT      = 5;
export const BUSINESS_WORKSPACE_LIMIT = 10;

/**
 * Returns the workspace count cap for an effective plan string.
 * @param {'free' | 'trial' | 'pro' | 'business'} effectivePlan
 * @returns {number}
 */
export function getWorkspaceLimit(effectivePlan) {
    if (effectivePlan === 'business') return BUSINESS_WORKSPACE_LIMIT;
    if (effectivePlan === 'pro' || effectivePlan === 'trial') return PRO_WORKSPACE_LIMIT;
    return FREE_WORKSPACE_LIMIT;
}

/**
 * Single source of truth for purchasable billing plans.
 *
 * Each entry is what users CAN BUY (the SKU). The `entitlement` field maps
 * back to the value written to `user_plans.plan` — both monthly and yearly
 * Pro purchases unlock the same `'pro'` feature set. The pricing page,
 * Cashfree order creation, and the webhook + verify activation routes all
 * read from this object so the price, duration, and label stay in sync.
 *
 * Adding a new tier (e.g. business): add an entry here + a UI card. No other
 * code touches.
 */
export const BILLING_PLANS = {
    pro: {
        label:          'Pro Monthly',
        priceInr:       299,
        durationMonths: 1,
        entitlement:    'pro',
    },
    pro_yearly: {
        label:          'Pro Yearly',
        priceInr:       2999,
        durationMonths: 12,
        entitlement:    'pro',
        // Calculated savings shown in the UI: 12 × 299 − 2999 = 589 (≈16% off).
        savingsLabel:   'Save ₹589 vs monthly',
    },
};

/**
 * Computes the new `plan_expires_at` for a given billing plan, used by
 * activatePlan in webhook/verify.
 */
export function computePlanExpiresAt(billingPlanId, fromDate = new Date()) {
    const plan = BILLING_PLANS[billingPlanId];
    if (!plan) throw new Error(`Unknown billing plan: ${billingPlanId}`);
    const next = new Date(fromDate);
    next.setMonth(next.getMonth() + plan.durationMonths);
    return next;
}

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
 * Returns the automation count limit for an effective plan string.
 * Returns null for unlimited plans (pro / trial / business).
 * @param {'free' | 'trial' | 'pro' | 'business'} effectivePlan
 * @returns {number|null}
 */
export function getAutomationLimit(effectivePlan) {
    if (effectivePlan === 'pro' || effectivePlan === 'business' || effectivePlan === 'trial') {
        return PRO_AUTOMATION_LIMIT; // unlimited
    }
    return FREE_AUTOMATION_LIMIT;
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
