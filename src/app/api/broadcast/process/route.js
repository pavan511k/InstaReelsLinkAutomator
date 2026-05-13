import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    sendTextDM, sendButtonTemplateDM, sendMultiCtaDM, MetaApiError,
    applyBranding, resolveMessageVariables,
} from '@/lib/send-dm';
import { getEffectivePlan } from '@/lib/plans';

// Meta error codes that mean "slow down" — not a permanent failure
const THROTTLE_CODES = new Set([4, 17, 613]);

// Backoff schedule (ms) — indexed by throttle count (0-based)
const THROTTLE_BACKOFF_MS = [5, 10, 20, 40, 60].map((m) => m * 60_000);

const isThrottleError = (err) =>
    err instanceof MetaApiError && THROTTLE_CODES.has(err.code);

const parseThrottleState = (msg) => {
    try { return JSON.parse(msg); } catch { return null; }
};

const buildThrottleState = (count) => {
    const backoffMs = THROTTLE_BACKOFF_MS[Math.min(count - 1, THROTTLE_BACKOFF_MS.length - 1)];
    return JSON.stringify({ type: 'throttle', until: Date.now() + backoffMs, count, backoffMs });
};

const MAX_RETRIES = 3; // attempts after the initial send before permanent failure

function createServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

/**
 * GET /api/broadcast/process
 *
 * Cron endpoint — called every 5 minutes by Vercel.
 * For each running broadcast job:
 *   1. Calculates how many DMs can be sent in this batch (rate_limit_per_min × 5)
 *   2. Fetches that many 'pending' recipients
 *   3. Sends DMs, records results
 *   4. Updates job counters
 *   5. Marks job 'completed' when all recipients are processed
 *
 * Uses Node runtime (not edge) — needs longer execution time for large batches.
 */
export async function GET(request) {
    // Verify cron secret — fail closed if not configured
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[Broadcast/process] CRON_SECRET not configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const now      = new Date().toISOString();

    // ── Find all running + throttled jobs ────────────────────────
    const { data: runningJobs } = await supabase
        .from('broadcast_jobs')
        .select('*')
        .in('status', ['running', 'throttled'])
        .order('started_at', { ascending: true })
        .limit(10); // process up to 10 concurrent jobs per invocation

    if (!runningJobs || runningJobs.length === 0) {
        return NextResponse.json({ processed: 0, message: 'No running broadcast jobs' });
    }

    let totalSent = 0;

    for (const job of runningJobs) {
        try {
            const sentInJob = await processJob(supabase, job);
            totalSent += sentInJob;
        } catch (err) {
            console.error(`[Broadcast/process] Job ${job.id} error:`, err.message);
            // Mark job failed
            await supabase
                .from('broadcast_jobs')
                .update({ status: 'failed', error_message: err.message, updated_at: now })
                .eq('id', job.id);
        }
    }

    return NextResponse.json({
        processed: runningJobs.length,
        dmsSent:   totalSent,
    });
}

