import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
    sendAutomatedDM, sendFollowGateDM, checkUserIsFollower,
    resolveMessageVariables, replyToComment,
    sendTextDM, sendButtonTemplateDM, sendQuickReplyDM, sendMultiCtaDM,
} from '@/lib/send-dm';
import { applyTracking } from '@/lib/click-tracking';
import { fireAlerts } from '@/app/api/alerts/route';

import { getDmLimit, getEffectivePlan } from '@/lib/plans';

const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'autodm_webhook_verify';

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

    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
        console.log('[Webhook] Verification successful');
        return new NextResponse(challenge, { status: 200 });
    }

    console.warn('[Webhook] Verification failed — invalid token');
    return NextResponse.json({ error: 'Invalid verification token' }, { status: 403 });
}

// ─── Receive ─────────────────────────────────────────────────────────────────

export async function POST(request) {
    const body = await request.json();

    // Respond 200 immediately — Meta requires fast ACK
    processWebhookEvents(body).catch((err) =>
        console.error('[Webhook] Processing error:', err),
    );

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

    // ── Ice breaker tap ─────────────────────────────────────
    if (msgPayload?.startsWith('ICE_BREAKER_')) {
        await handleIceBreakerResponse(supabase, igAccountId, senderId, msgPayload);
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
            await sendFollowGateDM(igSender2, senderId, declineMsg, token2);
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

        try {
            await sendRewardDM(igSenderId, senderId, queueEntry.link_dm_type,
                queueEntry.link_dm_config, accessToken, {}, rewardPlan);

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
                    accessToken);
            } catch (err) {
                console.warn('[Webhook] Failed to send max-retry message:', err.message);
            }
        } else {
            await supabase.from('dm_followup_queue')
                .update({ retry_count: newRetryCount, updated_at: new Date().toISOString() })
                .eq('id', queueEntry.id);
            try {
                const nudge = resolveMessageVariables(
                    queueEntry.nudge_message ||
                    "We couldn't verify your follow yet \ud83d\ude48 Make sure you're following, then tap \u2705 Yes!",
                    { username: senderId },
                );
                await sendFollowGateDM(igSenderId, senderId, nudge, accessToken);
            } catch (err) {
                console.warn('[Webhook] Failed to send nudge DM:', err.message);
            }
        }
    }
}

async function sendRewardDM(igSenderId, recipientId, dmType, dmConfig, accessToken, trackingMap = {}, plan = 'free') {
    switch (dmType) {
        case 'button_template':
            return sendButtonTemplateDM(igSenderId, recipientId, dmConfig.slides || [], accessToken, trackingMap, plan);
        case 'quick_reply':
            return sendQuickReplyDM(igSenderId, recipientId, dmConfig.message || '', dmConfig.quickReplies || [], accessToken);
        case 'multi_cta':
            return sendMultiCtaDM(igSenderId, recipientId, dmConfig.message || '', dmConfig.buttons || [], accessToken, trackingMap, plan);
        case 'message_template':
        default:
            return sendTextDM(igSenderId, recipientId, dmConfig.message || '', accessToken);
    }
}

// ─── Comment Handlers ─────────────────────────────────────────────────────────

