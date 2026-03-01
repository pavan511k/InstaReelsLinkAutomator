/**
 * Instagram DM Sending Utility
 * Uses Instagram Messaging API (Graph API) to send DMs
 */

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Send a text message DM to a user
 * @param {string} igUserId - Instagram Business Account ID (sender)
 * @param {string} recipientId - Instagram user ID (recipient)
 * @param {string} message - Text message to send
 * @param {string} accessToken - Page access token
 */
export async function sendTextDM(igUserId, recipientId, message, accessToken) {
    const url = `${GRAPH_API_BASE}/${igUserId}/messages`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text: message },
            access_token: accessToken,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to send DM');
    }

    return response.json();
}

/**
 * Send a private reply to a Facebook Page comment
 * @param {string} commentId - The FB comment ID to reply to privately
 * @param {string} message - Text message to send
 * @param {string} accessToken - Page access token
 */
export async function sendFacebookPrivateReply(commentId, message, accessToken) {
    const url = `${GRAPH_API_BASE}/${commentId}/private_replies`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: message,
            access_token: accessToken,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to send Facebook private reply');
    }

    return response.json();
}

/**
 * Reply to a specific Instagram comment
 * @param {string} commentId - The ID of the comment to reply to
 * @param {string} message - The reply text
 * @param {string} accessToken - Page access token
 */
export async function replyToComment(commentId, message, accessToken) {
    const url = `${GRAPH_API_BASE}/${commentId}/replies`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: message,
            access_token: accessToken,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to reply to comment');
    }

    return response.json();
}

/**
 * Send a button template DM (Generic Template) to a user
 * Instagram supports Generic Templates with buttons via the Send API
 * @param {string} igUserId - Instagram Business Account ID
 * @param {string} recipientId - Instagram user ID
 * @param {Array} slides - Array of slide configs with imageUrl and buttons
 * @param {string} accessToken - Page access token
 */
export async function sendButtonTemplateDM(igUserId, recipientId, slides, accessToken) {
    const url = `${GRAPH_API_BASE}/${igUserId}/messages`;

    // Build Generic Template elements from slides
    const elements = slides.map((slide) => {
        const element = {
            title: 'AutoDM',
            buttons: slide.buttons
                .filter((b) => b.label && b.value)
                .map((b) => {
                    if (b.type === 'url') {
                        return {
                            type: 'web_url',
                            url: b.value,
                            title: b.label,
                        };
                    }
                    if (b.type === 'phone') {
                        return {
                            type: 'phone_number',
                            payload: b.value,
                            title: b.label,
                        };
                    }
                    return null;
                })
                .filter(Boolean),
        };

        if (slide.imageUrl && !slide.imageUrl.startsWith('data:')) {
            element.image_url = slide.imageUrl;
        }

        return element;
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'generic',
                        elements,
                    },
                },
            },
            access_token: accessToken,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to send button template DM');
    }

    return response.json();
}

/**
 * Resolve variables in a message template
 * @param {string} template - Message with {variable} placeholders
 * @param {object} context - Variable values
 */
export function resolveMessageVariables(template, context) {
    return template.replace(/\{(\w+)\}/g, (match, variable) => {
        return context[variable] || match;
    });
}

/**
 * Send a DM based on automation config
 * Routes to the correct send function based on dm_type
 * @param {object} automation - The automation DB record
 * @param {string} recipientId - The IG User ID or FB Comment ID
 * @param {string} accessToken - Page Access Token
 * @param {string} igUserId - IG Sender ID or FB Page ID
 * @param {object} context - Variable replacement context
 * @param {string} platform - 'instagram' or 'facebook'
 */
export async function sendAutomatedDM(automation, recipientId, accessToken, igUserId, context = {}, platform = 'instagram') {
    const { dm_type, dm_config } = automation;

    // Facebook requires using the `private_replies` edge on the comment ID to initiate a DM.
    // In our webhook logic, `context.comment_id` is passed so we can use it.
    if (platform === 'facebook') {
        const message = resolveMessageVariables(dm_config.message || 'Check your DMs!', context);
        // Facebook Private Replies only support text natively without prior interaction.
        // If it was a button template, we degrade gracefully to text for the first message,
        // or we could try sending a template. For safety, we use text.
        return sendFacebookPrivateReply(context.comment_id || recipientId, message, accessToken);
    }

    switch (dm_type) {
        case 'button_template': {
            const slides = dm_config.slides || [];
            return sendButtonTemplateDM(igUserId, recipientId, slides, accessToken);
        }

        case 'message_template': {
            const message = resolveMessageVariables(dm_config.message || '', context);
            return sendTextDM(igUserId, recipientId, message, accessToken);
        }

        default:
            throw new Error(`Unknown DM type: ${dm_type}`);
    }
}
