import { NextResponse, after } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
import { graphBase } from '@/lib/meta-graph';
import {
    sendAutomatedDM, sendFollowGateDM, checkUserIsFollower,
    resolveMessageVariables, replyToComment,
    sendTextDM, sendButtonTemplateDM, sendQuickReplyDM, sendMultiCtaDM,
    applyBranding,
} from '@/lib/send-dm';
import { applyTracking } from '@/lib/click-tracking';
import { fireAlerts } from '@/app/api/alerts/route';

import { getDmLimit, getEffectivePlan } from '@/lib/plans';
import { getMonthlyDmCount } from '@/lib/plan-server';

// No hardcoded fallback — leaving a default would let anyone who knows the
// literal pass Meta's challenge if the env var were ever missing.
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

function createServiceClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

/**
 * Fetches the effective plan string for a user from user_plans.
 * Falls back to 'free' if the table doesn't exist or no row is found.
 */
async function getUserPlan(supabase, userId) {
    try {
        const { data } = await supabase
            .from('user_plans')
            .select('plan, plan_expires_at, trial_ends_at')
            .eq('user_id', userId)
            .maybeSingle();
        return getEffectivePlan(data);
    } catch {
        return 'free';
    }
}

// ─── Verification ────────────────────────────────────────────────────────────

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const mode      = searchParams.get('hub.mode');
    const token     = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (!WEBHOOK_VERIFY_TOKEN) {
        console.error('[Webhook] WEBHOOK_VERIFY_TOKEN not configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
        console.log('[Webhook] Verification successful');
        return new NextResponse(challenge, { status: 200 });
    }

    console.warn('[Webhook] Verification failed — invalid token');
    return NextResponse.json({ error: 'Invalid verification token' }, { status: 403 });
}

// ─── Receive ─────────────────────────────────────────────────────────────────

