import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    sendTextDM, sendButtonTemplateDM, sendMultiCtaDM,
} from '@/lib/send-dm';

const GRAPH_API_VERSION = 'v21.0';

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
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const auth = request.headers.get('authorization');
        if (auth !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const supabase = createServiceClient();
    const now      = new Date().toISOString();

    // ── Find all running jobs ─────────────────────────────────────
    const { data: runningJobs } = await supabase
        .from('broadcast_jobs')
        .select('*')
        .eq('status', 'running')
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
    // Batch size: rate_limit_per_min × 5 (cron runs every 5 min)
    // Cap at 100 per invocation for safety
    const batchSize = Math.min(job.rate_limit_per_min * 5, 100);
    const now = new Date().toISOString();

    // ── Fetch next batch of pending recipients ────────────────────
    const { data: recipients } = await supabase
        .from('broadcast_recipients')
        .select('id, recipient_ig_id')
        .eq('job_id', job.id)
        .eq('status', 'pending')
        .order('id', { ascending: true })
        .limit(batchSize);

    if (!recipients || recipients.length === 0) {
        // No more pending — mark completed
        await supabase
            .from('broadcast_jobs')
            .update({
                status:       'completed',
                completed_at: now,
                updated_at:   now,
            })
            .eq('id', job.id);
        console.log(`[Broadcast/process] Job ${job.id} completed`);
        return 0;
    }

    let sent = 0, failed = 0;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

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
    // Space out sends within the batch to avoid burst rate limiting.
    // Delay = 60_000ms / rate_limit_per_min between each DM.
    const delayMs = Math.max(Math.floor(60_000 / job.rate_limit_per_min), 500);

    for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        let recipientStatus = 'sent';
        let errorMsg = null;

        try {
            await sendBroadcastDM(
                job.ig_account_id,
                recipient.recipient_ig_id,
                job.access_token,
                job.dm_type,
                job.dm_config,
                trackingMap,
            );
            sent++;

            // Log to dm_sent_log so it shows in the Logs page
            if (job.automation_id) {
                await supabase.from('dm_sent_log').insert({
                    automation_id:   job.automation_id,
                    post_id:         job.post_id,
                    recipient_ig_id: recipient.recipient_ig_id,
                    comment_id:      null,
                    comment_text:    '[Broadcast]',
                    status:          'sent',
                    sent_at:         new Date().toISOString(),
                });
            }
        } catch (err) {
            console.warn(`[Broadcast/process] Failed to DM ${recipient.recipient_ig_id}:`, err.message);
            recipientStatus = 'failed';
            errorMsg        = err.message?.slice(0, 500) || 'Unknown error';
            failed++;
        }

        // Update recipient record
        await supabase
            .from('broadcast_recipients')
            .update({
                status:       recipientStatus,
                error_message: errorMsg,
                processed_at: new Date().toISOString(),
            })
            .eq('id', recipient.id);

        // Inter-message delay (skip delay after last item in batch)
        if (i < recipients.length - 1) {
            await sleep(delayMs);
        }
    }

    // ── Update job counters ────────────────────────────────────────
    const newProcessed = (job.processed_count || 0) + recipients.length;
    const newSent      = (job.sent_count     || 0) + sent;
    const newFailed    = (job.failed_count   || 0) + failed;

    const isDone = newProcessed >= job.total_recipients;
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

    console.log(`[Broadcast/process] Job ${job.id}: sent=${sent}, failed=${failed}, done=${isDone}`);
    return sent;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendBroadcastDM(igAccountId, recipientId, accessToken, dmType, dmConfig, trackingMap) {
    switch (dmType) {
        case 'button_template':
            return sendButtonTemplateDM(igAccountId, recipientId, dmConfig.slides || [], accessToken, trackingMap);

        case 'multi_cta':
            return sendMultiCtaDM(igAccountId, recipientId, dmConfig.message || '', dmConfig.buttons || [], accessToken, trackingMap);

        case 'message_template':
        default:
            return sendTextDM(igAccountId, recipientId, dmConfig.message || '', accessToken);
    }
}
