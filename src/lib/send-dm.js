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

// Use Private Replies (recipient.comment_id) when responding to a public
// comment — bypasses the 24-hour standard messaging window and gives a 7-day
// window from comment creation. Falls back to recipient.id when no commentId
// is available (e.g. follow-up flow steps, user-initiated replies).
function buildRecipient(recipientId, commentId) {
    return commentId ? { comment_id: commentId } : { id: recipientId };
}

/**
 * Send a plain text DM
 * useIgApi=true  → Instagram Business Login token → graph.instagram.com
 * useIgApi=false → Facebook Page Access Token    → graph.facebook.com
 */
export async function sendTextDM(igUserId, recipientId, message, accessToken, useIgApi = false, commentId = null) {
    const base = useIgApi ? GRAPH_IG_BASE : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;

    console.log(`[sendTextDM:debug] url=${url} recipient=${recipientId} useIgApi=${useIgApi} privateReply=${!!commentId}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: buildRecipient(recipientId, commentId),
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
export async function sendQuickReplyDM(igUserId, recipientId, message, quickReplies, accessToken, useIgApi = false, commentId = null) {
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
            recipient: buildRecipient(recipientId, commentId),
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
export async function sendMultiCtaDM(igUserId, recipientId, message, buttons, accessToken, trackingMap = {}, plan = 'free', useIgApi = false, dmConfig = {}, commentId = null) {
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

    // Subtitle rules mirror applyBranding: opt-out wins; Pro shows only
    // their own custom branding (no AutoDM push on paid plans); free tier
    // gets the minimal "autodm.pro" tag. The em-dash convention for plain
    // DMs is dropped here because the template subtitle is already a
    // visually distinct line under the title.
    let subtitle;
    if (dmConfig?.appendBranding === false) {
        subtitle = undefined;
    } else {
        const isPro = plan === 'pro' || plan === 'business' || plan === 'trial';
        if (isPro) {
            const customBranding = (dmConfig?.branding || '').trim();
            subtitle = customBranding ? customBranding.slice(0, 80) : undefined;
        } else {
            subtitle = 'autodm.pro';
        }
    }

    // Meta's generic_template caps title at 80 chars. We hard-truncate so
    // the preview and the wire content stay consistent (the preview also
    // truncates at 80 to match).
    const safeTitle = (message || 'Check this out').slice(0, 80);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: buildRecipient(recipientId, commentId),
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

export async function sendButtonTemplateDM(igUserId, recipientId, slides, accessToken, trackingMap = {}, plan = 'free', useIgApi = false, dmConfig = {}, commentId = null) {
    const base = useIgApi ? GRAPH_IG_BASE : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;

    // Per-slide branding mirrors applyBranding:
    //   - opt-out wins (no subtitle suffix added)
    //   - Pro: only their custom string (paid plans don't get an AutoDM push)
    //   - free: minimal "autodm.pro" tag
    const isPro = plan === 'pro' || plan === 'business' || plan === 'trial';
    const customBranding = isPro ? (dmConfig?.branding || '').trim() : '';
    const brandLabel     = isPro ? customBranding : 'autodm.pro';
    const shouldAppend   = dmConfig?.appendBranding !== false && !!brandLabel;

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
            recipient: buildRecipient(recipientId, commentId),
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
 * Uses the IG User Profile endpoint with the `is_user_follow_business`
 * field. This is the documented Meta way to answer "does this IGSID
 * follow my business?" -- it's one call, not paginated.
 *
 * Permission: `instagram_business_manage_messages` (already approved).
 * Token base: graph.instagram.com when authenticated via IG Business
 * Login, graph.facebook.com when authenticated via Facebook Login.
 * Sending the IG token to graph.facebook.com (the previous behaviour)
 * returns "Invalid OAuth access token" and silently disabled the gate.
 *
 * @param {string} igAccountId  — our IG Business Account ID (unused but kept for compat)
 * @param {string} checkUserId  — the IGSID we're checking
 * @param {string} accessToken  — IG or FB page access token
 * @param {boolean} [useIgApi=false] — true => graph.instagram.com; false => graph.facebook.com
 * @returns {Promise<boolean|null>} true=follower, false=not, null=API failure (caller skips gate)
 */
export async function checkUserIsFollower(igAccountId, checkUserId, accessToken, useIgApi = false) {
    const base = useIgApi ? GRAPH_IG_BASE : GRAPH_API_BASE;
    const url  = `${base}/${checkUserId}` +
        `?fields=is_user_follow_business` +
        `&access_token=${encodeURIComponent(accessToken)}`;

    const urlForLog = url.replace(/access_token=[^&]+/, 'access_token=<MASKED>');
    console.log('[FollowCheck] GET ' + urlForLog);

    try {
        const res = await fetch(url);
        const rawText = await res.text();
        let data;
        try { data = JSON.parse(rawText); } catch { data = { _raw: rawText }; }

        console.log('[FollowCheck] Response ' + JSON.stringify({
            status: res.status, ok: res.ok, body: data,
        }));

        if (!res.ok) {
            console.warn('[FollowCheck] API error: ' + (data.error?.message || res.status));
            return null;
        }

        if (typeof data.is_user_follow_business !== 'boolean') {
            console.warn('[FollowCheck] No is_user_follow_business in response (insufficient perms?)');
            return null;
        }

        return data.is_user_follow_business;
    } catch (err) {
        console.warn('[FollowCheck] threw: ' + err.message);
        return null;
    }
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
/**
 * Send a heart (love) reaction to a message the user sent us.
 *
 * Uses the Send API's `sender_action: react` form, available on both
 * Messenger and Instagram messaging endpoints. We need the inbound
 * `messageId` (a.k.a. `mid` from the webhook event) to attach the
 * reaction to the right bubble.
 *
 * Best-effort: a failure here is logged and swallowed so the main
 * DM still goes out. Reactions don't have a strict 24h messaging
 * window — same constraints as a normal DM reply, which we're
 * inside of anyway since the user just messaged us.
 */
export async function sendHeartReaction(igUserId, recipientId, messageId, accessToken, useIgApi = false) {
    if (!messageId || !recipientId || !igUserId) return null;
    const base = useIgApi ? GRAPH_IG_BASE : GRAPH_API_BASE;
    const url  = `${base}/${igUserId}/messages`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            sender_action: 'react',
            payload: {
                message_id: messageId,
                reaction:   'love',
            },
            access_token: accessToken,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Log + swallow — the main DM is the important thing.
        console.warn('[sendHeartReaction] failed:', err.error?.message || `${res.status} ${res.statusText}`);
        return null;
    }
    return res.json();
}

export async function sendFollowGateDM(igUserId, recipientId, message, accessToken, useIgApi = false, commentId = null, opts = {}) {
    // Send as a button template (template_type: 'button') so the
    // confirm/decline buttons render INSIDE the message bubble rather
    // than as floating chips below it. The confirm button title is
    // customizable via `opts.confirmTitle` (the builder pre-fills with
    // copy like "I'm following!"). Payloads stay CONFIRMED_FOLLOW /
    // NOT_FOLLOWING so the existing webhook handler matches button taps
    // the same way it used to match the quick-reply chip taps.
    //
    // Title length is capped at 20 chars by Meta's button spec; message
    // text can be up to 640 chars.
    //
    // NOTE: postback button taps deliver as `messaging[].postback.payload`
    // (not `messaging[].message.quick_reply.payload`), so the dispatch
    // loop in app/api/webhooks/instagram/route.js normalizes those into
    // the message-event shape before invoking handleIncomingDMReply.
    const base = useIgApi ? GRAPH_IG_BASE : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;

    const confirmTitle = (opts.confirmTitle || '').toString().trim().slice(0, 20)
        || '✅ Yes, I followed!';

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: buildRecipient(recipientId, commentId),
            message: {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'button',
                        text: (message || '').slice(0, 640),
                        buttons: [
                            {
                                type: 'postback',
                                title: confirmTitle,
                                payload: 'CONFIRMED_FOLLOW',
                            },
                        ],
                    },
                },
            },
            access_token: accessToken,
        }),
    });

    await throwIfMetaError(res, 'Failed to send follow-gate DM');
    return res.json();
}

/**
 * Opening-message button gate. Sends a button template card with the
 * opening text and a single postback button. Tapping the button fires
 * an OPENING_TAP webhook event which the dispatcher catches to send
 * the main DM via sendRewardDM. Mirrors sendFollowGateDM structurally
 * (template_type: 'button' + a single postback button) -- only the
 * payload string and button title source differ.
 *
 * Title cap: 20 chars per Meta's button spec. Text cap: 640 chars.
 */
export async function sendOpeningGateDM(igUserId, recipientId, message, buttonText, accessToken, useIgApi = false, commentId = null) {
    const base = useIgApi ? GRAPH_IG_BASE : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;

    const title = (buttonText || '').toString().trim().slice(0, 20) || 'Continue';

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: buildRecipient(recipientId, commentId),
            message: {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'button',
                        text: (message || '').slice(0, 640),
                        buttons: [
                            {
                                type: 'postback',
                                title,
                                payload: 'OPENING_TAP',
                            },
                        ],
                    },
                },
            },
            access_token: accessToken,
        }),
    });

    await throwIfMetaError(res, 'Failed to send opening-gate DM');
    return res.json();
}

/**
 * Resolve {variable} placeholders in a message template
 */
export function resolveMessageVariables(template, context) {
    return template.replace(/\{(\w+)\}/g, (match, variable) => context[variable] || match);
}

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

// Minimal one-line attribution for free-tier DMs. Instagram auto-detects
// the bare domain and renders it as a tappable link without us adding any
// "https://" preamble that would make it look like a spam footer.
export const FREE_BRANDING_SUFFIX = '— autodm.pro';

export function applyBranding(message, dmConfig, plan) {
    const trimmed = (message || '').trimEnd();

    // Rules:
    //   - dmConfig.appendBranding === false  -> always clean (explicit opt-out)
    //   - Pro/Trial + dmConfig.branding set  -> append the user's custom line
    //   - Pro/Trial + no custom branding     -> clean (paid plans don't get
    //                                          our default branding pushed)
    //   - free / non-Pro                     -> minimal "— autodm.pro" footer
    if (dmConfig?.appendBranding === false) return trimmed;

    const isPro = plan === 'pro' || plan === 'business' || plan === 'trial';

    if (isPro) {
        const custom = (dmConfig?.branding || '').trim();
        if (!custom) return trimmed;
        const customLine = `— ${custom}`;
        if (trimmed.endsWith(custom) || trimmed.endsWith(customLine)) return trimmed;
        return `${trimmed}\n\n${customLine}`;
    }

    if (trimmed.endsWith(FREE_BRANDING_SUFFIX)) return trimmed;
    return `${trimmed}\n\n${FREE_BRANDING_SUFFIX}`;
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

    // Comment-triggered first DMs need Private Replies (recipient.comment_id)
    // to bypass the 24h messaging window. Only applies to Instagram —
    // Facebook stays on the standard messages endpoint per the comment below.
    // Private Reply (recipient.comment_id) only works with a real Meta
    // comment_id. Several flows store synthetic dedup keys in the queue
    // -- e.g. `story_reply:<mid>` for story replies (which are DMs, not
    // comments) -- and passing those to Meta makes it return "The
    // requested user cannot be found." Synthetic IDs are namespaced with
    // a "<flow>:<id>" shape; real Meta comment_ids are numeric and never
    // contain a colon, so filter on that.
    const rawCommentId = context?.comment_id || '';
    const isSyntheticCommentId = rawCommentId.includes(':');
    const commentId = (platform === 'instagram' && rawCommentId && !isSyntheticCommentId)
        ? rawCommentId
        : null;

    console.log(`[sendAutomatedDM:debug] platform=${platform} dm_type=${dm_type} igUserId=${igUserId} recipient=${recipientId} useIgApi=${useIgApi} privateReply=${!!commentId}`);

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
            return sendButtonTemplateDM(igUserId, recipientId, slides, accessToken, trackingMap, plan, useIgApi, dm_config, commentId);
        }

        case 'message_template': {
            const message = applyBranding(
                resolveMessageVariables(dm_config.message || '', context),
                dm_config,
                plan,
            );
            return sendTextDM(igUserId, recipientId, message, accessToken, useIgApi, commentId);
        }

        case 'quick_reply': {
            const message = applyBranding(
                resolveMessageVariables(dm_config.message || '', context),
                dm_config,
                plan,
            );
            return sendQuickReplyDM(igUserId, recipientId, message, dm_config.quickReplies || [], accessToken, useIgApi, commentId);
        }

        case 'multi_cta': {
            const message = resolveMessageVariables(dm_config.message || '', context);
            return sendMultiCtaDM(igUserId, recipientId, message, dm_config.buttons || [], accessToken, trackingMap, plan, useIgApi, dm_config, commentId);
        }

        case 'builder_v2': {
            // New flow-builder shape:
            //   dm_config = { message, imageUrl, buttons, openingEnabled,
            //                 openingMessage, openingButtonText, ... }
            //
            // When openingEnabled is set, send the opening as its OWN
            // message bubble first, then the main DM as a second bubble.
            // (Previously these were concatenated into one body, which
            // made the recipient see a single giant blob.)
            //
            // The askToFollow gate flow intentionally keeps the
            // concatenation in sendRewardDM (route.js) -- the gate
            // already used a message slot so a third bubble would be
            // too noisy.
            //
            // Main-DM routing rules below:
            //   • image + buttons   → button_template (one slide)
            //   • image only        → button_template (one slide, no buttons)
            //   • buttons only      → multi_cta
            //   • text only         → message_template
            const validButtons = (dm_config.buttons || []).filter((b) => b.label && b.url);
            const imageUrl     = dm_config.imageUrl || null;
            const mainMessage  = resolveMessageVariables(dm_config.message || '', context);

            // Meta's Private Reply (recipient.comment_id) can be used at
            // most once per comment, so after the opening DM uses it we
            // switch the main DM to recipient.id. The opening DM also
            // opens the 24h messaging window, so the main DM still
            // delivers without needing Private Reply.
            let privateReplyCommentId = commentId;

            const openingMsg = dm_config.openingEnabled
                && typeof dm_config.openingMessage === 'string'
                && dm_config.openingMessage.trim()
                    ? resolveMessageVariables(dm_config.openingMessage, context)
                    : null;

            if (openingMsg) {
                try {
                    await sendTextDM(igUserId, recipientId, openingMsg, accessToken, useIgApi, privateReplyCommentId);
                    privateReplyCommentId = null;
                } catch (err) {
                    // Non-fatal: log and continue so the main DM still
                    // goes out even if the opener fails. privateReplyCommentId
                    // stays set so the main DM can still attempt Private Reply.
                    console.warn('[sendAutomatedDM] Opening message send failed (continuing with main DM):', err.message);
                }
            }

            if (imageUrl) {
                const slide = {
                    headline:    'AutoDM',
                    description: mainMessage,
                    imageUrl,
                    ...(validButtons.length > 0 && {
                        buttons: validButtons.map((b) => ({ type: 'url', label: b.label, value: b.url })),
                    }),
                };
                return sendButtonTemplateDM(igUserId, recipientId, [slide], accessToken, trackingMap, plan, useIgApi, dm_config, privateReplyCommentId);
            }
            if (validButtons.length > 0) {
                return sendMultiCtaDM(
                    igUserId, recipientId, mainMessage,
                    validButtons.map((b) => ({ label: b.label, url: b.url })),
                    accessToken, trackingMap, plan, useIgApi, dm_config, privateReplyCommentId,
                );
            }
            return sendTextDM(
                igUserId, recipientId,
                applyBranding(mainMessage, dm_config, plan),
                accessToken, useIgApi, privateReplyCommentId,
            );
        }

        case 'follow_up': {
            // Send the initial gate message ("follow us and reply YES")
            const message = applyBranding(
                resolveMessageVariables(dm_config.gateMessage || '', context),
                dm_config,
                plan,
            );
            return sendFollowGateDM(igUserId, recipientId, message, accessToken, useIgApi, commentId);
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
            return sendTextDM(igUserId, recipientId, message, accessToken, useIgApi, commentId);
        }

        default:
            throw new Error(`Unknown DM type: ${dm_type}`);
    }
}
