import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import ThemedShell from '@/components/dashboard/ThemedShell';
import TrialBanner from '@/components/dashboard/TrialBanner';
import bodyStyles from './layout.module.css';
import { getEffectivePlan, trialDaysRemaining, TRIAL_DAYS } from '@/lib/plans';

export const metadata = {
    title: 'Dashboard — AutoDM',
};

export default async function DashboardLayout({ children }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    let isConnected   = false;
    let profilePicUrl = null;
    let effectivePlan = 'free';
    let trialDaysLeft = 0;

    // ── Connection status (credentials only — no plan columns here) ──────
    try {
        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('id, ig_profile_picture_url')
            .eq('user_id', user.id)
            .eq('is_active', true);

        if (accounts && accounts.length > 0) {
            isConnected   = true;
            profilePicUrl = accounts.find((a) => a.ig_profile_picture_url)?.ig_profile_picture_url || null;
        }
    } catch { /* table may not exist in fresh deploys */ }

    // ── Plan (user_plans is the single source of truth) ──────────────────
    try {
        const { data: userPlan } = await supabase
            .from('user_plans')
            .select('plan, plan_expires_at, trial_ends_at')
            .eq('user_id', user.id)
            .maybeSingle();

        if (userPlan) {
            // Row already exists — read normally
            effectivePlan = getEffectivePlan(userPlan);
            trialDaysLeft = trialDaysRemaining(userPlan);
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

    return (
        <ThemedShell>
            <Sidebar
                user={user}
                isConnected={isConnected}
                profilePicUrl={profilePicUrl}
                effectivePlan={effectivePlan}
                trialDaysLeft={trialDaysLeft}
            />
            <div className={bodyStyles.body}>
                <TrialBanner effectivePlan={effectivePlan} trialDaysLeft={trialDaysLeft} />
                <main className={bodyStyles.main}>
                    {children}
                </main>
            </div>
        </ThemedShell>
    );
}
