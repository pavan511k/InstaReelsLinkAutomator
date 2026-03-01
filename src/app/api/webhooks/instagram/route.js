import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendAutomatedDM } from '@/lib/send-dm';

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

    // We only care about Instagram comments
    if (object !== 'instagram') {
        console.log('[Webhook] Ignoring non-Instagram event:', object);
        return;
    }

    const supabase = createServiceClient();

    for (const entryItem of entry || []) {
        const igUserId = entryItem.id; // Instagram Business Account ID that received the event

        for (const change of entryItem.changes || []) {
            if (change.field === 'comments') {
                await handleCommentEvent(supabase, igUserId, change.value);
            }
        }
    }
}

/**
 * Handle a single comment event
 * Flow: comment → find matching automation → check keywords → send DM
 */
async function handleCommentEvent(supabase, igAccountId, commentData) {
    const { id: commentId, text, from, media } = commentData;

    if (!text || !from?.id || !media?.id) {
        console.log('[Webhook] Skipping comment — missing data');
        return;
    }

    const commentText = text.toLowerCase().trim();
    const commenterId = from.id;
    const mediaId = media.id;

    console.log(`[Webhook] Comment on media ${mediaId}: "${text}" from user ${commenterId}`);

    try {
        // Find the post in our DB by the Instagram media ID
        const { data: post } = await supabase
            .from('instagram_posts')
            .select('id, account_id')
            .eq('ig_post_id', mediaId)
            .single();

        if (!post) {
            console.log('[Webhook] Post not found in DB for media:', mediaId);
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

        // Check if comment matches trigger keywords
        const triggerConfig = automation.trigger_config;
        const keywords = (triggerConfig.keywords || []).map((k) => k.toLowerCase());

        const isExcludeMode = triggerConfig.excludeKeywords;
        let shouldSend = false;

        if (isExcludeMode) {
            // Send to everyone EXCEPT those who use these keywords
            shouldSend = !keywords.some((kw) => commentText.includes(kw));
        } else {
            // Send only to those who use one of the keywords
            shouldSend = keywords.some((kw) => commentText.includes(kw));
        }

        // Exclude mentions if configured
        if (shouldSend && triggerConfig.excludeMentions && text.includes('@')) {
            console.log('[Webhook] Skipping — comment contains @mention');
            shouldSend = false;
        }

        if (!shouldSend) {
            console.log('[Webhook] Comment did not match trigger keywords');
            return;
        }

        // Check deduplication (sendOncePerUser)
        if (triggerConfig.sendOncePerUser) {
            const { data: existing } = await supabase
                .from('dm_sent_log')
                .select('id')
                .eq('automation_id', automation.id)
                .eq('recipient_ig_id', commenterId)
                .limit(1);

            if (existing && existing.length > 0) {
                console.log('[Webhook] DM already sent to this user for this automation');
                return;
            }
        }

        // Get the connected account for access token
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('ig_user_id, fb_page_access_token, access_token')
            .eq('id', post.account_id)
            .eq('is_active', true)
            .single();

        if (!account) {
            console.log('[Webhook] Connected account not found or inactive');
            return;
        }

        const accessToken = account.fb_page_access_token || account.access_token;
        const senderIgId = account.ig_user_id;

        // Apply delay if configured
        if (automation.settings_config?.delayMessage) {
            const delayMs = Math.floor(Math.random() * 90000) + 30000; // 30s-2min
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        // Send the DM
        const context = {
            first_name: from.username || 'there',
            username: from.username || '',
        };

        const result = await sendAutomatedDM(
            automation,
            commenterId,
            accessToken,
            senderIgId,
            context
        );

        console.log(`[Webhook] ✅ DM sent to ${commenterId}:`, result);

        // Log the sent DM for deduplication and analytics
        await supabase.from('dm_sent_log').insert({
            automation_id: automation.id,
            post_id: post.id,
            recipient_ig_id: commenterId,
            comment_id: commentId,
            comment_text: text,
            status: 'sent',
            sent_at: new Date().toISOString(),
        });

    } catch (err) {
        console.error('[Webhook] Error processing comment:', err);

        // Log the failure
        try {
            const supabaseRetry = createServiceClient();
            await supabaseRetry.from('dm_sent_log').insert({
                automation_id: null,
                post_id: null,
                recipient_ig_id: commenterId,
                comment_id: commentId,
                comment_text: text,
                status: 'failed',
                error_message: err.message,
                sent_at: new Date().toISOString(),
            });
        } catch {
            // Silent fail for logging
        }
    }
}