async function handleInstagramCommentEvent(supabase, igAccountId, commentData) {
    const { id: commentId, text, from, media } = commentData;

    if (!text || !from?.id || !media?.id) {
        console.log('[Webhook] Skipping IG comment — missing data');
        return;
    }

    console.log(`[Webhook] IG Comment on media ${media.id}: "${text}" from user ${from.id}`);

    const { data: post } = await supabase
        .from('instagram_posts')
        .select('id, account_id')
        .eq('ig_post_id', media.id)
        .single();

    const perPostFired = await processAutomationForComment(supabase, post, text, from.id, commentId, 'instagram');
    if (post?.account_id) {
        await processGlobalTriggers(supabase, post, text, from.id, commentId, 'instagram', perPostFired);
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

    const perPostFiredFb = await processAutomationForComment(supabase, post, message, from.id, comment_id, 'facebook');
    if (post?.account_id) {
        await processGlobalTriggers(supabase, post, message, from.id, comment_id, 'facebook', perPostFiredFb);
    }
}

// ─── Core Automation Logic ───────────────────────────────────────────────────

async function processAutomationForComment(supabase, post, commentText, commenterId, commentId, platform) {
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
        .select('access_token, fb_page_access_token, ig_user_id, fb_page_id, default_config')
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
            let keywords = (triggerConfig.keywords || []).map((k) => k.toLowerCase());
            if (!settingsConfig.disableUniversalTriggers) {
                const globalKws = (account.default_config?.keywords || []).map((k) => k.toLowerCase());
                keywords = [...new Set([...keywords, ...globalKws])];
            }
            if (keywords.length === 0) {
                shouldSend = true;
            } else if (triggerConfig.excludeKeywords) {
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

    // ── Billing gate — plan from user_plans ──────────────────────
    const userPlan = await getUserPlan(supabase, automation.user_id);
    const dmLimit  = getDmLimit(userPlan);

    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const { data: userAutomations } = await supabase
        .from('dm_automations').select('id').eq('user_id', automation.user_id);
    const allIds = (userAutomations || []).map((a) => a.id);

    const { count: totalMonthly } = await supabase
        .from('dm_sent_log').select('id', { count: 'exact', head: true })
        .in('automation_id', allIds).eq('status', 'sent')
        .gte('sent_at', startOfMonth.toISOString());

    if (dmLimit !== null && (totalMonthly || 0) >= dmLimit) {
        console.log(`[Webhook] Monthly limit (${dmLimit}) reached for ${userPlan} plan — skipping`);
        return;
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

    if (settingsConfig.delayMessage) {
        const delay = Math.floor(Math.random() * 90_000) + 30_000;
        await new Promise((r) => setTimeout(r, delay));
    }

    const context = { username: commenterId, first_name: commenterId, comment_id: commentId };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    let trackingMap = {};
    try {
        const { data: linkCodes } = await supabase
            .from('dm_link_codes').select('code, original_url')
            .eq('automation_id', automation.id);
        for (const row of (linkCodes || [])) {
            trackingMap[row.original_url] = `${appUrl}/r/${row.code}`;
        }
    } catch { /* non-fatal */ }

    // ── A/B variant selection ────────────────────────────────────
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

        try {
            const { data: variantLinkCodes } = await supabase
                .from('dm_link_codes').select('code, original_url')
                .eq('automation_id', automation.id).eq('ab_variant', abVariant);
            trackingMap = {};
            for (const row of (variantLinkCodes || [])) {
                trackingMap[row.original_url] = `${appUrl}/r/${row.code}`;
            }
        } catch { /* non-fatal */ }

        activeAutomation = { ...automation, dm_type: variantConfig.type, dm_config: variantConfig };
        console.log(`[Webhook] A/B variant selected: ${abVariant}`);
    }

    try {
        if (activeAutomation.dm_type === 'follow_up') {
            await handleFollowUpAutomation(supabase, activeAutomation, post, commenterId, commentId, commentText, senderId, token, trackingMap);
            return true;
        }

        if (activeAutomation.dm_type === 'email_collector') {
            await handleEmailCollectorAutomation(supabase, activeAutomation, post, commenterId, commentId, commentText, senderId, token);
            return true;
        }

        // ── All other types — reply immediately, enqueue the DM ──────────
        const DEFAULT_COMMENT_REPLY = 'Hey! Check your DM \u2764\ufe0f Didn\'t receive the link? Follow and comment again.';
        const replyMsg = settingsConfig.replyMessage || settingsConfig.autoReplyText || DEFAULT_COMMENT_REPLY;
        try {
            await replyToComment(commentId, resolveMessageVariables(replyMsg, context), token);
            console.log('[Webhook] Comment reply sent');
        } catch (replyErr) {
            console.warn('[Webhook] Comment reply failed (non-fatal):', replyErr.message);
        }

        await supabase.from('dm_queue').insert({
            user_id:         automation.user_id,
            account_id:      post.account_id,
            automation_id:   automation.id,
            post_id:         post.id,
            recipient_ig_id: commenterId,
            comment_id:      commentId,
            comment_text:    commentText,
            platform,
            dm_type:         activeAutomation.dm_type,
            dm_config:       activeAutomation.dm_config,
            tracking_map:    trackingMap,
            user_plan:       userPlan,
            queue_reason:    'overflow',
            priority:        5,
            status:          'pending',
            scheduled_after: new Date().toISOString(),
        });

        console.log(`[Webhook] DM enqueued for ${commenterId}${abVariant ? ` (variant ${abVariant})` : ''}`);

        checkAndFireLimitAlert(supabase, automation.user_id, (totalMonthly || 0) + 1)
            .catch((e) => console.warn('[Webhook] Limit alert check failed (non-fatal):', e.message));

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
            sent_at:         new Date().toISOString(),
        });
    }
}

