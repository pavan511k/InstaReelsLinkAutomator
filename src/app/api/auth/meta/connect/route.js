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
 * GET /api/auth/meta/connect?type=instagram|facebook|both
 * Redirects the user to the Facebook OAuth dialog
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const connectionType = searchParams.get('type') || 'instagram';

    // Validate connection type
    if (!['instagram', 'facebook', 'both'].includes(connectionType)) {
        return NextResponse.json(
            { error: 'Invalid connection type. Must be instagram, facebook, or both.' },
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

    // Build the OAuth URL with user ID as state (for CSRF protection + user mapping)
    const authUrl = buildAuthUrl(connectionType, user.id);

    return NextResponse.redirect(authUrl);
}
