/**
 * Instagram DM Sending Utility
 * Uses Instagram Messaging API (Graph API) to send DMs
 */
import { applyTracking } from '@/lib/click-tracking';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Send a plain text DM
 * useIgApi=true  → Instagram Business Login token → graph.instagram.com
 * useIgApi=false → Facebook Page Access Token    → graph.facebook.com
 */
export async function sendTextDM(igUserId, recipientId, message, accessToken, useIgApi = false) {
    const base = useIgApi ? 'https://graph.instagram.com/v21.0' : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;
    
    console.log(`[sendTextDM:debug] url=${url} recipient=${recipientId} useIgApi=${useIgApi} token_prefix=${accessToken?.slice(0, 12)}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text: message },
            access_token: accessToken,
        }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to send DM');
    }
    return res.json();
}

/**
 * Send a Quick Reply DM
 * Instagram supports up to 13 quick reply chips, each ≤20 chars
 * https://developers.facebook.com/docs/messenger-platform/send-messages/quick-replies
 */
export async function sendQuickReplyDM(igUserId, recipientId, message, quickReplies, accessToken, useIgApi = false) {
    const base = useIgApi ? 'https://graph.instagram.com/v21.0' : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;

    const validReplies = (quickReplies || [])
        .filter((qr) => qr.title?.trim())
        .slice(0, 13) // Instagram max
        .map((qr) => ({
            content_type: 'text',
            title: qr.title.trim().slice(0, 20), // 20-char limit
            payload: qr.payload || qr.title.trim().toUpperCase().replace(/\s+/g, '_'),
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

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to send quick reply DM');
    }
    return res.json();
}

/**
 * Send a Multi-CTA DM (Generic Template — no image, just title + multiple URL buttons)
 * Supports up to 3 buttons per Instagram's Generic Template spec
 */
export async function sendMultiCtaDM(igUserId, recipientId, message, buttons, accessToken, trackingMap = {}, plan = 'free', useIgApi = false) {
    const base = useIgApi ? 'https://graph.instagram.com/v21.0' : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;

    const validButtons = (buttons || [])
        .filter((b) => b.label?.trim() && b.url?.trim())
        .slice(0, 3) // Instagram max 3 buttons per element
        .map((b) => ({
            type: 'web_url',
            url: applyTracking(b.url.trim(), trackingMap),
            title: b.label.trim().slice(0, 20),
        }));

    if (validButtons.length === 0) {
        throw new Error('Multi-CTA requires at least one button with a label and URL');
    }

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
                            title: message || 'Check this out',
                            ...(plan === 'free' ? { subtitle: 'Sent with AutoDM' } : {}),
                            buttons: validButtons,
                        }],
                    },
                },
            },
            access_token: accessToken,
        }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to send Multi-CTA DM');
    }
    return res.json();
}

/**
 * Send a Button Template DM (Generic Template with image carousel)
 */
export async function sendButtonTemplateDM(igUserId, recipientId, slides, accessToken, trackingMap = {}, plan = 'free', useIgApi = false) {
    const base = useIgApi ? 'https://graph.instagram.com/v21.0' : GRAPH_API_BASE;
    const url = `${base}/${igUserId}/messages`;

    const elements = slides.map((slide) => {
        const userDesc = (slide.description || '').trim();
        const isPro = plan === 'pro' || plan === 'business';
        // Free: always append. Pro: respect slide.appendBranding (default true).
        const shouldAppend = isPro ? (slide.appendBranding !== false) : true;
        let subtitle;
        if (shouldAppend) {
            subtitle = userDesc ? `${userDesc} • Sent with AutoDM` : 'Sent with AutoDM';
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
                url: applyTracking(slide.buttonUrl, trackingMap),
                title: slide.buttonLabel,
            }];
        } else if (slide.buttons && Array.isArray(slide.buttons)) {
            element.buttons = slide.buttons
                .filter((b) => b.label && b.value)
                .map((b) => {
                    if (b.type === 'url') return { type: 'web_url', url: applyTracking(b.value, trackingMap), title: b.label };
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

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to send button template DM');
    }
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

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to send Facebook private reply');
    }
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

    const base     = useIgApi ? 'https://graph.instagram.com/v21.0' : GRAPH_API_BASE;
    // Instagram uses /replies; Facebook uses /comments
    const endpoint = isFacebook ? 'comments' : 'replies';
    const url      = `${base}/${resolvedCommentId}/${endpoint}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, access_token: accessToken }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to reply to comment');
    }
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
    let url = `${GRAPH_API_BASE}/${igAccountId}/followers?fields=id&limit=100&access_token=${encodeURIComponent(accessToken)}`;

    // Check up to 2 pages (200 recent followers)
    for (let page = 0; page < 2; page++) {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json();
            console.warn('[FollowCheck] API error:', err.error?.message);
            return false; // fail-safe: don't block user if API fails
        }

        const data = await res.json();
        const followers = data.data || [];

        if (followers.some((f) => f.id === checkUserId)) {
            return true;
        }

        // No more pages
        if (!data.paging?.next) break;
        url = data.paging.next;
    }

    return false;
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
    const base = useIgApi ? 'https://graph.instagram.com/v21.0' : GRAPH_API_BASE;
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

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to send follow-gate DM');
    }
    return res.json();
}

/**
 * Resolve {variable} placeholders in a message template
 */
export function resolveMessageVariables(template, context) {
    return template.replace(/\{(\w+)\}/g, (match, variable) => context[variable] || match);
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

    // Facebook DMs go through the standard Messenger messages endpoint:
    // POST /{page-id}/messages with the recipient's Facebook user ID.
    // private_replies is legacy, requires established pages + approved
    // pages_messaging, and fails on new pages — do not use it here.
    if (platform === 'facebook') {
        const message = resolveMessageVariables(dm_config.message || 'Check your DMs!', context);
        return sendTextDM(igUserId, recipientId, message, accessToken, false);
    }

    switch (dm_type) {
        case 'button_template': {
            const slides = dm_config.slides || [];
            return sendButtonTemplateDM(igUserId, recipientId, slides, accessToken, trackingMap, plan, useIgApi);
        }

        case 'message_template': {
            const message = resolveMessageVariables(dm_config.message || '', context);
            return sendTextDM(igUserId, recipientId, message, accessToken, useIgApi);
        }

        case 'quick_reply': {
            const message = resolveMessageVariables(dm_config.message || '', context);
            return sendQuickReplyDM(igUserId, recipientId, message, dm_config.quickReplies || [], accessToken, useIgApi);
        }

        case 'multi_cta': {
            const message = resolveMessageVariables(dm_config.message || '', context);
            return sendMultiCtaDM(igUserId, recipientId, message, dm_config.buttons || [], accessToken, trackingMap, plan, useIgApi);
        }

        case 'follow_up': {
            // Send the initial gate message ("follow us and reply YES")
            const message = resolveMessageVariables(dm_config.gateMessage || '', context);
            return sendFollowGateDM(igUserId, recipientId, message, accessToken, useIgApi);
        }

        case 'email_collector': {
            // Send the ask message — webhook will capture the reply
            const message = resolveMessageVariables(
                dm_config.emailAskMessage || 'Hey! Could you share your email address? 📧',
                context,
            );
            return sendTextDM(igUserId, recipientId, message, accessToken, useIgApi);
        }

        default:
            throw new Error(`Unknown DM type: ${dm_type}`);
    }
}