async function checkAndFireLimitAlert(supabase, userId, currentCount) {
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

async function handleFollowUpAutomation(supabase, automation, post, commenterId, commentId, commentText, igSenderId, accessToken, trackingMap = {}) {
    const dmConfig = automation.dm_config;

    const { data: existing } = await supabase
        .from('dm_followup_queue').select('id, status')
        .eq('automation_id', automation.id).eq('recipient_ig_id', commenterId)
        .in('status', ['awaiting_confirmation']).maybeSingle();

    if (existing) {
        console.log('[Webhook] Follow-up already pending for this user — skipping');
        return;
    }

    const gateMessage = resolveMessageVariables(
        dmConfig.gateMessage || 'Hey! Follow our account and reply YES to get the link \ud83d\ude0a',
        { username: commenterId, first_name: commenterId },
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
            automation_id:   automation.id, post_id: post.id,
            recipient_ig_id: commenterId,   comment_id: commentId,
            comment_text:    commentText,   status: 'sent',
            sent_at:         new Date().toISOString(),
        });

        console.log(`[Webhook] Follow-gate DM sent and queued for ${commenterId}`);
    } catch (err) {
        console.error('[Webhook] Failed to send follow-gate DM:', err.message);
        await supabase.from('dm_sent_log').insert({
            automation_id:   automation.id, post_id: post.id,
            recipient_ig_id: commenterId,   comment_id: commentId,
            comment_text:    commentText,   status: 'failed',
            error_message:   err.message,   sent_at: new Date().toISOString(),
        });
    }
}

// ─── Email Collector Comment Handler ─────────────────────────────────────────

async function handleEmailCollectorAutomation(supabase, automation, post, commenterId, commentId, commentText, igSenderId, accessToken) {
    const dmConfig = automation.dm_config;

    const { data: existing } = await supabase
        .from('email_collect_queue').select('id, status')
        .eq('automation_id', automation.id).eq('recipient_ig_id', commenterId)
        .eq('status', 'awaiting_email').maybeSingle();

    if (existing) {
        console.log('[Webhook/Email] Email collection already pending — skipping');
        return;
    }

    const askMessage = resolveMessageVariables(
        dmConfig.emailAskMessage || 'Hey! Could you share your email address? \ud83d\udce7',
        { username: commenterId, first_name: commenterId },
    );

    try {
        await sendTextDM(igSenderId, commenterId, askMessage, accessToken);

        await supabase.from('email_collect_queue').insert({
            automation_id:        automation.id,
            account_id:           post.account_id,
            recipient_ig_id:      commenterId,
            ig_sender_id:         igSenderId,
            confirmation_message: dmConfig.emailConfirmMessage || '',
            status:               'awaiting_email',
        });

        await supabase.from('dm_sent_log').insert({
            automation_id:   automation.id, post_id: post.id,
            recipient_ig_id: commenterId,   comment_id: commentId,
            comment_text:    commentText,   status: 'sent',
            sent_at:         new Date().toISOString(),
        });

        console.log(`[Webhook/Email] Email ask DM sent for ${commenterId}`);
    } catch (err) {
        console.error('[Webhook/Email] Failed to send email ask DM:', err.message);
        await supabase.from('dm_sent_log').insert({
            automation_id:   automation.id, post_id: post.id,
            recipient_ig_id: commenterId,   comment_id: commentId,
            comment_text:    commentText,   status: 'failed',
            error_message:   err.message,   sent_at: new Date().toISOString(),
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
            const account = queueEntry.connected_accounts;
            await sendTextDM(account.ig_user_id, senderId,
                'Please reply with a valid email address (e.g. you@example.com) \ud83d\udce7', account.access_token);
        } catch { /* non-critical */ }
        return;
    }

    const email    = emailMatch[0].toLowerCase();
    const account  = queueEntry.connected_accounts;
    const token    = account.access_token;
    const igSender = account.ig_user_id;

    console.log(`[Webhook] Captured email ${email} from ${senderId}`);

    try {
        const { data: automation } = await supabase
            .from('dm_automations').select('user_id')
            .eq('id', queueEntry.automation_id).maybeSingle();

        await supabase.from('email_leads').upsert({
            automation_id:   queueEntry.automation_id,
            account_id:      queueEntry.account_id,
            user_id:         automation?.user_id,
            recipient_ig_id: senderId,
            email,
            confirmed_at:    new Date().toISOString(),
        }, { onConflict: 'automation_id,recipient_ig_id' });

        await supabase.from('email_collect_queue')
            .update({ status: 'email_captured', updated_at: new Date().toISOString() })
            .eq('id', queueEntry.id);

        const confirmMsg = queueEntry.confirmation_message ||
            `Thanks! \ud83c\udf89 We've saved your email (${email}) and will be in touch soon.`;
        await sendTextDM(igSender, senderId, confirmMsg, token);

        console.log(`[Webhook] Email lead captured for ${senderId}`);
    } catch (err) {
        console.error('[Webhook] Failed to save email lead:', err.message);
    }
}

// ─── Story Mention Handler ─────────────────────────────────────────────────────

async function handleStoryMentionEvent(supabase, igAccountId, mentionData) {
    const { media_id } = mentionData;
    if (!media_id) return;

    console.log(`[Webhook/Mention] Account ${igAccountId} mentioned in story ${media_id}`);

    const { data: account } = await supabase
        .from('connected_accounts')
        .select('id, user_id, access_token, ig_user_id, default_config')
        .eq('ig_user_id', igAccountId).eq('is_active', true).maybeSingle();

    if (!account) return;

    const mentionConfig = account.default_config?.mentionDm;
    if (!mentionConfig?.enabled || !mentionConfig?.message?.trim()) return;

    try {
        const mediaRes = await fetch(
            `https://graph.facebook.com/v21.0/${media_id}?fields=from&access_token=${encodeURIComponent(account.access_token)}`
        );
        if (!mediaRes.ok) return;

        const mediaData   = await mediaRes.json();
        const mentionerId = mediaData?.from?.id;
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
            const startOfMonth = new Date();
            startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
            const { data: userAutos } = await supabase.from('dm_automations').select('id').eq('user_id', account.user_id);
            const allIds = (userAutos || []).map((a) => a.id);
            const { count: mc } = await supabase.from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .in('automation_id', allIds).eq('status', 'sent').gte('sent_at', startOfMonth.toISOString());
            if ((mc || 0) >= dmLimit) return;
        }

        const message = mentionConfig.message
            .replace('{username}', mentionerId).replace('{first_name}', mentionerId);
        await sendTextDM(account.ig_user_id, mentionerId, message, account.access_token);

        await supabase.from('dm_sent_log').insert({
            automation_id:   null,
            post_id:         null,
            recipient_ig_id: mentionerId,
            comment_id:      media_id,
            comment_text:    '[story mention]',
            status:          'sent',
            sent_at:         new Date().toISOString(),
        });

        console.log(`[Webhook/Mention] \u2705 DM sent to ${mentionerId}`);
    } catch (err) {
        console.error('[Webhook/Mention] Failed:', err.message);
    }
}

