import { NextResponse } from 'next/server';

const FETCH_TIMEOUT_MS = 8000;

/**
 * POST /api/url-metadata
 * Fetches Open Graph metadata (title, image, description) from a given URL.
 * Used for auto-populating slide headline and image when a product URL is pasted.
 */
export async function POST(request) {
    try {
        const { url } = await request.json();

        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Basic URL validation
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        // Only allow http/https
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are supported' }, { status: 400 });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AutoDMBot/1.0)',
                    'Accept': 'text/html,application/xhtml+xml',
                },
                redirect: 'follow',
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                return NextResponse.json(
                    { error: `Failed to fetch URL (${response.status})` },
                    { status: 422 },
                );
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
                return NextResponse.json(
                    { error: 'URL does not return HTML content' },
                    { status: 422 },
                );
            }

            // Read limited amount of HTML (first 50KB) to avoid memory issues
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let html = '';
            const MAX_BYTES = 50 * 1024;

            while (html.length < MAX_BYTES) {
                const { done, value } = await reader.read();
                if (done) break;
                html += decoder.decode(value, { stream: true });
            }
            reader.cancel();

            // Parse OG tags from HTML
            const metadata = parseOpenGraphTags(html);
            metadata.domain = parsedUrl.hostname.replace('www.', '');

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

/**
 * Parse Open Graph and standard meta tags from HTML string.
 * Falls back to <title> if og:title is missing.
 */
function parseOpenGraphTags(html) {
    const result = { title: '', image: '', description: '' };

    // Extract og:title
    const ogTitle = extractMetaContent(html, 'og:title');
    if (ogTitle) {
        result.title = ogTitle;
    } else {
        // Fallback: <title> tag
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            result.title = decodeHTMLEntities(titleMatch[1].trim());
        }
    }

    // Extract og:image
    const ogImage = extractMetaContent(html, 'og:image');
    if (ogImage) {
        result.image = ogImage;
    }

    // Extract og:description, fallback to meta description
    const ogDesc = extractMetaContent(html, 'og:description');
    if (ogDesc) {
        result.description = ogDesc;
    } else {
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
        if (descMatch) {
            result.description = decodeHTMLEntities(descMatch[1].trim());
        }
    }

    return result;
}

/**
 * Extract content from a meta tag with given property name.
 * Handles both property="og:X" and name="og:X" patterns.
 */
function extractMetaContent(html, property) {
    // Pattern 1: property="og:X" content="..."
    const pattern1 = new RegExp(
        `<meta[^>]+property=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`,
        'i',
    );
    // Pattern 2: content="..." property="og:X"
    const pattern2 = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRegex(property)}["']`,
        'i',
    );

    const match = html.match(pattern1) || html.match(pattern2);
    return match ? decodeHTMLEntities(match[1].trim()) : '';
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
