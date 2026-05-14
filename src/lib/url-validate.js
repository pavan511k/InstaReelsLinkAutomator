/**
 * Meta-compatible URL validator for button-template URLs.
 *
 * Meta accepts only fully-qualified http(s) URLs with a real hostname
 * (i.e. at least one dot, so a TLD is present). It rejects:
 *   - `https://shopnow`              — no TLD, no dot in hostname
 *   - `shopnow.com`                  — no scheme
 *   - `https://shop now.com`         — spaces
 *   - `javascript:alert(1)`          — disallowed scheme
 *
 * Reproducing the check on our side gives users a clear save-time error
 * instead of a cryptic "The provided Url is invalid" at DM-send time.
 *
 * Returns true when Meta is expected to accept the URL.
 */
export function isValidButtonUrl(url) {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    if (/\s/.test(trimmed)) return false;

    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        return false;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    // Meta requires a TLD — hostnames like "shopnow" (no dot) are rejected.
    if (!parsed.hostname.includes('.')) return false;

    return true;
}
