/**
 * Meta OAuth helper — builds authorization URLs and exchanges codes for tokens.
 * 
 * Instagram connections use Instagram's own OAuth (`instagram.com/oauth/authorize`)
 * Facebook connections use Facebook's OAuth (`facebook.com/dialog/oauth`)
 * Both connections use Facebook's OAuth (grants both IG + FB permissions)
 */

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const REDIRECT_URI = `${APP_URL}/api/auth/meta/callback`;

// Instagram API with Instagram Login scopes
const IG_SCOPES = [
    'instagram_business_basic',
    'instagram_business_manage_messages',
    'instagram_business_manage_comments',
];

// Facebook Login scopes
const FB_SCOPES = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_metadata',
    'pages_messaging',
];

// Combined scopes for "Both" (uses Facebook Login + Instagram permissions)
const BOTH_SCOPES = [
    'instagram_basic',
    'instagram_manage_comments',
    'instagram_manage_messages',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_metadata',
    'pages_messaging',
];

/**
 * Build the OAuth authorization URL
 * Instagram → Instagram Login (instagram.com)
 * Facebook → Facebook Login (facebook.com)
 * Both → Facebook Login with IG permissions
 */
export function buildAuthUrl(connectionType, state) {
    const encodedState = `${connectionType}:${state}`;

    // NOTE: To use Instagram's native login screen (instagram.com/oauth/authorize),
    // you need to configure "Instagram > API Setup with Instagram Login" in your
    // Meta Developer App. Once configured, set USE_INSTAGRAM_LOGIN = true.
    const USE_INSTAGRAM_LOGIN = false;

    if (connectionType === 'instagram' && USE_INSTAGRAM_LOGIN) {
        // Instagram's own OAuth endpoint (shows Instagram login screen)
        const params = new URLSearchParams({
            enable_fb_login: '0',
            force_authentication: '1',
            client_id: META_APP_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            scope: IG_SCOPES.join(','),
            state: encodedState,
        });
        return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
    }

    // Use Facebook OAuth with appropriate scopes
    // For Instagram: uses IG permissions via Facebook Login (works without extra config)
    const scopeMap = {
        instagram: BOTH_SCOPES, // IG permissions granted via Facebook Login
        facebook: FB_SCOPES,
        both: BOTH_SCOPES,
    };
    const scopes = scopeMap[connectionType] || BOTH_SCOPES;
    const params = new URLSearchParams({
        client_id: META_APP_ID,
        redirect_uri: REDIRECT_URI,
        scope: scopes.join(','),
        response_type: 'code',
        state: encodedState,
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

// ─── Instagram Token Exchange ───────────────────────────────────

/**
 * Exchange code for short-lived Instagram token
 * Uses Instagram's token endpoint (form-data POST)
 */
export async function exchangeCodeForInstagramToken(code) {
    const body = new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code,
    });

    const response = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        body,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error_message || 'Failed to exchange code for Instagram token');
    }

    return response.json(); // { access_token, user_id }
}

/**
 * Exchange short-lived IG token for long-lived token (60 days)
 */
export async function getInstagramLongLivedToken(shortLivedToken) {
    const params = new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: META_APP_SECRET,
        access_token: shortLivedToken,
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
 * Get Instagram user profile using Instagram API
 */
export async function getInstagramUserProfile(accessToken) {
    const response = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=user_id,username,profile_picture_url,name&access_token=${accessToken}`
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
        `https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`
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
        `https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to get long-lived Facebook token');
    }

    return response.json();
}

// ─── Shared Graph API Calls ─────────────────────────────────────

/**
 * Get user's Facebook Pages
 */
export async function getUserPages(accessToken) {
    const response = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to fetch pages');
    }

    const data = await response.json();
    return data.data || [];
}

/**
 * Get the Instagram Business Account linked to a Facebook Page
 */
export async function getInstagramAccount(pageId, pageAccessToken) {
    const response = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${pageAccessToken}`
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
        `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to fetch user info');
    }

    return response.json();
}
