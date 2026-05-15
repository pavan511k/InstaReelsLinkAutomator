/**
 * Meta OAuth helper — builds authorization URLs and exchanges codes for tokens.
 * 
 * Instagram connections use Instagram's own OAuth (`instagram.com/oauth/authorize`)
 * Facebook connections use Facebook's OAuth (`facebook.com/dialog/oauth`)
 * Both connections use Facebook's OAuth (grants both IG + FB permissions)
 */

import { GRAPH_FB_BASE, GRAPH_IG_BASE, FB_OAUTH_BASE } from '@/lib/meta-graph';

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;                          // Facebook App ID
const INSTAGRAM_APP_ID = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID; // Instagram App ID (separate from FB)
const META_APP_SECRET = process.env.META_APP_SECRET;                              // Facebook App Secret
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET; // Instagram App Secret (separate from FB)
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, ''); // strip trailing slash
const REDIRECT_URI = `${APP_URL}/api/auth/meta/callback`;

// Instagram API with Instagram Login scopes.
const IG_SCOPES = [
    'instagram_business_basic',
    'instagram_business_manage_messages',
    // 'instagram_business_manage_comments', // REJECTED in App Review — uncomment once Meta approves it (needed for Public Comment Reply via API).
];

// Facebook Login scopes.
const FB_SCOPES = [
    'pages_show_list',
    // 'pages_read_engagement', // REJECTED in App Review — uncomment once Meta approves it (needed for FB Comment Resend feature).
    // 'pages_manage_engagement', // TO REQUEST in next App Review — needed for the Public Comment Reply feature (`replyToComment` posts via POST /{comment-id}/comments).
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
    const USE_INSTAGRAM_LOGIN = true;

    if (connectionType === 'instagram' && USE_INSTAGRAM_LOGIN) {
        // Instagram's own OAuth endpoint (shows Instagram login screen)
        const params = new URLSearchParams({
            enable_fb_login: '0',
            force_authentication: '1',
            client_id: INSTAGRAM_APP_ID,   // Instagram App ID — NOT the Facebook App ID
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
    return `${FB_OAUTH_BASE}/dialog/oauth?${params.toString()}`;
}

// ─── Instagram Token Exchange ───────────────────────────────────

/**
 * Exchange code for short-lived Instagram token
 * Uses Instagram's token endpoint (form-data POST).
 *
 * DEBUG LOGGING ENABLED: app has no production customers yet; user has
 * explicitly granted permission to log tokens + secrets while we
 * diagnose the non-Roles login failure. Remove the verbose logs before
 * any real launch.
 */
export async function exchangeCodeForInstagramToken(code) {
    const url = 'https://api.instagram.com/oauth/access_token';
    const body = new URLSearchParams({
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code,
    });

    console.log('[OAUTH_DEBUG] Step1 REQ', JSON.stringify({
        url,
        method: 'POST',
        body: {
            client_id:     INSTAGRAM_APP_ID,
            client_secret: INSTAGRAM_APP_SECRET,
            grant_type:    'authorization_code',
            redirect_uri:  REDIRECT_URI,
            code,
        },
    }));

    const response = await fetch(url, { method: 'POST', body });
    const rawText  = await response.text();
    let parsed;
    try { parsed = JSON.parse(rawText); } catch { parsed = { _raw: rawText }; }

    console.log('[OAUTH_DEBUG] Step1 RESP', JSON.stringify({
        status: response.status,
        ok:     response.ok,
        body:   parsed,
    }));

    if (!response.ok) {
        throw new Error(parsed?.error_message || parsed?.error?.message || `Step1 HTTP ${response.status}`);
    }
    return parsed;
}

/**
 * Exchange short-lived IG token for long-lived token (60 days).
 * Tries POST first (workaround for "Unsupported request - method type: get"
 * seen on non-Roles users), falls back to GET.
 */
export async function getInstagramLongLivedToken(shortLivedToken) {
    const url = 'https://graph.instagram.com/access_token';
    const params = new URLSearchParams({
        grant_type:    'ig_exchange_token',
        client_secret: INSTAGRAM_APP_SECRET,
        access_token:  shortLivedToken,
    });

    // Attempt POST first.
    console.log('[OAUTH_DEBUG] Step2 REQ (POST)', JSON.stringify({
        url,
        method: 'POST',
        body: {
            grant_type:    'ig_exchange_token',
            client_secret: INSTAGRAM_APP_SECRET,
            access_token:  shortLivedToken,
        },
    }));
    let response = await fetch(url, { method: 'POST', body: params });
    let rawText  = await response.text();
    let parsed;
    try { parsed = JSON.parse(rawText); } catch { parsed = { _raw: rawText }; }

    console.log('[OAUTH_DEBUG] Step2 RESP (POST)', JSON.stringify({
        status: response.status,
        ok:     response.ok,
        body:   parsed,
    }));

    if (response.ok) return parsed;

    // POST rejected — distinguish method-mismatch (retry as GET) from real failures.
    const firstMsg = parsed?.error?.message || parsed?.error_message || '';
    const methodMismatch =
        /method type/i.test(firstMsg) ||
        /unsupported.*method/i.test(firstMsg) ||
        response.status === 405;

    if (!methodMismatch) {
        throw new Error(firstMsg || `Step2 HTTP ${response.status}`);
    }

    // Fallback: GET.
    const getUrl = `${url}?${params.toString()}`;
    console.log('[OAUTH_DEBUG] Step2 REQ (GET fallback)', JSON.stringify({
        url: getUrl,
        method: 'GET',
    }));
    response = await fetch(getUrl);
    rawText  = await response.text();
    try { parsed = JSON.parse(rawText); } catch { parsed = { _raw: rawText }; }

    console.log('[OAUTH_DEBUG] Step2 RESP (GET fallback)', JSON.stringify({
        status: response.status,
        ok:     response.ok,
        body:   parsed,
    }));

    if (!response.ok) {
        throw new Error(parsed?.error?.message || parsed?.error_message || `Step2 HTTP ${response.status}`);
    }
    return parsed;
}

/**
 * Get Instagram user profile using Instagram API
 */
export async function getInstagramUserProfile(accessToken) {
    const url = `${GRAPH_IG_BASE}/me?fields=user_id,username,profile_picture_url,name&access_token=${accessToken}`;
    console.log('[OAUTH_DEBUG] Step3 REQ (GET)', JSON.stringify({ url }));

    const response = await fetch(url);
    const rawText  = await response.text();
    let parsed;
    try { parsed = JSON.parse(rawText); } catch { parsed = { _raw: rawText }; }

    console.log('[OAUTH_DEBUG] Step3 RESP', JSON.stringify({
        status: response.status,
        ok:     response.ok,
        body:   parsed,
    }));

    if (!response.ok) {
        throw new Error(parsed?.error?.message || parsed?.error_message || `Step3 HTTP ${response.status}`);
    }
    return parsed;
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
 * Get user's Facebook Pages
 */
export async function getUserPages(accessToken) {
    const response = await fetch(
        `${GRAPH_FB_BASE}/me/accounts?access_token=${accessToken}`
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
