// Removed edge runtime — we need service role access to provision trial in user_plans
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { TRIAL_DAYS } from '@/lib/plans';
import { sendTrialStartedEmail } from '@/lib/email';
import { WORKSPACE_COOKIE_NAME } from '@/lib/workspace-context';
import { enforceWorkspaceLocks } from '@/lib/workspace-locks';

/**
 * GET /auth/callback
 *
 * Called by Supabase after the user clicks the email verification link.
 * 1. Exchanges the one-time code for a session.
 * 2. Provisions a user_plans row with a 30-day trial if one doesn't exist yet.
 *    (ignoreDuplicates: true — safe to call multiple times, never overwrites a paid plan.)
 * 3. Redirects to /dashboard where the inline trial banner + sidebar plan
 *    badge will immediately reflect the trial status.
 */
export async function GET(request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';

    if (!code) {
        return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // ── Step 1: exchange code for session ────────────────────────────────
    const response = NextResponse.redirect(
        buildRedirectUrl(origin, request.headers.get('x-forwarded-host'), next)
    );

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() { return request.cookies.getAll(); },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value, options);
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !sessionData?.user) {
        console.error('[AuthCallback] Session exchange failed:', error?.message);
        return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // ── Step 2: provision trial + send trial-started email ───────────────
    // This is the single source of truth for "user becomes a paying-eligible
    // trial user." Runs once per user — the first time they click the email
    // verification link Supabase sent. Subsequent visits to this route (e.g.
    // password resets that route through here) skip both the insert and the
    // email because the user_plans row already exists.
    let activeWorkspaceId = null;
    try {
        const serviceDb = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
        );

        // Check if user_plans row exists. If not, insert AND send email.
        // If yes, skip both (already onboarded — or paid plan, which we
        // must never overwrite).
        const userId = sessionData.user.id;
        const { data: existingPlan } = await serviceDb
            .from('user_plans').select('user_id')
            .eq('user_id', userId).maybeSingle();

        if (!existingPlan) {
            const trialEndsAt = new Date();
            trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

            await serviceDb.from('user_plans').insert({
                user_id:       userId,
                plan:          'free',
                trial_ends_at: trialEndsAt.toISOString(),
            });

            console.log(`[AuthCallback] Trial provisioned for user ${userId} — expires ${trialEndsAt.toDateString()}`);

            // Fire-and-forget trial-started email. Failure to send shouldn't
            // block the redirect — user can still use the product.
            const userEmail = sessionData.user.email;
            const userName  = sessionData.user.user_metadata?.full_name || '';
            if (userEmail) {
                sendTrialStartedEmail({
                    to:          userEmail,
                    name:        userName,
                    igUsername:  '', // not connected yet — email copy handles this
                    trialEndsAt: trialEndsAt.toISOString(),
                }).catch((e) => console.warn('[AuthCallback] Trial email send failed:', e.message));
            }
        }

        // Default workspace provisioning. Single source of truth: every
        // authenticated user has at least one workspace. The schema
        // migration backfilled existing users; this branch covers brand
        // new signups + any edge case where a user reached this route
        // without a workspace row.
        const { data: existingWs } = await serviceDb
            .from('workspaces')
            .select('id')
            .eq('owner_id', userId)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (existingWs) {
            activeWorkspaceId = existingWs.id;
        } else {
            const { data: newWs } = await serviceDb
                .from('workspaces')
                .insert({ owner_id: userId, name: 'Default', slug: 'default' })
                .select('id')
                .single();
            if (newWs) {
                await serviceDb
                    .from('workspace_members')
                    .insert({ workspace_id: newWs.id, user_id: userId, role: 'owner' });
                activeWorkspaceId = newWs.id;
                console.log(`[AuthCallback] Default workspace ${newWs.id} created for user ${userId}`);
            }
        }

        // Reconcile workspace locks defensively. Catches the case where a
        // user's trial expired or paid plan lapsed since the last time
        // they touched the app — the cron sweep handles this too, but
        // running here means a returning user sees the right state on
        // the very first page load after coming back.
        try {
            await enforceWorkspaceLocks(serviceDb, userId);
        } catch (err) {
            console.warn('[AuthCallback] Lock reconciliation failed:', err.message);
        }
    } catch (err) {
        // Non-fatal — dashboard layout has a tertiary fallback provisioner.
        console.warn('[AuthCallback] Trial/workspace provision failed (non-fatal):', err.message);
    }

    if (activeWorkspaceId) {
        response.cookies.set(WORKSPACE_COOKIE_NAME, activeWorkspaceId, {
            httpOnly: true,
            sameSite: 'lax',
            secure:   process.env.NODE_ENV === 'production',
            path:     '/',
            maxAge:   60 * 60 * 24 * 365,
        });
    }

    return response;
}

function buildRedirectUrl(origin, forwardedHost, next) {
    const isLocal = process.env.NODE_ENV === 'development';
    if (isLocal) return `${origin}${next}`;
    if (forwardedHost) return `https://${forwardedHost}${next}`;
    return `${origin}${next}`;
}
