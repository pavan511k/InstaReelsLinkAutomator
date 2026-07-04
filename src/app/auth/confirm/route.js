// Not edge — provisionNewUser needs service-role access to user_plans.
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { WORKSPACE_COOKIE_NAME } from '@/lib/workspace-context';
import { provisionNewUser } from '@/lib/provision-new-user';

/**
 * GET /auth/confirm?token_hash=...&type=signup|recovery&next=...
 *
 * Handles Supabase email links (signup confirmation, password reset, magic
 * link) via the token_hash + verifyOtp flow.
 *
 * Why this exists separately from /auth/callback: the PKCE `?code=` flow
 * requires the code verifier that the browser stored at signup time. Email
 * links are routinely opened in a DIFFERENT context — the email app's in-app
 * browser, or another device — where that verifier cookie doesn't exist, so
 * `exchangeCodeForSession` fails with "PKCE code verifier not found in
 * storage." That's exactly why email/password confirmations weren't
 * completing (no session, no trial email) while Google — a single continuous
 * browser session — worked. `verifyOtp` needs no verifier, so it works from
 * any device/browser.
 *
 * Requires the Supabase email templates to link here with `{{ .TokenHash }}`
 * (see the deploy note that ships with this change).
 */
export async function GET(request) {
    const { searchParams, origin } = new URL(request.url);
    const tokenHash = searchParams.get('token_hash');
    const type      = searchParams.get('type');            // 'signup' | 'recovery' | 'email' | 'magiclink'
    const next      = searchParams.get('next') ?? '/dashboard';

    if (!tokenHash || !type) {
        return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

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

    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (error || !data?.user) {
        // Expired / invalid / already-used link. Surface it with the same
        // taxonomy /login already understands (otp_expired → "request a new
        // link"), so the user isn't dead-ended.
        console.warn('[AuthConfirm] verifyOtp failed:', error?.message);
        const params = new URLSearchParams({
            error:             'access_denied',
            error_code:        'otp_expired',
            error_description: error?.message || 'Email link is invalid or has expired',
        });
        return NextResponse.redirect(`${origin}/login?${params.toString()}`);
    }

    // Password recovery just needs the session set, then the reset form (the
    // template sends next=/reset-password). Signup/confirmation is a first-time
    // auth → provision trial + workspace via the shared provisioner.
    if (type !== 'recovery') {
        let activeWorkspaceId = null;
        try {
            ({ activeWorkspaceId } = await provisionNewUser(data.user));
        } catch (err) {
            console.warn('[AuthConfirm] Trial/workspace provision failed (non-fatal):', err.message);
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
    }

    return response;
}

function buildRedirectUrl(origin, forwardedHost, next) {
    const isLocal = process.env.NODE_ENV === 'development';
    if (isLocal) return `${origin}${next}`;
    if (forwardedHost) return `https://${forwardedHost}${next}`;
    return `${origin}${next}`;
}
