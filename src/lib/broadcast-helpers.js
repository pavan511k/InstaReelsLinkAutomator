import { GRAPH_FB_BASE as GRAPH_BASE, GRAPH_IG_BASE } from '@/lib/meta-graph';

/**
 * Parse a raw comma-separated keyword string into a normalised array.
 * Returns [] when no keywords are provided (means "no filter — include all").
 */
export function parseKeywords(raw) {
    return (raw || '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
}

/**
 * Paginate through all comments on an IG/FB post and return unique commenter IDs.
 * Excludes the account owner's own ID.
 * Capped at 5,000 unique commenters for memory safety.
 *
 * @param {string}   igMediaId   — our internal media ID (may have 'fb_' prefix)
 * @param {string}   accessToken
 * @param {string}   ownerIgId   — excluded from results
 * @param {boolean}  useIgApi    — true → graph.instagram.com, false → graph.facebook.com
 * @param {string[]} keywords    — pre-parsed lowercase keywords; empty = no filter
 * @returns {Promise<string[]>}
 */
export async function fetchAllCommenters(igMediaId, accessToken, ownerIgId, useIgApi = false, keywords = []) {
    const seen        = new Set();
    const MAX         = 5_000;
    const hasKeywords = keywords.length > 0;

    // 'fb_' prefix is our internal convention — strip it before the Graph API call.
    const rawMediaId = igMediaId.startsWith('fb_') ? igMediaId.slice(3) : igMediaId;

    const base = useIgApi ? GRAPH_IG_BASE : GRAPH_BASE;

    // Instagram uses 'text'; Facebook uses 'message'. Only request the text
    // field when keyword filtering is active — avoids unnecessary data transfer.
    const textField = useIgApi ? 'text' : 'message';
    const fields    = hasKeywords ? `id,from,${textField}` : 'id,from';

    let url = `${base}/${rawMediaId}/comments`
        + `?fields=${fields}`
        + `&limit=100`
        + `&access_token=${encodeURIComponent(accessToken)}`;

    while (url && seen.size < MAX) {
        let data;
        try {
            const res = await fetch(url);
            if (!res.ok) break;
            data = await res.json();
        } catch {
            break;
        }

        for (const comment of (data.data || [])) {
            const fromId = comment.from?.id;
            if (!fromId || fromId === ownerIgId) continue;

            if (hasKeywords) {
                const text = (comment[textField] || '').toLowerCase();
                if (!keywords.some((kw) => text.includes(kw))) continue;
            }

            seen.add(fromId);
        }

        url = data.paging?.next || null;
    }

    return Array.from(seen);
}
