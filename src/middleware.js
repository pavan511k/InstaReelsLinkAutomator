import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Maintenance / closed-beta gate. While MAINTENANCE_MODE=true, any
// authenticated user whose email isn't on ALLOWED_EMAILS gets bounced from
// the real app to /coming-soon. Marketing pages, login, and signup stay
// open so visitors can still register interest — they just can't reach the
// dashboard until Meta verification is complete and we flip this off.
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const isEmailAllowlisted = (email) =>
    !!email && ALLOWED_EMAILS.includes(email.toLowerCase());

export async function middleware(request) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Protected routes — redirect to login if not authenticated
    // Legacy /posts, /stories, /global-automations, /welcome-openers
    // were removed; the new builder covers the same use cases.
    const isAdminRoute = pathname.startsWith('/admin');
    const isProtectedRoute = pathname.startsWith('/dashboard') ||
        pathname.startsWith('/automations') ||
        pathname.startsWith('/contacts') ||
        pathname.startsWith('/tools') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/leads') ||
        isAdminRoute;

    const isAuthRoute = pathname === '/login' || pathname === '/signup';
    const isBypassRoute = pathname === '/reset-password' || pathname === '/verify';
    const isComingSoonRoute = pathname === '/coming-soon';

    // Never redirect away from these — needed post-email-link
    if (isBypassRoute) return supabaseResponse;

    if (isProtectedRoute && !user) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // Admin tools always require allowlist — independent of MAINTENANCE_MODE.
    // Non-admins get silently redirected to the dashboard so /admin doesn't
    // even hint at being a route. Allowlisted users pass through.
    if (isAdminRoute && user && !isEmailAllowlisted(user.email)) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        url.search = '';
        return NextResponse.redirect(url);
    }

    // Closed-beta gate: authed but not allowlisted → coming-soon page when
    // they try to reach the app surface. We exclude /coming-soon itself so
    // the redirect doesn't loop.
    if (
        MAINTENANCE_MODE &&
        user &&
        !isEmailAllowlisted(user.email) &&
        !isComingSoonRoute &&
        (isProtectedRoute || isAuthRoute)
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/coming-soon';
        url.search = '';
        return NextResponse.redirect(url);
    }

    // Redirect logged-in users away from auth pages
    if (isAuthRoute && user) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