export async function POST(request) {
    // Read raw body so we can verify Meta's HMAC over the exact bytes sent.
    const rawBody = await request.text();

    // ── Verify X-Hub-Signature-256 — fail closed ──────────────────
    // Meta signs the raw body with the App Secret. Without this check, anyone
    // can POST forged events here and trigger DMs. Reference:
    // https://developers.facebook.com/docs/messenger-platform/webhooks#validate-payloads
    // Events can arrive signed by either the Facebook app or the Instagram app
    // depending on which product the webhook subscription lives under. Accept
    // either signature so a single webhook URL serves both flows.
    const candidateSecrets = [
        process.env.META_APP_SECRET,
        process.env.INSTAGRAM_APP_SECRET,
    ].filter(Boolean);
    if (candidateSecrets.length === 0) {
        console.error('[Webhook] Neither META_APP_SECRET nor INSTAGRAM_APP_SECRET configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const signatureHeader = request.headers.get('x-hub-signature-256') || '';
    if (!signatureHeader.startsWith('sha256=')) {
        console.warn('[Webhook] Missing or malformed X-Hub-Signature-256');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    const providedHex = signatureHeader.slice('sha256='.length);
    let provided;
    try {
        provided = Buffer.from(providedHex, 'hex');
    } catch {
        provided = null;
    }
    const signaturesMatch = !!provided && candidateSecrets.some((secret) => {
        const expected = Buffer.from(
            createHmac('sha256', secret).update(rawBody).digest('hex'),
            'hex',
        );
        return provided.length === expected.length && timingSafeEqual(provided, expected);
    });
    if (!signaturesMatch) {
        console.warn('[Webhook] Invalid X-Hub-Signature-256 — rejecting', {
            providedPrefix: providedHex.slice(0, 12),
            providedLen: providedHex.length,
            bodyBytes: Buffer.byteLength(rawBody, 'utf8'),
            secretsTried: candidateSecrets.length,
            ua: request.headers.get('user-agent') || null,
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let body;
    try {
        body = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Await fully — serverless runtimes kill unawaited promises once the
    // response is returned. Meta waits up to 20s so this is safe.
    try {
        await processWebhookEvents(body);
    } catch (err) {
        console.error('[Webhook] Processing error:', err);
    }

    return NextResponse.json({ received: true }, { status: 200 });
}

// ─── Router ──────────────────────────────────────────────────────────────────

async function processWebhookEvents(body) {
    const { object, entry } = body;

    if (object !== 'instagram' && object !== 'page') return;

    const supabase = createServiceClient();

    for (const entryItem of entry || []) {
        const accountId = entryItem.id;

        // ── Incoming DM replies (messages) ─────────────────────────────
        for (const msg of entryItem.messaging || []) {
            if (msg.message && !msg.message.is_echo) {
                await handleIncomingDMReply(supabase, accountId, msg);
            }
        }

        // ── Comment + mention events (changes) ────────────────────────
        for (const change of entryItem.changes || []) {
            if (object === 'instagram' && change.field === 'comments') {
                await handleInstagramCommentEvent(supabase, accountId, change.value);
            } else if (object === 'instagram' && change.field === 'mentions') {
                await handleStoryMentionEvent(supabase, accountId, change.value);
            } else if (object === 'page' && change.field === 'feed') {
                if (change.value.item === 'comment' && change.value.verb === 'add') {
                    await handleFacebookCommentEvent(supabase, accountId, change.value);
                }
            }
        }
    }
}

// ─── DM Reply Handler ────────────────────────────────────────────────────────

async function handleIncomingDMReply(supabase, igAccountId, messagingEvent) {
    const senderId   = messagingEvent.sender?.id;
    const msgText    = messagingEvent.message?.text?.toLowerCase().trim() || '';
    const msgPayload = messagingEvent.message?.quick_reply?.payload || '';

    if (!senderId || !msgText) return;

    console.log(`[Webhook] Incoming DM from ${senderId}: "${msgText}"`);

    // ── Story reply ─────────────────────────────────────────
    // When a viewer replies to a story, Meta delivers a normal `messages`
    // webhook with `message.reply_to.story.id` set to the story's media ID.
    // Stories don't generate `comments` events, so this is the only hook
    // we get for "user reacted to my story". Try to dispatch via the
    // story-reply handler first; if no automation matches, fall through
    // so the existing follow-gate / email-collector logic still runs.
    const replyToStoryId = messagingEvent.message?.reply_to?.story?.id;
    if (replyToStoryId) {
        console.log(`[Webhook] DM is a story reply → story_id=${replyToStoryId}`);
        const handled = await handleStoryReplyEvent(supabase, igAccountId, {
            senderId,
            storyMediaId: replyToStoryId,
            text: messagingEvent.message?.text || '',
            mid: messagingEvent.message?.mid || null,
        });
        if (handled) return;
    }

    // ── Ice breaker tap ─────────────────────────────────────
    if (msgPayload?.startsWith('ICE_BREAKER_')) {
        await handleIceBreakerResponse(supabase, igAccountId, senderId, msgPayload);
        return;
    }

    // ── Quick-reply chip tap ────────────────────────────────
    // The recipient just tapped one of the chips on a Quick Reply DM.
    // Match the payload back to the original automation's config and send
    // the configured response. Returns true if handled (so we don't fall
    // through into follow-up / email-collector branches).
    if (msgPayload && await handleQuickReplyTap(supabase, senderId, msgPayload)) {
        return;
    }

    // Look for a pending follow-up queue entry for this user
    const { data: queueEntry } = await supabase
        .from('dm_followup_queue')
        .select('*, connected_accounts(access_token, fb_page_access_token, ig_user_id)')
        .eq('recipient_ig_id', senderId)
        .eq('status', 'awaiting_confirmation')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!queueEntry) {
        await handleEmailCollectorReply(supabase, senderId, msgText);
        return;
    }

    const isExplicitNo =
        msgPayload === 'NOT_FOLLOWING' ||
        msgText === 'no' || msgText === 'not yet' || msgText === '\u274c no, not yet';

    if (isExplicitNo) {
        console.log(`[Webhook] User ${senderId} tapped NO — keeping queue open`);
        const account2  = queueEntry.connected_accounts;
        const token2    = account2.fb_page_access_token || account2.access_token;
        const igSender2 = queueEntry.ig_sender_id;
        try {
            const declineMsg = queueEntry.decline_message ||
                "No worries! Follow us first, then tap \u2705 Yes when you're ready! \ud83d\ude4c";
            const useIgApi2 = !account2.fb_page_access_token;
            // Plain text — re-prompting with YES/NO chips feels pushy.
            // Queue stays open; if the user types 'yes' later, normal flow resumes.
            await sendTextDM(igSender2, senderId, declineMsg, token2, useIgApi2);
        } catch (err) {
            console.warn('[Webhook] Failed to send no-response message:', err.message);
        }
        return;
    }

    const keywords = queueEntry.confirmation_keywords || ['yes', 'done', 'followed', 'ok'];
    const isConfirmation =
        msgPayload === 'CONFIRMED_FOLLOW' ||
        keywords.some((kw) => msgText.includes(kw.toLowerCase()));

    if (!isConfirmation) {
        console.log('[Webhook] DM reply does not match confirmation keywords');
        return;
    }

    const account     = queueEntry.connected_accounts;
    const accessToken = account.fb_page_access_token || account.access_token;
    const useIgApi    = !account.fb_page_access_token;
    const igSenderId  = queueEntry.ig_sender_id;

    console.log(`[Webhook] Checking if ${senderId} follows ${igSenderId}...`);
    let isFollowing = false;

    try {
        isFollowing = await checkUserIsFollower(igSenderId, senderId, accessToken);
    } catch (err) {
        console.error('[Webhook] Follow check error (non-fatal):', err.message);
    }

    if (isFollowing) {
        console.log(`[Webhook] ${senderId} IS following — sending reward DM`);

        let rewardPlan = 'free';
        try {
            // Plan lives in user_plans — resolve via the automation's user_id.
            const { data: autoForPlan } = await supabase
                .from('dm_automations').select('user_id')
                .eq('id', queueEntry.automation_id).maybeSingle();
            if (autoForPlan?.user_id) rewardPlan = await getUserPlan(supabase, autoForPlan.user_id);
        } catch { /* defaults to free */ }

        // Build the click-tracking map for this automation so reward-DM
        // links route through /r/<code> for analytics. Without this, every
        // click on a Follow Gate reward link is invisible to the dashboard.
        let rewardTracking = {};
        try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
            const { data: linkCodes } = await supabase
                .from('dm_link_codes').select('code, original_url')
                .eq('automation_id', queueEntry.automation_id)
                .limit(500);
            for (const row of (linkCodes || [])) {
                rewardTracking[row.original_url] = `${appUrl}/r/${row.code}`;
            }
        } catch { /* non-fatal — reward will still send, just unmapped */ }

        try {
            await sendRewardDM(igSenderId, senderId, queueEntry.link_dm_type,
                queueEntry.link_dm_config, accessToken, rewardTracking, rewardPlan, useIgApi);

            await supabase.from('dm_followup_queue')
                .update({ status: 'link_sent', updated_at: new Date().toISOString() })
                .eq('id', queueEntry.id);

            await supabase.from('dm_sent_log').insert({
                automation_id:   queueEntry.automation_id,
                post_id:         null,
                recipient_ig_id: senderId,
                comment_id:      null,
                comment_text:    msgText,
                status:          'sent',
                platform:        useIgApi ? 'instagram' : 'facebook',
                sent_at:         new Date().toISOString(),
            });

            console.log('[Webhook] Reward DM sent and queue entry marked link_sent');
        } catch (err) {
            console.error('[Webhook] Failed to send reward DM:', err.message);
        }
    } else {
        const newRetryCount = (queueEntry.retry_count || 0) + 1;
        const maxRetries    = queueEntry.max_retries || 3;

        console.log(`[Webhook] ${senderId} is NOT following (retry ${newRetryCount}/${maxRetries})`);

        if (newRetryCount >= maxRetries) {
            await supabase.from('dm_followup_queue')
                .update({ status: 'max_retries_reached', retry_count: newRetryCount, updated_at: new Date().toISOString() })
                .eq('id', queueEntry.id);
            try {
                await sendTextDM(igSenderId, senderId,
                    "Sorry, we couldn't verify your follow after multiple attempts. Feel free to try again by commenting! \ud83d\ude0a",
                    accessToken, useIgApi);
            } catch (err) {
                console.warn('[Webhook] Failed to send max-retry message:', err.message);
            }
        } else {
            await supabase.from('dm_followup_queue')
                .update({ retry_count: newRetryCount, updated_at: new Date().toISOString() })
                .eq('id', queueEntry.id);
            try {
                // Use 'there' as a friendly placeholder fallback \u2014 the IGSID
                // is meaningless to a recipient and dm_followup_queue doesn't
                // currently capture the username.
                const nudge = resolveMessageVariables(
                    queueEntry.nudge_message ||
                    "We couldn't verify your follow yet \ud83d\ude48 Make sure you're following, then tap \u2705 Yes!",
                    { username: 'there', first_name: 'there' },
                );
                await sendFollowGateDM(igSenderId, senderId, nudge, accessToken, useIgApi);
            } catch (err) {
                console.warn('[Webhook] Failed to send nudge DM:', err.message);
            }
        }
    }
}

// ─── Quick-reply chip-tap handler ────────────────────────────────────────────
//
// When a recipient taps one of the chips on a Quick Reply DM, Meta delivers a
// `messaging` event whose `message.quick_reply.payload` matches the payload
// we encoded at send time (chip.id). Our generated payloads for the legacy
// title-derived format ("SEND_ME_THE_LINK") would never collide with the
// guards above (ICE_BREAKER_*, follow-gate keywords) because they go through
// the title-uppercase transform — so we just look up the most recent
// quick_reply automation DM to this recipient and try to match.
//
// Returns true if the tap was matched and handled (so the caller can return
// without falling through to follow-gate / email-collector branches).
async function handleQuickReplyTap(supabase, senderId, msgPayload) {
    // Find the most recent quick_reply DM sent to this user. We bound the
    // window to 7 days to avoid matching a chip the user is "tapping" weeks
    // after the conversation went stale (very rare in practice).
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recent } = await supabase
        .from('dm_sent_log')
        .select(`
            id, automation_id, recipient_username, platform, sent_at,
            dm_automations!inner(
                id, user_id, dm_type, dm_config,
                connected_accounts!inner(id, access_token, fb_page_access_token, ig_user_id)
            )
        `)
        .eq('recipient_ig_id', senderId)
        .eq('status', 'sent')
        .gte('sent_at', sevenDaysAgo)
        .eq('dm_automations.dm_type', 'quick_reply')
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!recent) return false;

    const automation = recent.dm_automations;
    const chips = automation?.dm_config?.quickReplies || [];

    // Match by chip.id (preferred — set explicitly when sending) OR by the
    // title-uppercase fallback that send-dm.js generates when payload is
    // omitted. This makes the lookup robust to either format.
    const titleToPayload = (t) => (t || '').trim().toUpperCase().replace(/\s+/g, '_');
    const matched = chips.find((c) =>
        c.id === msgPayload ||
        c.payload === msgPayload ||
        titleToPayload(c.title) === msgPayload
    );

    if (!matched || !matched.responseMessage?.trim()) return false;

    const account = automation.connected_accounts;
    const token   = account.fb_page_access_token || account.access_token;
    const useIg   = !account.fb_page_access_token;
    const platform = recent.platform || 'instagram';

    const personal = recent.recipient_username || 'there';
    const plan = await getUserPlan(supabase, automation.user_id);

    // Substitute placeholders + apply branding so the response matches the
    // way the original message_template / quick_reply DMs were sent.
    let body = resolveMessageVariables(matched.responseMessage, {
        username: personal,
        first_name: personal,
    });
    // Inline branding logic — applyBranding lives in send-dm.js but isn't
    // exported. We mirror its behaviour here: free → suffix with URL, Pro →
    // respect dm_config.branding (custom or empty for unbrand).
    const isPro = plan === 'pro' || plan === 'business' || plan === 'trial';
    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://autodm.pro').replace(/\/$/, '');
    if (isPro) {
        const custom = (automation.dm_config?.branding || '').trim();
        if (custom && !body.trimEnd().endsWith(custom)) body = `${body.trimEnd()}\n\n— ${custom}`;
    } else {
        const suffix = `— Sent with AutoDM · ${APP_URL}`;
        if (!body.trimEnd().endsWith(suffix)) body = `${body.trimEnd()}\n\n${suffix}`;
    }

    try {
        await sendTextDM(account.ig_user_id, senderId, body, token, useIg);

        await supabase.from('dm_sent_log').insert({
            automation_id:      automation.id,
            post_id:            null,
            recipient_ig_id:    senderId,
            recipient_username: recent.recipient_username,
            comment_id:         null,
            comment_text:       `[chip tap: ${matched.title}]`,
            status:             'sent',
            platform,
            sent_at:            new Date().toISOString(),
        });

        console.log(`[Webhook/QR] ✅ Chip "${matched.title}" reply sent to ${senderId}`);
    } catch (err) {
        console.error(`[Webhook/QR] Failed to reply for chip tap "${matched.title}":`, err.message);
        await supabase.from('dm_sent_log').insert({
            automation_id:      automation.id,
            post_id:            null,
            recipient_ig_id:    senderId,
            recipient_username: recent.recipient_username,
            comment_id:         null,
            comment_text:       `[chip tap: ${matched.title}]`,
            status:             'failed',
            error_message:      err.message,
            platform,
            sent_at:            new Date().toISOString(),
        });
    }
    return true;
}

async function sendRewardDM(igSenderId, recipientId, dmType, dmConfig, accessToken, trackingMap = {}, plan = 'free', useIgApi = false) {
    switch (dmType) {
        case 'button_template':
            // Branding controlled by dmConfig.appendBranding (default true).
            return sendButtonTemplateDM(igSenderId, recipientId, dmConfig.slides || [], accessToken, trackingMap, plan, useIgApi, dmConfig);
        case 'quick_reply': {
            const text = applyBranding(dmConfig.message || '', dmConfig, plan);
            return sendQuickReplyDM(igSenderId, recipientId, text, dmConfig.quickReplies || [], accessToken, useIgApi);
        }
        case 'multi_cta':
            return sendMultiCtaDM(igSenderId, recipientId, dmConfig.message || '', dmConfig.buttons || [], accessToken, trackingMap, plan, useIgApi, dmConfig);
        case 'message_template':
        default: {
            const text = applyBranding(dmConfig.message || '', dmConfig, plan);
            return sendTextDM(igSenderId, recipientId, text, accessToken, useIgApi);
        }
    }
}

// ─── Comment Handlers ─────────────────────────────────────────────────────────

async function handleInstagramCommentEvent(supabase, igAccountId, commentData) {
    const { id: commentId, text, from, media } = commentData;

    if (!text || !from?.id || !media?.id) {
        console.log('[Webhook] Skipping IG comment — missing data');
        return;
    }

    console.log(`[Webhook] IG Comment on media ${media.id}: "${text}" from user ${from.id} (@${from.username || '?'})`);

    const { data: post } = await supabase
        .from('instagram_posts')
        .select('id, account_id')
        .eq('ig_post_id', media.id)
        .single();

    // from.username — Instagram includes the handle on comment webhook payloads.
    // Captured here and propagated through the queue / sent_log so flow-step
    // and upsell follow-ups can substitute {first_name} / {username}.
    const commenterUsername = from.username || null;

    const perPostFired = await processAutomationForComment(supabase, post, text, from.id, commentId, 'instagram', commenterUsername);
    if (post?.account_id) {
        await processGlobalTriggers(supabase, post, text, from.id, commentId, 'instagram', perPostFired, commenterUsername);
    }
}

async function handleFacebookCommentEvent(supabase, pageId, commentData) {
    const { comment_id, message, from, post_id } = commentData;

    if (!message || !from?.id || !post_id || !comment_id) {
        console.log('[Webhook] Skipping FB comment — missing data');
        return;
    }

    console.log(`[Webhook] FB Comment on post ${post_id}: "${message}" from user ${from.id}`);

    const { data: post } = await supabase
        .from('instagram_posts')
        .select('id, account_id')
        .eq('ig_post_id', `fb_${post_id}`)
        .single();

    const commenterUsername = from.name || from.username || null;
    const perPostFiredFb = await processAutomationForComment(supabase, post, message, from.id, comment_id, 'facebook', commenterUsername);
    if (post?.account_id) {
        await processGlobalTriggers(supabase, post, message, from.id, comment_id, 'facebook', perPostFiredFb, commenterUsername);
    }
}

// ─── Core Automation Logic ───────────────────────────────────────────────────

async function processAutomationForComment(supabase, post, commentText, commenterId, commentId, platform, commenterUsername = null) {
    if (!post) {
        console.log('[Webhook] Post not found in DB');
        return;
    }

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

    if (automation.expires_at && new Date(automation.expires_at) <= new Date()) {
        console.log(`[Webhook] Automation ${automation.id} has expired — auto-pausing`);
        await supabase.from('dm_automations')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', automation.id);
        return;
    }

    if (automation.scheduled_start_at && new Date(automation.scheduled_start_at) > new Date()) {
        console.log(`[Webhook] Automation ${automation.id} not yet started — skipping`);
        return;
    }

    const { data: account } = await supabase
        .from('connected_accounts')
        .select('access_token, fb_page_access_token, ig_user_id, fb_page_id, platform, default_config')
        .eq('id', post.account_id)
        .single();

    if (!account) {
        console.error('[Webhook] Connected account not found for post');
        return;
    }

    const triggerConfig    = automation.trigger_config;
    const settingsConfig   = automation.settings_config || {};
    const triggerType      = triggerConfig.type || triggerConfig.triggerType || 'keywords';
    const lowerCommentText = commentText.toLowerCase().trim();
    let shouldSend = false;

    switch (triggerType) {
        case 'all_comments':
            shouldSend = true;
            break;

        case 'emojis_only': {
            const EMOJI_RE  = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
            const plainText = lowerCommentText.replace(EMOJI_RE, '').trim();
            shouldSend = EMOJI_RE.test(commentText) && plainText.replace(/[^a-z0-9]/g, '') === '';
            break;
        }

        case 'mentions_only':
            shouldSend = /@\w+/.test(commentText);
            break;

        case 'keywords':
        default: {
            const isExcludeMode = !!triggerConfig.excludeKeywords;

            // Per-automation keywords are the user's source of truth for the
            // match list. Globals (account.default_config.keywords) are
            // *positive* default triggers — merging them into an exclude-mode
            // automation would flip them into a blacklist, which is the
            // opposite of the user's intent. So we only merge globals in
            // positive (non-exclude) mode.
            let keywords = (triggerConfig.keywords || []).map((k) => k.toLowerCase());
            if (!isExcludeMode && !settingsConfig.disableUniversalTriggers) {
                const globalKws = (account.default_config?.keywords || []).map((k) => k.toLowerCase());
                keywords = [...new Set([...keywords, ...globalKws])];
            }

            if (keywords.length === 0) {
                // Empty keyword list on a 'keywords' trigger means the user
                // hasn't configured a match — don't fire. To send on every
                // comment, the user should pick trigger type 'all_comments'.
                // The fallback block below still handles cases where the
                // account-level default trigger type is non-keyword.
                shouldSend = false;
            } else if (isExcludeMode) {
                shouldSend = !keywords.some((kw) => lowerCommentText.includes(kw));
            } else {
                shouldSend = keywords.some((kw) => lowerCommentText.includes(kw));
            }
            break;
        }
    }

    if (
        !shouldSend &&
        !settingsConfig.disableUniversalTriggers &&
        account.default_config?.triggerType &&
        account.default_config.triggerType !== 'keywords' &&
        triggerType === 'keywords' &&
        (triggerConfig.keywords || []).length === 0
    ) {
        const globalType = account.default_config.triggerType;
        if (globalType === 'all_comments') {
            shouldSend = true;
        } else if (globalType === 'emojis_only') {
            const EMOJI_GLOBAL = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
            const plainGlobal  = lowerCommentText.replace(EMOJI_GLOBAL, '').trim();
            shouldSend = EMOJI_GLOBAL.test(commentText) && plainGlobal.replace(/[^a-z0-9]/g, '') === '';
        } else if (globalType === 'mentions_only') {
            shouldSend = /@\w+/.test(commentText);
        }
    }

    if (shouldSend && triggerConfig.excludeMentions && commentText.includes('@')) {
        shouldSend = false;
    }

    if (!shouldSend) {
        console.log('[Webhook] Comment did not match trigger');
        return;
    }

    const globalExclude = (account.default_config?.excludeKeywords || []).map((k) => k.toLowerCase());
    if (globalExclude.length > 0 && globalExclude.some((kw) => lowerCommentText.includes(kw))) {
        console.log('[Webhook] Skipping — global exclude keyword matched');
        return;
    }

    // ── Billing gate — plan from user_plans, count from cached counter ──
    const userPlan = await getUserPlan(supabase, automation.user_id);
    const dmLimit  = getDmLimit(userPlan);

    if (dmLimit !== null) {
        const totalMonthly = await getMonthlyDmCount(supabase, automation.user_id);
        if (totalMonthly >= dmLimit) {
            console.log(`[Webhook] Monthly limit (${dmLimit}) reached for ${userPlan} plan — skipping`);
            return;
        }
    }

    // ── Idempotency: check sent log AND queue ─────────────────────
    const { data: existingLog } = await supabase
        .from('dm_sent_log').select('id')
        .eq('automation_id', automation.id).eq('comment_id', commentId).maybeSingle();

    if (existingLog) {
        console.log('[Webhook] Already processed this comment (sent log)');
        return;
    }

    const { data: existingQueue } = await supabase
        .from('dm_queue').select('id')
        .eq('automation_id', automation.id).eq('comment_id', commentId)
        .in('status', ['pending', 'processing', 'sent']).maybeSingle();

    if (existingQueue) {
        console.log('[Webhook] Already enqueued this comment (dm queue)');
        return;
    }

    // ── Send-once-per-user ────────────────────────────────────────
    if (triggerConfig.sendOncePerUser) {
        const { data: prevDms } = await supabase
            .from('dm_sent_log').select('id')
            .eq('automation_id', automation.id).eq('recipient_ig_id', commenterId).limit(1);
        if (prevDms && prevDms.length > 0) {
            console.log(`[Webhook] User ${commenterId} already received DM for this post`);
            return;
        }
    }

    const token    = account.fb_page_access_token || account.access_token;
    const senderId = platform === 'facebook' ? account.fb_page_id : account.ig_user_id;
    // Instagram Business Login tokens must use graph.instagram.com for comment replies
    // Facebook Page Access Tokens use graph.facebook.com
    const useIgApi = !account.fb_page_access_token;

    // delayMessage: store a future scheduled_after on the queue row instead of
    // sleeping inline — sleeping here blocks the webhook and causes Meta retries.
    const delayMs = settingsConfig.delayMessage
        ? Math.floor(Math.random() * 90_000) + 30_000
        : 0;

    // Friendly fallback when Meta's webhook payload omits from.username —
    // we never want to substitute the numeric IGSID into a public comment
    // reply (it would surface "Hey 1784140123456789!" to the post).
    const personalForReply = commenterUsername || 'there';
    const context = {
        username:   personalForReply,
        first_name: personalForReply,
        comment_id: commentId,
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    // ── A/B variant selection (must precede tracking map lookup) ──
    // Selection happens against `dm_sent_log` aggregates and doesn't
    // need `dm_link_codes`, so we resolve the variant first. Then we
    // do a SINGLE link-code query below with an optional ab_variant
    // filter — previously this was two queries, the first fetched all
    // codes then was thrown away the moment A/B was enabled.
    let activeAutomation = automation;
    let abVariant = null;

    if (automation.dm_config?.abEnabled && automation.dm_config?.variantA && automation.dm_config?.variantB) {
        const winner = automation.dm_config.abWinner;

        if (winner) {
            abVariant = winner;
        } else {
            const { data: abRows } = await supabase
                .from('dm_sent_log').select('ab_variant')
                .eq('automation_id', automation.id).in('ab_variant', ['A', 'B']).eq('status', 'sent');

            const countA = (abRows || []).filter((r) => r.ab_variant === 'A').length;
            const countB = (abRows || []).filter((r) => r.ab_variant === 'B').length;
            abVariant = countA <= countB ? 'A' : 'B';
        }

        const variantConfig = abVariant === 'A' ? automation.dm_config.variantA : automation.dm_config.variantB;
        activeAutomation = { ...automation, dm_type: variantConfig.type, dm_config: variantConfig };
        console.log(`[Webhook] A/B variant selected: ${abVariant}`);
    }

    // ── Tracking map — one query, variant-aware. ────────────────
    // For non-A/B automations: pulls all codes for the automation.
    // For A/B automations: pulls only the active variant's codes.
    // (The previous version did the all-codes fetch unconditionally
    // and then a second variant-filtered fetch when A/B was on,
    // throwing away the first result. Net: redundant query gone.)
    let trackingMap = {};
    try {
        let q = supabase
            .from('dm_link_codes').select('code, original_url')
            .eq('automation_id', automation.id)
            .limit(500);
        if (abVariant) q = q.eq('ab_variant', abVariant);

        const { data: linkCodes } = await q;
        for (const row of (linkCodes || [])) {
            trackingMap[row.original_url] = `${appUrl}/r/${row.code}`;
        }
    } catch { /* non-fatal */ }

    try {
        if (activeAutomation.dm_type === 'follow_up') {
            await handleFollowUpAutomation(supabase, activeAutomation, post, commenterId, commentId, commentText, senderId, token, trackingMap, commenterUsername, platform);
            return true;
        }

        if (activeAutomation.dm_type === 'email_collector') {
            await handleEmailCollectorAutomation(supabase, activeAutomation, post, commenterId, commentId, commentText, senderId, token, useIgApi, commenterUsername, platform);
            return true;
        }

        // ── All other types — reply immediately (if enabled), enqueue the DM ──
        // commentReplyEnabled defaults to true: undefined / null on legacy
        // rows must keep the existing "always reply" behavior. The user has
        // to explicitly set it to false to suppress the reply.
        const commentReplyEnabled = settingsConfig.commentReplyEnabled !== false;
        if (commentReplyEnabled) {
            // Neutral default \u2014 works for keyword / all-comments / mentions /
            // emoji automations alike. Users who specifically need
            // follow-gate copy ("follow and comment again") can write it
            // themselves on the SettingsTab textarea.
            const DEFAULT_COMMENT_REPLY = 'Hey! Just sent you a DM \ud83d\udce9 \u2014 check your inbox.';
            const replyMsg = settingsConfig.replyMessage || settingsConfig.autoReplyText || DEFAULT_COMMENT_REPLY;
            try {
                await replyToComment(commentId, resolveMessageVariables(replyMsg, context), token, useIgApi);
                console.log('[Webhook] Comment reply sent');
            } catch (replyErr) {
                console.warn('[Webhook] Comment reply failed (non-fatal):', replyErr.message);
            }
        } else {
            console.log('[Webhook] Comment reply skipped \u2014 disabled on this automation');
        }

        const { error: enqErr } = await supabase.from('dm_queue').insert({
            user_id:            automation.user_id,
            account_id:         post.account_id,
            automation_id:      automation.id,
            post_id:            post.id,
            recipient_ig_id:    commenterId,
            recipient_username: commenterUsername,
            comment_id:         commentId,
            comment_text:       commentText,
            platform,
            dm_type:            activeAutomation.dm_type,
            dm_config:          activeAutomation.dm_config,
            tracking_map:       trackingMap,
            user_plan:          userPlan,
            queue_reason:       'overflow',
            priority:           5,
            status:             'pending',
            scheduled_after:    new Date(Date.now() + delayMs).toISOString(),
        });

        // Concurrent webhook deliveries can both pass the existingQueue check
        // and race here. The unique idx_dm_queue_dedup catches the duplicate
        // (Postgres error 23505); treat that as "already queued, skip" rather
        // than logging a misleading 'failed' row in dm_sent_log.
        if (enqErr) {
            if (enqErr.code === '23505') {
                console.log(`[Webhook] DM already queued (dedup race) for ${commenterId} on comment ${commentId}`);
                return true;
            }
            throw enqErr;
        }

        console.log(`[Webhook] DM enqueued for ${commenterId}${abVariant ? ` (variant ${abVariant})` : ''}`);

        // Trigger immediate queue processing for non-delayed DMs so the DM
        // goes out in ~1s instead of waiting up to 1 minute for the next cron.
        if(!delayMs) {
            const cronSecret = process.env.CRON_SECRET || '';
            after( async () => {
                try {
                    await fetch(`${appUrl}/api/cron/process-queue`, { 
                        headers: { Authorization: `Bearer ${cronSecret}` },
                    });
                } catch (err) {
                    /* non-fatal - cron will still pick it up*/
                    console.error('[Webhook] Failed to trigger immediate queue processing:', err.message);
                }
            });
        }

        checkAndFireLimitAlert(supabase, automation.user_id)
            .catch((e) => console.warn('[Webhook] Limit alert check failed (non-fatal):', e.message));

        // Sample for A/B winner declaration. The function self-gates on the
        // 50-send-per-variant threshold and on a 10% CTR delta, so most
        // calls return after a single COUNT query. Fire-and-forget — once
        // a winner is declared, dm_config.abWinner short-circuits future
        // variant rotation in this same handler (line ~680).
        if (abVariant) {
            checkAndDeclareAbWinner(supabase, automation)
                .catch((e) => console.warn('[Webhook] A/B winner check failed (non-fatal):', e.message));
        }

        return true;
    } catch (err) {
        console.error('[Webhook] Failed to enqueue DM:', err.message);
        await supabase.from('dm_sent_log').insert({
            automation_id:   automation.id,
            post_id:         post.id,
            recipient_ig_id: commenterId,
            comment_id:      commentId,
            comment_text:    commentText,
            status:          'failed',
            error_message:   `enqueue failed: ${err.message}`,
            ab_variant:      abVariant,
            platform,
            sent_at:         new Date().toISOString(),
        });
    }
}

async function checkAndFireLimitAlert(supabase, userId) {
    const { data: prefs } = await supabase
        .from('alert_preferences')
        .select('alert_email, webhook_url, threshold_pct, alerted_months')
        .eq('user_id', userId)
        .maybeSingle();

    if (!prefs || (!prefs.alert_email && !prefs.webhook_url)) return;

    // Plan from user_plans — no connected_accounts needed
    const alertPlan  = await getUserPlan(supabase, userId);
    const alertLimit = getDmLimit(alertPlan);
    if (alertLimit === null) return; // unlimited plan — no alerts needed

    const currentCount = await getMonthlyDmCount(supabase, userId);
    const threshold    = prefs.threshold_pct ?? 80;
    const usagePct     = (currentCount / alertLimit) * 100;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const alreadyFired = (prefs.alerted_months || []).includes(currentMonth);

    if (usagePct < threshold || alreadyFired) return;

    console.log(`[Webhook] Firing limit alert for user ${userId} at ${Math.round(usagePct)}%`);

    let userEmail = '';
    try {
        const { data: adminUser } = await supabase.auth.admin.getUserById(userId);
        userEmail = adminUser?.user?.email || '';
    } catch { /* non-fatal */ }

    await fireAlerts({ userId, userEmail, alertEmail: prefs.alert_email, webhookUrl: prefs.webhook_url,
        sentCount: currentCount, limit: alertLimit, thresholdPct: threshold });

    const newMonths = [...new Set([...(prefs.alerted_months || []), currentMonth])];
    await supabase.from('alert_preferences')
        .update({ alerted_months: newMonths, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
}

async function checkAndDeclareAbWinner(supabase, automation) {
    const AB_MIN_SENDS = 50;

    const { data: sentRows } = await supabase
        .from('dm_sent_log').select('ab_variant')
        .eq('automation_id', automation.id).in('ab_variant', ['A', 'B']).eq('status', 'sent');

    const countA = (sentRows || []).filter((r) => r.ab_variant === 'A').length;
    const countB = (sentRows || []).filter((r) => r.ab_variant === 'B').length;
    if (countA < AB_MIN_SENDS || countB < AB_MIN_SENDS) return;

    const { data: clickRows } = await supabase.from('click_events').select('code').eq('automation_id', automation.id);
    const { data: linkCodes } = await supabase.from('dm_link_codes').select('code, ab_variant')
        .eq('automation_id', automation.id).in('ab_variant', ['A', 'B']);

    const codeToVariant = {};
    for (const lc of (linkCodes || [])) codeToVariant[lc.code] = lc.ab_variant;

    let clicksA = 0, clicksB = 0;
    for (const ce of (clickRows || [])) {
        if (codeToVariant[ce.code] === 'A') clicksA++;
        else if (codeToVariant[ce.code] === 'B') clicksB++;
    }

    const ctrA = countA > 0 ? clicksA / countA : 0;
    const ctrB = countB > 0 ? clicksB / countB : 0;
    const MIN_CTR_DIFF = 0.10;
    let winner = null;
    if (ctrA > ctrB + MIN_CTR_DIFF)      winner = 'A';
    else if (ctrB > ctrA + MIN_CTR_DIFF) winner = 'B';
    if (!winner) return;

    await supabase.from('dm_automations')
        .update({ dm_config: { ...automation.dm_config, abWinner: winner }, updated_at: new Date().toISOString() })
        .eq('id', automation.id);

    console.log(`[Webhook] A/B winner declared: Variant ${winner} (CTR A=${(ctrA*100).toFixed(1)}%, B=${(ctrB*100).toFixed(1)}%)`);
}

// ─── Follow-Up Automation ─────────────────────────────────────────────────────

async function handleFollowUpAutomation(supabase, automation, post, commenterId, commentId, commentText, igSenderId, accessToken, trackingMap = {}, commenterUsername = null, platform = 'instagram') {
    const dmConfig = automation.dm_config;

    const { data: existing } = await supabase
        .from('dm_followup_queue').select('id, status')
        .eq('automation_id', automation.id).eq('recipient_ig_id', commenterId)
        .in('status', ['awaiting_confirmation']).maybeSingle();

    if (existing) {
        console.log('[Webhook] Follow-up already pending for this user — skipping');
        return;
    }

    const personalForGate = commenterUsername || 'there';
    const gateMessage = resolveMessageVariables(
        dmConfig.gateMessage || 'Hey! Follow our account and reply YES to get the link \ud83d\ude0a',
        { username: personalForGate, first_name: personalForGate },
    );

    try {
        await sendFollowGateDM(igSenderId, commenterId, gateMessage, accessToken);

        await supabase.from('dm_followup_queue').insert({
            automation_id:         automation.id,
            account_id:            post.account_id,
            recipient_ig_id:       commenterId,
            ig_sender_id:          igSenderId,
            gate_message:          gateMessage,
            nudge_message:         dmConfig.nudgeMessage || "We couldn't verify your follow yet \ud83d\ude48",
            decline_message:       dmConfig.declineMessage || "No worries! Follow us and tap \u2705 Yes whenever you're ready \ud83d\ude4c",
            confirmation_keywords: ['yes', 'done', 'followed', 'ok'],
            max_retries:           dmConfig.maxRetries || 3,
            link_dm_type:          dmConfig.linkDmType || 'message_template',
            link_dm_config:        dmConfig.linkDmConfig || { message: dmConfig.linkMessage || '' },
        });

        await supabase.from('dm_sent_log').insert({
            automation_id:      automation.id, post_id: post.id,
            recipient_ig_id:    commenterId,   recipient_username: commenterUsername,
            comment_id:         commentId,
            comment_text:       commentText,   status: 'sent',
            platform,
            sent_at:            new Date().toISOString(),
        });

        console.log(`[Webhook] Follow-gate DM sent and queued for ${commenterId}`);
    } catch (err) {
        console.error('[Webhook] Failed to send follow-gate DM:', err.message);
        await supabase.from('dm_sent_log').insert({
            automation_id:      automation.id, post_id: post.id,
            recipient_ig_id:    commenterId,   recipient_username: commenterUsername,
            comment_id:         commentId,
            comment_text:       commentText,   status: 'failed',
            error_message:      err.message,
            platform,
            sent_at:            new Date().toISOString(),
        });
    }
}

// ─── Email Collector Comment Handler ─────────────────────────────────────────

async function handleEmailCollectorAutomation(supabase, automation, post, commenterId, commentId, commentText, igSenderId, accessToken, useIgApi = false, commenterUsername = null, platform = 'instagram') {
    const dmConfig = automation.dm_config;

    const { data: existing } = await supabase
        .from('email_collect_queue').select('id, status')
        .eq('automation_id', automation.id).eq('recipient_ig_id', commenterId)
        .eq('status', 'awaiting_email').maybeSingle();

    if (existing) {
        console.log('[Webhook/Email] Email collection already pending — skipping');
        return;
    }

    const personalForAsk = commenterUsername || 'there';
    // Resolve placeholders + apply branding so free users get the AutoDM
    // footer and Pro users get their custom branding (or none if cleared) \u2014
    // matching what every other DM type does.
    const userPlanForAsk = await getUserPlan(supabase, automation.user_id);
    const askMessage = applyBranding(
        resolveMessageVariables(
            dmConfig.emailAskMessage || 'Hey! Could you share your email address? \ud83d\udce7',
            { username: personalForAsk, first_name: personalForAsk },
        ),
        dmConfig,
        userPlanForAsk,
    );

    try {
        await sendTextDM(igSenderId, commenterId, askMessage, accessToken, useIgApi);

        await supabase.from('email_collect_queue').insert({
            automation_id:        automation.id,
            account_id:           post.account_id,
            recipient_ig_id:      commenterId,
            ig_sender_id:         igSenderId,
            confirmation_message: dmConfig.emailConfirmMessage || '',
            status:               'awaiting_email',
        });

        await supabase.from('dm_sent_log').insert({
            automation_id:      automation.id, post_id: post.id,
            recipient_ig_id:    commenterId,   recipient_username: commenterUsername,
            comment_id:         commentId,
            comment_text:       commentText,   status: 'sent',
            platform,
            sent_at:            new Date().toISOString(),
        });

        console.log(`[Webhook/Email] Email ask DM sent for ${commenterId}`);
    } catch (err) {
        console.error('[Webhook/Email] Failed to send email ask DM:', err.message);
        await supabase.from('dm_sent_log').insert({
            automation_id:      automation.id, post_id: post.id,
            recipient_ig_id:    commenterId,   recipient_username: commenterUsername,
            comment_id:         commentId,
            comment_text:       commentText,   status: 'failed',
            error_message:      err.message,
            platform,
            sent_at:            new Date().toISOString(),
        });
    }
}

// ─── Email Collector Reply Handler ───────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

async function handleEmailCollectorReply(supabase, senderId, msgText) {
    const { data: queueEntry } = await supabase
        .from('email_collect_queue')
        .select('*, connected_accounts(access_token, ig_user_id)')
        .eq('recipient_ig_id', senderId).eq('status', 'awaiting_email')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (!queueEntry) {
        console.log('[Webhook] No pending email collection — ignoring DM reply');
        return;
    }

    const emailMatch = msgText.match(EMAIL_REGEX);
    if (!emailMatch) {
        console.log('[Webhook] DM reply has no valid email address');
        try {
            const account      = queueEntry.connected_accounts;
            const replyUseIgApi = !account.fb_page_access_token;
            await sendTextDM(account.ig_user_id, senderId,
                'Please reply with a valid email address (e.g. you@example.com) \ud83d\udce7', account.access_token, replyUseIgApi);
        } catch { /* non-critical */ }
        return;
    }

    const email       = emailMatch[0].toLowerCase();
    const account     = queueEntry.connected_accounts;
    const token       = account.fb_page_access_token || account.access_token;
    const igSender    = account.ig_user_id;
    const replyUseIgApi = !account.fb_page_access_token;

    console.log(`[Webhook] Captured email ${email} from ${senderId}`);

    try {
        const { data: automation } = await supabase
            .from('dm_automations').select('user_id')
            .eq('id', queueEntry.automation_id).maybeSingle();

        // Resolve owner — prefer dm_automations, fall back to connected_accounts.
        // Without a user_id the row violates the email_leads RLS read policy
        // (user_id = auth.uid()) and becomes invisible/orphaned.
        let ownerUserId = automation?.user_id || null;
        if (!ownerUserId && queueEntry.account_id) {
            const { data: acc } = await supabase
                .from('connected_accounts').select('user_id')
                .eq('id', queueEntry.account_id).maybeSingle();
            ownerUserId = acc?.user_id || null;
        }
        if (!ownerUserId) {
            console.error(`[Webhook] Cannot resolve user_id for email lead from ${senderId} — skipping insert`);
            return;
        }

        await supabase.from('email_leads').upsert({
            automation_id:   queueEntry.automation_id,
            account_id:      queueEntry.account_id,
            user_id:         ownerUserId,
            recipient_ig_id: senderId,
            email,
            confirmed_at:    new Date().toISOString(),
        }, { onConflict: 'automation_id,recipient_ig_id' });

        await supabase.from('email_collect_queue')
            .update({ status: 'email_captured', updated_at: new Date().toISOString() })
            .eq('id', queueEntry.id);

        // Look up the captured username + Pro plan + dm_config for the confirm DM
        // so it gets the same {first_name}/{username}/{email} substitution and
        // branding behaviour as the rest of the DM types.
        const { data: ownerAuto } = await supabase
            .from('dm_automations').select('dm_config')
            .eq('id', queueEntry.automation_id).maybeSingle();
        const dmConfig = ownerAuto?.dm_config || {};
        const ownerPlan = await getUserPlan(supabase, ownerUserId);

        // recipient_username may have been captured on the original ask DM \u2014
        // fall back to 'there' if missing (e.g. story-mention edge cases).
        const { data: askLog } = await supabase
            .from('dm_sent_log').select('recipient_username')
            .eq('automation_id', queueEntry.automation_id)
            .eq('recipient_ig_id', senderId)
            .order('sent_at', { ascending: false }).limit(1).maybeSingle();
        const personalForConfirm = askLog?.recipient_username || 'there';

        const rawConfirm = queueEntry.confirmation_message ||
            `Thanks! \ud83c\udf89 We've saved your email ({email}) and will be in touch soon.`;
        const confirmMsg = applyBranding(
            resolveMessageVariables(rawConfirm, {
                username:   personalForConfirm,
                first_name: personalForConfirm,
                email,
            }),
            dmConfig,
            ownerPlan,
        );
        await sendTextDM(igSender, senderId, confirmMsg, token, replyUseIgApi);

        console.log(`[Webhook] Email lead captured for ${senderId}`);
    } catch (err) {
        console.error('[Webhook] Failed to save email lead:', err.message);
    }
}

// ─── Story Reply Handler ──────────────────────────────────────────────────────
// Triggered when a viewer replies to one of the user's stories. Stories don't
// generate `comments` webhooks, so this is the only signal we get. Looks up
// the corresponding post row by ig_post_id == reply_to.story.id and dispatches
// to the same automation pipeline a normal comment would use, with a synthetic
// commentId for idempotency.
//
// Returns true when an automation was attempted (handled or filtered),
// false when no story-row / no active automation existed for this story —
// the caller falls back to the legacy follow-gate / email-collector flow.
async function handleStoryReplyEvent(supabase, igAccountId, { senderId, storyMediaId, text, mid }) {
    if (!senderId || !storyMediaId || !text?.trim()) {
        console.log('[Webhook/StoryReply] Missing required fields — skipping');
        return false;
    }

    const { data: post } = await supabase
        .from('instagram_posts')
        .select('id, account_id, is_story')
        .eq('ig_post_id', storyMediaId)
        .maybeSingle();

    if (!post) {
        console.log(`[Webhook/StoryReply] No post row for story ${storyMediaId} — falling through`);
        return false;
    }
    if (!post.is_story) {
        console.log(`[Webhook/StoryReply] Post ${post.id} is not flagged is_story — falling through`);
        return false;
    }

    const { data: automation } = await supabase
        .from('dm_automations')
        .select('id')
        .eq('post_id', post.id)
        .eq('is_active', true)
        .maybeSingle();

    if (!automation) {
        console.log(`[Webhook/StoryReply] No active automation for story-post ${post.id} — falling through`);
        return false;
    }

    // Synthetic comment_id keeps idempotency working — Meta's `mid` is the
    // most-stable per-event identifier; fall back to story+sender so a
    // resend without mid still dedups.
    const syntheticCommentId = `story_reply:${mid || `${storyMediaId}:${senderId}`}`;

    console.log(`[Webhook/StoryReply] Dispatching automation for story ${storyMediaId}, sender ${senderId}, dedup=${syntheticCommentId}`);

    try {
        const perPostFired = await processAutomationForComment(
            supabase, post, text, senderId, syntheticCommentId, 'instagram', null,
        );
        if (post.account_id) {
            await processGlobalTriggers(
                supabase, post, text, senderId, syntheticCommentId, 'instagram', perPostFired, null,
            );
        }
    } catch (err) {
        console.error('[Webhook/StoryReply] Dispatch failed:', err);
    }
    return true;
}

// ─── Story Mention Handler ─────────────────────────────────────────────────────
// Story-mention DMs are sent synchronously here and do NOT pass through
// dm_queue. The per-account hourly rate limit (cron/process-queue) therefore
// does not apply. Story mentions are low-volume and bounded by Meta's own
// per-account messaging caps, so this is intentional rather than a bug.

async function handleStoryMentionEvent(supabase, igAccountId, mentionData) {
    const { media_id } = mentionData;
    if (!media_id) return;

    console.log(`[Webhook/Mention] Account ${igAccountId} mentioned in story ${media_id}`);

    const { data: account } = await supabase
        .from('connected_accounts')
        .select('id, user_id, access_token, fb_page_access_token, ig_user_id, default_config')
        .eq('ig_user_id', igAccountId).eq('is_active', true).maybeSingle();

    if (!account) return;

    const mentionConfig = account.default_config?.mentionDm;
    if (!mentionConfig?.enabled || !mentionConfig?.message?.trim()) return;

    // Runtime Pro gate — Story Mention Auto-DM is a Pro feature. If the user
    // downgrades, any saved mentionDm config stops firing (they can still see
    // and disable it via Settings → Configuration).
    const mentionUserPlan = await getUserPlan(supabase, account.user_id);
    if (mentionUserPlan !== 'pro' && mentionUserPlan !== 'business' && mentionUserPlan !== 'trial') {
        console.log(`[Webhook/Mention] Skipping — user is on ${mentionUserPlan} plan`);
        return;
    }

    const mentionToken  = account.fb_page_access_token || account.access_token;
    const useIgApi      = !account.fb_page_access_token;
    const mentionBase   = graphBase(useIgApi);

    try {
        const mediaRes = await fetch(
            `${mentionBase}/${media_id}?fields=from&access_token=${encodeURIComponent(mentionToken)}`
        );
        if (!mediaRes.ok) return;

        const mediaData       = await mediaRes.json();
        const mentionerId     = mediaData?.from?.id;
        const mentionerHandle = mediaData?.from?.username || null;
        if (!mentionerId) return;

        // Dedup via recipient + media_id
        const { data: alreadySent } = await supabase
            .from('dm_sent_log').select('id')
            .is('automation_id', null)
            .eq('recipient_ig_id', mentionerId)
            .eq('comment_id', media_id)
            .eq('comment_text', '[story mention]')
            .maybeSingle();
        if (alreadySent) return;

        // Plan from user_plans — no connected_accounts.plan needed
        const userPlan = await getUserPlan(supabase, account.user_id);
        const dmLimit  = getDmLimit(userPlan);
        if (dmLimit !== null) {
            const mc = await getMonthlyDmCount(supabase, account.user_id);
            if (mc >= dmLimit) return;
        }

        // Personalisation: never substitute the numeric IGSID into a
        // user-facing message ("Hey 897716016649795!"). Use the captured
        // handle from media.from.username when Meta returns it; otherwise
        // fall back to the friendly default that the rest of the pipeline
        // (process-queue, sendback, flow-steps) already uses.
        const personal = mentionerHandle || 'there';
        const message  = applyBranding(
            resolveMessageVariables(mentionConfig.message, {
                username:   personal,
                first_name: personal,
            }),
            mentionConfig,
            mentionUserPlan,
        );
        await sendTextDM(account.ig_user_id, mentionerId, message, mentionToken, useIgApi);

        await supabase.from('dm_sent_log').insert({
            automation_id:      null,
            post_id:            null,
            recipient_ig_id:    mentionerId,
            recipient_username: mentionerHandle,
            comment_id:         media_id,
            comment_text:       '[story mention]',
            status:             'sent',
            platform:           'instagram',  // Story mentions are Instagram-only
            sent_at:             new Date().toISOString(),
        });

        console.log(`[Webhook/Mention] \u2705 DM sent to ${mentionerId}`);
    } catch (err) {
        console.error('[Webhook/Mention] Failed:', err.message);
    }
}

// ─── Global Triggers ─────────────────────────────────────────────────────────

async function processGlobalTriggers(supabase, post, commentText, commenterId, commentId, platform, perPostFired = false, commenterUsername = null) {
    const { data: globalAutomations } = await supabase
        .from('global_automations').select('*')
        .eq('account_id', post.account_id).eq('is_active', true);

    if (!globalAutomations || globalAutomations.length === 0) return;

    const { data: account } = await supabase
        .from('connected_accounts')
        .select('access_token, fb_page_access_token, ig_user_id, fb_page_id')
        .eq('id', post.account_id).single();
    if (!account) return;

    const lowerComment = commentText.toLowerCase().trim();
    // All global automations for the same account belong to the same user
    const userPlan     = await getUserPlan(supabase, globalAutomations[0]?.user_id || '');

    // Runtime Pro gate: globals are a Pro feature. Existing rows from a
    // previously-Pro account must not keep firing after the user downgrades.
    // The user can still pause / delete them via the UI; they just don't send.
    if (userPlan !== 'pro' && userPlan !== 'business' && userPlan !== 'trial') {
        console.log(`[Global] Skipping ${globalAutomations.length} global(s) — user is on ${userPlan} plan`);
        return;
    }

    for (const ga of globalAutomations) {
        if (ga.skip_if_post_has_automation && perPostFired) {
            console.log(`[Global] Skipping "${ga.name}" — per-post automation already fired`);
            continue;
        }

        const tc = ga.trigger_config || {};
        const triggerType = tc.type || 'keywords';
        let matches = false;

        if (triggerType === 'all_comments') {
            matches = true;
        } else if (triggerType === 'emojis_only') {
            const EMOJI_RE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
            const plain    = lowerComment.replace(EMOJI_RE, '').trim();
            matches = EMOJI_RE.test(commentText) && plain.replace(/[^a-z0-9]/g, '') === '';
        } else if (triggerType === 'mentions_only') {
            matches = /@\w+/.test(commentText);
        } else {
            // 'keywords' (default). Empty keyword list means the user hasn't
            // configured a match — don't fire. Parity with the per-automation
            // path in processAutomationForComment.
            const kws = (tc.keywords || []).map((k) => k.toLowerCase());
            matches = kws.length > 0 && kws.some((kw) => lowerComment.includes(kw));
        }

        if (!matches) continue;

        if (ga.send_once_per_user) {
            const { data: prev } = await supabase.from('dm_sent_log').select('id')
                .eq('automation_id', ga.id).eq('recipient_ig_id', commenterId).eq('status', 'sent').limit(1);
            if (prev && prev.length > 0) continue;
        }

        const { data: existingLog } = await supabase.from('dm_sent_log').select('id')
            .eq('automation_id', ga.id).eq('comment_id', commentId).maybeSingle();
        if (existingLog) continue;

        const dmLimit = getDmLimit(userPlan);
        if (dmLimit !== null) {
            const monthly = await getMonthlyDmCount(supabase, ga.user_id);
            if (monthly >= dmLimit) break;
        }

        try {
            await supabase.from('dm_queue').insert({
                user_id:            ga.user_id,
                account_id:         post.account_id,
                automation_id:      ga.id,
                post_id:            post.id,
                recipient_ig_id:    commenterId,
                recipient_username: commenterUsername,
                comment_id:         commentId,
                comment_text:       commentText,
                platform,
                dm_type:            ga.dm_type,
                dm_config:          ga.dm_config,
                tracking_map:       {},
                user_plan:          userPlan,
                queue_reason:       'overflow',
                priority:           5,
                status:             'pending',
                scheduled_after: new Date().toISOString(),
            });
            console.log(`[Global] \u2705 "${ga.name}" enqueued for ${commenterId}`);
        } catch (err) {
            console.error(`[Global] "${ga.name}" enqueue failed:`, err.message);
        }
    }
}

// ─── Ice Breaker Handler ──────────────────────────────────────────────────────

async function handleIceBreakerResponse(supabase, igAccountId, senderId, payload) {
    if (!payload?.startsWith('ICE_BREAKER_')) return false;

    const { data: account } = await supabase
        .from('connected_accounts')
        .select('id, user_id, access_token, ig_user_id, default_config')
        .eq('ig_user_id', igAccountId).eq('is_active', true).maybeSingle();
    if (!account) return false;

    // Runtime Pro gate — Welcome Openers is a Pro feature. If the user
    // downgrades, their saved openers stop responding (they can still see
    // and delete them via /welcome-openers).
    const userPlan = await getUserPlan(supabase, account.user_id);
    if (userPlan !== 'pro' && userPlan !== 'business' && userPlan !== 'trial') {
        console.log(`[IceBreaker] Skipping — user is on ${userPlan} plan`);
        return false;
    }

    const iceBreakers = account.default_config?.iceBreakers || [];
    const matched = iceBreakers.find((ib) => ib.payload === payload);

    if (!matched?.responseMessage?.trim()) {
        console.log(`[IceBreaker] No matching ice breaker for payload: ${payload}`);
        return false;
    }

    try {
        await sendTextDM(account.ig_user_id, senderId, matched.responseMessage, account.access_token, true);
        console.log(`[IceBreaker] \u2705 Response sent for "${matched.title}" to ${senderId}`);
        return true;
    } catch (err) {
        console.error('[IceBreaker] Failed to send response:', err.message);
        return false;
    }
}
