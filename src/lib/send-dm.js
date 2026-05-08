/**
 * Instagram DM Sending Utility
 * Uses Instagram Messaging API (Graph API) to send DMs
 */
import { applyTracking, attachRecipient } from '@/lib/click-tracking';
import { GRAPH_FB_BASE as GRAPH_API_BASE, GRAPH_IG_BASE } from '@/lib/meta-graph';

// App URL is needed by attachRecipient to tell our short URLs apart from
// arbitrary third-party URLs in the trackingMap. Computed once per import.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://autodm.pro').replace(/\/$/, '');
const trackUrl = (url, recipientId) => attachRecipient(url, recipientId, APP_URL);

export class MetaApiError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'MetaApiError';
        this.code = code;
    }
}

async function throwIfMetaError(res, fallbackMsg) {
    if (!res.ok) {
        const data = await res.json();
        throw new MetaApiError(data.error?.code, data.error?.message || fallbackMsg);
    }
}

/**
 * Send a plain text DM
 * useIgApi=true  → Instagram Business Login token → graph.instagram.com
 * useIgApi=false → Facebook Page Access Token    → graph.facebook.com
 */
export async function sendTextDM(igUserId, recipientId, message, accessToken, useIgApi = false) {
    const base = useIgApi ? GRAPH_IG_BASE : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;
    
    console.log(`[sendTextDM:debug] url=${url} recipient=${recipientId} useIgApi=${useIgApi}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text: message },
            access_token: accessToken,
        }),
    });

    await throwIfMetaError(res, 'Failed to send DM');
    return res.json();
}

/**
 * Send a Quick Reply DM
 * Instagram supports up to 13 quick reply chips, each ≤20 chars
 * https://developers.facebook.com/docs/messenger-platform/send-messages/quick-replies
 */
export async function sendQuickReplyDM(igUserId, recipientId, message, quickReplies, accessToken, useIgApi = false) {
    const base = useIgApi ? GRAPH_IG_BASE : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;

    const validReplies = (quickReplies || [])
        .filter((qr) => qr.title?.trim())
        .slice(0, 5) // matches the UI cap; IG supports up to 13 but >5 is unreadable on mobile
        .map((qr) => ({
            content_type: 'text',
            title: qr.title.trim().slice(0, 20), // 20-char limit
            // Prefer chip.id so the payload is stable across title edits — the
            // webhook handler matches on this back to the chip's responseMessage.
            // Falls back to qr.payload (legacy/manual) and finally the title-
            // uppercase transform so older saved configs still resolve.
            payload: qr.id || qr.payload || qr.title.trim().toUpperCase().replace(/\s+/g, '_'),
        }));

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
                text: message,
                quick_replies: validReplies,
            },
            access_token: accessToken,
        }),
    });

    await throwIfMetaError(res, 'Failed to send quick reply DM');
    return res.json();
}

/**
 * Send a Multi-CTA DM (Generic Template — no image, just title + multiple URL buttons)
 * Supports up to 3 buttons per Instagram's Generic Template spec.
 *
 * Title is capped at 80 chars (Meta limit). Buttons are capped at 3.
 * Subtitle = branding line; controlled by dmConfig.appendBranding (default
 * true) and dmConfig.branding (Pro custom override).
 */
export async function sendMultiCtaDM(igUserId, recipientId, message, buttons, accessToken, trackingMap = {}, plan = 'free', useIgApi = false, dmConfig = {}) {
    const base = useIgApi ? GRAPH_IG_BASE : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;

    const validButtons = (buttons || [])
        .filter((b) => b.label?.trim() && b.url?.trim())
        .slice(0, 3) // Instagram max 3 buttons per element
        .map((b) => ({
            type: 'web_url',
            url: trackUrl(applyTracking(normaliseUrl(b.url.trim()), trackingMap), recipientId),
            title: b.label.trim().slice(0, 20),
        }));

    if (validButtons.length === 0) {
        throw new Error('Multi-CTA requires at least one button with a label and URL');
    }

    // Subtitle reflects the unified branding toggle. Generic-template
    // subtitle has its own 80-char cap, so we slice the suffix.
    let subtitle;
    if (dmConfig?.appendBranding === false) {
        subtitle = undefined;
    } else {
        const isPro = plan === 'pro' || plan === 'business' || plan === 'trial';
        const customBranding = isPro ? (dmConfig?.branding || '').trim() : '';
        subtitle = (customBranding || 'Sent with AutoDM').slice(0, 80);
    }

    // Meta's generic_template caps title at 80 chars. We hard-truncate so
    // the preview and the wire content stay consistent (the preview also
    // truncates at 80 to match).
    const safeTitle = (message || 'Check this out').slice(0, 80);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'generic',
                        elements: [{
                            title: safeTitle,
                            ...(subtitle ? { subtitle } : {}),
                            buttons: validButtons,
                        }],
                    },
                },
            },
            access_token: accessToken,
        }),
    });

    await throwIfMetaError(res, 'Failed to send Multi-CTA DM');
    return res.json();
}

/**
 * Send a Button Template DM (Generic Template with image carousel)
 *
 * Branding is controlled by the unified dmConfig.appendBranding flag (one
 * value for the whole carousel). When true, every slide's subtitle gets the
 * branding suffix appended. When false, no branding is added — the user's
 * description (if any) is used as-is.
 *
 * Defensive cap: Meta's Generic Template hard-limits at 10 elements. We
 * slice to META_MAX_CARDS regardless of plan so over-cap configs (which
 * the UI shouldn't allow but data-loaded templates could carry) still send
 * the first 10 instead of failing the whole DM.
 */
export const META_MAX_CARDS = 10;

export async function sendButtonTemplateDM(igUserId, recipientId, slides, accessToken, trackingMap = {}, plan = 'free', useIgApi = false, dmConfig = {}) {
    const base = useIgApi ? GRAPH_IG_BASE : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;

    const isPro = plan === 'pro' || plan === 'business' || plan === 'trial';
    const customBranding = isPro ? (dmConfig?.branding || '').trim() : '';
    const shouldAppend   = dmConfig?.appendBranding !== false;
    const brandLabel     = customBranding || 'Sent with AutoDM';

    const cappedSlides = (slides || []).slice(0, META_MAX_CARDS);
    if ((slides || []).length > META_MAX_CARDS) {
        console.warn(`[sendButtonTemplateDM] Slide list (${slides.length}) exceeds Meta's ${META_MAX_CARDS}-card limit; truncating`);
    }
    const elements = cappedSlides.map((slide) => {
        const userDesc = (slide.description || '').trim();
        let subtitle;
        if (shouldAppend) {
            subtitle = userDesc ? `${userDesc} • ${brandLabel}` : brandLabel;
        } else {
            subtitle = userDesc || undefined;
        }

        const element = {
            title: slide.headline || 'AutoDM',
            ...(subtitle ? { subtitle } : {}),
        };

        if (slide.buttonLabel && slide.buttonUrl) {
            element.buttons = [{
                type: 'web_url',
                url: trackUrl(applyTracking(normaliseUrl(slide.buttonUrl), trackingMap), recipientId),
                title: slide.buttonLabel,
            }];
        } else if (slide.buttons && Array.isArray(slide.buttons)) {
            element.buttons = slide.buttons
                .filter((b) => b.label && b.value)
                .map((b) => {
                    if (b.type === 'url') return { type: 'web_url', url: trackUrl(applyTracking(normaliseUrl(b.value), trackingMap), recipientId), title: b.label };
                    if (b.type === 'phone') return { type: 'phone_number', payload: b.value, title: b.label };
                    return null;
                })
                .filter(Boolean);
        }

        if (slide.imageUrl && !slide.imageUrl.startsWith('data:')) {
            element.image_url = slide.imageUrl;
        }

        return element;
    });

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: 'template',
                    payload: { template_type: 'generic', elements },
                },
            },
            access_token: accessToken,
        }),
    });

    await throwIfMetaError(res, 'Failed to send button template DM');
    return res.json();
}

