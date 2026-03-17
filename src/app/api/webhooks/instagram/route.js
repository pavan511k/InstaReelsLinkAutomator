export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
    sendAutomatedDM, sendFollowGateDM, checkUserIsFollower,
    resolveMessageVariables, replyToComment,
    sendTextDM, sendButtonTemplateDM, sendQuickReplyDM, sendMultiCtaDM,
} from '@/lib/send-dm';
import { applyTracking } from '@/lib/click-tracking';
import { fireAlerts } from '@/app/api/alerts/route';

const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'autodm_webhook_verify';
const MONTHLY_DM_LIMIT = 1000;

function createServiceClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
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

        // ── Comment events (changes) ───────────────────────────────────
        for (const change of entryItem.changes || []) {
            if (object === 'instagram' && change.field === 'comments') {
                await handleInstagramCommentEvent(supabase, accountId, change.value);
            } else if (object === 'page' && change.field === 'feed') {
                if (change.value.item === 'comment' && change.value.verb === 'add') {
                    await handleFacebookCommentEvent(supabase, accountId, change.value);
                }
            }
        }
    }
}

// ─── DM Reply Handler (follow-up flow) ───────────────────────────────────────

/**
 * Called when a user sends us a DM (reply to our gate message).
 * Checks whether there's a pending follow-up for them, then:
 *   - Verifies follow status via Graph API
 *   - Sends reward DM if following, or nudge if not
 */
async function handleIncomingDMReply(supabase, igAccountId, messagingEvent) {
    const senderId   = messagingEvent.sender?.id;
    const msgText    = messagingEvent.message?.text?.toLowerCase().trim() || '';
    const msgPayload = messagingEvent.message?.quick_reply?.payload || '';

    if (!senderId || !msgText) return;

    console.log(`[Webhook] Incoming DM from ${senderId}: "${msgText}"`);

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
        console.log('[Webhook] No pending follow-up for this user — ignoring DM reply');
        return;
    }

    // Handle the explicit NO / not-yet button
    const isExplicitNo =
        msgPayload === 'NOT_FOLLOWING' ||
        msgText === 'no' || msgText === 'not yet' || msgText === '\u274c no, not yet';

    if (isExplicitNo) {
        console.log(`[Webhook] User ${senderId} tapped NO — sending follow-prompt and keeping queue open`);
        const account2    = queueEntry.connected_accounts;
        const token2      = account2.fb_page_access_token || account2.access_token;
        const igSender2   = queueEntry.ig_sender_id;
        try {
            // Re-send the gate message with Yes/No buttons so they can tap Yes when ready
            const declineMsg = queueEntry.decline_message ||
                "No worries! Follow us first, then tap \u2705 Yes when you're ready and we'll send you the link right away! 🙌";
            await sendFollowGateDM(igSender2, senderId, declineMsg, token2);
        } catch (err) {
            console.warn('[Webhook] Failed to send no-response message:', err.message);
        }
        return; // Keep queue entry open — they can tap Yes later
    }

    // Check if the message is a YES confirmation (button payload or keyword fallback)
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

    // ── Check follow status ──────────────────────────────────────
    console.log(`[Webhook] Checking if ${senderId} follows ${igSenderId}...`);
    let isFollowing = false;

    try {
        isFollowing = await checkUserIsFollower(igSenderId, senderId, accessToken);
    } catch (err) {
        console.error('[Webhook] Follow check error (non-fatal):', err.message);
        // Fail-open: if API fails, don't penalise the user
    }

    if (isFollowing) {
        // ── Send the reward DM ────────────────────────────────────
        console.log(`[Webhook] ${senderId} IS following — sending reward DM`);

        try {
            await sendRewardDM(
                igSenderId,
                senderId,
                queueEntry.link_dm_type,
                queueEntry.link_dm_config,
                accessToken,
            );

            await supabase
                .from('dm_followup_queue')
                .update({ status: 'link_sent', updated_at: new Date().toISOString() })
                .eq('id', queueEntry.id);

            // Count this DM in the billing log
            await supabase.from('dm_sent_log').insert({
                automation_id: queueEntry.automation_id,
                post_id:       null,
                recipient_ig_id: senderId,
                comment_id:    null,
                comment_text:  msgText,
                status:        'sent',
                sent_at:       new Date().toISOString(),
            });

            console.log('[Webhook] Reward DM sent and queue entry marked link_sent');
        } catch (err) {
            console.error('[Webhook] Failed to send reward DM:', err.message);
        }
    } else {
        // ── Send nudge (not following yet) ────────────────────────
        const newRetryCount = (queueEntry.retry_count || 0) + 1;
        const maxRetries    = queueEntry.max_retries || 3;

        console.log(`[Webhook] ${senderId} is NOT following (retry ${newRetryCount}/${maxRetries})`);

        if (newRetryCount >= maxRetries) {
            // Max retries reached — give up
            await supabase
                .from('dm_followup_queue')
                .update({ status: 'max_retries_reached', retry_count: newRetryCount, updated_at: new Date().toISOString() })
                .eq('id', queueEntry.id);

            try {
                await sendTextDM(
                    igSenderId,
                    senderId,
                    "Sorry, we couldn't verify your follow after multiple attempts. Feel free to try again by commenting on the post! 😊",
                    accessToken,
                );
            } catch (err) {
                console.warn('[Webhook] Failed to send max-retry message:', err.message);
            }
        } else {
            // Send the nudge with Yes/No buttons again so they can tap when ready
            await supabase
                .from('dm_followup_queue')
                .update({ retry_count: newRetryCount, updated_at: new Date().toISOString() })
                .eq('id', queueEntry.id);

            try {
                const nudge = resolveMessageVariables(
                    queueEntry.nudge_message ||
                    "We couldn't verify your follow yet 🙈 Make sure you're following our account, then tap ✅ Yes when you're ready!",
                    { username: senderId },
                );
                // Send nudge as another gate message with Yes/No buttons
                await sendFollowGateDM(igSenderId, senderId, nudge, accessToken);
            } catch (err) {
                console.warn('[Webhook] Failed to send nudge DM:', err.message);
            }
        }
    }
}

