import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { provisionNewUser } from '@/lib/provision-new-user';

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
        // Short-circuit if a plan row already exists — never overwrite it
        // (esp. a paid plan), and preserve the original response shape.
        const { data: existingPlan } = await admin
            .from('user_plans')
            .select('plan')
            .eq('user_id', user.id)
            .maybeSingle();

        if (existingPlan) {
            return NextResponse.json({
                success:        true,
                alreadyExisted: true,
                plan:           existingPlan.plan,
            });
        }

        // First-time signup → shared provisioner: applies the one-free-trial-
        // per-email block, sends the welcome email, and provisions a workspace
        // — the same rules as the web flow. Idempotent, so a request that raced
        // the check above is handled safely inside it.
        const { trialGranted, trialEndsAt } = await provisionNewUser(user);

        console.log(`[ProvisionTrial] Provisioned ${user.id} (mobile signup) — trial=${trialGranted}`);

        return NextResponse.json({
            success:        true,
            alreadyExisted: false,
            trial:          trialGranted,
            trialEndsAt:    trialEndsAt || null,
        });
    } catch (err) {
        console.error('[ProvisionTrial] Unexpected error:', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
}
