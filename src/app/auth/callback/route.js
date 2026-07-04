// Not edge — provisionNewUser needs service-role access to user_plans.
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { WORKSPACE_COOKIE_NAME } from '@/lib/workspace-context';
import { provisionNewUser } from '@/lib/provision-new-user';

/**
 * GET /auth/callback
 *
 * OAuth (Google) callback — exchanges the PKCE `?code=` for a session, then
 * provisions the user's trial + workspace via the shared provisioner.
 *
 * Email links (signup confirmation, password reset) now use the token_hash
 * flow via `/auth/confirm` instead — that path doesn't depend on a client-side
 * PKCE code verifier, so it survives being opened on a different device or in
 * an email app's in-app browser (the failure this route hit for email links).
 */
export async function GET(request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';

    if (!code) {
        // No code → the provider step failed before reaching us (e.g. the user
        // cancelled Google consent). Forward Supabase's real error so /login can
        // message it correctly; fall back to auth_failed.
        const providerError = searchParams.get('error');
        if (providerError) {
            const params = new URLSearchParams({ error: providerError });
            const providerErrorCode = searchParams.get('error_code');
            const providerErrorDesc = searchParams.get('error_description');
            if (providerErrorCode) params.set('error_code', providerErrorCode);
            if (providerErrorDesc) params.set('error_description', providerErrorDesc);
            return NextResponse.redirect(`${origin}/login?${params.toString()}`);
        }
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

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !sessionData?.user) {
        console.error('[AuthCallback] Session exchange failed:', error?.message);
        return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // Provision trial + workspace (first-time users). Shared with /auth/confirm
    // so OAuth and email-link signups onboard identically. Non-fatal — the
    // dashboard layout has a tertiary fallback provisioner.
    let activeWorkspaceId = null;
    try {
        ({ activeWorkspaceId } = await provisionNewUser(sessionData.user));
    } catch (err) {
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
