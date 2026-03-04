import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendAutomatedDM, resolveMessageVariables } from '@/lib/send-dm';

/**
 * Instagram Webhook Endpoint
 *
 * GET — Webhook verification (Meta sends a challenge)
 * POST — Receive comment events and process DM automations
 *
 * Configure in Meta Developer Dashboard:
 * Webhooks → Instagram → comments subscription
 * Callback URL: https://your-domain.vercel.app/api/webhooks/instagram
 * Verify Token: Set in WEBHOOK_VERIFY_TOKEN env var
 */

const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'autodm_webhook_verify';

// Use service role for webhook processing (no user session)
function createServiceClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

/**
 * GET /api/webhooks/instagram
 * Webhook verification — Meta sends a challenge to confirm the endpoint
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
        console.log('[Webhook] Verification successful');
        return new NextResponse(challenge, { status: 200 });
    }

    console.warn('[Webhook] Verification failed — invalid token');
    return NextResponse.json({ error: 'Invalid verification token' }, { status: 403 });
}

/**
 * POST /api/webhooks/instagram
 * Receive webhook events from Instagram
 */
export async function POST(request) {
    const body = await request.json();

    // Always respond 200 immediately (Meta requires fast responses)
    // Process in the background
    processWebhookEvents(body).catch((err) => {
        console.error('[Webhook] Processing error:', err);
    });

    return NextResponse.json({ received: true }, { status: 200 });
}

/**
 * Process incoming webhook events
 */
async function processWebhookEvents(body) {
    const { object, entry } = body;

    // We only care about Instagram comments and Facebook Page comments
    if (object !== 'instagram' && object !== 'page') {
        console.log('[Webhook] Ignoring non-supported event object:', object);
        return;
    }

    const supabase = createServiceClient();

    for (const entryItem of entry || []) {
        const accountId = entryItem.id; // Instagram Business Account ID or Facebook Page ID

        for (const change of entryItem.changes || []) {
            if (object === 'instagram' && change.field === 'comments') {
                await handleInstagramCommentEvent(supabase, accountId, change.value);
            } else if (object === 'page' && change.field === 'feed') {
                // Facebook Page feed events include posts, comments, reactions, etc.
                // We only want comments.
                if (change.value.item === 'comment' && change.value.verb === 'add') {
                    await handleFacebookCommentEvent(supabase, accountId, change.value);
                }
            }
        }
    }
}

/**
 * Handle a single Instagram comment event
 * Flow: extract data → process automation
 */
async function handleInstagramCommentEvent(supabase, igAccountId, commentData) {
    const { id: commentId, text, from, media } = commentData;

    if (!text || !from?.id || !media?.id) {
        console.log('[Webhook] Skipping IG comment — missing data');
        return;
    }

    console.log(`[Webhook] IG Comment on media ${media.id}: "${text}" from user ${from.id}`);

    // For Instagram, we need to extract the post by ig_post_id
    const { data: post } = await supabase
        .from('instagram_posts')
        .select('id, account_id')
        .eq('ig_post_id', media.id)
        .single();

    await processAutomationForComment(supabase, post, text, from.id, commentId, 'instagram');
}

/**
 * Handle a single Facebook Page comment event (feed)
 * Flow: extract data → process automation
 */
async function handleFacebookCommentEvent(supabase, pageId, commentData) {
    const { comment_id, message, from, post_id } = commentData;

    if (!message || !from?.id || !post_id || !comment_id) {
        console.log('[Webhook] Skipping FB comment — missing data');
        return;
    }

    console.log(`[Webhook] FB Comment on post ${post_id}: "${message}" from user ${from.id}`);

    // Facebook Webhook returns post_id like "PAGEID_POSTID". 
    // In our DB, we store Facebook posts as 'fb_PAGEID_POSTID'
    const dbPostId = `fb_${post_id}`;

    const { data: post } = await supabase
        .from('instagram_posts')
        .select('id, account_id')
        .eq('ig_post_id', dbPostId)
        .single();

    await processAutomationForComment(supabase, post, message, from.id, comment_id, 'facebook');
}

/**
 * Shared logic for matching keywords and sending DMs
 */
