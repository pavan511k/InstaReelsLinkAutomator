import { graphBase } from '@/lib/meta-graph';

/**
 * Fetches display name + username of an Instagram user (commenter / messager)
 * from the Graph API. Both fields are returned in a single call.
 *
 * Endpoint:
 *   GET /{ig-scoped-user-id}?fields=username,name
 *
 * Permission required: instagram_business_basic (already in the approved set).
 *
 * Behavior:
 *   - Returns { firstName, username } on success — each may be null if the
 *     field wasn't returned.
 *   - Returns { firstName: null, username: null } on any failure (network,
 *     permission, missing field). Callers fall back to a neutral string
 *     ("there") so DMs never leak the numeric IGSID or a literal placeholder.
 *
 * @param {string} igUserId    - The IG-scoped user ID of the commenter/messager.
 * @param {string} accessToken - Page or IG Business Login access token.
 * @param {boolean} useIgApi   - true → graph.instagram.com, false → graph.facebook.com.
 * @returns {Promise<{firstName: string|null, username: string|null}>}
 */
export async function fetchIgUserProfile(igUserId, accessToken, useIgApi = true) {
    const empty = { firstName: null, username: null };
    if (!igUserId || !accessToken) return empty;

    const base = graphBase(useIgApi);
    const url = `${base}/${igUserId}?fields=username,name&access_token=${encodeURIComponent(accessToken)}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.warn(`[IgProfile] Profile lookup failed for ${igUserId}:`, err.error?.message || res.status);
            return empty;
        }
        const data = await res.json();
        return {
            firstName: extractFirstName(data?.name),
            username:  data?.username || null,
        };
    } catch (err) {
        console.warn(`[IgProfile] Profile lookup threw for ${igUserId}:`, err.message);
        return empty;
    }
}

/**
 * Back-compat alias — returns only the first name. Prefer `fetchIgUserProfile`
 * in new code so the single Graph call gives you both fields.
 */
export async function fetchIgUserFirstName(igUserId, accessToken, useIgApi = true) {
    const { firstName } = await fetchIgUserProfile(igUserId, accessToken, useIgApi);
    return firstName;
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
