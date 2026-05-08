import { NextResponse } from 'next/server';

// Per-UA fetch budget. Worst case (all 3 UAs fail) ≈ 21s. Most sites resolve
// on the first attempt in < 3s.
const FETCH_TIMEOUT_MS = 7000;

// User agents in priority order. Most sites (Myntra, Amazon, Nykaa, Ajio, etc.)
// respond cleanly to a real Chrome UA — fast path. The link-preview crawler
// UAs are kept as fallbacks for sites that bot-block generic browsers
// (Meesho, Flipkart) but whitelist Facebook / Twitter for shareable previews.
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (compatible; Twitterbot/1.0)',
];

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
        let fetchUrl  = url;

        // Pre-resolve known short-link domains that use JS/meta-refresh
        // (Flipkart's dl.flipkart.com is the main offender — HTTP redirect
        // doesn't fire; the page body contains a `window.location =` script).
        // We do at most ONE extra hop to keep latency bounded.
        if (/^dl\.flipkart\.com$/i.test(parsedUrl.hostname)) {
            try {
                const probe = await fetch(url, {
                    signal: AbortSignal.timeout(8000),
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
                    redirect: 'follow',
                });
                const probeText = await probe.text();
                const jsRedirect =
                    probeText.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i) ||
                    probeText.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+url=([^"'>\s]+)/i);
                if (jsRedirect && jsRedirect[1]) {
                    const next = jsRedirect[1].replace(/&amp;/g, '&');
                    try {
                        fetchUrl   = new URL(next, url).toString();
                        parsedUrl  = new URL(fetchUrl);
                        domainKey  = getDomainKey(parsedUrl.hostname);
                    } catch { /* keep original */ }
                }
            } catch { /* keep original — main fetch will try again */ }
        }

        // Try multiple UAs — bot-blocked sites whitelist crawler UAs.
        // Stop on the first attempt that returns metadata with at least an
        // image OR title; bot-block pages return 403/CAPTCHA which we skip.
        let response = null;
        let html = null;
        let bestMeta = null;
        let lastStatus = 0;

        for (const ua of USER_AGENTS) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            try {
                response = await fetch(fetchUrl, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': ua,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-IN,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Cache-Control': 'no-cache',
                    },
                    redirect: 'follow',
                });
            } catch (e) {
                clearTimeout(timeoutId);
                if (e.name === 'AbortError') {
                    return NextResponse.json({ error: 'Request timed out' }, { status: 408 });
                }
                continue;  // try next UA
            }
            clearTimeout(timeoutId);
            lastStatus = response.status;

            // Re-classify on first attempt only — final URL doesn't change between UAs
            if (response.url) {
                try {
                    const finalKey = getDomainKey(new URL(response.url).hostname);
                    if (finalKey !== 'generic') domainKey = finalKey;
                    parsedUrl = new URL(response.url);
                } catch { /* keep original */ }
            }

            // 403 from bot block — skip, try next UA
            if (response.status === 403 || response.status === 429) continue;

            const contentType = response.headers.get('content-type') || '';
            const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');
            if (!isHtml) continue;

            // Read first 200 KB — Amazon embeds the colorImages JSON deep
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            const MAX_BYTES = 200 * 1024;
            while (buf.length < MAX_BYTES) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
            }
            reader.cancel();
            html = buf;

            const meta = parseMetadata(html, domainKey);
            if (meta.image && meta.title) { bestMeta = meta; break; }
            // Keep the most-complete result so far in case later UAs all fail
            if (!bestMeta || (meta.title && !bestMeta.title) || (meta.image && !bestMeta.image)) {
                bestMeta = meta;
            }
        }

        try {
            // All UA attempts exhausted — emit the final result
            if (!bestMeta) {
                if (lastStatus === 403 || lastStatus === 429) {
                    return NextResponse.json(
                        { error: `This site blocked the request (${lastStatus}). Try uploading the image manually.` },
                        { status: 422 },
                    );
                }
                return NextResponse.json(
                    { error: `Could not fetch URL (status ${lastStatus || 'unknown'})` },
                    { status: 422 },
                );
            }

            bestMeta.domain = parsedUrl.hostname.replace('www.', '');

            // Empty result → friendly error
            if (!bestMeta.title && !bestMeta.image) {
                const friendly = domainKey === 'amazon'
                    ? 'Amazon blocked the request (anti-bot). Try uploading the image manually.'
                    : 'Could not extract product info from this page. Try uploading the image manually.';
                return NextResponse.json({ error: friendly }, { status: 422 });
            }

            return NextResponse.json(bestMeta);
        } catch (fetchErr) {
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

    // Detect Amazon's bot-block page so we surface a clear error instead of
    // returning the "Amazon.in Robot Check" title with no image.
    if (domainKey === 'amazon' && /Robot Check|Type the characters you see/i.test(html)) {
        return result;  // empty — caller treats as failure
    }
    // Meesho often serves a "Access Denied" page to server-side fetches.
    // Title is literally "Access Denied" — bail with empty so the caller
    // returns a friendly error instead of using "Access Denied" as headline.
    if (domainKey === 'meesho' && /Access Denied|<title>\s*Access Denied/i.test(html)) {
        return result;
    }

    // ─ Parse all <script type="application/ld+json"> blocks once.
    // Modern e-commerce sites (Meesho, Flipkart, Nykaa, Ajio, even Amazon)
    // embed a Product schema here that's far more reliable than ad-hoc regex.
    const ldData = parseAllJsonLd(html);
    const ldProduct = findProductInLd(ldData);

    // ─ Title ──────────────────────────────────────────────────────────────────
    const ogTitle = extractMetaContent(html, 'og:title');
    if (ogTitle) {
        result.title = ogTitle;
    } else if (ldProduct?.name) {
        result.title = String(ldProduct.name).trim();
    } else {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) result.title = decodeHTMLEntities(titleMatch[1].trim());
    }
    // Strip trailing site-name suffixes like " - Amazon.in" or " | Myntra"
    result.title = result.title
        .replace(/\s*[\-|]\s*(Amazon|Myntra|Meesho|Flipkart|Nykaa|Ajio|Snapdeal)[^|\-]*$/i, '')
        .trim();

    // ─ Image — try sources in order of reliability ────────────────────────────
    // For Amazon, prefer the platform extractor (data-old-hires gives the
    // highest-res variant that JSON-LD doesn't usually include). For others,
    // JSON-LD wins because Meesho/Flipkart/Myntra mostly serve their best
    // image through Product schema.
    const ldImage = pickLdImage(ldProduct);
    let platformImage = null;
    switch (domainKey) {
        case 'amazon':   platformImage = extractAmazonImage(html);   break;
        case 'myntra':   platformImage = extractMyntraImage(html);   break;
        case 'meesho':   platformImage = extractMeeshoImage(html);   break;
        case 'flipkart': platformImage = extractFlipkartImage(html); break;
    }

    if (domainKey === 'amazon') {
        if (platformImage && !isBadImage(platformImage)) result.image = platformImage;
        else if (ldImage && !isBadImage(ldImage))        result.image = ldImage;
    } else {
        if (ldImage && !isBadImage(ldImage))             result.image = ldImage;
        else if (platformImage && !isBadImage(platformImage)) result.image = platformImage;
    }

    // 3) og:image / og:image:secure_url / twitter:image
    if (!result.image) {
        const ogImage = extractMetaContent(html, 'og:image') ||
                        extractMetaContent(html, 'og:image:secure_url') ||
                        extractMetaContent(html, 'og:image:url') ||
                        extractMetaContent(html, 'twitter:image') ||
                        extractMetaContent(html, 'twitter:image:src');
        if (ogImage && !isBadImage(ogImage)) result.image = ogImage;
    }

    // 4) Microdata <... itemprop="image" ...> + <link rel="image_src">
    if (!result.image) {
        const micro = extractMicrodataImage(html);
        if (micro && !isBadImage(micro)) result.image = micro;
    }

    // 5) Last resort — generic <img> with the largest declared dimensions
    if (!result.image) {
        const largest = extractLargestImage(html);
        if (largest) result.image = largest;
    }

    // ─ Description ────────────────────────────────────────────────────────────
    const ogDesc = extractMetaContent(html, 'og:description');
    if (ogDesc) {
        result.description = ogDesc;
    } else if (ldProduct?.description) {
        result.description = String(ldProduct.description).trim();
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

// ── JSON-LD helpers ───────────────────────────────────────────────────────────
function parseAllJsonLd(html) {
    const blocks = [];
    const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const raw = m[1].trim();
        if (!raw) continue;
        try {
            const parsed = JSON.parse(raw);
            blocks.push(parsed);
        } catch {
            // Some sites embed multiple JSON objects in a single script tag separated
            // by newlines — try to recover by parsing each line that looks like JSON.
            for (const line of raw.split(/\n/)) {
                const t = line.trim().replace(/,\s*$/, '');
                if (t.startsWith('{')) {
                    try { blocks.push(JSON.parse(t)); } catch { /* skip */ }
                }
            }
        }
    }
    return blocks;
}