/**
 * Send a Facebook Private Reply (text only — FB limitation)
 */
export async function sendFacebookPrivateReply(commentId, message, accessToken) {
    const url = `${GRAPH_API_BASE}/${commentId}/private_replies`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, access_token: accessToken }),
    });

    await throwIfMetaError(res, 'Failed to send Facebook private reply');
    return res.json();
}

/**
 * Reply to a comment publicly.
 *
 * Instagram: POST /{comment-id}/replies       (graph.instagram.com or graph.facebook.com)
 * Facebook:  POST /{comment-id}/comments      (graph.facebook.com only)
 *
 * Facebook feed webhooks deliver compound comment IDs in the format
 * "{post_id}_{comment_id}". The Graph API comment-reply endpoint only
 * accepts the plain comment ID, so we strip the prefix here.
 *
 * useIgApi=true  → Instagram Business Login token → graph.instagram.com
 * useIgApi=false → Facebook Page Access Token    → graph.facebook.com
 */
export async function replyToComment(commentId, message, accessToken, useIgApi = false) {
    const isFacebook = !useIgApi;

    // Facebook compound comment IDs arrive as "{post_id}_{comment_id}".
    // Strip the post-ID prefix so the API call targets the comment itself.
    const resolvedCommentId = isFacebook && commentId.includes('_')
        ? commentId.split('_').pop()
        : commentId;

    const base     = useIgApi ? GRAPH_IG_BASE : GRAPH_API_BASE;
    // Instagram uses /replies; Facebook uses /comments
    const endpoint = isFacebook ? 'comments' : 'replies';
    const url      = `${base}/${resolvedCommentId}/${endpoint}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, access_token: accessToken }),
    });

    await throwIfMetaError(res, 'Failed to reply to comment');
    return res.json();
}

/**
 * Check whether a specific user is following our Instagram Business Account.
 *
 * Strategy: the user JUST followed (they replied "Yes" after following),
 * so they will be in the first 1-2 pages of the followers endpoint.
 * We check up to 200 recent followers — practical and fast.
 *
 * @param {string} igAccountId  — our IG Business Account ID
 * @param {string} checkUserId  — the IG user ID we're looking for
 * @param {string} accessToken  — page access token
 * @returns {Promise<boolean>}
 */
export async function checkUserIsFollower(igAccountId, checkUserId, accessToken) {
    // Walk up to 5 pages of 100 = 500 most recent followers. Real Follow Gate
    // users follow + immediately tap YES, so they're at the top of the list,
    // but paginating deeper covers small-creator scenarios where multiple
    // people follow at the same time and push the new one a few pages back.
    const MAX_PAGES = 5;

    const walk = async () => {
        let url = `${GRAPH_API_BASE}/${igAccountId}/followers?fields=id&limit=100&access_token=${encodeURIComponent(accessToken)}`;
        for (let page = 0; page < MAX_PAGES; page++) {
            const res = await fetch(url);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn('[FollowCheck] API error:', err.error?.message || res.status);
                return null;  // signal "API failed" vs "not found"
            }
            const data = await res.json();
            const followers = data.data || [];
            if (followers.some((f) => f.id === checkUserId)) return true;
            if (!data.paging?.next) break;
            url = data.paging.next;
        }
        return false;
    };

    // First attempt — covers users who already followed before tapping YES.
    let result = await walk();
    if (result === true) return true;

    // Retry once after a propagation delay. Meta's /followers endpoint can
    // take 3-10 seconds to reflect a brand-new follow. Without this, users
    // who follow + immediately tap YES get falsely marked "not following".
    await new Promise((r) => setTimeout(r, 6000));
    result = await walk();
    return result === true;
}

/**
 * Send the initial "follow-gate" DM.
 * This is the first message in the follow-up flow — it asks the user to
 * follow the account and reply YES to receive the reward link.
 *
 * @param {string} igUserId    — our IG Business Account ID (sender)
 * @param {string} recipientId — the user to send to
 * @param {string} message     — the gate message text
 * @param {string} accessToken
 */
export async function sendFollowGateDM(igUserId, recipientId, message, accessToken, useIgApi = false) {
    // Send with YES and NO quick reply chips so the user doesn't need to type anything.
    // YES triggers the follow-check flow; NO gives them a polite decline.
    const base = useIgApi ? GRAPH_IG_BASE : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
                text: message,
                quick_replies: [
                    {
                        content_type: 'text',
                        title: '✅ Yes, I followed!',
                        payload: 'CONFIRMED_FOLLOW',
                    },
                    {
                        content_type: 'text',
                        title: '❌ No, not yet',
                        payload: 'NOT_FOLLOWING',
                    },
                ],
            },
            access_token: accessToken,
        }),
    });

    await throwIfMetaError(res, 'Failed to send follow-gate DM');
    return res.json();
}

/**
 * Resolve {variable} placeholders in a message template
 */
export function resolveMessageVariables(template, context) {
    return template.replace(/\{(\w+)\}/g, (match, variable) => context[variable] || match);
}

/**
 * Append the branding suffix to a plain-text DM body. Behaviour mirrors
 * sendButtonTemplateDM's subtitle handling so message_template and
 * button_template are consistent for free vs Pro users.
 *
 *   Free: always appends "— Sent with AutoDM · <APP_URL>" (URL becomes
 *         a clickable link inside the IG/FB DM thread automatically).
 *   Pro:  if dm_config.branding is set, append that as-is. If they cleared
 *         the field, no append.
 */
/**
 * Normalise a user-entered URL — auto-prepend https:// if the user typed
 * "amazon.in/foo" instead of a full URL. Meta rejects naked hostnames and
 * the resulting error is opaque to creators.
 */
function normaliseUrl(raw) {
    const u = (raw || '').trim();
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    return `https://${u}`;
}