async function processAutomationForComment(supabase, post, commentText, commenterId, commentId, platform) {
    if (!post) {
        console.log(`[Webhook] Post not found in DB`);
        return;
    }

    // Find active automation for this post
    const { data: automation } = await supabase
        .from('dm_automations')
        .select('*')
        .eq('post_id', post.id)
        .eq('is_active', true)
        .single();

    if (!automation) {
        console.log('[Webhook] No active automation for post:', post.id);
        return;
    }

    // Evaluate trigger based on configured trigger type
    const triggerConfig = automation.trigger_config;
    const triggerType = triggerConfig.triggerType || 'keywords';
    const lowerCommentText = commentText.toLowerCase().trim();
    let shouldSend = false;

    switch (triggerType) {
        case 'all_comments': {
            // Fire on every comment — no filtering needed
            shouldSend = true;
            break;
        }

        case 'emojis_only': {
            // Fire only when the comment contains at least one emoji and no plain text words
            const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
            const plainText = lowerCommentText.replace(EMOJI_REGEX, '').trim();
            const hasEmoji = EMOJI_REGEX.test(commentText); // reset regex state
            // Pure emoji comment: stripping emojis leaves nothing (or only whitespace/punctuation)
            shouldSend = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(commentText)
                && plainText.replace(/[^a-z0-9]/g, '') === '';
            break;
        }

        case 'mentions_only': {
            // Fire only when the comment is a @mention (starts with @ or contains a @handle)
            shouldSend = /@\w+/.test(commentText);
            break;
        }

        case 'keywords':
        default: {
            // Classic keyword matching
            const keywords = (triggerConfig.keywords || []).map((k) => k.toLowerCase());
            const isExcludeMode = triggerConfig.excludeKeywords;

            if (keywords.length === 0) {
                // No keywords configured — treat as "all comments"
                shouldSend = true;
            } else if (isExcludeMode) {
                shouldSend = !keywords.some((kw) => lowerCommentText.includes(kw));
            } else {
                shouldSend = keywords.some((kw) => lowerCommentText.includes(kw));
            }
            break;
        }
    }

    // Exclude @mentions if the "Exclude @Mentions" setting is on (applies to keywords mode)
    if (shouldSend && triggerConfig.excludeMentions && commentText.includes('@')) {
        console.log('[Webhook] Skipping — comment contains @mention (excludeMentions=true)');
        shouldSend = false;
    }

    if (!shouldSend) {
        console.log('[Webhook] Comment did not match trigger keywords');
        return;
    }

    // Check if we already replied to this exact comment (idempotency)
    const { data: existingLog } = await supabase
        .from('dm_sent_log')
        .select('id')
        .eq('automation_id', automation.id)
        .eq('comment_id', commentId)
        .single();

    if (existingLog) {
        console.log('[Webhook] Already processed this comment');
        return;
    }

    // Check rate limits/frequency (Send once per user config)
    if (triggerConfig.sendOncePerUser) {
        const { data: previousDms } = await supabase
            .from('dm_sent_log')
            .select('id')
            .eq('automation_id', automation.id)
            .eq('recipient_ig_id', commenterId)
            .limit(1);

        if (previousDms && previousDms.length > 0) {
            console.log(`[Webhook] User ${commenterId} already received DM for this post`);
            return;
        }
    }

    // We need the page access token to send the DM
    const { data: account } = await supabase
        .from('connected_accounts')
        .select('access_token, fb_page_access_token, ig_user_id, fb_page_id')
        .eq('id', post.account_id)
        .single();

    if (!account) {
        console.error('[Webhook] Connected account not found for post');
        return;
    }

    // Verify global exclude keywords from user settings
    const globalExcludeKeywords = (account.default_config?.excludeKeywords || []).map((k) => k.toLowerCase());
    if (globalExcludeKeywords.length > 0 && globalExcludeKeywords.some((kw) => lowerCommentText.includes(kw))) {
        console.log(`[Webhook] Skipping — comment contains global exclude keyword`);
        return;
    }

    const token = account.fb_page_access_token || account.access_token;
    // For Facebook, sender is the Page ID. For Instagram, sender is the IG User ID
    const senderId = platform === 'facebook' ? account.fb_page_id : account.ig_user_id;

    console.log(`[Webhook] Preparing to send ${automation.dm_type} DM to ${commenterId} from ${senderId}`);

    try {
        // Build variables context
        const context = {
            username: commenterId, // Standard graph API doesn't always provide username directly in webhooks without extra calls
            first_name: commenterId,
        };

        // Send DM
        await sendAutomatedDM(automation, commenterId, token, senderId, context, platform);

        // Auto-reply to comment if configured (Premium feature usually, simplified here)
        if (automation.settings_config?.autoReplyText) {
            await resolveMessageVariables(automation.settings_config.autoReplyText, context);
            // Ignore failure for comment replies
        }

        // Log success
        await supabase.from('dm_sent_log').insert({
            automation_id: automation.id,
            post_id: post.id,
            recipient_ig_id: commenterId,
            comment_id: commentId,
            comment_text: commentText,
            status: 'sent',
        });

        console.log('[Webhook] Successfully processed and logged DM');
    } catch (err) {
        console.error('[Webhook] Failed to send DM:', err.message);

        // Log failure
        await supabase.from('dm_sent_log').insert({
            automation_id: automation.id,
            post_id: post.id,
            recipient_ig_id: commenterId,
            comment_id: commentId,
            comment_text: commentText,
            status: 'failed',
            error_message: err.message,
        });
    }
}