function findProductInLd(blocks) {
    const visit = (node) => {
        if (!node) return null;
        if (Array.isArray(node)) {
            for (const item of node) {
                const found = visit(item);
                if (found) return found;
            }
            return null;
        }
        if (typeof node === 'object') {
            const t = node['@type'];
            if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) return node;
            if (node['@graph']) {
                const found = visit(node['@graph']);
                if (found) return found;
            }
        }
        return null;
    };
    for (const block of blocks) {
        const found = visit(block);
        if (found) return found;
    }
    return null;
}

function pickLdImage(product) {
    if (!product?.image) return null;
    const img = product.image;
    // image can be: string | string[] | { url } | { url }[]
    if (typeof img === 'string') return img;
    if (Array.isArray(img)) {
        for (const it of img) {
            if (typeof it === 'string') return it;
            if (it?.url)   return it.url;
            if (it?.['@id']) return it['@id'];
        }
        return null;
    }
    if (typeof img === 'object') {
        return img.url || img['@id'] || null;
    }
    return null;
}

// ── Microdata + link rel=image_src ────────────────────────────────────────────
function extractMicrodataImage(html) {
    const link = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);
    if (link) return link[1];

    const ip1 = new RegExp(
        'itemprop=[\'"]image[\'"][^>]*(?:content|src|href)=[\'"](https?[^\'"]+)[\'"]',
        'i',
    );
    const m1 = html.match(ip1);
    if (m1) return m1[1];

    const ip2 = new RegExp(
        '(?:content|src|href)=[\'"](https?[^\'"]+)[\'"][^>]*itemprop=[\'"]image[\'"]',
        'i',
    );
    const m2 = html.match(ip2);
    if (m2) return m2[1];

    return null;
}

