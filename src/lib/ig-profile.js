import { graphBase } from '@/lib/meta-graph';

/**
 * Fetches the display name of an Instagram user (commenter / messager) from
 * the Graph API and returns the first whitespace-delimited token, suitable
 * for substituting {first_name} in DM templates.
 *
 * Endpoint:
 *   GET /{ig-scoped-user-id}?fields=name
 *
 * Permission required: instagram_business_basic (already in the approved set).
 *
 * Behavior:
 *   - Returns the first word of `name` on success.
 *   - Returns null on any failure (network, permission, missing field). Callers
 *     fall back to a neutral string ("there") so DMs never leak the numeric
 *     IGSID or a literal {first_name}.
 *
 * @param {string} igUserId    - The IG-scoped user ID of the commenter/messager.
 * @param {string} accessToken - Page or IG Business Login access token.
 * @param {boolean} useIgApi   - true → graph.instagram.com, false → graph.facebook.com.
 * @returns {Promise<string|null>}
 */
export async function fetchIgUserFirstName(igUserId, accessToken, useIgApi = true) {
    if (!igUserId || !accessToken) return null;

    const base = graphBase(useIgApi);
    const url = `${base}/${igUserId}?fields=name&access_token=${encodeURIComponent(accessToken)}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.warn(`[IgProfile] Name lookup failed for ${igUserId}:`, err.error?.message || res.status);
            return null;
        }
        const data = await res.json();
        return extractFirstName(data?.name);
    } catch (err) {
        console.warn(`[IgProfile] Name lookup threw for ${igUserId}:`, err.message);
        return null;
    }
}

/**
 * Pulls the first whitespace-delimited token from a display name. Used by
 * both the IG fetch path and the FB webhook path (which gets `from.name`
 * directly in the payload).
 *
 * @param {string|null|undefined} displayName
 * @returns {string|null}  First word, or null when input is empty/whitespace.
 */
export function extractFirstName(displayName) {
    if (!displayName || typeof displayName !== 'string') return null;
    const first = displayName.trim().split(/\s+/)[0];
    return first || null;
}