async function processJob(supabase, job) {
    const now = new Date().toISOString();

    // ── Throttled job: check if backoff has expired ───────────────
    if (job.status === 'throttled') {
        const state = parseThrottleState(job.error_message);
        if (state?.until && Date.now() < state.until) {
            const waitSecs = Math.ceil((state.until - Date.now()) / 1000);
            console.log(`[Broadcast/process] Job ${job.id} throttled for ${waitSecs}s more, skipping`);
            return 0;
        }
        // Backoff expired — clear throttle state and continue as running
        await supabase
            .from('broadcast_jobs')
            .update({ status: 'running', error_message: null, updated_at: now })
            .eq('id', job.id);
        job = { ...job, status: 'running', error_message: null };
    }

    // Batch size: rate_limit_per_min × 5 (cron runs every 5 min), cap at 100
    const batchSize = Math.min(job.rate_limit_per_min * 5, 100);

    // ── Fetch next batch of pending recipients ────────────────────
    // Order retry_count ASC so fresh recipients are processed before retries.
    const { data: recipients } = await supabase
        .from('broadcast_recipients')
        .select('id, recipient_ig_id, recipient_username, retry_count')
        .eq('job_id', job.id)
        .eq('status', 'pending')
        .order('retry_count', { ascending: true })
        .order('id',          { ascending: true })
        .limit(batchSize);

    if (!recipients || recipients.length === 0) {
        // No more pending — mark completed
        await supabase
            .from('broadcast_jobs')
            .update({ status: 'completed', completed_at: now, updated_at: now })
            .eq('id', job.id);
        console.log(`[Broadcast/process] Job ${job.id} completed`);
        return 0;
    }

    let sent = 0, failed = 0, processedThisBatch = 0, wasThrottled = false;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    // Fetch the owner's plan once per batch — applyBranding gates branding
    // on the plan: free plans get the minimal "— autodm.pro" tag, Pro plans
    // get their custom branding string (if set) or nothing. Falls back to
    // 'free' if the row is missing.
    let userPlan = 'free';
    try {
        const { data: planRow } = await supabase
            .from('user_plans')
            .select('plan, plan_expires_at, trial_ends_at')
            .eq('user_id', job.user_id)
            .maybeSingle();
        userPlan = getEffectivePlan(planRow);
    } catch { /* non-fatal */ }

    // Build tracking map for this job's DM config
    let trackingMap = {};
    try {
        const { data: linkCodes } = await supabase
            .from('dm_link_codes')
            .select('code, original_url')
            .eq('automation_id', job.automation_id);
        for (const row of (linkCodes || [])) {
            trackingMap[row.original_url] = `${appUrl}/r/${row.code}`;
        }
    } catch { /* non-fatal */ }

    // ── Send DMs with inter-message delay ─────────────────────────
    const delayMs = Math.max(Math.floor(60_000 / job.rate_limit_per_min), 500);

    for (let i = 0; i < recipients.length; i++) {
        const recipient   = recipients[i];
        let recipientStatus = 'sent';
        let errorMsg        = null;
        let requeued        = false;

        try {
            await sendBroadcastDM(
                job.ig_account_id,
                recipient.recipient_ig_id,
                job.access_token,
                job.dm_type,
                job.dm_config,
                trackingMap,
                job.use_ig_api ?? false,
                recipient.recipient_username || 'there',
                userPlan,
            );
            sent++;
            processedThisBatch++;

            if (job.automation_id) {
                await supabase.from('dm_sent_log').insert({
                    automation_id:   job.automation_id,
                    post_id:         job.post_id,
                    recipient_ig_id: recipient.recipient_ig_id,
                    comment_id:      null,
                    comment_text:    '[Broadcast]',
                    status:          'sent',
                    platform:        (job.use_ig_api ?? false) ? 'instagram' : 'facebook',
                    sent_at:         new Date().toISOString(),
                });
            }
        } catch (err) {
            if (isThrottleError(err)) {
                // Leave this recipient as 'pending' — it will be retried after backoff
                const prevState     = parseThrottleState(job.error_message);
                const throttleCount = (prevState?.count || 0) + 1;
                await supabase
                    .from('broadcast_jobs')
                    .update({
                        status:          'throttled',
                        error_message:   buildThrottleState(throttleCount),
                        sent_count:      (job.sent_count      || 0) + sent,
                        failed_count:    (job.failed_count    || 0) + failed,
                        processed_count: (job.processed_count || 0) + processedThisBatch,
                        updated_at:      now,
                    })
                    .eq('id', job.id);
                console.warn(`[Broadcast/process] Job ${job.id} throttled (attempt ${throttleCount}):`, err.message);
                wasThrottled = true;
                break; // leave recipient pending — skip update below
            }

            const currentRetry = recipient.retry_count || 0;
            if (currentRetry < MAX_RETRIES) {
                // Re-queue: increment retry_count, leave status as pending
                await supabase
                    .from('broadcast_recipients')
                    .update({
                        retry_count:   currentRetry + 1,
                        error_message: err.message?.slice(0, 500) || 'Unknown error',
                        processed_at:  new Date().toISOString(),
                    })
                    .eq('id', recipient.id);
                console.warn(`[Broadcast/process] Retry ${currentRetry + 1}/${MAX_RETRIES} queued for ${recipient.recipient_ig_id}:`, err.message);
                requeued = true; // skip terminal update below
            } else {
                // Retry budget exhausted — permanent failure
                console.warn(`[Broadcast/process] Permanent failure for ${recipient.recipient_ig_id} after ${MAX_RETRIES} retries:`, err.message);
                recipientStatus = 'failed';
                errorMsg        = err.message?.slice(0, 500) || 'Unknown error';
                failed++;
                processedThisBatch++;
            }
        }

        // Write terminal state for sent / permanently-failed recipients
        if (!wasThrottled && !requeued) {
            await supabase
                .from('broadcast_recipients')
                .update({
                    status:        recipientStatus,
                    error_message: errorMsg,
                    processed_at:  new Date().toISOString(),
                })
                .eq('id', recipient.id);
        }

        if (i < recipients.length - 1) await sleep(delayMs);
    }

    if (wasThrottled) return sent;

    // ── Update job counters (non-throttled path) ──────────────────
    // processedThisBatch only counts terminal outcomes (sent + permanent-failed),
    // not recipients that were re-queued for retry.
    const newProcessed = (job.processed_count || 0) + processedThisBatch;
    const newSent      = (job.sent_count      || 0) + sent;
    const newFailed    = (job.failed_count    || 0) + failed;
    const isDone       = newProcessed >= job.total_recipients;

    await supabase
        .from('broadcast_jobs')
        .update({
            processed_count: newProcessed,
            sent_count:      newSent,
            failed_count:    newFailed,
            status:          isDone ? 'completed' : 'running',
            completed_at:    isDone ? new Date().toISOString() : null,
            updated_at:      now,
        })
        .eq('id', job.id);

    const requeued = recipients.length - processedThisBatch;
    console.log(`[Broadcast/process] Job ${job.id}: sent=${sent}, failed=${failed}, requeued=${requeued}, done=${isDone}`);
    return sent;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendBroadcastDM(igAccountId, recipientId, accessToken, dmType, dmConfig, trackingMap, useIApi = false, personalName = 'there', plan = 'free') {
    // Variable substitution + brand-suffix application were missing on the
    // broadcast path entirely — the live DM was a raw copy of dm_config.message
    // while the in-app preview ran both transforms, so creators saw "{first_name}"
    // and the AutoDM/custom-suffix line vanish. Apply the same pipeline used by
    // sendAutomatedDM so preview and delivery match.
    const context = { username: personalName, first_name: personalName };

    switch (dmType) {
        case 'button_template':
            return sendButtonTemplateDM(igAccountId, recipientId, dmConfig.slides || [], accessToken, trackingMap, plan, useIApi, dmConfig);

        case 'multi_cta': {
            const message = resolveMessageVariables(dmConfig.message || '', context);
            return sendMultiCtaDM(igAccountId, recipientId, message, dmConfig.buttons || [], accessToken, trackingMap, plan, useIApi, dmConfig);
        }

        case 'message_template':
        default: {
            const message = applyBranding(
                resolveMessageVariables(dmConfig.message || '', context),
                dmConfig,
                plan,
            );
            return sendTextDM(igAccountId, recipientId, message, accessToken, useIApi);
        }
    }
}
