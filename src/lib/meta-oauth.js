/**
 * Meta OAuth helper — builds authorization URLs and exchanges codes for tokens.
 *
 * Instagram connections use Instagram's own OAuth (instagram.com/oauth/authorize)
 * with the Instagram app credentials.
 * Facebook connections use Facebook's OAuth (facebook.com/dialog/oauth) with
 * the Facebook app credentials.
 */

import { GRAPH_FB_BASE, FB_OAUTH_BASE, GRAPH_IG_BASE } from '@/lib/meta-graph';

const META_APP_ID          = process.env.NEXT_PUBLIC_META_APP_ID;        // Facebook App ID
const INSTAGRAM_APP_ID     = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
const META_APP_SECRET      = process.env.META_APP_SECRET;                // Facebook App Secret
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
const APP_URL              = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const REDIRECT_URI         = `${APP_URL}/api/auth/meta/callback`;

// Instagram API with Instagram Login scopes.
const IG_SCOPES = [
    'instagram_business_basic',
    'instagram_business_manage_messages',
    'instagram_business_manage_comments', // REJECTED in App Review.
    // ⚠ This scope gates TWO things, not just one:
    //   1. RECEIVING `comments` webhook events. Without it Meta delivers
    //      DM events but NEVER delivers a comment event, so every
    //      comment-triggered automation silently does nothing.
    //   2. POSTING public comment replies via the Comment Reply API.
    // Resubmit for App Review to enable comment-trigger automations.
];

// Facebook Login scopes.
const FB_SCOPES = [
    'pages_show_list',
    'pages_read_engagement',   // REJECTED in App Review.
    // ⚠ Required to receive `feed` webhook events for FB Page comments
    //   AND for linked IG comments arriving via the Page subscription.
    //   Without it, only DMs (`messages`) are delivered.
    // 'pages_manage_engagement', // TO REQUEST in next App Review — needed for the Public Comment Reply feature (`replyToComment` posts via POST /{comment-id}/comments).
    'pages_manage_metadata',
    'pages_messaging',
];

/**
 * Build the OAuth authorization URL for the given connection type.
 *   instagram → Instagram Login (instagram.com)
 *   facebook  → Facebook Login (facebook.com)
 */
export function buildAuthUrl(connectionType, state) {
    const encodedState = `${connectionType}:${state}`;

    if (connectionType === 'instagram') {
        const params = new URLSearchParams({
            enable_fb_login:      '0',
            force_authentication: '1',
            client_id:            INSTAGRAM_APP_ID,
            redirect_uri:         REDIRECT_URI,
            response_type:        'code',
            scope:                IG_SCOPES.join(','),
            state:                encodedState,
        });
        return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
    }

    const params = new URLSearchParams({
        client_id:     META_APP_ID,
        redirect_uri:  REDIRECT_URI,
        scope:         FB_SCOPES.join(','),
        response_type: 'code',
        state:         encodedState,
    });
    return `${FB_OAUTH_BASE}/dialog/oauth?${params.toString()}`;
}

// ─── Instagram Token Exchange ───────────────────────────────────

/**
 * Exchange the OAuth code for an Instagram access token.
 * Uses Instagram's token endpoint (form-encoded POST).
 */
export async function exchangeCodeForInstagramToken(code) {
    const body = new URLSearchParams({
        client_id:     INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        grant_type:    'authorization_code',
        redirect_uri:  REDIRECT_URI,
        code,
    });

    const response = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        body,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error_message || error.error?.message || 'Failed to exchange code for Instagram token');
    }

    return response.json(); // { access_token, user_id, permissions? }
}

/**
 * Exchange short-lived Instagram token for the 60-day long-lived variant.
 *
 * Throws an error that satisfies `isInstagramAlreadyLongLivedError()` when
 * Meta rejects the exchange — that happens on the new IG-API-with-Login
 * flow where Step 1 already returns a long-lived token. Callers should
 * catch and reuse the original token in that case.
 */
export async function getInstagramLongLivedToken(shortLivedToken) {
    const params = new URLSearchParams({
        grant_type:    'ig_exchange_token',
        client_secret: INSTAGRAM_APP_SECRET,
        access_token:  shortLivedToken,
    });

    const response = await fetch(
        `https://graph.instagram.com/access_token?${params.toString()}`
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to get long-lived Instagram token');
    }

    return response.json(); // { access_token, token_type, expires_in }
}

/**
 * Fetch the Instagram user's profile via the IG Graph API.
 */
export async function getInstagramUserProfile(accessToken) {
    const response = await fetch(
        `${GRAPH_IG_BASE}/me?fields=user_id,username,profile_picture_url,name&access_token=${accessToken}`
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to fetch Instagram profile');
    }

    return response.json(); // { user_id, username, profile_picture_url, name }
}

// ─── Facebook Token Exchange ────────────────────────────────────

/**
 * Exchange code for Facebook access token (GET request)
 */
export async function exchangeCodeForFacebookToken(code) {
    const params = new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
    });

    const response = await fetch(
        `${GRAPH_FB_BASE}/oauth/access_token?${params.toString()}`
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to exchange code for Facebook token');
    }

    return response.json();
}

/**
 * Exchange short-lived FB token for long-lived token (60 days)
 */
export async function getFacebookLongLivedToken(shortLivedToken) {
    const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(
        `${GRAPH_FB_BASE}/oauth/access_token?${params.toString()}`
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to get long-lived Facebook token');
    }

    return response.json();
}

// ─── Shared Graph API Calls ─────────────────────────────────────

/**
 * Get user's Facebook Pages.
 *
 * Requests `picture.type(large){url}` so the OAuth callback can store the
 * Page's profile picture URL alongside id/name — mirrors the IG flow
 * where `getInstagramUserProfile` returns `profile_picture_url`.
 */
export async function getUserPages(accessToken) {
    const fields = 'id,name,access_token,picture.type(large){url}';
    const response = await fetch(
        `${GRAPH_FB_BASE}/me/accounts?fields=${fields}&access_token=${accessToken}`
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to fetch pages');
    }

    const data = await response.json();
    return data.data || [];
}

/**
 * Fetch the current profile-picture URL for a Facebook Page.
 *
 * Used by /api/accounts/refresh-profile-pic when the stored CDN URL has
 * expired. Returns the URL string or null. Mirrors the IG flow's
 * getInstagramUserProfile-based refresh.
 */
export async function getFacebookPagePicture(pageId, pageAccessToken) {
    const response = await fetch(
        `${GRAPH_FB_BASE}/${pageId}?fields=picture.type(large){url}&access_token=${encodeURIComponent(pageAccessToken)}`
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to fetch Page picture');
    }

    const data = await response.json();
    return data?.picture?.data?.url || null;
}

/**
 * Get the Instagram Business Account linked to a Facebook Page
 */
export async function getInstagramAccount(pageId, pageAccessToken) {
    const response = await fetch(
        `${GRAPH_FB_BASE}/${pageId}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${pageAccessToken}`
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to fetch Instagram account');
    }

    const data = await response.json();
    return data.instagram_business_account || null;
}

/**
 * Get Facebook user info
 */
export async function getMetaUser(accessToken) {
    const response = await fetch(
        `${GRAPH_FB_BASE}/me?fields=id,name&access_token=${accessToken}`
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to fetch user info');
    }

    return response.json();
}