// ─── Global Triggers ─────────────────────────────────────────────────────────

async function processGlobalTriggers(supabase, post, commentText, commenterId, commentId, platform, perPostFired = false) {
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
        } else {
            const kws = (tc.keywords || []).map((k) => k.toLowerCase());
            matches = kws.length === 0 || kws.some((kw) => lowerComment.includes(kw));
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
            const startOfMonth = new Date();
            startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
            const { data: userAutos } = await supabase.from('dm_automations').select('id').eq('user_id', ga.user_id);
            const allIds = (userAutos || []).map((a) => a.id);
            const { count: monthly } = await supabase.from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .in('automation_id', allIds).eq('status', 'sent').gte('sent_at', startOfMonth.toISOString());
            if ((monthly || 0) >= dmLimit) break;
        }

        try {
            await supabase.from('dm_queue').insert({
                user_id:         ga.user_id,
                account_id:      post.account_id,
                automation_id:   ga.id,
                post_id:         post.id,
                recipient_ig_id: commenterId,
                comment_id:      commentId,
                comment_text:    commentText,
                platform,
                dm_type:         ga.dm_type,
                dm_config:       ga.dm_config,
                tracking_map:    {},
                user_plan:       userPlan,
                queue_reason:    'overflow',
                priority:        5,
                status:          'pending',
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
        .select('id, access_token, ig_user_id, default_config')
        .eq('ig_user_id', igAccountId).eq('is_active', true).maybeSingle();
    if (!account) return false;

    const iceBreakers = account.default_config?.iceBreakers || [];
    const matched = iceBreakers.find((ib) => ib.payload === payload);

    if (!matched?.responseMessage?.trim()) {
        console.log(`[IceBreaker] No matching ice breaker for payload: ${payload}`);
        return false;
    }

    try {
        await sendTextDM(account.ig_user_id, senderId, matched.responseMessage, account.access_token);
        console.log(`[IceBreaker] \u2705 Response sent for "${matched.title}" to ${senderId}`);
        return true;
    } catch (err) {
        console.error('[IceBreaker] Failed to send response:', err.message);
        return false;
    }
}