/**
 * Default branding suffix shown to recipients when appendBranding is true and
 * no Pro custom override is set. Exported so the live phone preview renders
 * the exact same string the recipient will see.
 */
export function defaultBrandingSuffix() {
    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://autodm.pro').replace(/\/$/, '');
    return `— Sent with AutoDM · ${APP_URL}`;
}

export function applyBranding(message, dmConfig, plan) {
    const trimmed = (message || '').trimEnd();

    // Single source of truth: dm_config.appendBranding (default true). When
    // false, send the message as-is regardless of plan. Old rows without the
    // field default to true, preserving prior behavior.
    if (dmConfig?.appendBranding === false) return trimmed;

    const isPro = plan === 'pro' || plan === 'business' || plan === 'trial';

    // Pro power-user override: a custom branding string still wins when set.
    if (isPro) {
        const custom = (dmConfig?.branding || '').trim();
        if (custom) {
            const customLine = `— ${custom}`;
            if (trimmed.endsWith(custom) || trimmed.endsWith(customLine)) return trimmed;
            return `${trimmed}\n\n${customLine}`;
        }
    }

    const suffix = defaultBrandingSuffix();
    if (trimmed.endsWith(suffix)) return trimmed;
    return `${trimmed}\n\n${suffix}`;
}

/**
 * Route to the correct send function based on dm_type
 * @param {object} automation
 * @param {string} recipientId
 * @param {string} accessToken
 * @param {string} igUserId
 * @param {object} context         - { username, first_name, comment_id }
 * @param {string} platform
 * @param {object} trackingMap     - { originalUrl → trackedUrl } from dm_link_codes
 */
