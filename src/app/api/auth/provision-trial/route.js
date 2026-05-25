import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { TRIAL_DAYS } from '@/lib/plans';
import { sendTrialStartedEmail } from '@/lib/email';

/**
 * POST /api/auth/provision-trial
 *
 * Mobile-callable endpoint that mirrors what the web's /auth/callback
 * does after email-verification: provisions a 30-day Pro trial row in
 * user_plans + sends the "Your 30-day AutoDM Pro trial is live" email.
 *
 * Why it exists separately from /auth/callback:
 *   - Web flow: user clicks the Supabase verification link → /auth/callback
 *     exchanges the code, provisions, sends email. Mobile email/password
 *     signups may route the verification link to a different URL, AND
 *     mobile Google sign-in skips email verification entirely.
 *   - Without this endpoint, mobile signups never get the trial row or
 *     the welcome email. Trial DM features (Email Collector, ice
 *     breakers, follow-up nudge) silently no-op for those users.
 *
 * Auth: Bearer JWT only (mobile-specific). Web doesn't need this — it
 * already provisions in /auth/callback.
 *
 * Idempotency: checks user_plans first. If a row exists (free trial OR
 * paid plan), returns success without writing or emailing. Safe to call
 * on every sign-in.
 */
export async function POST(request) {
    const authHeader = request?.headers?.get?.('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!bearer) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const admin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    const { data, error: authErr } = await admin.auth.getUser(bearer);
    if (authErr || !data?.user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const user = data.user;

    try {
        // Check if the user_plans row exists. If yes, this is not a
        // first-time sign-in — short-circuit. Crucially we do NOT
        // overwrite the row, so a paid user signing back in on mobile
        // doesn't get reset to trial.
        const { data: existingPlan } = await admin
            .from('user_plans')
            .select('user_id, plan, trial_ends_at, plan_expires_at')
            .eq('user_id', user.id)
            .maybeSingle();

        if (existingPlan) {
            return NextResponse.json({
                success:        true,
                alreadyExisted: true,
                plan:           existingPlan.plan,
            });
        }

        // First time — provision the trial + send the welcome email.
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

        const { error: insertErr } = await admin
            .from('user_plans')
            .insert({
                user_id:       user.id,
                plan:          'free',
                trial_ends_at: trialEndsAt.toISOString(),
            });

        if (insertErr) {
            // Race condition: another concurrent request may have
            // already provisioned. Re-check; if row now exists, treat
            // as success.
            if (insertErr.code === '23505') {
                return NextResponse.json({ success: true, alreadyExisted: true });
            }
            console.error('[ProvisionTrial] Insert failed:', insertErr.message);
            return NextResponse.json({ error: 'Failed to provision trial' }, { status: 500 });
        }

        console.log(`[ProvisionTrial] Trial row created for ${user.id} (mobile signup) — expires ${trialEndsAt.toDateString()}`);

        // Fire-and-forget welcome email. Failure to send shouldn't
        // block — the row is already in place, the user is on trial.
        const userEmail = user.email;
        const userName  = user.user_metadata?.full_name || '';
        if (userEmail) {
            sendTrialStartedEmail({
                to:          userEmail,
                name:        userName,
                igUsername:  '',  // not connected yet — email copy handles this
                trialEndsAt: trialEndsAt.toISOString(),
            }).catch((e) => console.warn('[ProvisionTrial] Email send failed:', e.message));
        }

        return NextResponse.json({
            success:        true,
            alreadyExisted: false,
            trialEndsAt:    trialEndsAt.toISOString(),
        });
    } catch (err) {
        console.error('[ProvisionTrial] Unexpected error:', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
}
