import { NextResponse, after } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
import { graphBase } from '@/lib/meta-graph';
import {
    sendAutomatedDM, sendFollowGateDM, sendOpeningGateDM,
    checkUserIsFollower, sendHeartReaction,
    resolveMessageVariables, replyToComment,
    sendTextDM, sendButtonTemplateDM, sendQuickReplyDM, sendMultiCtaDM,
    applyBranding,
} from '@/lib/send-dm';
import { applyTracking } from '@/lib/click-tracking';
import { fetchIgUserFirstName, extractFirstName } from '@/lib/ig-profile';
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

    // Touch-log so we can prove from Vercel logs whether Meta actually
    // reached the endpoint at all. If you tap an ice-breaker / button and
    // do NOT see this line within a few seconds, the webhook subscription
    // is the problem (not the handler) -- hit /api/accounts/resubscribe
    // or reconnect the account.
    console.log('[Webhook] POST received', JSON.stringify({
        bodyBytes:  Buffer.byteLength(rawBody, 'utf8'),
        hasSig:     !!request.headers.get('x-hub-signature-256'),
        ua:         request.headers.get('user-agent') || null,
        bodyPreview: rawBody.slice(0, 400),
    }));

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
    // Diagnostic: dump the full incoming envelope so we can see exactly
    // what Meta sent (e.g. confirm postback events for button taps are
    // being delivered, or that story-mention attachments are shaped as
    // expected). User has explicitly granted permission to log sensitive
    // data while debugging.
    console.log('[Webhook] Raw incoming payload:', JSON.stringify(body));

    const { object, entry } = body;

    if (object !== 'instagram' && object !== 'page') {
        console.log(`[Webhook] Ignoring envelope with object=${object} (only instagram + page handled)`);
        return;
    }

    const supabase = createServiceClient();

    for (const entryItem of entry || []) {
        const accountId = entryItem.id;
        const msgCount    = (entryItem.messaging || []).length;
        const changeCount = (entryItem.changes   || []).length;
        console.log(`[Webhook] Entry id=${accountId} messaging.count=${msgCount} changes.count=${changeCount}`);

        // ── Incoming DM replies (messages) ─────────────────────────────
        for (const msg of entryItem.messaging || []) {
            // Diagnostic: log the shape of each messaging event so we can
            // tell at a glance whether Meta sent a message (DM, story
            // mention attachment, quick-reply tap), a postback (button
            // tap), or something else (read receipts, etc.).
            const eventShape = {
                hasMessage:   !!msg.message,
                isEcho:       !!msg.message?.is_echo,
                hasPostback:  !!msg.postback,
                hasReferral:  !!msg.referral,
                hasReaction:  !!msg.reaction,
                hasRead:      !!msg.read,
                sender:       msg.sender?.id,
                payload:      msg.message?.quick_reply?.payload || msg.postback?.payload,
                attachments:  (msg.message?.attachments || []).map((a) => a?.type),
            };
            console.log('[Webhook] Messaging event shape:', JSON.stringify(eventShape));

            if (msg.message && !msg.message.is_echo) {
                await handleIncomingDMReply(supabase, accountId, msg);
            } else if (msg.postback?.payload) {
                console.log('[Webhook] Postback event received -- routing through handleIncomingDMReply:', JSON.stringify({
                    sender:  msg.sender?.id,
                    title:   msg.postback.title,
                    payload: msg.postback.payload,
                    mid:     msg.postback.mid,
                }));
                // Postback events fire when a user taps a button inside a
                // template (e.g. the follow-gate buttons sent by
                // sendFollowGateDM). Meta delivers these on a separate
                // shape -- `msg.postback.payload` instead of
                // `msg.message.quick_reply.payload` -- so normalise into
                // the message-event shape before dispatch. Same
                // downstream logic then catches CONFIRMED_FOLLOW /
                // NOT_FOLLOWING / ICE_BREAKER_* payloads regardless of
                // how Meta delivered them.
                await handleIncomingDMReply(supabase, accountId, {
                    ...msg,
                    message: {
                        text: msg.postback.title || '',
                        quick_reply: { payload: msg.postback.payload },
                        mid: msg.postback.mid || null,
                    },
                });
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
    const senderId    = messagingEvent.sender?.id;
    const msgText     = messagingEvent.message?.text?.toLowerCase().trim() || '';
    const msgPayload  = messagingEvent.message?.quick_reply?.payload || '';
    const attachments = messagingEvent.message?.attachments || [];
    const inboundMid  = messagingEvent.message?.mid || null;

    if (!senderId) return;

    // Diagnostic: summarise the inbound event so log readers can tell at a
    // glance whether Meta delivered a text DM, a quick-reply tap, a story
    // mention, etc. The attachment-type array is the smoking gun for the
    // "my mention auto-DM isn't firing" debug case.
    const attachmentTypes = attachments.map((a) => a?.type).filter(Boolean);
    console.log(`[Webhook] DM event from ${senderId} on account ${igAccountId}: has_text=${!!msgText} payload=${msgPayload || 'none'} attachments=${JSON.stringify(attachmentTypes)}`);

    // ── Story mention delivered as a DM ─────────────────────
    // Meta delivers story mentions through this `messages` webhook (not
    // the legacy `mentions` change-field path): the event has no text
    // body, just an attachment with type='story_mention'. Dispatch
    // BEFORE the text guard below or these get silently dropped.
    if (attachments.some((a) => a?.type === 'story_mention')) {
        console.log(`[Webhook] Story mention detected from ${senderId}, routing to handler`);
        await handleStoryMentionDM(supabase, igAccountId, senderId, inboundMid);
        return;
    }

    if (!msgText) return;

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
    // Two paths because Meta is inconsistent:
    //   1. Payload-based -- Meta is supposed to deliver a
    //      quick_reply.payload when a user taps an ice-breaker chip.
    //      This is the deterministic path when it works.
    //   2. Text-fallback -- in practice Meta sometimes delivers
    //      ice-breaker taps as plain text with no payload (often when
    //      the openers were configured on the IG Business Inbox side
    //      rather than via our /api/ice-breakers route). Match by the
    //      configured question text. Exact match only so this doesn't
    //      intercept follow-up-gate YES/NO replies or keyword DMs.
    if (msgPayload?.startsWith('ICE_BREAKER_')) {
        const handled = await handleIceBreakerResponse(supabase, igAccountId, senderId, msgPayload);
        if (handled) return;
    }
    if (msgText && await handleIceBreakerByText(supabase, igAccountId, senderId, msgText)) {
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

    // Look for a pending follow-up queue entry for this user. Two flows
    // share this table:
    //   - awaiting_confirmation -> follow gate (tap = verify follower)
    //   - awaiting_opening_tap  -> opening-message gate (tap = send main DM)
    // We pick the most-recent row; concurrent gates for the same user
    // are prevented by partial unique indexes on each status.
    const { data: queueEntry } = await supabase
        .from('dm_followup_queue')
        .select('*, connected_accounts(access_token, fb_page_access_token, ig_user_id)')
        .eq('recipient_ig_id', senderId)
        .in('status', ['awaiting_confirmation', 'awaiting_opening_tap'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!queueEntry) {
        // No pending follow-gate — see if this DM matches a builder_v2
        // dm-auto-responder automation (keyword-triggered DM reply).
        // Returns true if a match handled the message; otherwise we
        // fall through to legacy email-collector capture.
        const dmAutoHandled = await handleDmAutoResponder(
            supabase, igAccountId, senderId, msgText,
            messagingEvent.message?.mid || null,
        );
        if (dmAutoHandled) return;
        await handleEmailCollectorReply(supabase, senderId, msgText);
        return;
    }

    // ── Opening-message button gate (status='awaiting_opening_tap') ───
    // The OPENING_TAP postback fires when the user taps the opening
    // button. Typed confirmation keywords (e.g. the button title) also
    // match for forgiveness. On match, send the main DM via sendRewardDM
    // with openingEnabled=false so the opening isn't re-sent, then mark
    // the row link_sent. No match -> silent (queue stays open).
    if (queueEntry.status === 'awaiting_opening_tap') {
        const openingKeywords = queueEntry.confirmation_keywords || [];
        const isOpeningTap =
            msgPayload === 'OPENING_TAP'
            || openingKeywords.some((kw) => msgText.includes((kw || '').toLowerCase()));

        if (!isOpeningTap) {
            console.log('[Webhook] Opening-tap: input did not match payload or keywords -- ignoring');
            return;
        }

        const openingAccount   = queueEntry.connected_accounts;
        const openingToken     = openingAccount.fb_page_access_token || openingAccount.access_token;
        const openingUseIgApi  = !openingAccount.fb_page_access_token;
        const openingIgSender  = queueEntry.ig_sender_id;

        // Resolve plan for branding / templates
        let openingRewardPlan = 'free';
        try {
            const { data: autoForPlan } = await supabase
                .from('dm_automations').select('user_id')
                .eq('id', queueEntry.automation_id).maybeSingle();
            if (autoForPlan?.user_id) openingRewardPlan = await getUserPlan(supabase, autoForPlan.user_id);
        } catch { /* defaults to free */ }

        // Build click-tracking map so reward links resolve through /r/<code>
        let openingTracking = {};
        try {
            const appUrlForOpening = process.env.NEXT_PUBLIC_APP_URL || '';
            const { data: linkCodes } = await supabase
                .from('dm_link_codes').select('code, original_url')
                .eq('automation_id', queueEntry.automation_id)
                .limit(500);
            for (const row of (linkCodes || [])) {
                openingTracking[row.original_url] = `${appUrlForOpening}/r/${row.code}`;
            }
        } catch { /* non-fatal */ }

        // Strip openingEnabled so sendRewardDM doesn't re-send the opening
        // bubble (the user already saw it before tapping the button).
        const rewardConfig = { ...(queueEntry.link_dm_config || {}), openingEnabled: false };

        try {
            await sendRewardDM(
                openingIgSender, senderId, queueEntry.link_dm_type,
                rewardConfig, openingToken, openingTracking,
                openingRewardPlan, openingUseIgApi,
            );

            await supabase.from('dm_followup_queue')
                .update({ status: 'link_sent', updated_at: new Date().toISOString() })
                .eq('id', queueEntry.id);

            await supabase.from('dm_sent_log').insert({
                automation_id:   queueEntry.automation_id,
                post_id:         null,
                recipient_ig_id: senderId,
                comment_id:      null,
                comment_text:    `[opening tap: ${msgText.slice(0, 60)}]`,
                status:          'sent',
                platform:        openingUseIgApi ? 'instagram' : 'facebook',
                sent_at:         new Date().toISOString(),
            });

            console.log('[Webhook] Opening tap: main DM sent, queue marked link_sent');
        } catch (err) {
            console.error('[Webhook] Opening tap: failed to send main DM:', err.message);
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
                // currently capture the username or first name.
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
            id, automation_id, recipient_username, recipient_first_name, platform, sent_at,
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

    const usernameForReply  = recent.recipient_username || 'there';
    const firstNameForReply = recent.recipient_first_name || 'there';
    const plan = await getUserPlan(supabase, automation.user_id);

    // Substitute placeholders + apply branding so the response matches the
    // way the original message_template / quick_reply DMs were sent.
    let body = resolveMessageVariables(matched.responseMessage, {
        username:   usernameForReply,
        first_name: firstNameForReply,
    });
    // Centralized branding via applyBranding (was duplicated inline here
    // when applyBranding wasn't exported -- it is now, so we just call it).
    body = applyBranding(body, automation.dm_config || {}, plan);

    try {
        await sendTextDM(account.ig_user_id, senderId, body, token, useIg);

        await supabase.from('dm_sent_log').insert({
            automation_id:        automation.id,
            post_id:              null,
            recipient_ig_id:      senderId,
            recipient_username:   recent.recipient_username,
            recipient_first_name: recent.recipient_first_name,
            comment_id:           null,
            comment_text:         `[chip tap: ${matched.title}]`,
            status:               'sent',
            platform,
            sent_at:              new Date().toISOString(),
        });

        console.log(`[Webhook/QR] ✅ Chip "${matched.title}" reply sent to ${senderId}`);
    } catch (err) {
        console.error(`[Webhook/QR] Failed to reply for chip tap "${matched.title}":`, err.message);
        await supabase.from('dm_sent_log').insert({
            automation_id:        automation.id,
            post_id:              null,
            recipient_ig_id:      senderId,
            recipient_username:   recent.recipient_username,
            recipient_first_name: recent.recipient_first_name,
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
        case 'builder_v2': {
            // Mirror the builder_v2 dispatch in sendAutomatedDM: when an
            // opening message is configured, send it as its own bubble
            // first, then the main DM. (Used to concatenate them into a
            // single body which made the recipient see one big blob.)
            const validButtons = (dmConfig.buttons || []).filter((b) => b.label && b.url);
            const imageUrl     = dmConfig.imageUrl || null;
            const mainMessage  = dmConfig.message || '';

            const openingMsg = dmConfig.openingEnabled
                && typeof dmConfig.openingMessage === 'string'
                && dmConfig.openingMessage.trim()
                    ? dmConfig.openingMessage
                    : null;

            if (openingMsg) {
                try {
                    await sendTextDM(igSenderId, recipientId, openingMsg, accessToken, useIgApi);
                } catch (err) {
                    // Non-fatal -- log and continue so the main DM still
                    // goes out even if the opener fails to send.
                    console.warn('[sendRewardDM] Opening message send failed (continuing with main DM):', err.message);
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
                return sendButtonTemplateDM(igSenderId, recipientId, [slide], accessToken, trackingMap, plan, useIgApi, dmConfig);
            }
            if (validButtons.length > 0) {
                return sendMultiCtaDM(
                    igSenderId, recipientId, mainMessage,
                    validButtons.map((b) => ({ label: b.label, url: b.url })),
                    accessToken, trackingMap, plan, useIgApi, dmConfig,
                );
            }
            return sendTextDM(
                igSenderId, recipientId,
                applyBranding(mainMessage, dmConfig, plan),
                accessToken, useIgApi,
            );
        }
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
    // and upsell follow-ups can substitute {username}. {first_name} is fetched
    // separately via the Graph API inside processAutomationForComment, where
    // the access token is already loaded.
    const commenterUsername = from.username || null;

    const result = await processAutomationForComment(supabase, post, text, from.id, commentId, 'instagram', commenterUsername, null);
    if (post?.account_id) {
        await processGlobalTriggers(supabase, post, text, from.id, commentId, 'instagram', result.fired, commenterUsername, result.firstName);
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

    // FB delivers the user's display name in from.name. Use it for both the
    // {username} fallback (preserving prior behavior) and to derive a real
    // {first_name} via the first whitespace-delimited token.
    const commenterUsername = from.name || from.username || null;
    const commenterFirstName = extractFirstName(from.name);
    const result = await processAutomationForComment(supabase, post, message, from.id, comment_id, 'facebook', commenterUsername, commenterFirstName);
    if (post?.account_id) {
        await processGlobalTriggers(supabase, post, message, from.id, comment_id, 'facebook', result.fired, commenterUsername, result.firstName);
    }
}

// ─── Core Automation Logic ───────────────────────────────────────────────────

async function processAutomationForComment(supabase, post, commentText, commenterId, commentId, platform, commenterUsername = null, commenterFirstName = null, inboundMid = null, overrideAutomation = null) {
    // Single result object — every early return ships this back so the
    // caller (handleInstagramCommentEvent / handleFacebookCommentEvent /
    // handleStoryReplyEvent) can forward firstName to processGlobalTriggers
    // without a second Graph API call.
    const out = { fired: false, firstName: commenterFirstName };

    if (!post) {
        console.log('[Webhook] Post not found in DB');
        return out;
    }

    // ── Multi-automation routing (first match wins, ordered by specificity) ──
    // A post can have N active automations attached (e.g., one per
    // keyword set). Fetch all candidates, rank by specificity, then
    // fire ONLY the highest-priority one whose trigger matches. This
    // prevents the same fan from getting two DMs back-to-back when
    // their comment matches multiple automations.
    //
    // We also include account-wide automations saved with
    // post_target_mode='any' (post_id IS NULL). Those need an
    // additional account-owner lookup to scope correctly.
    const { data: account } = await supabase
        .from('connected_accounts')
        .select('user_id, access_token, fb_page_access_token, ig_user_id, fb_page_id, platform, default_config')
        .eq('id', post.account_id)
        .single();

    if (!account) {
        console.error('[Webhook] Connected account not found for post');
        return out;
    }

    let candidates;
    if (overrideAutomation) {
        // Caller (e.g., handleDmAutoResponder) already matched the
        // automation against the inbound message — skip the candidate
        // query and trust their pick.
        candidates = [overrideAutomation];
    } else {
        const { data: postBound } = await supabase
            .from('dm_automations')
            .select('*')
            .eq('post_id', post.id)
            .eq('is_active', true);

        // "Any Post" automations are a fallback — they only fire when no
        // active post-specific automation exists for this post. If a
        // post-bound automation is paused, post-bound is empty here and
        // any-mode kicks in. If a post-bound is active, any-mode yields
        // entirely so two automations don't fire on the same comment.
        const hasPostBound = (postBound || []).length > 0;
        const { data: anyMode } = hasPostBound
            ? { data: [] }
            : await supabase
                .from('dm_automations')
                .select('*')
                .is('post_id', null)
                .eq('is_active', true)
                .eq('user_id', account.user_id)
                .filter('trigger_config->>postTargetMode', 'eq', 'any');

        candidates = [...(postBound || []), ...(anyMode || [])];
    }

    if (candidates.length === 0) {
        console.log('[Webhook] No active automation for post:', post.id);
        return out;
    }

    // Resolve {first_name} for IG commenters via the Graph API. FB callers
    // pre-fill commenterFirstName from from.name, so this only fires for
    // platform === 'instagram'. Failure → null → downstream falls back to
    // a neutral "there" so DMs never expose the numeric IGSID.
    if (!out.firstName && platform === 'instagram') {
        const lookupToken = account.fb_page_access_token || account.access_token;
        const useIgApiForLookup = !account.fb_page_access_token;
        out.firstName = await fetchIgUserFirstName(commenterId, lookupToken, useIgApiForLookup);
    }

    const lowerCommentText = commentText.toLowerCase().trim();

    // Specificity ranking — lower number wins:
    //   0  keyword automation with explicit keyword list (most specific)
    //   1  emojis_only / mentions_only (specific shape match)
    //   2  keyword automation with empty list (would fall through to globals)
    //   3  all_comments catch-all
    const specificity = (a) => {
        const tc = a.trigger_config || {};
        const tt = tc.type || tc.triggerType || 'keywords';
        if (tt === 'keywords' && (tc.keywords || []).length > 0) return 0;
        if (tt === 'emojis_only' || tt === 'mentions_only') return 1;
        if (tt === 'keywords') return 2;
        if (tt === 'all_comments') return 3;
        return 4;
    };

    // Evaluate trigger match for a single candidate. Returns true when
    // the comment satisfies that automation's trigger config (including
    // global-default fallbacks and excludeMentions flag).
    const evaluateMatch = (automation) => {
        const triggerConfig  = automation.trigger_config || {};
        const settingsConfig = automation.settings_config || {};
        const triggerType    = triggerConfig.type || triggerConfig.triggerType || 'keywords';
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
                // Per-automation keywords are the user's source of truth.
                // Merge in account-level globals only in positive mode —
                // exclude-mode merging would flip globals into a blacklist.
                let keywords = (triggerConfig.keywords || []).map((k) => k.toLowerCase());
                if (!isExcludeMode && !settingsConfig.disableUniversalTriggers) {
                    const globalKws = (account.default_config?.keywords || []).map((k) => k.toLowerCase());
                    keywords = [...new Set([...keywords, ...globalKws])];
                }
                if (keywords.length === 0) {
                    shouldSend = false;
                } else if (isExcludeMode) {
                    shouldSend = !keywords.some((kw) => lowerCommentText.includes(kw));
                } else {
                    shouldSend = keywords.some((kw) => lowerCommentText.includes(kw));
                }
                break;
            }
        }

        // Global-trigger fallback when the automation is keyword-typed
        // but has no keywords AND universal triggers aren't disabled.
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
        return shouldSend;
    };

    // Drop expired/not-yet-started before ranking — they can't fire
    // and shouldn't take priority over a viable lower-priority match.
    const now = new Date();
    const eligible = [];
    for (const c of candidates) {
        if (c.expires_at && new Date(c.expires_at) <= now) {
            console.log(`[Webhook] Automation ${c.id} has expired — auto-pausing`);
            await supabase.from('dm_automations')
                .update({ is_active: false, updated_at: now.toISOString() })
                .eq('id', c.id);
            continue;
        }
        if (c.scheduled_start_at && new Date(c.scheduled_start_at) > now) {
            console.log(`[Webhook] Automation ${c.id} not yet started — skipping`);
            continue;
        }
        eligible.push(c);
    }

    const ranked = [...eligible].sort((x, y) => specificity(x) - specificity(y));

    let automation = null;
    const matchedButSkipped = [];
    for (const candidate of ranked) {
        if (evaluateMatch(candidate)) {
            if (automation === null) {
                automation = candidate;
            } else {
                matchedButSkipped.push(candidate.id);
            }
        }
    }

    if (!automation) {
        console.log('[Webhook] Comment did not match any active automation on post');
        return out;
    }

    if (matchedButSkipped.length > 0) {
        // Surface this so users in /logs can understand why their
        // less-specific automation didn't fire on this comment.
        console.log(
            `[Webhook] Comment ${commentId} matched ${matchedButSkipped.length + 1} automations on post ${post.id}; ` +
            `fired ${automation.id} (highest specificity), skipped: ${matchedButSkipped.join(', ')}`
        );
    }

    const triggerConfig  = automation.trigger_config;
    const settingsConfig = automation.settings_config || {};

    const globalExclude = (account.default_config?.excludeKeywords || []).map((k) => k.toLowerCase());
    if (globalExclude.length > 0 && globalExclude.some((kw) => lowerCommentText.includes(kw))) {
        console.log('[Webhook] Skipping — global exclude keyword matched');
        return out;
    }

    // ── Billing gate — plan from user_plans, count from cached counter ──
    const userPlan = await getUserPlan(supabase, automation.user_id);
    const dmLimit  = getDmLimit(userPlan);

    if (dmLimit !== null) {
        const totalMonthly = await getMonthlyDmCount(supabase, automation.user_id);
        if (totalMonthly >= dmLimit) {
            console.log(`[Webhook] Monthly limit (${dmLimit}) reached for ${userPlan} plan — skipping`);
            return out;
        }
    }

    // ── Idempotency: check sent log AND queue ─────────────────────
    const { data: existingLog } = await supabase
        .from('dm_sent_log').select('id')
        .eq('automation_id', automation.id).eq('comment_id', commentId).maybeSingle();

    if (existingLog) {
        console.log('[Webhook] Already processed this comment (sent log)');
        return out;
    }

    const { data: existingQueue } = await supabase
        .from('dm_queue').select('id')
        .eq('automation_id', automation.id).eq('comment_id', commentId)
        .in('status', ['pending', 'processing', 'sent']).maybeSingle();

    if (existingQueue) {
        console.log('[Webhook] Already enqueued this comment (dm queue)');
        return out;
    }

    // ── Send-once-per-user ────────────────────────────────────────
    if (triggerConfig.sendOncePerUser) {
        const { data: prevDms } = await supabase
            .from('dm_sent_log').select('id')
            .eq('automation_id', automation.id).eq('recipient_ig_id', commenterId).limit(1);
        if (prevDms && prevDms.length > 0) {
            console.log(`[Webhook] User ${commenterId} already received DM for this post`);
            return out;
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
    // {first_name} resolves separately: real first name when we fetched / parsed
    // one (FB from.name or IG Graph API), otherwise neutral "there".
    const personalForReply = commenterUsername || 'there';
    const firstNameForReply = out.firstName || 'there';
    const context = {
        username:   personalForReply,
        first_name: firstNameForReply,
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

    // ── Runtime plan gate for Pro-only automation features ──────────
    // Email Collector + Ask-to-Follow + Send follow-up are Pro-only.
    // If the user built these on Pro/Trial and then downgraded, the
    // saved row keeps the flags but they should stop firing on free —
    // matches Story Mention's hard-cutoff behaviour. Reuses `userPlan`
    // already resolved above for the DM-limit billing gate.
    const planAllowsPro = userPlan === 'pro' || userPlan === 'business' || userPlan === 'trial';

    try {
        // ── Heart reaction on inbound message (builder_v2 + opt-in) ────
        // Best-effort: fires when reactWithHeart is on and we have an
        // inbound message id (story-reply / DM auto-responder). The
        // call swallows API failures so the main DM still proceeds.
        if (
            activeAutomation.dm_type === 'builder_v2'
            && Boolean(activeAutomation.settings_config?.reactWithHeart)
            && inboundMid
            && platform === 'instagram'
        ) {
            try {
                await sendHeartReaction(
                    account.ig_user_id, commenterId, inboundMid, token, !account.fb_page_access_token,
                );
                console.log(`[Webhook] Heart reaction sent on mid ${inboundMid}`);
            } catch (err) {
                console.warn('[Webhook] Heart reaction failed (non-fatal):', err.message);
            }
        }

        // ── Email Collector — queue the user for email capture ────────
        // The actual ask message rides the standard builder_v2 enqueue
        // path below (it lives at dm_config.message). Here we just
        // insert an email_collect_queue row so when the user replies,
        // the existing handleEmailCollectorReply picks it up,
        // validates the email, and fires the thank-you message.
        // Pro/Trial only — saved rows on a downgraded account stop
        // capturing emails (the ask message itself still goes out as
        // a normal DM, but no queue row means no follow-up capture).
        if (
            activeAutomation.dm_type === 'builder_v2'
            && activeAutomation.settings_config?.templateType === 'email-collector'
            && planAllowsPro
        ) {
            try {
                await supabase.from('email_collect_queue').insert({
                    automation_id:        activeAutomation.id,
                    account_id:           post.account_id,
                    recipient_ig_id:      commenterId,
                    ig_sender_id:         account.ig_user_id,
                    confirmation_message: activeAutomation.settings_config?.emailThanksMessage || '',
                    status:               'awaiting_email',
                });
            } catch (err) {
                console.warn('[Webhook] email_collect_queue insert failed:', err.message);
            }
        } else if (
            activeAutomation.dm_type === 'builder_v2'
            && activeAutomation.settings_config?.templateType === 'email-collector'
            && !planAllowsPro
        ) {
            console.log(`[Webhook] Skipping email-collector queue — user ${account.user_id} is on ${userPlan}`);
        }

        if (activeAutomation.dm_type === 'follow_up') {
            await handleFollowUpAutomation(supabase, activeAutomation, post, commenterId, commentId, commentText, senderId, token, trackingMap, commenterUsername, platform, out.firstName);
            out.fired = true;
            return out;
        }

        if (activeAutomation.dm_type === 'email_collector') {
            // Legacy email-collector path — same Pro gate as builder_v2.
            if (!planAllowsPro) {
                console.log(`[Webhook] Skipping legacy email-collector — user ${account.user_id} is on ${userPlan}`);
                return out;
            }
            await handleEmailCollectorAutomation(supabase, activeAutomation, post, commenterId, commentId, commentText, senderId, token, useIgApi, commenterUsername, platform, out.firstName);
            out.fired = true;
            return out;
        }

        // ── Conditional follow-gate for builder_v2 ─────────────────────
        // When askToFollow is on, we only gate non-followers. Existing
        // followers get the normal builder_v2 main DM with no extra
        // confirmation step (Manychat-style — gate is invisible to
        // people who already follow). For non-followers we send the
        // gate message and queue them for YES verification, after
        // which the existing dm_followup_queue YES handler routes
        // them to sendRewardDM(dm_type='builder_v2', ...) with the
        // saved inner config.
        //
        // Pro/Trial only — if a user built askToFollow on Trial and
        // then downgraded, the gate skips and the main DM goes out
        // ungated (still better than blocking the DM entirely).
        if (activeAutomation.dm_type === 'builder_v2'
            && Boolean(activeAutomation.settings_config?.askToFollow)
            && planAllowsPro) {
            // FB doesn't expose follower-list, so we only gate IG. On
            // FB platform we fall through to the normal send.
            if (platform === 'instagram') {
                let isFollower = null;
                try {
                    isFollower = await checkUserIsFollower(account.ig_user_id, commenterId, token);
                } catch (err) {
                    console.warn('[Webhook] Follow check threw — sending DM anyway:', err.message);
                }
                // null = API failed → don't punish the user; treat as
                // "follower" and send the DM. false = confirmed not
                // following → fire the gate flow.
                if (isFollower === false) {
                    const settings = activeAutomation.settings_config || {};
                    const gateMessage = resolveMessageVariables(
                        settings.askToFollowMessage
                          || 'Hey {first_name}! Follow us first and reply YES so I can send your link 🎁',
                        { username: commenterUsername || 'there', first_name: out.firstName || 'there' },
                    );
                    try {
                        // INSERT into dm_followup_queue FIRST -- the partial
                        // unique index idx_followup_queue_unique_inflight makes
                        // this the atomic dedup gate. Concurrent webhook
                        // deliveries hit 23505 and bail before firing a
                        // duplicate gate DM. Send moves below the gate.
                        const { error: enqErr } = await supabase.from('dm_followup_queue').insert({
                            automation_id:         activeAutomation.id,
                            account_id:            post.account_id,
                            recipient_ig_id:       commenterId,
                            ig_sender_id:          account.ig_user_id,
                            gate_message:          gateMessage,
                            // Reuse the gate copy for retry nudges so we
                            // don't have a second editable field cluttering
                            // the builder UI.
                            nudge_message:         gateMessage,
                            confirmation_keywords: ['yes', 'done', 'followed', 'ok'],
                            max_retries:           3,
                            // YES handler reads these to dispatch the reward
                            // DM via sendRewardDM. We point it back at the
                            // same builder_v2 config we'd have sent directly.
                            link_dm_type:          'builder_v2',
                            link_dm_config:        activeAutomation.dm_config,
                        });
                        if (enqErr) {
                            if (enqErr.code === '23505') {
                                console.log(`[Webhook] Gate flow already in-flight (dedup race) for ${commenterId}`);
                                out.fired = true;
                                return out;
                            }
                            throw enqErr;
                        }
                        // Won the dedup race -- now send the gate DM. Roll
                        // back the inflight row on send failure so the user
                        // isn't stuck awaiting_confirmation with no DM.
                        try {
                            await sendFollowGateDM(
                                account.ig_user_id, commenterId, gateMessage, token,
                                !account.fb_page_access_token, commentId,
                                { confirmTitle: settings.askToFollowButtonText || "I'm following!" },
                            );
                        } catch (sendErr) {
                            await supabase.from('dm_followup_queue').delete()
                                .eq('automation_id', activeAutomation.id)
                                .eq('recipient_ig_id', commenterId)
                                .eq('status', 'awaiting_confirmation');
                            throw sendErr;
                        }
                        await supabase.from('dm_sent_log').insert({
                            automation_id:        activeAutomation.id,
                            post_id:              post.id,
                            recipient_ig_id:      commenterId,
                            recipient_username:   commenterUsername,
                            recipient_first_name: out.firstName,
                            comment_id:           commentId,
                            comment_text:         commentText,
                            status:               'sent',
                            platform,
                            sent_at:              new Date().toISOString(),
                        });
                        console.log(`[Webhook] Gate sent for non-follower ${commenterId}`);
                        out.fired = true;
                        return out;
                    } catch (err) {
                        console.warn('[Webhook] Gate send failed (falling through):', err.message);
                    }
                }
            }
            // Follower (or follower-check skipped): fall through to
            // the normal builder_v2 enqueue path below. No gate sent.
        }

        const isBuilderV2 = activeAutomation.dm_type === 'builder_v2';

        // ── Atomic dedup BEFORE any user-visible action ───────────
        // Goal: under Meta webhook retries only ONE delivery proceeds.
        // We claim the comment via INSERT FIRST, then do user-visible
        // work (comment reply + DM). Two claim targets depending on flow:
        //   - openingGateOn → INSERT dm_followup_queue (idx_followup_queue_unique_opening_inflight)
        //   - else          → INSERT dm_queue with HELD scheduled_after
        //                     (idx_dm_queue_dedup). The "held" timestamp
        //                     stops the natural cron from dispatching
        //                     the DM until we UPDATE it back below.
        //                     This gives us atomic dedup + correct
        //                     ordering + zero artificial DM delay.
        const openingBtnText = (activeAutomation.dm_config?.openingButtonText || '').trim();
        const openingMsgRaw  = (activeAutomation.dm_config?.openingMessage    || '').trim();
        const openingGateOn  = isBuilderV2
            && activeAutomation.dm_config?.openingEnabled
            && openingBtnText.length > 0
            && openingMsgRaw.length > 0;

        const HOLD_MS = 30_000;
        let openingResolved = null;
        let openingGateClaimed = false;

        if (openingGateOn) {
            openingResolved = resolveMessageVariables(openingMsgRaw, context);

            const { error: openingEnqErr } = await supabase
                .from('dm_followup_queue')
                .insert({
                    automation_id:         activeAutomation.id,
                    account_id:            post.account_id,
                    recipient_ig_id:       commenterId,
                    ig_sender_id:          account.ig_user_id,
                    status:                'awaiting_opening_tap',
                    gate_message:          openingResolved,
                    nudge_message:         openingResolved,
                    confirmation_keywords: [
                        openingBtnText.toLowerCase(),
                        'yes', 'send', 'send me the link', 'ok',
                    ],
                    max_retries:           1,
                    link_dm_type:          'builder_v2',
                    link_dm_config:        activeAutomation.dm_config,
                });

            if (openingEnqErr) {
                if (openingEnqErr.code === '23505') {
                    // Row exists. Differentiate Meta's 1-2s retry from a
                    // stale abandoned flow: if the existing row's updated_at
                    // is recent (< OPENING_DEDUP_WINDOW_MS), treat as a true
                    // duplicate delivery and bail. Otherwise the user is
                    // re-engaging (often after deleting the chat) so refresh
                    // the row in place and re-send the opener -- otherwise
                    // they'd be permanently locked out of the reward DM.
                    const OPENING_DEDUP_WINDOW_MS = 15_000;
                    const { data: existing } = await supabase
                        .from('dm_followup_queue')
                        .select('id, updated_at')
                        .eq('automation_id', activeAutomation.id)
                        .eq('recipient_ig_id', commenterId)
                        .eq('status', 'awaiting_opening_tap')
                        .maybeSingle();

                    const ageMs = existing
                        ? Date.now() - new Date(existing.updated_at).getTime()
                        : 0;

                    if (!existing || ageMs < OPENING_DEDUP_WINDOW_MS) {
                        console.log(`[Webhook] Opening gate dedup (Meta retry suspected, age=${ageMs}ms) for ${commenterId}`);
                        out.fired = true;
                        return out;
                    }

                    // Stale flow -- user re-engaging. UPDATE in place; the
                    // updated_at trigger will refresh the freshness clock.
                    // We also re-write link_dm_config in case the automation
                    // config has changed since the original opener.
                    const { error: refreshErr } = await supabase
                        .from('dm_followup_queue')
                        .update({
                            gate_message:   openingResolved,
                            nudge_message:  openingResolved,
                            link_dm_config: activeAutomation.dm_config,
                            retry_count:    0,
                        })
                        .eq('id', existing.id);

                    if (refreshErr) {
                        console.warn('[Webhook] Failed to refresh stale opening gate row:', refreshErr.message);
                        out.fired = true;
                        return out;
                    }

                    console.log(`[Webhook] Opening gate re-engaged (prev row was ${Math.round(ageMs/1000)}s stale) for ${commenterId}`);
                    openingGateClaimed = true;
                } else {
                    console.warn('[Webhook] Opening gate insert failed (falling through to normal DM):', openingEnqErr.message);
                    // Fall through to normal-flow path below.
                }
            } else {
                openingGateClaimed = true;
            }
        }

        if (!openingGateClaimed) {
            // Normal flow: INSERT dm_queue with scheduled_after held
            // HOLD_MS in the future. Cron filters by scheduled_after<=now
            // so it skips this row until we UPDATE below. That keeps the
            // DM from racing the comment reply we're about to send.
            const { error: enqErr } = await supabase.from('dm_queue').insert({
                user_id:              automation.user_id,
                account_id:           post.account_id,
                automation_id:        automation.id,
                post_id:              post.id,
                recipient_ig_id:      commenterId,
                recipient_username:   commenterUsername,
                recipient_first_name: out.firstName,
                comment_id:           commentId,
                comment_text:         commentText,
                platform,
                dm_type:              activeAutomation.dm_type,
                dm_config:            activeAutomation.dm_config,
                tracking_map:         trackingMap,
                user_plan:            userPlan,
                queue_reason:         'overflow',
                priority:             5,
                status:               'pending',
                scheduled_after:      new Date(Date.now() + HOLD_MS).toISOString(),
            });

            if (enqErr) {
                if (enqErr.code === '23505') {
                    console.log(`[Webhook] DM already queued (dedup race) for ${commenterId} on comment ${commentId}`);
                    out.fired = true;
                    return out;
                }
                throw enqErr;
            }
        }

        // ── Comment reply (only the dedup winner reaches here) ────
        // Atomic dedup above guarantees at most one public reply per
        // comment regardless of Meta webhook retries.
        const commentReplyEnabled = isBuilderV2
            ? Boolean(settingsConfig.replyPublicly)
            : (settingsConfig.commentReplyEnabled !== false);
        if (commentReplyEnabled) {
            let replyMsg = null;
            if (isBuilderV2 && Array.isArray(settingsConfig.publicReplies)) {
                const enabledReplies = settingsConfig.publicReplies
                    .filter((r) => r && r.enabled && typeof r.text === 'string' && r.text.trim());
                if (enabledReplies.length > 0) {
                    // Random pick so a fan commenting twice doesn't
                    // see the same reply both times.
                    replyMsg = enabledReplies[Math.floor(Math.random() * enabledReplies.length)].text;
                }
            }
            replyMsg = replyMsg
                || settingsConfig.replyMessage
                || settingsConfig.autoReplyText
                || 'Hey! Just sent you a DM -- check your inbox.';
            try {
                await replyToComment(commentId, resolveMessageVariables(replyMsg, context), token, useIgApi);
                console.log('[Webhook] Comment reply sent');
            } catch (replyErr) {
                console.warn('[Webhook] Comment reply failed (non-fatal):', replyErr.message);
            }
        }

        // ── Path-specific post-dedup work ─────────────────────────

        if (openingGateClaimed) {
            // Opening-gate path: send the button-template DM. Roll back
            // the inflight row on send failure so the user isn't stuck
            // awaiting_opening_tap with no DM received.
            try {
                await sendOpeningGateDM(
                    account.ig_user_id, commenterId, openingResolved,
                    openingBtnText, token,
                    !account.fb_page_access_token, commentId,
                );
                await supabase.from('dm_sent_log').insert({
                    automation_id:        activeAutomation.id,
                    post_id:              post.id,
                    recipient_ig_id:      commenterId,
                    recipient_username:   commenterUsername,
                    recipient_first_name: out.firstName,
                    comment_id:           commentId,
                    comment_text:         commentText,
                    status:               'sent',
                    platform,
                    sent_at:              new Date().toISOString(),
                });
                console.log(`[Webhook] Opening-gate DM sent for ${commenterId}; awaiting tap`);
            } catch (sendErr) {
                await supabase.from('dm_followup_queue').delete()
                    .eq('automation_id', activeAutomation.id)
                    .eq('recipient_ig_id', commenterId)
                    .eq('status', 'awaiting_opening_tap');
                console.warn('[Webhook] Opening-gate send failed:', sendErr.message);
            }
            out.fired = true;
            return out;
        }

        // Normal-flow path: activate the dm_queue row by UPDATEing
        // scheduled_after to now + delayMs. Cron then picks it up
        // immediately (or after delayMs if delayMessage is on). If
        // this UPDATE fails for any transient reason the row sits at
        // now+HOLD_MS and the natural cron tick picks it up after
        // 30s -- DM is delayed but not lost.
        await supabase.from('dm_queue').update({
            scheduled_after: new Date(Date.now() + delayMs).toISOString(),
        })
            .eq('automation_id', automation.id)
            .eq('recipient_ig_id', commenterId)
            .eq('comment_id', commentId)
            .eq('status', 'pending');

        console.log(`[Webhook] DM enqueued for ${commenterId}${abVariant ? ` (variant ${abVariant})` : ''}`);

        // Trigger immediate queue processing for non-delayed DMs so the
        // DM goes out within ~1-2s rather than waiting up to a minute
        // for the next natural cron tick.
        if (!delayMs) {
            const cronSecret = process.env.CRON_SECRET || '';
            after( async () => {
                try {
                    await fetch(`${appUrl}/api/cron/process-queue`, {
                        headers: { Authorization: `Bearer ${cronSecret}` },
                    });
                } catch (err) {
                    /* non-fatal - the natural cron will still pick it up */
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

        out.fired = true;
        return out;
    } catch (err) {
        console.error('[Webhook] Failed to enqueue DM:', err.message);
        await supabase.from('dm_sent_log').insert({
            automation_id:        automation.id,
            post_id:              post.id,
            recipient_ig_id:      commenterId,
            recipient_username:   commenterUsername,
            recipient_first_name: out.firstName,
            comment_id:           commentId,
            comment_text:         commentText,
            status:               'failed',
            error_message:        `enqueue failed: ${err.message}`,
            ab_variant:           abVariant,
            platform,
            sent_at:              new Date().toISOString(),
        });
        return out;
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

async function handleFollowUpAutomation(supabase, automation, post, commenterId, commentId, commentText, igSenderId, accessToken, trackingMap = {}, commenterUsername = null, platform = 'instagram', commenterFirstName = null) {
    const dmConfig = automation.dm_config;

    const { data: existing } = await supabase
        .from('dm_followup_queue').select('id, status')
        .eq('automation_id', automation.id).eq('recipient_ig_id', commenterId)
        .in('status', ['awaiting_confirmation']).maybeSingle();

    if (existing) {
        console.log('[Webhook] Follow-up already pending for this user — skipping');
        return;
    }

    const usernameForGate  = commenterUsername || 'there';
    const firstNameForGate = commenterFirstName || 'there';
    const gateMessage = resolveMessageVariables(
        dmConfig.gateMessage || 'Hey! Follow our account and reply YES to get the link \ud83d\ude0a',
        { username: usernameForGate, first_name: firstNameForGate },
    );

    try {
        // Private Reply (recipient.comment_id) bypasses the 24h messaging
        // window for the first comment-triggered DM. useIgApi stays at its
        // pre-existing default (false) — adding it isn't in scope here.
        // INSERT into dm_followup_queue FIRST -- partial unique index
        // idx_followup_queue_unique_inflight makes this the atomic dedup
        // gate so concurrent webhook deliveries can't fire a duplicate
        // gate DM. Send moves below the gate; rollback on send failure.
        const { error: enqErr } = await supabase.from('dm_followup_queue').insert({
            automation_id:         automation.id,
            account_id:            post.account_id,
            recipient_ig_id:       commenterId,
            ig_sender_id:          igSenderId,
            gate_message:          gateMessage,
            nudge_message:         dmConfig.nudgeMessage || "We couldn't verify your follow yet \ud83d\ude48",
            confirmation_keywords: ['yes', 'done', 'followed', 'ok'],
            max_retries:           dmConfig.maxRetries || 3,
            link_dm_type:          dmConfig.linkDmType || 'message_template',
            link_dm_config:        dmConfig.linkDmConfig || { message: dmConfig.linkMessage || '' },
        });
        if (enqErr) {
            if (enqErr.code === '23505') {
                console.log(`[Webhook] Follow-gate already in-flight (dedup race) for ${commenterId}`);
                return;
            }
            throw enqErr;
        }

        // Won the dedup race -- send the gate DM. On send failure, roll
        // back the inflight row so the user isn't stuck awaiting confirmation.
        try {
            await sendFollowGateDM(igSenderId, commenterId, gateMessage, accessToken, false, commentId);
        } catch (sendErr) {
            await supabase.from('dm_followup_queue').delete()
                .eq('automation_id', automation.id)
                .eq('recipient_ig_id', commenterId)
                .eq('status', 'awaiting_confirmation');
            throw sendErr;
        }

        await supabase.from('dm_sent_log').insert({
            automation_id:        automation.id, post_id: post.id,
            recipient_ig_id:      commenterId,   recipient_username: commenterUsername,
            recipient_first_name: commenterFirstName,
            comment_id:           commentId,
            comment_text:         commentText,   status: 'sent',
            platform,
            sent_at:              new Date().toISOString(),
        });

        console.log(`[Webhook] Follow-gate DM sent and queued for ${commenterId}`);
    } catch (err) {
        console.error('[Webhook] Failed to send follow-gate DM:', err.message);
        await supabase.from('dm_sent_log').insert({
            automation_id:        automation.id, post_id: post.id,
            recipient_ig_id:      commenterId,   recipient_username: commenterUsername,
            recipient_first_name: commenterFirstName,
            comment_id:           commentId,
            comment_text:         commentText,   status: 'failed',
            error_message:        err.message,
            platform,
            sent_at:              new Date().toISOString(),
        });
    }
}

// ─── Email Collector Comment Handler ─────────────────────────────────────────

async function handleEmailCollectorAutomation(supabase, automation, post, commenterId, commentId, commentText, igSenderId, accessToken, useIgApi = false, commenterUsername = null, platform = 'instagram', commenterFirstName = null) {
    const dmConfig = automation.dm_config;

    const { data: existing } = await supabase
        .from('email_collect_queue').select('id, status')
        .eq('automation_id', automation.id).eq('recipient_ig_id', commenterId)
        .eq('status', 'awaiting_email').maybeSingle();

    if (existing) {
        console.log('[Webhook/Email] Email collection already pending — skipping');
        return;
    }

    const usernameForAsk  = commenterUsername || 'there';
    const firstNameForAsk = commenterFirstName || 'there';
    // Resolve placeholders + apply branding so free users get the AutoDM
    // footer and Pro users get their custom branding (or none if cleared) \u2014
    // matching what every other DM type does.
    const userPlanForAsk = await getUserPlan(supabase, automation.user_id);
    const askMessage = applyBranding(
        resolveMessageVariables(
            dmConfig.emailAskMessage || 'Hey! Could you share your email address? \ud83d\udce7',
            { username: usernameForAsk, first_name: firstNameForAsk },
        ),
        dmConfig,
        userPlanForAsk,
    );

    try {
        // Private Reply for the comment-triggered first DM — bypasses the
        // 24h window the standard recipient.id path requires.
        // INSERT into email_collect_queue FIRST -- partial unique index
        // idx_email_queue_unique_inflight makes this the atomic dedup
        // gate so concurrent webhook deliveries can't fire a duplicate
        // email-ask DM. Send moves below the gate; rollback on failure.
        const { error: enqErr } = await supabase.from('email_collect_queue').insert({
            automation_id:        automation.id,
            account_id:           post.account_id,
            recipient_ig_id:      commenterId,
            ig_sender_id:         igSenderId,
            confirmation_message: dmConfig.emailConfirmMessage || '',
            status:               'awaiting_email',
        });
        if (enqErr) {
            if (enqErr.code === '23505') {
                console.log(`[Webhook/Email] Email collection already in-flight (dedup race) for ${commenterId}`);
                return;
            }
            throw enqErr;
        }

        // Won the dedup race -- send the email-ask DM. On send failure,
        // roll back the inflight row so the user isn't stuck awaiting_email.
        try {
            await sendTextDM(igSenderId, commenterId, askMessage, accessToken, useIgApi, commentId);
        } catch (sendErr) {
            await supabase.from('email_collect_queue').delete()
                .eq('automation_id', automation.id)
                .eq('recipient_ig_id', commenterId)
                .eq('status', 'awaiting_email');
            throw sendErr;
        }

        await supabase.from('dm_sent_log').insert({
            automation_id:        automation.id, post_id: post.id,
            recipient_ig_id:      commenterId,   recipient_username: commenterUsername,
            recipient_first_name: commenterFirstName,
            comment_id:           commentId,
            comment_text:         commentText,   status: 'sent',
            platform,
            sent_at:              new Date().toISOString(),
        });

        console.log(`[Webhook/Email] Email ask DM sent for ${commenterId}`);
    } catch (err) {
        console.error('[Webhook/Email] Failed to send email ask DM:', err.message);
        await supabase.from('dm_sent_log').insert({
            automation_id:        automation.id, post_id: post.id,
            recipient_ig_id:      commenterId,   recipient_username: commenterUsername,
            recipient_first_name: commenterFirstName,
            comment_id:           commentId,
            comment_text:         commentText,   status: 'failed',
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

        // recipient_username + recipient_first_name may have been captured on
        // the original ask DM \u2014 fall back to 'there' if missing (e.g. story-
        // mention edge cases).
        const { data: askLog } = await supabase
            .from('dm_sent_log').select('recipient_username, recipient_first_name')
            .eq('automation_id', queueEntry.automation_id)
            .eq('recipient_ig_id', senderId)
            .order('sent_at', { ascending: false }).limit(1).maybeSingle();
        const usernameForConfirm  = askLog?.recipient_username || 'there';
        const firstNameForConfirm = askLog?.recipient_first_name || 'there';

        const rawConfirm = queueEntry.confirmation_message ||
            `Thanks! \ud83c\udf89 We've saved your email ({email}) and will be in touch soon.`;
        const confirmMsg = applyBranding(
            resolveMessageVariables(rawConfirm, {
                username:   usernameForConfirm,
                first_name: firstNameForConfirm,
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
// ─── DM Auto Responder ───────────────────────────────────────────────────────
// Inbound DM (user-initiated, no story-reply context) gets matched
// against the user's active builder_v2 rows where templateType is
// 'dm-auto-responder'. First match (by trigger specificity) wins,
// same ranking rules as the comment path. We synthesize a comment_id
// from the inbound message id so dedup works even on retries.
async function handleDmAutoResponder(supabase, igAccountId, senderId, msgText, inboundMid) {
    if (!senderId || !msgText?.trim()) return false;

    // Look up the connected account to scope automations to this user.
    const { data: account } = await supabase
        .from('connected_accounts')
        .select('id, user_id, ig_user_id, fb_page_access_token, access_token, default_config')
        .eq('ig_user_id', igAccountId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!account) return false;

    const { data: candidates } = await supabase
        .from('dm_automations')
        .select('*')
        .eq('user_id', account.user_id)
        .eq('dm_type', 'builder_v2')
        .eq('is_active', true)
        .filter('settings_config->>templateType', 'eq', 'dm-auto-responder');
    if (!candidates || candidates.length === 0) return false;

    // Match: anyKeyword wins everything; otherwise need a keyword hit.
    const lowerText = msgText.toLowerCase().trim();
    const matchOne = (a) => {
        const tc = a.trigger_config || {};
        if (tc.anyKeyword) return true;
        const kws = (tc.keywords || []).map((k) => String(k).toLowerCase());
        return kws.some((kw) => kw && lowerText.includes(kw));
    };
    // Specificity rank — keyword automations beat any-keyword.
    const rank = (a) => (a.trigger_config?.anyKeyword ? 1 : 0);
    const matched = [...candidates].filter(matchOne).sort((x, y) => rank(x) - rank(y))[0];
    if (!matched) return false;

    // Dedup: synthesize a stable id so the same inbound DM doesn't
    // fire twice on a Meta retry. Falls through to mid → senderId+text.
    const syntheticCommentId = `dm_auto:${inboundMid || `${senderId}:${msgText.slice(0, 80)}`}`;

    const { data: alreadyLogged } = await supabase
        .from('dm_sent_log')
        .select('id')
        .eq('automation_id', matched.id)
        .eq('comment_id', syntheticCommentId)
        .maybeSingle();
    if (alreadyLogged) {
        console.log('[Webhook/DMAutoResponder] Already handled, skipping');
        return true;
    }

    // Reuse processAutomationForComment — synthesize a "post-less"
    // post object with just account_id so the existing code path
    // (billing gate, idempotency, enqueue) works without divergence.
    const fakePost = { id: null, account_id: account.id };

    try {
        await processAutomationForComment(
            supabase, fakePost, msgText, senderId, syntheticCommentId,
            'instagram', null, null, inboundMid, matched,
        );
        return true;
    } catch (err) {
        console.warn('[Webhook/DMAutoResponder] processing failed:', err.message);
        return false;
    }
}

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
        const result = await processAutomationForComment(
            supabase, post, text, senderId, syntheticCommentId, 'instagram', null, null, mid,
        );
        if (post.account_id) {
            await processGlobalTriggers(
                supabase, post, text, senderId, syntheticCommentId, 'instagram', result.fired, null, result.firstName,
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
        .eq('ig_user_id', igAccountId).eq('is_active', true)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();

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
        // {first_name} pulls the display name via the same lookup helper as
        // comment-trigger DMs; falls back to handle, then to "there".
        const mentionerFirstName = await fetchIgUserFirstName(mentionerId, mentionToken, useIgApi);
        const usernameForMention  = mentionerHandle || 'there';
        const firstNameForMention = mentionerFirstName || 'there';
        const message  = applyBranding(
            resolveMessageVariables(mentionConfig.message, {
                username:   usernameForMention,
                first_name: firstNameForMention,
            }),
            mentionConfig,
            mentionUserPlan,
        );
        await sendTextDM(account.ig_user_id, mentionerId, message, mentionToken, useIgApi);

        await supabase.from('dm_sent_log').insert({
            automation_id:        null,
            post_id:              null,
            recipient_ig_id:      mentionerId,
            recipient_username:   mentionerHandle,
            recipient_first_name: mentionerFirstName,
            comment_id:           media_id,
            comment_text:         '[story mention]',
            status:               'sent',
            platform:             'instagram',  // Story mentions are Instagram-only
            sent_at:              new Date().toISOString(),
        });

        console.log(`[Webhook/Mention] \u2705 DM sent to ${mentionerId}`);
    } catch (err) {
        console.error('[Webhook/Mention] Failed:', err.message);
    }
}

// Story mention delivered as a DM (current IG Messaging API path).
// Meta sends a `messages` webhook with `attachments[0].type='story_mention'`
// and no text body. The mentioner is `senderId`; there's no media_id on
// this path (the attachment payload.url is an opaque CDN URL), so dedup
// uses a 5-minute window per recipient instead of (recipient, media_id).
// That window also catches Meta retries on the same mention and any
// overlap with the legacy mentions-change-field handler above.
async function handleStoryMentionDM(supabase, igAccountId, senderId, inboundMid) {
    console.log(`[Webhook/MentionDM] Triggered: igAccount=${igAccountId} sender=${senderId} mid=${inboundMid}`);

    // Account lookup. Match on either column -- IG Business Login stores
    // the value in ig_user_id; an FB-linked path may deliver the IG event
    // under the Page's id which lives in fb_page_id. We do NOT filter by
    // is_active here: the queue processor doesn't, so excluding inactive
    // rows would mean normal comment-triggered DMs succeed while story
    // mentions silently fail (the bug you hit). When multiple rows match
    // we prefer the active one but fall back to the most recent overall.
    const { data: matches } = await supabase
        .from('connected_accounts')
        .select('id, user_id, access_token, fb_page_access_token, ig_user_id, fb_page_id, default_config, is_active')
        .or(`ig_user_id.eq.${igAccountId},fb_page_id.eq.${igAccountId}`)
        .order('updated_at', { ascending: false });

    if (!matches || matches.length === 0) {
        // Diagnostic: dump a sample of stored ids so it's obvious from the
        // log whether the column even has the value we're querying against.
        const { data: sample } = await supabase
            .from('connected_accounts')
            .select('id, ig_user_id, fb_page_id, is_active')
            .order('updated_at', { ascending: false })
            .limit(5);
        const stored = (sample || []).map((s) =>
            `{id:${s.id} ig:${s.ig_user_id} fb:${s.fb_page_id} active:${s.is_active}}`
        ).join(' ');
        console.log(`[Webhook/MentionDM] No row matched queried igAccountId=${igAccountId}. Sample of recent rows: ${stored || '(none)'} -- skipping`);
        return;
    }

    const account = matches.find((m) => m.is_active === true) || matches[0];
    console.log(`[Webhook/MentionDM] Account row matched: id=${account.id} stored.ig_user_id=${account.ig_user_id} stored.fb_page_id=${account.fb_page_id} is_active=${account.is_active} (queried=${igAccountId})`);
    if (!account.is_active) {
        console.warn(`[Webhook/MentionDM] Using INACTIVE account row id=${account.id} -- consider reconnecting in the dashboard so tokens stay fresh`);
    }

    const mentionConfig = account.default_config?.mentionDm;
    if (!mentionConfig?.enabled || !mentionConfig?.message?.trim()) {
        console.log(`[Webhook/MentionDM] No mentionDm config or disabled -- skipping`);
        return;
    }

    // Pro gate -- Story Mention Auto-DM is Pro/Trial only. Saved configs
    // from a previously-Pro account stop firing on downgrade.
    const userPlan = await getUserPlan(supabase, account.user_id);
    if (userPlan !== 'pro' && userPlan !== 'business' && userPlan !== 'trial') {
        console.log(`[Webhook/MentionDM] Skipping -- user is on ${userPlan} plan`);
        return;
    }

    // Cross-path dedup window.
    const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: recent } = await supabase
        .from('dm_sent_log').select('id')
        .is('automation_id', null)
        .eq('recipient_ig_id', senderId)
        .eq('comment_text', '[story mention]')
        .gte('sent_at', cutoff)
        .limit(1);
    if (recent && recent.length > 0) {
        console.log(`[Webhook/MentionDM] Recent reply already sent to ${senderId} -- skipping`);
        return;
    }

    // Monthly billing limit (same gate as the comment-trigger path)
    const dmLimit = getDmLimit(userPlan);
    if (dmLimit !== null) {
        const mc = await getMonthlyDmCount(supabase, account.user_id);
        if (mc >= dmLimit) {
            console.log(`[Webhook/MentionDM] Monthly DM limit reached -- skipping`);
            return;
        }
    }

    const mentionToken = account.fb_page_access_token || account.access_token;
    const useIgApi     = !account.fb_page_access_token;

    // Username + first-name lookup in a single Graph call so we can do
    // {username} and {first_name} substitution without surfacing the
    // numeric IGSID. Best-effort -- failure falls back to "there".
    let mentionerHandle    = null;
    let mentionerFirstName = null;
    try {
        const userRes = await fetch(
            `${graphBase(useIgApi)}/${senderId}?fields=username,name&access_token=${encodeURIComponent(mentionToken)}`
        );
        if (userRes.ok) {
            const userData = await userRes.json();
            mentionerHandle    = userData?.username || null;
            mentionerFirstName = extractFirstName(userData?.name);
        }
    } catch { /* non-fatal */ }

    const message = applyBranding(
        resolveMessageVariables(mentionConfig.message, {
            username:   mentionerHandle    || 'there',
            first_name: mentionerFirstName || 'there',
        }),
        mentionConfig,
        userPlan,
    );

    try {
        await sendTextDM(account.ig_user_id, senderId, message, mentionToken, useIgApi);
        await supabase.from('dm_sent_log').insert({
            automation_id:        null,
            post_id:              null,
            recipient_ig_id:      senderId,
            recipient_username:   mentionerHandle,
            recipient_first_name: mentionerFirstName,
            comment_id:           inboundMid ? `story_mention:${inboundMid}` : null,
            comment_text:         '[story mention]',
            status:               'sent',
            platform:             'instagram',
            sent_at:              new Date().toISOString(),
        });
        console.log(`[Webhook/MentionDM] Reply sent to ${senderId}`);
    } catch (err) {
        console.error('[Webhook/MentionDM] Send failed:', err.message);
    }
}

// ─── Global Triggers ─────────────────────────────────────────────────────────

async function processGlobalTriggers(supabase, post, commentText, commenterId, commentId, platform, perPostFired = false, commenterUsername = null, commenterFirstName = null) {
    const { data: globalAutomations } = await supabase
        .from('global_automations').select('*')
        .eq('account_id', post.account_id).eq('is_active', true);

    if (!globalAutomations || globalAutomations.length === 0) return;

    const { data: account } = await supabase
        .from('connected_accounts')
        .select('access_token, fb_page_access_token, ig_user_id, fb_page_id')
        .eq('id', post.account_id).single();
    if (!account) return;

    // If the entry handler didn't pass a firstName (e.g. processAutomationForComment
    // bailed before its account-load + Graph API fetch), do the lookup here for IG
    // commenters so global automations also get real {first_name} substitution.
    if (!commenterFirstName && platform === 'instagram') {
        const lookupToken = account.fb_page_access_token || account.access_token;
        const useIgApiForLookup = !account.fb_page_access_token;
        commenterFirstName = await fetchIgUserFirstName(commenterId, lookupToken, useIgApiForLookup);
    }

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
                user_id:              ga.user_id,
                account_id:           post.account_id,
                automation_id:        ga.id,
                post_id:              post.id,
                recipient_ig_id:      commenterId,
                recipient_username:   commenterUsername,
                recipient_first_name: commenterFirstName,
                comment_id:           commentId,
                comment_text:         commentText,
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
    console.log('[IceBreaker] handleIceBreakerResponse entry ' + JSON.stringify({
        igAccountId, senderId, payload,
        startsWithPrefix: !!payload && payload.startsWith('ICE_BREAKER_'),
    }));

    if (!payload || !payload.startsWith('ICE_BREAKER_')) {
        console.log('[IceBreaker] Rejecting: payload does not start with ICE_BREAKER_');
        return false;
    }

    const { data: account, error: accountErr } = await supabase
        .from('connected_accounts')
        .select('id, user_id, access_token, ig_user_id, default_config')
        .eq('ig_user_id', igAccountId).eq('is_active', true)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();

    if (accountErr) console.warn('[IceBreaker] connected_accounts lookup error: ' + accountErr.message);
    if (!account) {
        console.warn('[IceBreaker] No active connected_account for ig_user_id=' + igAccountId);
        return false;
    }

    // Runtime Pro gate — Welcome Openers is a Pro feature. If the user
    // downgrades, their saved openers stop responding (they can still see
    // and delete them via /welcome-openers).
    const userPlan = await getUserPlan(supabase, account.user_id);
    if (userPlan !== 'pro' && userPlan !== 'business' && userPlan !== 'trial') {
        console.log('[IceBreaker] Skipping — user is on ' + userPlan + ' plan');
        return false;
    }

    const iceBreakers = (account.default_config && account.default_config.iceBreakers) || [];
    console.log('[IceBreaker] Stored iceBreakers: ' + JSON.stringify(
        iceBreakers.map((ib) => ({
            title:                  ib.title,
            payload:                ib.payload,
            responseMessagePreview: (ib.responseMessage || '').slice(0, 60),
        }))
    ));

    const matched = iceBreakers.find((ib) => ib.payload === payload);
    if (!matched) {
        console.warn('[IceBreaker] No payload match. inbound=' + payload +
            ' configuredPayloads=' + JSON.stringify(iceBreakers.map((ib) => ib.payload)));
        return false;
    }
    if (!matched.responseMessage || !matched.responseMessage.trim()) {
        console.warn('[IceBreaker] Matched but responseMessage is empty: ' + JSON.stringify(matched));
        return false;
    }

    try {
        console.log('[IceBreaker] Sending response DM ' + JSON.stringify({
            from:    account.ig_user_id,
            to:      senderId,
            title:   matched.title,
            payload: matched.payload,
            preview: matched.responseMessage.slice(0, 80),
        }));
        const dmResult = await sendTextDM(account.ig_user_id, senderId, matched.responseMessage, account.access_token, true);
        console.log('[IceBreaker] sendTextDM returned: ' + JSON.stringify(dmResult));
        console.log('[IceBreaker] Response sent for "' + matched.title + '" to ' + senderId);
        return true;
    } catch (err) {
        console.error('[IceBreaker] Failed to send response: ' + err.message, err.stack);
        return false;
    }
}

// Fallback path for ice-breaker taps that arrive without quick_reply.payload.
// Matches the inbound message text against each configured ice-breaker
// question. Returns true if a match fired so the dispatcher stops.
//
// Normalisation: lowercase + trim + strip trailing punctuation. Covers the
// common variations Meta delivers (with / without a question mark, etc).
async function handleIceBreakerByText(supabase, igAccountId, senderId, msgText) {
    console.log('[IceBreaker:textMatch] entry ' + JSON.stringify({ igAccountId, senderId, msgText }));

    const { data: account } = await supabase
        .from('connected_accounts')
        .select('id, user_id, access_token, ig_user_id, default_config')
        .eq('ig_user_id', igAccountId).eq('is_active', true)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (!account) {
        console.warn('[IceBreaker:textMatch] No active connected_account for ig_user_id=' + igAccountId);
        return false;
    }

    const iceBreakers = (account.default_config && account.default_config.iceBreakers) || [];
    if (iceBreakers.length === 0) {
        console.log('[IceBreaker:textMatch] No ice breakers configured');
        return false;
    }

    const normalise = (str) => (str || '').toLowerCase().trim().replace(/[?!.,\s]+$/g, '');
    const target    = normalise(msgText);
    if (!target) return false;

    // FIX: stored field is `title`, NOT `question`. The Meta payload uses
    // `question` in the wire format but we persist locally as `title`.
    // Previously this read `ib.question` which is always undefined.
    const matched = iceBreakers.find((ib) => normalise(ib.title) === target);

    console.log('[IceBreaker:textMatch] target="' + target + '" matched=' + (matched ? 'yes' : 'no') +
        ' candidates=' + JSON.stringify(iceBreakers.map((ib) => normalise(ib.title))));

    if (!matched || !matched.responseMessage || !matched.responseMessage.trim()) {
        return false;
    }

    const userPlan = await getUserPlan(supabase, account.user_id);
    if (userPlan !== 'pro' && userPlan !== 'business' && userPlan !== 'trial') {
        console.log('[IceBreaker:textMatch] Skipping — user is on ' + userPlan + ' plan');
        return false;
    }

    try {
        console.log('[IceBreaker:textMatch] Sending response DM ' + JSON.stringify({
            from: account.ig_user_id, to: senderId, title: matched.title,
            preview: matched.responseMessage.slice(0, 80),
        }));
        const dmResult = await sendTextDM(account.ig_user_id, senderId, matched.responseMessage, account.access_token, true);
        console.log('[IceBreaker:textMatch] sendTextDM returned: ' + JSON.stringify(dmResult));
        return true;
    } catch (err) {
        console.error('[IceBreaker:textMatch] Failed to send response: ' + err.message, err.stack);
        return false;
    }
}
