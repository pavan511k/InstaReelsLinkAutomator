import crypto from 'crypto';

/**
 * Parse and verify a Meta `signed_request` payload (used by the
 * Deauthorize and Data Deletion webhook callbacks).
 *
 * We try both Meta app secrets — the Facebook one and the Instagram
 * one — because the callback can be signed by either, depending on
 * which OAuth flow the user originally completed. Returns the decoded
 * payload object on success, or `null` if the signature can't be
 * verified against either secret.
 *
 * @param {string} signedRequest      Raw `signed_request` form value sent by Meta.
 * @param {string} loggingTag         Short label used as a log prefix (e.g. 'Deauth', 'DataDeletion').
 * @returns {object|null}             The decoded payload, or null on verification failure.
 */
export function parseMetaSignedRequest(signedRequest, loggingTag) {
    const fbSecret = process.env.META_APP_SECRET;
    const igSecret = process.env.INSTAGRAM_APP_SECRET;

    if (!fbSecret && !igSecret) {
        console.error(`[${loggingTag}] Neither META_APP_SECRET nor INSTAGRAM_APP_SECRET set — cannot verify signed request`);
        return null;
    }

    const [encodedSig, payload] = (signedRequest || '').split('.');
    if (!encodedSig || !payload) {
        console.error(`[${loggingTag}] Malformed signed_request (missing sig or payload)`);
        return null;
    }

    const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    const candidates = [
        { label: 'FB', secret: fbSecret },
        { label: 'IG', secret: igSecret },
    ].filter((c) => !!c.secret);

    let matchedLabel = null;
    for (const c of candidates) {
        const expected = crypto.createHmac('sha256', c.secret).update(payload).digest();
        if (expected.length === sig.length && crypto.timingSafeEqual(sig, expected)) {
            matchedLabel = c.label;
            break;
        }
    }

    if (!matchedLabel) {
        console.error(`[${loggingTag}] Signature verification failed against both app secrets`);
        return null;
    }

    console.log(`[${loggingTag}] Signature verified against ${matchedLabel} app secret`);

    const decodedPayload = Buffer.from(
        payload.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
    ).toString('utf8');

    try {
        return JSON.parse(decodedPayload);
    } catch (err) {
        console.error(`[${loggingTag}] Decoded payload was not valid JSON:`, err.message);
        return null;
    }
}
