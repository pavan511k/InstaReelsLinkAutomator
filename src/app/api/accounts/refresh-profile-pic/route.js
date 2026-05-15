import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getInstagramUserProfile } from '@/lib/meta-oauth';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * POST /api/accounts/refresh-profile-pic
 * Body: { accountId }
 *
 * Refresh a connected account's stored Instagram profile-picture URL.
 *
 * Why: Meta's IG profile-picture URLs are short-lived signed CDN URLs
 * (typically expire after ~6h). The stored value goes stale even though
 * the account is still connected. The avatar UIs already fall back to
 * initials on <img onError>, but staying that way until the user
 * re-OAuths is bad UX. This endpoint is called from those onError
 * handlers to fetch a fresh URL from Meta and update the DB so the
 * fresh URL serves on the next render and for the next session.
 *
 * Performance: only fires when the browser actually fails to load the
 * image. Happy path (fresh URL) costs nothing — no Meta call, no DB
 * write. Idempotent: parallel calls for the same account return the
 * same fresh URL.
 *
 * Currently handles `platform === 'instagram'` only — FB-only accounts
 * don't render IG profile pictures (they show a platform icon instead).
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
        .select('id, platform, access_token, ig_profile_picture_url')
        .eq('id', accountId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

    if (lookupErr || !account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Only the IG-direct flow is supported here. For FB-only accounts
    // the UI shows a platform icon, no refresh needed.
    if (account.platform !== 'instagram' || !account.access_token) {
        return NextResponse.json({
            profilePictureUrl: account.ig_profile_picture_url || null,
            refreshed: false,
        });
    }

    try {
        const profile = await getInstagramUserProfile(account.access_token);
        const fresh = profile?.profile_picture_url || null;

        if (!fresh) {
            // Meta returned without a URL — keep whatever we had.
            return NextResponse.json({
                profilePictureUrl: account.ig_profile_picture_url || null,
                refreshed: false,
            });
        }

        // Only write if the URL actually changed — saves a needless DB
        // update on the rare case Meta returns the same URL.
        if (fresh !== account.ig_profile_picture_url) {
            await supabase
                .from('connected_accounts')
                .update({ ig_profile_picture_url: fresh })
                .eq('id', account.id)
                .eq('workspace_id', workspaceId);
        }

        return NextResponse.json({ profilePictureUrl: fresh, refreshed: true });
    } catch (err) {
        // Meta failures (rate limit, expired access token, network) are
        // non-fatal: the UI already shows initials as a fallback. Log
        // server-side and return a soft failure so the client doesn't
        // alarm the user about an avatar refresh.
        console.warn('[refresh-profile-pic] Meta refresh failed:', err.message);
        return NextResponse.json({
            profilePictureUrl: account.ig_profile_picture_url || null,
            refreshed: false,
            warning: err.message,
        });
    }
}
