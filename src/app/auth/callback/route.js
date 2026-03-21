// Removed edge runtime — we need service role access to provision trial in user_plans
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { TRIAL_DAYS } from '@/lib/plans';

/**
 * GET /auth/callback
 *
 * Called by Supabase after the user clicks the email verification link.
 * 1. Exchanges the one-time code for a session.
 * 2. Provisions a user_plans row with a 30-day trial if one doesn't exist yet.
 *    (ignoreDuplicates: true — safe to call multiple times, never overwrites a paid plan.)
 * 3. Redirects to /dashboard where TrialBanner will immediately be visible.
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

    // ── Step 2: provision trial (service role — bypasses user_plans RLS) ─
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
                    user_id:       sessionData.user.id,
                    plan:          'free',
                    trial_ends_at: trialEndsAt.toISOString(),
                },
                {
                    onConflict:       'user_id',
                    ignoreDuplicates: true, // never overwrites an existing row (paid plans safe)
                }
            );

        console.log(`[AuthCallback] Trial provisioned for user ${sessionData.user.id} — expires ${trialEndsAt.toDateString()}`);
    } catch (err) {
        // Non-fatal — layout has a fallback provisioner
        console.warn('[AuthCallback] Trial provision failed (non-fatal):', err.message);
    }

    return response;
}

function buildRedirectUrl(origin, forwardedHost, next) {
    const isLocal = process.env.NODE_ENV === 'development';
    if (isLocal) return `${origin}${next}`;
    if (forwardedHost) return `https://${forwardedHost}${next}`;
    return `${origin}${next}`;
}
