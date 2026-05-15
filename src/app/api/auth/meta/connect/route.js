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

    // Get the logged-in user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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

    // Cross-platform conflict check — only one active platform at a time.
    // Reconnecting the SAME platform is fine (token refresh); switching to
    // a DIFFERENT platform requires explicit disconnect first.
    const { data: activeAccounts } = await supabase
        .from('connected_accounts')
        .select('platform')
        .eq('user_id', user.id)
        .eq('is_active', true);

    if (activeAccounts && activeAccounts.length > 0) {
        const conflictRow = activeAccounts.find((a) => a.platform !== connectionType);
        if (conflictRow) {
            // Send them to Settings — that's where they need to disconnect to
            // proceed. Dashboard has no UI to surface this error since the
            // ConnectAccount component (which owns the error banner) only
            // renders when zero accounts are connected.
            const url = new URL('/settings', request.url);
            url.searchParams.set('error', 'disconnect_first');
            return NextResponse.redirect(url);
        }
    }

    // Build the OAuth URL with user ID as state (for CSRF protection + user mapping)
    const authUrl = buildAuthUrl(connectionType, user.id);

    return NextResponse.redirect(authUrl);
}
