import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { buildAuthUrl } from '@/lib/meta-oauth';

// Closed-beta gate for Facebook. While FB_BETA_MODE=true, only users on
// ALLOWED_EMAILS can initiate a Facebook OAuth. Everyone else is sent
// back to the dashboard with a "Coming soon" message. Flip
// FB_BETA_MODE=false after smoke-testing to open FB to all users.
// ALLOWED_EMAILS is the same list used by middleware's maintenance gate.
const FB_BETA_MODE = process.env.FB_BETA_MODE === 'true';
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const isEmailAllowlisted = (email) =>
    !!email && ALLOWED_EMAILS.includes(email.toLowerCase());

/**
 * GET /api/auth/meta/connect?type=instagram|facebook
 * Redirects the user to the Meta OAuth dialog.
 *
 * Rule: a user can have ONE active platform at a time (IG XOR FB). If
 * they're already connected to one and request the OTHER, we bounce
 * them back to /dashboard with a friendly "disconnect first" message.
 * Re-OAuth of the SAME platform is allowed (token refresh / scope update).
 *
 * The legacy 'both' type is no longer accepted for new connections, but
 * existing connected_accounts rows with platform='both' keep working —
 * the OAuth callback still handles that value defensively.
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const connectionType = searchParams.get('type') || 'instagram';

    // Validate connection type — 'both' removed; single-platform only.
    if (!['instagram', 'facebook'].includes(connectionType)) {
        return NextResponse.json(
            { error: 'Invalid connection type. Must be instagram or facebook.' },
            { status: 400 }
        );
    }

    // Get the logged-in user. Two paths:
    //   1. Web flow → session cookie (existing behavior).
    //   2. Mobile flow → ?token= query param carrying the Supabase JWT.
    //      We can't share cookies with WebBrowser.openAuthSessionAsync, so
    //      the mobile app passes the JWT in the URL. Validated via the
    //      admin client.
    const isMobile = searchParams.get('source') === 'mobile';
    const mobileToken = searchParams.get('token');

    let user = null;
    let supabase = null; // user-context client; only created on web flow

    if (isMobile && mobileToken) {
        try {
            const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
            const adminClient = createSupabaseClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY,
            );
            const { data, error: tokenError } = await adminClient.auth.getUser(mobileToken);
            if (tokenError) {
                console.warn('[OAuth/Connect] Mobile token rejected:', tokenError.message);
            } else {
                user = data.user;
            }
        } catch (err) {
            console.warn('[OAuth/Connect] Mobile token validation threw:', err.message);
        }
    } else {
        supabase = await createClient();
        ({ data: { user } } = await supabase.auth.getUser());
    }

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // FB closed-beta gate — block FB initiation for users outside the
    // allowlist. Direct URL hits get the same treatment as the UI button.
    if (connectionType === 'facebook' && FB_BETA_MODE && !isEmailAllowlisted(user.email)) {
        const url = new URL('/dashboard', request.url);
        url.searchParams.set('error', 'fb_coming_soon');
        return NextResponse.redirect(url);
    }

    // Cross-platform conflict check (web flow only). We skip this for mobile
    // because the cookie-bound getActiveWorkspaceId isn't available there,
    // and the same protection still fires at the callback step via the
    // unique-index conflict path. Mobile users get the
    // `account_in_other_workspace` / `account_in_use_elsewhere` deep-link
    // response instead of the `disconnect_first` preflight.
    if (!isMobile && supabase) {
        const { getActiveWorkspaceId } = await import('@/lib/workspace-context');
        const workspaceId = await getActiveWorkspaceId(supabase);
        if (workspaceId) {
            const { data: activeAccounts } = await supabase
                .from('connected_accounts')
                .select('platform')
                .eq('workspace_id', workspaceId)
                .eq('is_active', true);

            if (activeAccounts && activeAccounts.length > 0) {
                const conflictRow = activeAccounts.find((a) => a.platform !== connectionType);
                if (conflictRow) {
                    const url = new URL('/settings', request.url);
                    url.searchParams.set('error', 'disconnect_first');
                    return NextResponse.redirect(url);
                }
            }
        }
    }

    // Build the OAuth URL with user ID as state. When initiated by the
    // mobile app, append `:mobile` so the callback knows to redirect
    // back to the autodm:// deep link instead of the web `/settings`
    // route. Web flows are unchanged.
    const stateArg = isMobile ? `${user.id}:mobile` : user.id;
    const authUrl  = buildAuthUrl(connectionType, stateArg);

    return NextResponse.redirect(authUrl);
}
