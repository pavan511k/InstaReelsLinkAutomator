import { NextResponse } from 'next/server';

const FETCH_TIMEOUT_MS = 12000;

// ── Domain classifier ──────────────────────────────────────────────────────────
function getDomainKey(hostname) {
    const h = hostname.toLowerCase();
    // amzn.in / amzn.to / amzn.eu are Amazon short-links that redirect to full product pages
    if (h.includes('amazon.') || h.includes('amzn.')) return 'amazon';
    if (h.includes('myntra.'))   return 'myntra';
    if (h.includes('meesho.'))   return 'meesho';
    if (h.includes('flipkart.')) return 'flipkart';
    if (h.includes('nykaa.'))    return 'nykaa';
    if (h.includes('ajio.'))     return 'ajio';
    if (h.includes('snapdeal.')) return 'snapdeal';
    return 'generic';
}

/**
 * POST /api/url-metadata
 * Fetches Open Graph metadata (title, image, description) from a given URL.
 * Supports Amazon, Myntra, Meesho, Flipkart, Nykaa, Ajio, and generic sites.
 * Returns: { title, image, description, domain }
 */
export async function POST(request) {
    try {
        const { url } = await request.json();

        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are supported' }, { status: 400 });
        }

        // Use let — short-links (amzn.in) redirect; we re-classify using the final URL after fetch
        let domainKey = getDomainKey(parsedUrl.hostname);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-IN,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Upgrade-Insecure-Requests': '1',
                },
                redirect: 'follow',
            });

            clearTimeout(timeoutId);

            // Re-classify using the final URL after any redirects
            // e.g. amzn.in/d/xxx  →  redirect follows →  amazon.in/dp/xxx
            // This is the safety net if getDomainKey already matched amzn. above.
            if (response.url) {
                try {
                    const finalKey = getDomainKey(new URL(response.url).hostname);
                    if (finalKey !== 'generic') domainKey = finalKey;
                    parsedUrl = new URL(response.url);
                } catch { /* keep original domainKey */ }
            }

            // For 403 responses (Meesho, Flipkart, etc.) — don’t bail immediately.
            // Many of these pages still embed og:image / og:title in the HTML body.
            // Try to parse what we get; only return an error if we extract nothing at all.
            const is403 = response.status === 403;
            if (!response.ok && !is403) {
                return NextResponse.json(
                    { error: `Failed to fetch URL (${response.status})` },
                    { status: 422 },
                );
            }

            const contentType = response.headers.get('content-type') || '';
            const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');

            // For a non-HTML non-ok response we can’t do anything useful
            if (!isHtml && !response.ok) {
                return NextResponse.json(
                    { error: `Failed to fetch URL (${response.status})` },
                    { status: 422 },
                );
            }

            if (!isHtml) {
                return NextResponse.json(
                    { error: 'URL does not return HTML content' },
                    { status: 422 },
                );
            }

            // Read first 150 KB — product image maps are often embedded deep in the page
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let html = '';
            const MAX_BYTES = 150 * 1024;

            while (html.length < MAX_BYTES) {
                const { done, value } = await reader.read();
                if (done) break;
                html += decoder.decode(value, { stream: true });
            }
            reader.cancel();

            const metadata = parseMetadata(html, domainKey);
            metadata.domain = parsedUrl.hostname.replace('www.', '');

            // If we got a 403 and couldn’t extract anything useful, surface a clear error
            if (is403 && !metadata.title && !metadata.image) {
                return NextResponse.json(
                    { error: `This site blocked the request (403). Try uploading the image manually.` },
                    { status: 422 },
                );
            }

            return NextResponse.json(metadata);
        } catch (fetchErr) {
            clearTimeout(timeoutId);
            if (fetchErr.name === 'AbortError') {
                return NextResponse.json({ error: 'Request timed out' }, { status: 408 });
            }
            return NextResponse.json(
                { error: `Failed to fetch: ${fetchErr.message}` },
                { status: 422 },
            );
        }
    } catch (err) {
        return NextResponse.json(
            { error: `Server error: ${err.message}` },
            { status: 500 },
        );
    }
}