/**
 * Send the reward DM (the actual link) after follow is verified.
 * Reuses the existing send functions — the link_dm_type can be any type.
 */
async function sendRewardDM(igSenderId, recipientId, dmType, dmConfig, accessToken, trackingMap = {}) {
    switch (dmType) {
        case 'button_template':
            return sendButtonTemplateDM(igSenderId, recipientId, dmConfig.slides || [], accessToken, trackingMap);
        case 'quick_reply':
            return sendQuickReplyDM(igSenderId, recipientId, dmConfig.message || '', dmConfig.quickReplies || [], accessToken);
        case 'multi_cta':
            return sendMultiCtaDM(igSenderId, recipientId, dmConfig.message || '', dmConfig.buttons || [], accessToken, trackingMap);
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

    await processAutomationForComment(supabase, post, text, from.id, commentId, 'instagram');
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

    await processAutomationForComment(supabase, post, message, from.id, comment_id, 'facebook');
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

    // ── Expiry check (safety net in case cron hasn't run yet) ────
    if (automation.expires_at && new Date(automation.expires_at) <= new Date()) {
        console.log(`[Webhook] Automation ${automation.id} has expired — auto-pausing`);
        await supabase
            .from('dm_automations')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', automation.id);
        return;
    }

    // ── Scheduled-start check (safety net) ───────────────────
    // This automation is marked active but its scheduled start hasn't arrived.
    // This shouldn't normally happen (upsert sets is_active=false for future starts),
    // but guard here just in case.
    if (automation.scheduled_start_at && new Date(automation.scheduled_start_at) > new Date()) {
        console.log(`[Webhook] Automation ${automation.id} not yet started (scheduled for ${automation.scheduled_start_at}) — skipping`);
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

    // ── Trigger evaluation ────────────────────────────────────────
    const triggerConfig     = automation.trigger_config;
    const settingsConfig    = automation.settings_config || {};
    const triggerType       = triggerConfig.type || triggerConfig.triggerType || 'keywords';
    const lowerCommentText  = commentText.toLowerCase().trim();
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

            // Merge global default keywords unless this post has universal triggers disabled
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

    // Honour account-level global trigger type when post has no post-specific config
    // (only when universal triggers aren’t disabled for this post)
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

    // ── Billing gate ──────────────────────────────────────────────
    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const { data: userAutomations } = await supabase
        .from('dm_automations').select('id').eq('user_id', automation.user_id);
    const allIds = (userAutomations || []).map((a) => a.id);

    const { count: totalMonthly } = await supabase
        .from('dm_sent_log').select('id', { count: 'exact', head: true })
        .in('automation_id', allIds).eq('status', 'sent')
        .gte('sent_at', startOfMonth.toISOString());

    if ((totalMonthly || 0) >= MONTHLY_DM_LIMIT) {
        console.log('[Webhook] Monthly limit reached — skipping');
        return;
    }

    // ── Idempotency ───────────────────────────────────────────────
    const { data: existingLog } = await supabase
        .from('dm_sent_log').select('id')
        .eq('automation_id', automation.id).eq('comment_id', commentId).maybeSingle();

    if (existingLog) {
        console.log('[Webhook] Already processed this comment');
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

    // ── Optional send delay ───────────────────────────────────────
    if (settingsConfig.delayMessage) {
        const delay = Math.floor(Math.random() * 90_000) + 30_000; // 30-120s
        await new Promise((r) => setTimeout(r, delay));
    }

    const context = { username: commenterId, first_name: commenterId, comment_id: commentId };

    // ── Fetch click-tracking codes for this automation ────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    let trackingMap = {};
    try {
        const { data: linkCodes } = await supabase
            .from('dm_link_codes')
            .select('code, original_url')
            .eq('automation_id', automation.id);
        for (const row of (linkCodes || [])) {
            trackingMap[row.original_url] = `${appUrl}/r/${row.code}`;
        }
    } catch { /* non-fatal — sends with original URLs if table missing */ }

    // ── A/B variant selection ────────────────────────────────────
    let activeAutomation = automation; // may be replaced by variant version
    let abVariant = null;

    if (automation.dm_config?.abEnabled && automation.dm_config?.variantA && automation.dm_config?.variantB) {
        const winner = automation.dm_config.abWinner; // 'A' | 'B' | null

        if (winner) {
            abVariant = winner;
        } else {
            // Count existing sends per variant to maintain 50/50 split
            const { data: abRows } = await supabase
                .from('dm_sent_log')
                .select('ab_variant')
                .eq('automation_id', automation.id)
                .in('ab_variant', ['A', 'B'])
                .eq('status', 'sent');

            const countA = (abRows || []).filter((r) => r.ab_variant === 'A').length;
            const countB = (abRows || []).filter((r) => r.ab_variant === 'B').length;
            abVariant = countA <= countB ? 'A' : 'B';
        }

        // Build variant-specific automation and tracking map
        const variantConfig = abVariant === 'A'
            ? automation.dm_config.variantA
            : automation.dm_config.variantB;

        // Rebuild tracking map filtered to this variant's codes only
        const variantCodes = Object.fromEntries(
            Object.entries(trackingMap).filter(([url]) => {
                // All codes qualify (we just re-fetch below)
                return true;
            })
        );

        // Re-fetch variant-specific tracking codes
        try {
            const { data: variantLinkCodes } = await supabase
                .from('dm_link_codes')
                .select('code, original_url')
                .eq('automation_id', automation.id)
                .eq('ab_variant', abVariant);
            trackingMap = {};
            for (const row of (variantLinkCodes || [])) {
                trackingMap[row.original_url] = `${appUrl}/r/${row.code}`;
            }
        } catch { /* non-fatal */ }

        activeAutomation = {
            ...automation,
            dm_type:   variantConfig.type,
            dm_config: variantConfig,
        };

        console.log(`[Webhook] A/B variant selected: ${abVariant} (A=${(abRows||[]).filter(r=>r.ab_variant==='A').length}, B=${(abRows||[]).filter(r=>r.ab_variant==='B').length})`);
    }

    try {
        // ── Special handling for follow_up DM type ────────────────
        if (activeAutomation.dm_type === 'follow_up') {
            await handleFollowUpAutomation(supabase, activeAutomation, post, commenterId, commentId, commentText, senderId, token, trackingMap);
            return;
        }

        // ── All other DM types ────────────────────────────────────
        await sendAutomatedDM(activeAutomation, commenterId, token, senderId, context, platform, trackingMap);

        // Always reply to the comment after sending the DM.
        const DEFAULT_COMMENT_REPLY = 'Hey! Check your DM \u2764\ufe0f Didn\'t receive the link? Follow and comment again.';
        const replyMsg = settingsConfig.replyMessage || settingsConfig.autoReplyText || DEFAULT_COMMENT_REPLY;
        try {
            await replyToComment(commentId, resolveMessageVariables(replyMsg, context), token);
            console.log('[Webhook] Comment reply sent');
        } catch (replyErr) {
            console.warn('[Webhook] Comment reply failed (non-fatal):', replyErr.message);
        }

        await supabase.from('dm_sent_log').insert({
            automation_id:   automation.id,
            post_id:         post.id,
            recipient_ig_id: commenterId,
            comment_id:      commentId,
            comment_text:    commentText,
            status:          'sent',
            ab_variant:      abVariant,
            sent_at:         new Date().toISOString(),
        });

        console.log(`[Webhook] DM sent and logged${abVariant ? ` (variant ${abVariant})` : ''}`);

        // ── Limit alert check (fire-and-forget) ──────────────────
        checkAndFireLimitAlert(supabase, automation.user_id, (totalMonthly || 0) + 1)
            .catch((e) => console.warn('[Webhook] Limit alert check failed (non-fatal):', e.message));

        // ── A/B winner detection (after 50+ sends per variant) ────
        if (abVariant && !automation.dm_config.abWinner) {
            checkAndDeclareAbWinner(supabase, automation).catch((e) =>
                console.warn('[Webhook] A/B winner check failed (non-fatal):', e.message),
            );
        }
    } catch (err) {
        console.error('[Webhook] Failed to send DM:', err.message);
        await supabase.from('dm_sent_log').insert({
            automation_id:   automation.id,
            post_id:         post.id,
            recipient_ig_id: commenterId,
            comment_id:      commentId,
            comment_text:    commentText,
            status:          'failed',
            error_message:   err.message,
            ab_variant:      abVariant,
            sent_at:         new Date().toISOString(),
        });
    }
}

/**
 * After a successful DM send, check whether the user has crossed their
 * configured alert threshold and fire email/webhook alerts if needed.
 * One alert per month per threshold crossing (deduped via alerted_months).
 */
async function checkAndFireLimitAlert(supabase, userId, currentCount) {
    const { data: prefs } = await supabase
        .from('alert_preferences')
        .select('alert_email, webhook_url, threshold_pct, alerted_months')
        .eq('user_id', userId)
        .maybeSingle();

    if (!prefs) return;
    if (!prefs.alert_email && !prefs.webhook_url) return;

    const threshold    = prefs.threshold_pct ?? 80;
    const usagePct     = (currentCount / MONTHLY_DM_LIMIT) * 100;
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const alreadyFired = (prefs.alerted_months || []).includes(currentMonth);

    if (usagePct < threshold || alreadyFired) return;

    console.log(`[Webhook] Firing limit alert for user ${userId} at ${Math.round(usagePct)}%`);

    // Best-effort email fetch — fail silently if admin API unavailable in edge
    let userEmail = '';
    try {
        const { data: adminUser } = await supabase.auth.admin.getUserById(userId);
        userEmail = adminUser?.user?.email || '';
    } catch { /* non-fatal */ }

    await fireAlerts({
        userId,
        userEmail,
        alertEmail:   prefs.alert_email,
        webhookUrl:   prefs.webhook_url,
        sentCount:    currentCount,
        limit:        MONTHLY_DM_LIMIT,
        thresholdPct: threshold,
    });

    // Mark month as alerted to prevent duplicate fires
    const newMonths = [...new Set([...(prefs.alerted_months || []), currentMonth])];
    await supabase
        .from('alert_preferences')
        .update({ alerted_months: newMonths, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
}

/**
 * After a send, check if A/B has enough data to declare a winner.
 * Requires ≥50 sends per variant. Winner is the variant with higher
 * click-through rate. If CTR difference < 10% or clicks are too low,
 * no winner is declared yet.
 */
async function checkAndDeclareAbWinner(supabase, automation) {
    const AB_MIN_SENDS = 50;

    const { data: sentRows } = await supabase
        .from('dm_sent_log')
        .select('ab_variant')
        .eq('automation_id', automation.id)
        .in('ab_variant', ['A', 'B'])
        .eq('status', 'sent');

    const countA = (sentRows || []).filter((r) => r.ab_variant === 'A').length;
    const countB = (sentRows || []).filter((r) => r.ab_variant === 'B').length;

    if (countA < AB_MIN_SENDS || countB < AB_MIN_SENDS) return; // not enough data

    // Fetch click counts per variant via dm_link_codes
    const { data: clickRows } = await supabase
        .from('click_events')
        .select('code')
        .eq('automation_id', automation.id);

    const { data: linkCodes } = await supabase
        .from('dm_link_codes')
        .select('code, ab_variant')
        .eq('automation_id', automation.id)
        .in('ab_variant', ['A', 'B']);

    const codeToVariant = {};
    for (const lc of (linkCodes || [])) codeToVariant[lc.code] = lc.ab_variant;

    let clicksA = 0, clicksB = 0;
    for (const ce of (clickRows || [])) {
        if (codeToVariant[ce.code] === 'A') clicksA++;
        else if (codeToVariant[ce.code] === 'B') clicksB++;
    }

    const ctrA = countA > 0 ? clicksA / countA : 0;
    const ctrB = countB > 0 ? clicksB / countB : 0;

    // Declare winner only if CTR difference is at least 10%
    const MIN_CTR_DIFF = 0.10;
    let winner = null;
    if (ctrA > ctrB + MIN_CTR_DIFF)      winner = 'A';
    else if (ctrB > ctrA + MIN_CTR_DIFF) winner = 'B';

    if (!winner) return; // too close to call

    // Update dm_config.abWinner
    const updatedConfig = { ...automation.dm_config, abWinner: winner };
    await supabase
        .from('dm_automations')
        .update({ dm_config: updatedConfig, updated_at: new Date().toISOString() })
        .eq('id', automation.id);

    console.log(`[Webhook] A/B winner declared: Variant ${winner} (CTR A=${(ctrA*100).toFixed(1)}%, B=${(ctrB*100).toFixed(1)}%)`);
}

// ─── Follow-Up Automation ─────────────────────────────────────────────────────

/**
 * Handle the initial comment trigger for a follow_up automation.
 * Sends the gate message and inserts a queue entry so the DM reply
 * handler can pick it up when the user replies.
 */
async function handleFollowUpAutomation(supabase, automation, post, commenterId, commentId, commentText, igSenderId, accessToken, trackingMap = {}) {
    const dmConfig = automation.dm_config;

    // Don't create duplicate queue entries for the same user + automation
    const { data: existing } = await supabase
        .from('dm_followup_queue')
        .select('id, status')
        .eq('automation_id', automation.id)
        .eq('recipient_ig_id', commenterId)
        .in('status', ['awaiting_confirmation'])
        .maybeSingle();

    if (existing) {
        console.log('[Webhook] Follow-up already pending for this user — skipping duplicate');
        return;
    }

    const gateMessage = resolveMessageVariables(
        dmConfig.gateMessage || 'Hey! Follow our account and reply YES to get the link 😊',
        { username: commenterId, first_name: commenterId },
    );

    try {
        // Send the gate DM (gate message itself has no tracked URLs — it's text only)
        await sendFollowGateDM(igSenderId, commenterId, gateMessage, accessToken);

        // Enqueue for follow verification
        await supabase.from('dm_followup_queue').insert({
            automation_id:          automation.id,
            account_id:             post.account_id,
            recipient_ig_id:        commenterId,
            ig_sender_id:           igSenderId,
            gate_message:           gateMessage,
            nudge_message:          dmConfig.nudgeMessage || "We couldn't verify your follow yet 🙈 Make sure you're following our account, then tap ✅ Yes when you're ready!",
            decline_message:        dmConfig.declineMessage || "No worries! Follow us and tap ✅ Yes whenever you're ready 🙌",
            confirmation_keywords:  ['yes', 'done', 'followed', 'ok'], // fallback for text replies; buttons use payload
            max_retries:            dmConfig.maxRetries || 3,
            link_dm_type:           dmConfig.linkDmType || 'message_template',
            link_dm_config:         dmConfig.linkDmConfig || { message: dmConfig.linkMessage || '' },
        });

        // Log gate message as a sent DM (counts toward billing)
        await supabase.from('dm_sent_log').insert({
            automation_id:   automation.id, post_id: post.id,
            recipient_ig_id: commenterId, comment_id: commentId,
            comment_text:    commentText, status: 'sent',
            sent_at:         new Date().toISOString(),
        });

        console.log(`[Webhook] Follow-gate DM sent and queued for ${commenterId}`);
    } catch (err) {
        console.error('[Webhook] Failed to send follow-gate DM:', err.message);
        await supabase.from('dm_sent_log').insert({
            automation_id: automation.id, post_id: post.id,
            recipient_ig_id: commenterId, comment_id: commentId,
            comment_text: commentText, status: 'failed',
            error_message: err.message, sent_at: new Date().toISOString(),
        });
    }
}