export async function sendAutomatedDM(automation, recipientId, accessToken, igUserId, context = {}, platform = 'instagram', trackingMap = {}, plan = 'free', useIgApi = false) {
    const { dm_type, dm_config } = automation;

    console.log(`[sendAutomatedDM:debug] platform=${platform} dm_type=${dm_type} igUserId=${igUserId} recipient=${recipientId} useIgApi=${useIgApi}`);

    // Facebook DMs go through the standard Messenger messages endpoint:
    // POST /{page-id}/messages with the recipient's Facebook user ID.
    // private_replies is legacy, requires established pages + approved
    // pages_messaging, and fails on new pages — do not use it here.
    if (platform === 'facebook') {
        const message = applyBranding(
            resolveMessageVariables(dm_config.message || '', context),
            dm_config,
            plan,
        );
        return sendTextDM(igUserId, recipientId, message, accessToken, false);
    }

    switch (dm_type) {
        case 'button_template': {
            const slides = dm_config.slides || [];
            return sendButtonTemplateDM(igUserId, recipientId, slides, accessToken, trackingMap, plan, useIgApi, dm_config);
        }

        case 'message_template': {
            const message = applyBranding(
                resolveMessageVariables(dm_config.message || '', context),
                dm_config,
                plan,
            );
            return sendTextDM(igUserId, recipientId, message, accessToken, useIgApi);
        }

        case 'quick_reply': {
            const message = applyBranding(
                resolveMessageVariables(dm_config.message || '', context),
                dm_config,
                plan,
            );
            return sendQuickReplyDM(igUserId, recipientId, message, dm_config.quickReplies || [], accessToken, useIgApi);
        }

        case 'multi_cta': {
            const message = resolveMessageVariables(dm_config.message || '', context);
            return sendMultiCtaDM(igUserId, recipientId, message, dm_config.buttons || [], accessToken, trackingMap, plan, useIgApi, dm_config);
        }

        case 'follow_up': {
            // Send the initial gate message ("follow us and reply YES")
            const message = applyBranding(
                resolveMessageVariables(dm_config.gateMessage || '', context),
                dm_config,
                plan,
            );
            return sendFollowGateDM(igUserId, recipientId, message, accessToken, useIgApi);
        }

        case 'email_collector': {
            // Send the ask message — webhook will capture the reply
            const message = applyBranding(
                resolveMessageVariables(
                    dm_config.emailAskMessage || 'Hey! Could you share your email address? 📧',
                    context,
                ),
                dm_config,
                plan,
            );
            return sendTextDM(igUserId, recipientId, message, accessToken, useIgApi);
        }

        default:
            throw new Error(`Unknown DM type: ${dm_type}`);
    }
}