// ── Main metadata parser ───────────────────────────────────────────────────────
function parseMetadata(html, domainKey) {
    const result = { title: '', image: '', description: '' };

    // ─ Title ──────────────────────────────────────────────────────────────────
    const ogTitle = extractMetaContent(html, 'og:title');
    if (ogTitle) {
        result.title = ogTitle;
    } else {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) result.title = decodeHTMLEntities(titleMatch[1].trim());
    }
    // Strip trailing site-name suffixes like " - Amazon.in" or " | Myntra"
    result.title = result.title
        .replace(/\s*[\-|]\s*(Amazon|Myntra|Meesho|Flipkart|Nykaa|Ajio|Snapdeal)[^|\-]*$/i, '')
        .trim();

    // ─ Image — OG first, then platform-specific ───────────────────────────────
    const ogImage = extractMetaContent(html, 'og:image');
    if (ogImage && !isBadImage(ogImage)) result.image = ogImage;

    // Platform extractors always run for known shops (OG image is often wrong/low-res)
    let platformImage = null;
    switch (domainKey) {
        case 'amazon':   platformImage = extractAmazonImage(html);   break;
        case 'myntra':   platformImage = extractMyntraImage(html);   break;
        case 'meesho':   platformImage = extractMeeshoImage(html);   break;
        case 'flipkart': platformImage = extractFlipkartImage(html); break;
        default:
            if (!result.image) platformImage = extractGenericImage(html);
            break;
    }
    if (platformImage) result.image = platformImage;

    // ─ Description ────────────────────────────────────────────────────────────
    const ogDesc = extractMetaContent(html, 'og:description');
    if (ogDesc) {
        result.description = ogDesc;
    } else {
        const descMatch =
            html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,})["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']{10,})["'][^>]+name=["']description["']/i);
        if (descMatch) result.description = decodeHTMLEntities(descMatch[1].trim());
    }
    // Fallback to platform-specific description sources when still empty or too short
    if (!result.description || result.description.length < 20) {
        const platformDesc = extractPlatformDescription(html, domainKey);
        if (platformDesc) result.description = platformDesc;
    }
    // Cap to 200 chars — used as slide subtitle in the phone preview
    if (result.description.length > 200) {
        result.description = result.description.slice(0, 197) + '...';
    }

    return result;
}

// ── Bad-image detector (logos, sprites, tracking pixels) ──────────────────────
function isBadImage(url) {
    const bad = ['logo', 'sprite', '/nav/', 'transparent', '1x1', 'pixel',
                 'blank.', 'spacer', 'icon', 'favicon', 'badge'];
    const u = url.toLowerCase();
    return bad.some((b) => u.includes(b));
}

