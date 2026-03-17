import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * POST /api/broadcast/start
 *
 * Body: {
 *   postId:           uuid         — our DB post ID
 *   dmType:           string       — 'message_template' | 'button_template' | 'multi_cta'
 *   dmConfig:         object       — DM payload config
 *   rateLimitPerMin:  number       — 1–60 (default 20)
 * }
 *
 * 1. Verifies post belongs to user
 * 2. Fetches all comments from IG Graph API (paginates until done)
 * 3. Deduplicates commenter IDs, excludes own account
 * 4. Checks which commenters already received a DM from this automation (skips them)
 * 5. Inserts broadcast_job + broadcast_recipients rows
 * 6. Returns job ID immediately — processing happens via cron
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { postId, dmType, dmConfig, rateLimitPerMin = 20 } = body;

    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    if (!dmType) return NextResponse.json({ error: 'dmType is required' }, { status: 400 });
    if (!dmConfig) return NextResponse.json({ error: 'dmConfig is required' }, { status: 400 });

    // ── Verify post + fetch connected account ─────────────────────
    const { data: post } = await supabase
        .from('instagram_posts')
        .select('id, ig_post_id, account_id, connected_accounts!inner(user_id, ig_user_id, access_token, fb_page_access_token)')
        .eq('id', postId)
        .single();

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (post.connected_accounts.user_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const account     = post.connected_accounts;
    const accessToken = account.fb_page_access_token || account.access_token;
    const igAccountId = account.ig_user_id;

    // ── Guard: no concurrent running job for this post ────────────
    const { data: existing } = await supabase
        .from('broadcast_jobs')
        .select('id, status')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .in('status', ['pending', 'running'])
        .maybeSingle();

    if (existing) {
        return NextResponse.json(
            { error: 'A broadcast is already running for this post. Pause or cancel it first.' },
            { status: 409 },
        );
    }

    // ── Fetch all comments from Instagram Graph API ───────────────
    const commenterIds = await fetchAllCommenters(post.ig_post_id, accessToken, igAccountId);

    if (commenterIds.length === 0) {
        return NextResponse.json({ error: 'No comments found on this post.' }, { status: 422 });
    }

    // ── Get the automation ID for skip-check ──────────────────────
    const { data: automation } = await supabase
        .from('dm_automations')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

    // ── Find who already got a DM (so we can skip them) ──────────
    let alreadySentSet = new Set();
    if (automation?.id) {
        const { data: prevLogs } = await supabase
            .from('dm_sent_log')
            .select('recipient_ig_id')
            .eq('automation_id', automation.id)
            .eq('status', 'sent')
            .in('recipient_ig_id', commenterIds);

        for (const row of (prevLogs || [])) {
            alreadySentSet.add(row.recipient_ig_id);
        }
    }

    const newRecipients  = commenterIds.filter((id) => !alreadySentSet.has(id));
    const skippedCount   = commenterIds.length - newRecipients.length;

    if (newRecipients.length === 0) {
        return NextResponse.json({
            error: `All ${commenterIds.length} commenter(s) already received a DM. No new recipients to send to.`,
        }, { status: 422 });
    }

    // ── Create the job (service role to insert access_token) ──────
    const service = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data: job, error: jobErr } = await service
        .from('broadcast_jobs')
        .insert({
            user_id:           user.id,
            automation_id:     automation?.id || null,
            post_id:           postId,
            ig_post_id:        post.ig_post_id,
            ig_account_id:     igAccountId,
            access_token:      accessToken,
            dm_type:           dmType,
            dm_config:         dmConfig,
            status:            'running',
            total_recipients:  newRecipients.length,
            skipped_count:     skippedCount,
            rate_limit_per_min: Math.min(Math.max(rateLimitPerMin, 1), 60),
            started_at:        new Date().toISOString(),
        })
        .select('id')
        .single();

    if (jobErr || !job) {
        console.error('[Broadcast/start] Job insert error:', jobErr?.message);
        return NextResponse.json({ error: 'Failed to create broadcast job' }, { status: 500 });
    }

    // ── Insert recipients in batches of 500 ──────────────────────
    const BATCH = 500;
    for (let i = 0; i < newRecipients.length; i += BATCH) {
        const chunk = newRecipients.slice(i, i + BATCH).map((id) => ({
            job_id:          job.id,
            recipient_ig_id: id,
            status:          'pending',
        }));
        const { error: recErr } = await service
            .from('broadcast_recipients')
            .insert(chunk);
        if (recErr) console.warn('[Broadcast/start] Recipient insert batch error:', recErr.message);
    }

    return NextResponse.json({
        success: true,
        jobId:          job.id,
        totalRecipients: newRecipients.length,
        skippedCount,
    });
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Paginate through all comments on an IG post and return unique commenter IDs.
 * Excludes the account owner's own ID.
 * Capped at 5,000 unique commenters for edge memory safety.
 */
async function fetchAllCommenters(igMediaId, accessToken, ownerIgId) {
    const seen = new Set();
    const MAX  = 5_000;

    let url = `${GRAPH_BASE}/${igMediaId}/comments`
        + `?fields=id,from`
        + `&limit=100`
        + `&access_token=${encodeURIComponent(accessToken)}`;

    while (url && seen.size < MAX) {
        let data;
        try {
            const res = await fetch(url);
            if (!res.ok) break;
            data = await res.json();
        } catch {
            break;
        }

        for (const comment of (data.data || [])) {
            const fromId = comment.from?.id;
            if (fromId && fromId !== ownerIgId) {
                seen.add(fromId);
            }
        }

        url = data.paging?.next || null;
    }

    return Array.from(seen);
}
