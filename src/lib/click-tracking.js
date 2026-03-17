/**
 * Click Tracking Utilities
 * Edge-compatible — no Node.js crypto.
 *
 * Responsibilities:
 *  1. Extract all outgoing URLs from a dm_config object
 *  2. Generate short tracking codes (8-char hex, edge crypto)
 *  3. Batch-upsert codes into dm_link_codes via Supabase
 *  4. Build a trackingMap { originalUrl → 'https://app.com/r/code' }
 *     that send-dm.js uses to replace URLs before sending
 */

/** Generate an 8-character lowercase hex code using Edge-compatible crypto */
export function generateCode() {
    const arr = new Uint8Array(4); // 4 bytes = 8 hex chars
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract every distinct outgoing URL from a dm_config object.
 * Covers: button_template, multi_cta, follow_up (all reward types).
 * Returns an array of unique, non-empty URL strings.
 */
export function extractUrlsFromConfig(dmConfig) {
    const urls = new Set();
    if (!dmConfig) return [];

    const addUrl = (u) => { if (u && typeof u === 'string' && u.startsWith('http')) urls.add(u.trim()); };

    switch (dmConfig.type) {
        case 'button_template':
            for (const slide of (dmConfig.slides || [])) {
                addUrl(slide.buttonUrl);
                for (const btn of (slide.buttons || [])) addUrl(btn.value);
            }
            break;

        case 'multi_cta':
            for (const btn of (dmConfig.buttons || [])) addUrl(btn.url);
            break;

        case 'follow_up': {
            // Reward DM can itself be button_template, multi_cta, or message
            const ldc = dmConfig.linkDmConfig || {};
            if (dmConfig.linkDmType === 'button_template') {
                for (const slide of (ldc.slides || [])) addUrl(slide.buttonUrl);
            } else if (dmConfig.linkDmType === 'multi_cta') {
                for (const btn of (ldc.buttons || [])) addUrl(btn.url);
            }
            // message_template: plain text — URLs inside text not wrapped (too fragile)
            break;
        }

        case 'message_template':
        case 'quick_reply':
        default:
            // No structured URL fields — skip
            break;
    }

    return Array.from(urls);
}

/**
 * Ensure all URLs in the config have tracking codes in the DB.
 * Uses INSERT ... ON CONFLICT DO NOTHING so existing codes are preserved.
 * Returns a map: { originalUrl → fullTrackedUrl }
 *
 * @param {string[]} urls         - list of URLs to track
 * @param {string}   automationId
 * @param {string}   userId
 * @param {object}   supabase     - Supabase client (service role recommended)
 * @param {string}   appUrl       - e.g. 'https://autodm.app'
 * @param {string|null} abVariant  - 'A', 'B', or null for non-AB automations
 * @returns {Promise<Record<string, string>>}
 */
export async function buildTrackingMap(urls, automationId, userId, supabase, appUrl, abVariant = null) {
    if (!urls || urls.length === 0) return {};

    const base = (appUrl || '').replace(/\/$/, '');

    // Prepare rows — generate a code for each URL
    const rows = urls.map((url) => ({
        code:          generateCode(),
        original_url:  url,
        automation_id: automationId,
        user_id:       userId,
        ab_variant:    abVariant,
    }));

    // For A/B, the conflict key is (automation_id, original_url, ab_variant).
    // For non-AB it's just (automation_id, original_url).
    // Supabase ignoreDuplicates handles both since the unique index already covers this.
    const { error: upsertErr } = await supabase
        .from('dm_link_codes')
        .upsert(rows, { onConflict: 'automation_id,original_url', ignoreDuplicates: true });

    if (upsertErr) {
        console.warn('[ClickTracking] Upsert error (non-fatal):', upsertErr.message);
        // Return empty map — DMs still send with original URLs
        return {};
    }

    // Fetch the definitive codes for this automation (may differ from generated ones on conflict)
    const { data: stored } = await supabase
        .from('dm_link_codes')
        .select('code, original_url')
        .eq('automation_id', automationId)
        .in('original_url', urls);

    const map = {};
    for (const row of (stored || [])) {
        map[row.original_url] = `${base}/r/${row.code}`;
    }

    return map;
}

/**
 * Given a URL and a trackingMap, return the tracked version.
 * Falls back to the original URL if the map doesn't contain it.
 */
export function applyTracking(url, trackingMap) {
    if (!trackingMap || !url) return url;
    return trackingMap[url] || url;
}
