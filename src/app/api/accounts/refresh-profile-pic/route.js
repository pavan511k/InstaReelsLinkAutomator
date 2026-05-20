import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getInstagramUserProfile, getFacebookPagePicture } from '@/lib/meta-oauth';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * POST /api/accounts/refresh-profile-pic
 * Body: { accountId }
 *
 * Refresh a connected account's stored profile-picture URL.
 *
 * Why: Meta's profile-picture URLs (both IG and FB Page) are short-lived
 * signed CDN URLs (typically expire after ~6h). The stored value goes
 * stale even though the account is still connected. The avatar UIs
 * already fall back to initials on <img onError>, but staying that way
 * until the user re-OAuths is bad UX. This endpoint is called from
 * those onError handlers to fetch a fresh URL from Meta and update the
 * DB so the fresh URL serves on the next render and for the next session.
 *
 * Performance: only fires when the browser actually fails to load the
 * image. Happy path (fresh URL) costs nothing — no Meta call, no DB
 * write. Idempotent: parallel calls for the same account return the
 * same fresh URL.
 *
 * Handles both platforms:
 *   • IG-direct accounts → calls getInstagramUserProfile, updates
 *     ig_profile_picture_url.
 *   • FB Page accounts   → calls getFacebookPagePicture on the page
 *     id with the page access token, updates fb_page_picture_url.
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const workspaceId = await getActiveWorkspaceId(supabase);
    if (!workspaceId) return NextResponse.json({ error: 'No active workspace' }, { status: 400 });

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { accountId } = body;
    if (!accountId) {
        return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Look up the account. RLS already constrains by user_id but we
    // also filter explicitly so a wrong-id call returns 404 not silent.
    const { data: account, error: lookupErr } = await supabase
        .from('connected_accounts')
        .select('id, platform, access_token, fb_page_id, fb_page_access_token, ig_profile_picture_url, fb_page_picture_url')
        .eq('id', accountId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

    if (lookupErr || !account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Decide which picture to refresh based on what the row actually has.
    // IG takes priority for 'both' rows (IG picture is what the sidebar
    // showed previously).
    const isIg = !!account.ig_profile_picture_url || account.platform === 'instagram';
    const isFb = !isIg && account.fb_page_id;

    if (isIg && account.access_token) {
        try {
            const profile = await getInstagramUserProfile(account.access_token);
            const fresh = profile?.profile_picture_url || null;

            if (!fresh) {
                return NextResponse.json({
                    profilePictureUrl: account.ig_profile_picture_url || null,
                    refreshed: false,
                });
            }

            if (fresh !== account.ig_profile_picture_url) {
                await supabase
                    .from('connected_accounts')
                    .update({ ig_profile_picture_url: fresh })
                    .eq('id', account.id)
                    .eq('workspace_id', workspaceId);
            }

            return NextResponse.json({ profilePictureUrl: fresh, refreshed: true });
        } catch (err) {
            console.warn('[refresh-profile-pic] IG refresh failed:', err.message);
            return NextResponse.json({
                profilePictureUrl: account.ig_profile_picture_url || null,
                refreshed: false,
                warning: err.message,
            });
        }
    }

    if (isFb && account.fb_page_access_token) {
        try {
            const fresh = await getFacebookPagePicture(account.fb_page_id, account.fb_page_access_token);

            if (!fresh) {
                return NextResponse.json({
                    profilePictureUrl: account.fb_page_picture_url || null,
                    refreshed: false,
                });
            }

            if (fresh !== account.fb_page_picture_url) {
                await supabase
                    .from('connected_accounts')
                    .update({ fb_page_picture_url: fresh })
                    .eq('id', account.id)
                    .eq('workspace_id', workspaceId);
            }

            return NextResponse.json({ profilePictureUrl: fresh, refreshed: true });
        } catch (err) {
            console.warn('[refresh-profile-pic] FB refresh failed:', err.message);
            return NextResponse.json({
                profilePictureUrl: account.fb_page_picture_url || null,
                refreshed: false,
                warning: err.message,
            });
        }
    }

    // No actionable token on the row — soft-fail with whatever's stored.
    return NextResponse.json({
        profilePictureUrl: account.ig_profile_picture_url || account.fb_page_picture_url || null,
        refreshed: false,
    });
}
