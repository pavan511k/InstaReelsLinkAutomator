import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import { getEffectivePlan, trialDaysRemaining, getDmLimit, TRIAL_DAYS } from '@/lib/plans';

export const metadata = {
    title: 'Dashboard — AutoDM',
};

export default async function DashboardLayout({ children }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    let isConnected         = false;
    let profilePicUrl       = null;
    let profilePicAccountId = null;
    let effectivePlan       = 'free';
    let trialDaysLeft       = 0;
    let activePlatform      = null;  // 'instagram' | 'facebook' | 'both' | null
    let monthlyDmCount      = 0;
    let dmCountMonth        = null;

    // ── Connection status (credentials only — no plan columns here) ──────
    try {
        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('id, ig_profile_picture_url, platform')
            .eq('user_id', user.id)
            .eq('is_active', true);

        if (accounts && accounts.length > 0) {
            isConnected   = true;
            // Pick the same account we'll display the avatar for — pass
            // both URL and id so the Sidebar's onError handler can call
            // /api/accounts/refresh-profile-pic against the right row.
            const picAccount = accounts.find((a) => a.ig_profile_picture_url);
            profilePicUrl = picAccount?.ig_profile_picture_url || null;
            profilePicAccountId = picAccount?.id || null;
            // Active platform — used to hide IG-only nav items for FB-only
            // accounts. If the user has both 'instagram' and 'facebook' rows
            // we treat it as 'both' so all features show.
            const platforms = new Set(accounts.map((a) => a.platform).filter(Boolean));
            if (platforms.has('both') || (platforms.has('instagram') && platforms.has('facebook'))) {
                activePlatform = 'both';
            } else if (platforms.has('instagram')) {
                activePlatform = 'instagram';
            } else if (platforms.has('facebook')) {
                activePlatform = 'facebook';
            }
        }
    } catch { /* table may not exist in fresh deploys */ }

    // ── Plan (user_plans is the single source of truth) ──────────────────
    try {
        const { data: userPlan } = await supabase
            .from('user_plans')
            .select('plan, plan_expires_at, trial_ends_at, monthly_dm_count, dm_count_month')
            .eq('user_id', user.id)
            .maybeSingle();

        if (userPlan) {
            // Row already exists — read normally
            effectivePlan  = getEffectivePlan(userPlan);
            trialDaysLeft  = trialDaysRemaining(userPlan);
            monthlyDmCount = userPlan.monthly_dm_count || 0;
            dmCountMonth   = userPlan.dm_count_month || null;
        } else {
            // ── Fallback: provision trial for first-time dashboard visit ──
            // This handles:
            //   • Users who sign in directly (not via email link)
            //   • Cases where the auth/callback provisioner failed
            //   • Existing users who signed up before user_plans existed
            try {
                const serviceDb = createServiceClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL,
                    process.env.SUPABASE_SERVICE_ROLE_KEY,
                );

                const trialEndsAt = new Date();
                trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

                await serviceDb
                    .from('user_plans')
                    .upsert(
                        {
                            user_id:       user.id,
                            plan:          'free',
                            trial_ends_at: trialEndsAt.toISOString(),
                        },
                        {
                            onConflict:       'user_id',
                            ignoreDuplicates: true, // safe — never overwrites a paid plan
                        }
                    );

                // Re-read so plan displays correctly on THIS render
                const { data: freshPlan } = await serviceDb
                    .from('user_plans')
                    .select('plan, plan_expires_at, trial_ends_at')
                    .eq('user_id', user.id)
                    .maybeSingle();

                effectivePlan = getEffectivePlan(freshPlan);
                trialDaysLeft = trialDaysRemaining(freshPlan);

                console.log(`[Layout] Trial provisioned for user ${user.id} (fallback)`);
            } catch (provErr) {
                // Still non-fatal — user sees free plan until next render
                console.warn('[Layout] Fallback trial provision failed:', provErr.message);
            }
        }
    } catch { /* user_plans table may not exist in very fresh deploys */ }

    // Cached counter is per-month; mismatch with current YYYY-MM means no
    // sends yet this month (counter will reset on the next insert).
    const currentMonth = new Date().toISOString().slice(0, 7);
    const dmUsed       = dmCountMonth === currentMonth ? monthlyDmCount : 0;
    const dmLimit      = getDmLimit(effectivePlan);

    // Standard centered shell. Full-bleed routes (e.g., flow builder)
    // override these properties via `main:has(.builder-fullbleed)` in
    // globals.css — see comment there. We can't decide here based on
    // pathname because Next.js layouts don't re-render across child
    // navigations, so a header-based check would lock in the shell of
    // whichever page was loaded first.
    const mainClass = 'mx-auto w-full max-w-7xl flex-1 px-3 py-8 sm:px-4 sm:py-10 lg:px-5 lg:py-12 xl:px-6 xl:py-14';

    return (
        // bg-neutral-50 (#FAFAFA) matches --page-bg from globals.css; using a
        // Tailwind utility directly so the shell doesn't depend on the CSS
        // module variables anymore. Inter font kept via Tailwind's font-sans.
        <div className="flex min-h-screen flex-col bg-neutral-50 font-sans lg:flex-row">
            <Sidebar
                user={user}
                isConnected={isConnected}
                profilePicUrl={profilePicUrl}
                profilePicAccountId={profilePicAccountId}
                effectivePlan={effectivePlan}
                trialDaysLeft={trialDaysLeft}
                activePlatform={activePlatform}
                dmUsed={dmUsed}
                dmLimit={dmLimit}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Trial-status communication is split intentionally:
                    • DashboardView has an inline contextual banner on /dashboard
                    • Sidebar's plan badge is visible on every other route
                   The persistent layout ribbon was redundant — removed. */}
                {/* Even tighter horizontal padding — content sits very close
                    to the sidebar. Horizontal: 12/16/20/24px,
                    vertical: 32/40/48/56px. max-w-7xl prevents sprawl. */}
                <main className={mainClass}>
                    {children}
                </main>
            </div>
        </div>
    );
}
