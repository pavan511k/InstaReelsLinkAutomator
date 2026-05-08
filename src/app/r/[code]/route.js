export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

/**
 * GET /r/[code]
 *
 * 1. Looks up the code in dm_link_codes to get the original URL
 * 2. Logs a click_event row (async, non-blocking — does NOT delay the redirect)
 * 3. Returns an instant 302 redirect to the original URL
 *
 * Design decisions:
 * - The redirect fires first via a streaming 302 — users feel zero latency.
 * - Click logging happens in a fire-and-forget promise.
 * - IP is hashed (SHA-256) before storage for GDPR compliance.
 * - Unknown codes: redirect to the app homepage rather than showing an error.
 */
export async function GET(request, { params }) {
    const { code } = params;

    if (!code || !/^[a-f0-9]{8}$/.test(code)) {
        return NextResponse.redirect(
            process.env.NEXT_PUBLIC_APP_URL || 'https://autodm.app',
        );
    }

    const supabase = createServiceClient();

    // ── Look up the code ──────────────────────────────────────────
    const { data: linkRow } = await supabase
        .from('dm_link_codes')
        .select('original_url, automation_id')
        .eq('code', code)
        .maybeSingle();

    if (!linkRow?.original_url) {
        // Unknown code — redirect home
        return NextResponse.redirect(
            process.env.NEXT_PUBLIC_APP_URL || 'https://autodm.app',
        );
    }

    // Defense against stored open-redirect payloads (e.g. javascript:, data:).
    // Codes are upserted server-side from automation configs but we still
    // refuse to bounce a browser to anything other than http(s).
    let parsedDestination;
    try {
        parsedDestination = new URL(linkRow.original_url);
    } catch {
        return NextResponse.redirect(
            process.env.NEXT_PUBLIC_APP_URL || 'https://autodm.app',
        );
    }
    if (parsedDestination.protocol !== 'http:' && parsedDestination.protocol !== 'https:') {
        return NextResponse.redirect(
            process.env.NEXT_PUBLIC_APP_URL || 'https://autodm.app',
        );
    }

    // Recipient attribution — captured server-side from the `?r=` query so
    // the destination site never sees it. Used by cron/upsell to skip
    // recipients who actually clicked. Legacy DMs without ?r=` log NULL,
    // which the upsell cron treats as "unknown — fall through to time-based".
    const reqUrl       = new URL(request.url);
    const recipientIg  = reqUrl.searchParams.get('r') || null;

    // ── Log click (fire-and-forget) ───────────────────────────────
    // We don't await this — the user gets their redirect immediately.
    logClick(supabase, code, linkRow.automation_id, recipientIg, request).catch((err) =>
        console.warn('[ClickTrack] Log error (non-fatal):', err.message),
    );

    // ── Redirect ──────────────────────────────────────────────────
    return NextResponse.redirect(linkRow.original_url, {
        status: 302,
        headers: {
            // Prevent the redirect URL from appearing in Referer headers
            // so the destination site doesn't see the tracking code URL.
            'Referrer-Policy': 'no-referrer',
            // No caching — every click must be a fresh lookup
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
    });
}

/** Log a single click event. Hashes the IP for privacy. */
async function logClick(supabase, code, automationId, recipientIg, request) {
    const ip        = request.headers.get('cf-connecting-ip')      // Cloudflare
                   || request.headers.get('x-forwarded-for')?.split(',')[0].trim()
                   || request.headers.get('x-real-ip')
                   || 'unknown';

    const userAgent = request.headers.get('user-agent') || '';
    const referer   = request.headers.get('referer')    || '';

    // Hash IP for GDPR-safe deduplication
    const ipHash = await hashString(ip);

    await supabase.from('click_events').insert({
        code,
        automation_id:   automationId,
        recipient_ig_id: recipientIg,
        ip_hash:         ipHash,
        user_agent:      userAgent.slice(0, 512), // cap to avoid huge strings
        referer:         referer.slice(0, 512),
        clicked_at:      new Date().toISOString(),
    });
}

/** SHA-256 hash using Web Crypto (edge-compatible) */
async function hashString(str) {
    const encoded = new TextEncoder().encode(str);
    const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
}
