import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { buildAuthUrl } from '@/lib/meta-oauth';

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

    // Build the OAuth URL with user ID as state (for CSRF protection + user mapping)
    const authUrl = buildAuthUrl(connectionType, user.id);

    return NextResponse.redirect(authUrl);
}