// ── Largest <img> fallback — find any image with width >= 300 ─────────────────
function extractLargestImage(html) {
    // Match every <img ...> tag (capped to 200 to avoid pathological pages)
    const imgRe = /<img\b([^>]+)>/gi;
    const candidates = [];
    let m;
    let count = 0;
    while ((m = imgRe.exec(html)) !== null && count < 200) {
        count++;
        const attrs = m[1];
        const srcMatch  = attrs.match(/\bsrc=["']([^"']+)["']/i)
                       || attrs.match(/\bdata-src=["']([^"']+)["']/i);
        if (!srcMatch) continue;
        const src = srcMatch[1];
        if (!/^https?:/i.test(src)) continue;
        if (isBadImage(src)) continue;

        const wMatch = attrs.match(/\bwidth=["']?(\d+)/i);
        const hMatch = attrs.match(/\bheight=["']?(\d+)/i);
        const w = wMatch ? parseInt(wMatch[1], 10) : 0;
        const h = hMatch ? parseInt(hMatch[1], 10) : 0;
        const area = w * h;
        // Boost product-keyword srcs even when dimensions are missing
        const keywordBoost = /product|hero|main/i.test(src) ? 200_000 : 0;
        candidates.push({ src, score: area + keywordBoost });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length && candidates[0].score >= 90_000
        ? candidates[0].src   // require >= 300x300 equivalent
        : null;
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
    // Amazon embeds image URLs in JSON blobs with backslash-escaped forward
    // slashes ("https:\/\/m.media-amazon.com\/..."). Run all patterns against
    // a normalised copy so the regex below doesn't have to handle both forms.
    const normalised = html.replace(/\\\//g, '/');
    const result = extractAmazonImageInner(normalised);
    if (result) return result;
    // Fall through to a broad catch-all on the normalised HTML
    const p = new RegExp(
        '(https?://[^\'" >]*media-amazon\\.com/images/I/[^\'" >]+\\.(?:jpg|jpeg|png|webp))',
        'i',
    );
    const m = normalised.match(p);
    return m ? m[1] : null;
}

function extractAmazonImageInner(html) {
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

    // P6 — _SL\d+_ / _AC_SL_ / _AC_UL_ / _UL\d+_ size suffix in any Amazon image URL
    const p6 = new RegExp(
        '(https[^\'" >]+(?:m\\.media-amazon\\.com|images-na\\.ssl-images-amazon\\.com|images-eu\\.ssl-images-amazon\\.com)' +
        '[^\'" >]+(?:_SL\\d+|_AC_SL|_AC_UL|_UL\\d+|_AC_SX\\d+|_AC_SY\\d+)[^\'" >]+\\.(?:jpg|jpeg|png|webp))',
        'i',
    );
    const m6 = html.match(p6);
    if (m6) return m6[1];

    // P7 — colorImages JSON map: var data = {colorImages: { initial: [{...}] }}
    //      extract any "hiRes" or "large" URL nested inside.
    const colorImagesIdx = html.indexOf('colorImages');
    if (colorImagesIdx > -1) {
        const slice = html.slice(colorImagesIdx, colorImagesIdx + 6000);
        const hiRes = slice.match(new RegExp('[\'"]hiRes[\'"]\\s*:\\s*[\'"](https[^\'"]+)[\'"]'));
        if (hiRes) return hiRes[1];
        const large = slice.match(new RegExp('[\'"]large[\'"]\\s*:\\s*[\'"](https[^\'"]+\\.(?:jpg|jpeg|png|webp))[\'"]'));
        if (large) return large[1];
    }

    // P8 — generic /images/I/<id>.jpg URL on any Amazon CDN. Last-resort
    //      catch-all: every Amazon product image lives at /images/I/.
    const p8 = new RegExp(
        '(https?://[^\'" >]*(?:m\\.media-amazon\\.com|ssl-images-amazon\\.com|images-amazon\\.com)/images/I/' +
        '[A-Za-z0-9+\\-_]+(?:\\._[^\'" >]+)?\\.(?:jpg|jpeg|png|webp))',
        'i',
    );
    const m8 = html.match(p8);
    if (m8) return m8[1];

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
    // P1 — JSON-LD Product schema "image" (string or array form)
    const p1 = new RegExp(
        '"@type"\\s*:\\s*"Product"[\\s\\S]{0,1500}?"image"\\s*:\\s*' +
        '(?:\\[\\s*)?[\'"]?(https[^\'" ,\\]]+)',
        'i',
    );
    const m1 = html.match(p1);
    if (m1) return m1[1];

    // P2 — Next.js __NEXT_DATA__ / state blob — Meesho is Next.js, the catalog
    //      payload usually has images as JSON arrays.
    const p2 = new RegExp(
        '"images"\\s*:\\s*\\[\\s*[\'"](' +
        'https[^\'"]+(?:meesho\\.com|meeshocdn\\.com|img\\.meesho)[^\'"]+)[\'"]',
        'i',
    );
    const m2 = html.match(p2);
    if (m2) return m2[1];

    // P3 — Meesho CDN image URLs in src attributes
    const p3 = new RegExp(
        'src=[\'"](' +
        'https[^\'"]+(?:meesho\\.com|meeshocdn\\.com|img\\.meesho)[^\'"]+\\.(?:jpg|jpeg|png|webp))[\'"]',
        'i',
    );
    const m3 = html.match(p3);
    if (m3) return m3[1];

    return null;
}

// ── Flipkart image extractor ───────────────────────────────────────────────────
function extractFlipkartImage(html) {
    // P1 — JSON-LD Product schema "image" (string or array form)
    const p1 = new RegExp(
        '"@type"\\s*:\\s*"Product"[\\s\\S]{0,1500}?"image"\\s*:\\s*' +
        '(?:\\[\\s*)?[\'"]?(https[^\'" ,\\]]+)',
        'i',
    );
    const m1 = html.match(p1);
    if (m1) return m1[1];

    // P2 — initialState / pageData blob — Flipkart embeds product image URLs
    //      in their initial app state, often nested under "imageUrl" / "image".
    const p2 = new RegExp(
        '"imageUrl"\\s*:\\s*[\'"](' +
        'https[^\'"]+(?:rukminim\\d*\\.flixcart\\.com|static-assets-web\\.flixcart)[^\'"]+)[\'"]',
        'i',
    );
    const m2 = html.match(p2);
    if (m2) return m2[1];

    // P3 — Flipkart CDN (rukminim*.flixcart.com or static-assets-web.flixcart.com)
    const p3 = new RegExp(
        'src=[\'"](' +
        'https[^\'"]+(?:rukminim\\d*\\.flixcart\\.com|static-assets-web\\.flixcart)[^\'"]+\\.(?:jpg|jpeg|png|webp))[\'"]',
        'i',
    );
    const m3 = html.match(p3);
    if (m3) return m3[1];

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