// ── Amazon image extractor ─────────────────────────────────────────────────────
// NOTE: All RegExp patterns use constructors — Next.js SWC parser chokes on
// the literal `https://` (two forward-slashes) inside regex literals.
function extractAmazonImage(html) {
    // P1 — data-old-hires (highest resolution, directly on the <img> element)
    const p1 = new RegExp(
        'data-old-hires=[\'"](' +
        'https[^\'"]+(?:m\\.media-amazon\\.com|ssl-images-amazon\\.com)' +
        '[^\'"]+\\.(?:jpg|jpeg|png|webp)(?:\\?[^\'"]*)?)[\'"]',
        'i',
    );
    const m1 = html.match(p1);
    if (m1) return m1[1];

    // P2 — data-a-dynamic-image JSON map — pick the largest image by pixel count
    // e.g.: data-a-dynamic-image='{"https://...": [1500, 1500], ...}'
    const p2 = new RegExp('data-a-dynamic-image=[\'"]([^\'">]+)[\'"]', 'i');
    const m2 = html.match(p2);
    if (m2) {
        try {
            const jsonStr = m2[1].replace(/&quot;/g, '"').replace(/&#34;/g, '"');
            const imgMap = JSON.parse(jsonStr);
            let bestUrl = null, bestPx = 0;
            for (const [url, dims] of Object.entries(imgMap)) {
                if (Array.isArray(dims) && dims[0] * dims[1] > bestPx) {
                    bestPx = dims[0] * dims[1];
                    bestUrl = url;
                }
            }
            if (bestUrl) return bestUrl;
        } catch { /* malformed JSON — fall through */ }
    }

    // P3 — id="landingImage" src (main product image element, both attribute orders)
    const p3a = new RegExp(
        'id=[\'"]landingImage[\'"][^>]*src=[\'"](' +
        'https[^\'"]+(?:m\\.media-amazon\\.com|ssl-images-amazon\\.com)[^\'"]+)[\'"]',
        'i',
    );
    const p3b = new RegExp(
        'src=[\'"](' +
        'https[^\'"]+(?:m\\.media-amazon\\.com|ssl-images-amazon\\.com)[^\'"]+)[\'"][^>]*id=[\'"]landingImage[\'"]',
        'i',
    );
    const m3 = html.match(p3a) || html.match(p3b);
    if (m3) return m3[1];

    // P4 — "hiRes":"..." in embedded JSON blobs
    const p4 = new RegExp(
        '[\'"]hiRes[\'"]\\s*:\\s*[\'"](' +
        'https[^\'"]+(?:m\\.media-amazon\\.com|ssl-images-amazon\\.com)[^\'"]+)[\'"]',
        'i',
    );
    const m4 = html.match(p4);
    if (m4) return m4[1];

    // P5 — "large":"..." in embedded JSON blobs
    const p5 = new RegExp(
        '[\'"]large[\'"]\\s*:\\s*[\'"](' +
        'https[^\'"]+(?:m\\.media-amazon\\.com|ssl-images-amazon\\.com)' +
        '[^\'"]+\\.(?:jpg|jpeg|png))[\'"]',
        'i',
    );
    const m5 = html.match(p5);
    if (m5) return m5[1];

    // P6 — _SL\d+_ large-size suffix (e.g. _SL1500_)
    const p6 = new RegExp(
        '(https[^\'" >]+m\\.media-amazon\\.com[^\'" >]+_SL\\d+[^\'" >]+\\.(?:jpg|jpeg|png|webp))',
        'i',
    );
    const m6 = html.match(p6);
    if (m6) return m6[1];

    return null;
}

// ── Myntra image extractor ─────────────────────────────────────────────────────
function extractMyntraImage(html) {
    // P1 — images array in embedded JSON (window.__myx or SSR data blob)
    const p1 = new RegExp(
        '[\'"]images[\'"]\\s*:\\s*\\[\\s*[\'"](' +
        'https[^\'"]+(?:assets\\.myntassets\\.com|cdn\\.myntassets\\.com)[^\'"]+)[\'"]',
        'i',
    );
    const m1 = html.match(p1);
    if (m1) return m1[1];

    // P2 — <img src> pointing at myntassets CDN
    const p2 = new RegExp(
        'src=[\'"](' +
        'https[^\'"]+(?:assets\\.myntassets\\.com|cdn\\.myntassets\\.com)' +
        '[^\'"]+\\.(?:jpg|jpeg|png|webp)(?:\\?[^\'"]*)?)[\'"]',
        'i',
    );
    const m2 = html.match(p2);
    if (m2) return m2[1];

    // P3 — og:image:secure_url fallback
    const secure = extractMetaContent(html, 'og:image:secure_url');
    if (secure && !isBadImage(secure)) return secure;

    return null;
}

// ── Meesho image extractor ─────────────────────────────────────────────────────
function extractMeeshoImage(html) {
    // P1 — JSON-LD Product schema "image" field
    const p1 = new RegExp(
        '"@type"\\s*:\\s*"Product"[\\s\\S]{0,800}?"image"\\s*:\\s*[\'"]?(https[^\'" ,\\]]+)',
        'i',
    );
    const m1 = html.match(p1);
    if (m1) return m1[1];

    // P2 — Meesho CDN image URLs in src attributes
    const p2 = new RegExp(
        'src=[\'"](' +
        'https[^\'"]+(?:meesho\\.com|meeshocdn\\.com|img\\.meesho)[^\'"]+\\.(?:jpg|jpeg|png|webp))[\'"]',
        'i',
    );
    const m2 = html.match(p2);
    if (m2) return m2[1];

    return null;
}

// ── Flipkart image extractor ───────────────────────────────────────────────────
function extractFlipkartImage(html) {
    // P1 — JSON-LD Product schema "image" field
    const p1 = new RegExp(
        '"@type"\\s*:\\s*"Product"[\\s\\S]{0,800}?"image"\\s*:\\s*[\'"]?(https[^\'" ,\\]]+)',
        'i',
    );
    const m1 = html.match(p1);
    if (m1) return m1[1];

    // P2 — Flipkart CDN (rukminim*.flixcart.com or static-assets-web.flixcart.com)
    const p2 = new RegExp(
        'src=[\'"](' +
        'https[^\'"]+(?:rukminim\\d*\\.flixcart\\.com|static-assets-web\\.flixcart)[^\'"]+\\.(?:jpg|jpeg|png|webp))[\'"]',
        'i',
    );
    const m2 = html.match(p2);
    if (m2) return m2[1];

    return null;
}

// ── Generic extractor (Twitter card, JSON-LD, og:image:secure_url) ────────────
function extractGenericImage(html) {
    // Twitter card image — often higher quality than og:image on some sites
    const tc = extractMetaContent(html, 'twitter:image') ||
               extractMetaContent(html, 'twitter:image:src');
    if (tc && !isBadImage(tc)) return tc;

    // Secure OG image variant
    const secure = extractMetaContent(html, 'og:image:secure_url');
    if (secure && !isBadImage(secure)) return secure;

    // JSON-LD Product schema
    const p1 = new RegExp(
        '"@type"\\s*:\\s*"Product"[\\s\\S]{0,800}?"image"\\s*:\\s*[\'"]?(https[^\'" ,\\]]+)',
        'i',
    );
    const m1 = html.match(p1);
    if (m1) return m1[1];

    return null;
}

// ── Platform description extractors ───────────────────────────────────────────
function extractPlatformDescription(html, domainKey) {
    // JSON-LD Product "description" — works across most e-commerce sites
    const p1 = new RegExp(
        '"@type"\\s*:\\s*"Product"[\\s\\S]{0,1500}?"description"\\s*:\\s*"((?:[^"]|\\\\")+)"',
        'i',
    );
    const m1 = html.match(p1);
    if (m1) {
        const desc = m1[1]
            .replace(/\\n/g, ' ')
            .replace(/\\u[0-9a-f]{4}/gi, '')
            .replace(/\\(.)/g, '$1')
            .trim();
        if (desc.length >= 20) return decodeHTMLEntities(desc.slice(0, 200));
    }

    // Amazon — first feature bullet (inside #feature-bullets)
    if (domainKey === 'amazon') {
        const p2 = new RegExp(
            'id=[\'"]feature-bullets[\'"][\\s\\S]{0,2000}?' +
            '<span[^>]*class=[\'"][^\'"]*a-list-item[^\'"]*[\'"][^>]*>\\s*([^<]{20,})',
            'i',
        );
        const m2 = html.match(p2);
        if (m2) return decodeHTMLEntities(m2[1].trim().slice(0, 200));
    }

    // Myntra — productName JSON field as fallback description
    if (domainKey === 'myntra') {
        const p3 = new RegExp('[\'"]productName[\'"]\\s*:\\s*[\'"]([^\'"]{20,})[\'"]', 'i');
        const m3 = html.match(p3);
        if (m3) return decodeHTMLEntities(m3[1].trim().slice(0, 200));
    }

    return null;
}

// ── Shared utilities ───────────────────────────────────────────────────────────
function extractMetaContent(html, property) {
    const esc = escapeRegex(property);
    const p1 = new RegExp(`<meta[^>]+property=["']${esc}["'][^>]+content=["']([^"']+)["']`, 'i');
    const p2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${esc}["']`, 'i');
    const p3 = new RegExp(`<meta[^>]+name=["']${esc}["'][^>]+content=["']([^"']+)["']`, 'i');
    const p4 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${esc}["']`, 'i');
    const match = html.match(p1) || html.match(p2) || html.match(p3) || html.match(p4);
    return match ? decodeHTMLEntities(match[1].trim()) : '';
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHTMLEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/');
}
