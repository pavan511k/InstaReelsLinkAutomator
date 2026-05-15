/**
 * Backfill — fetch historical comments from a post and enqueue DMs for
 * everyone whose comment matches the automation's trigger.
 *
 * This used to live as inline logic inside POST /api/automations/backfill,
 * which /api/automations called over a server-to-server HTTP fetch with a
 * shared-secret header. That round-trip was unreliable on serverless (the
 * fire-and-forget fetch could be killed before completing) and depended on
 * NEXT_PUBLIC_APP_URL pointing back at the same instance. Both pain
 * points disappear by calling this function in-process.
 *
 * Callers:
 *   • POST /api/automations — invokes via `after()` from next/server so the
 *     work runs after the response is sent but before the function exits.
 *   • POST /api/automations/backfill — used by the UI's manual re-trigger
 *     button. Wraps this fn behind user auth + Pro gate + ownership check.
 *
 * Caller responsibilities:
 *   - Verify the calling user owns `automationId` (this fn uses the service
 *     client so RLS does NOT enforce ownership).
 *   - Check the user is on Pro/Trial (backfill is Pro-only by product rule).
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { GRAPH_FB_BASE, GRAPH_IG_BASE } from '@/lib/meta-graph';

const MAX_COMMENTS_PER_PAGE = 100;
const MAX_PAGES             = 5; // up to 500 comments per backfill run

/**
 * Replay an automation against historical comments. We always run in
 * "missed" semantics — skip anyone already in dm_sent_log or dm_queue
 * — because IG's Private Reply endpoint is a single-shot per
 * comment_id within 7 days of the comment timestamp, so a "send to
 * everyone again" mode would just hit the API and fail. The 7-day
 * window is enforced inline below: comments older than that get
 * filtered out, since the Private Reply call will error.
 *
 * @param {object} args
 * @param {string} args.automationId
 * @param {string} args.postId
 */
export async function runBackfill({ automationId, postId }) {
    if (!automationId || !postId) {
        throw new Error('automationId and postId are required');
    }

    // Instagram's Private Reply endpoint hard-rejects any comment
    // older than 7 days. Pre-filter inline so we don't fill the queue
    // with sends we know IG will reject.
    const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
    const oldestAllowedMs = Date.now() - PRIVATE_REPLY_WINDOW_MS;

    const supabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    // ── Fetch automation + post + account ─────────────────────────────
    // We can't `select('*, connected_accounts!inner(...)')` directly on
    // dm_automations because there's no direct FK between those tables —
    // the relationship runs through instagram_posts.account_id. PostgREST
    // doesn't auto-resolve two-hop relationships, so the embedded join
    // silently returns no row and we'd throw "Automation not found" even
    // when the automation exists. Fetch the chain explicitly instead.
    const { data: automation, error: autoErr } = await supabase
        .from('dm_automations')
        .select('*')
        .eq('id', automationId)
        .single();

    if (autoErr || !automation) {
        console.warn('[Backfill] Automation lookup failed:',
            autoErr?.message || `no row for id=${automationId}`);
        throw new Error('Automation not found');
    }

    const { data: post, error: postErr } = await supabase
        .from('instagram_posts')
        .select(
            'id, ig_post_id, account_id, ' +
            'connected_accounts(id, access_token, fb_page_access_token, ig_user_id, fb_page_id)',
        )
        .eq('id', postId)
        .single();

    if (postErr || !post) {
        console.warn('[Backfill] Post lookup failed:',
            postErr?.message || `no row for id=${postId}`);
        throw new Error('Post not found');
    }

    const account = post.connected_accounts;
    if (!account) {
        console.warn('[Backfill] No connected_account row for post', postId);
        throw new Error('Connected account not found for this post');
    }
    const token     = account.fb_page_access_token || account.access_token;
    const useIgApi  = !account.fb_page_access_token;
    const graphBase = useIgApi ? GRAPH_IG_BASE : GRAPH_FB_BASE;
    const igPostId  = post.ig_post_id;

    if (!igPostId || igPostId.startsWith('fb_')) {
        throw new Error('Backfill only supported for Instagram posts');
    }

    // ── Fetch existing recipients to avoid duplicate DMs ──────────────
    const { data: alreadySent } = await supabase
        .from('dm_sent_log')
        .select('recipient_ig_id')
        .eq('automation_id', automationId)
        .eq('status', 'sent');

    const sentSet = new Set((alreadySent || []).map((r) => r.recipient_ig_id));

    // Skip queue items too so we don't double-enqueue when a previous
    // backfill is mid-flight.
    const { data: alreadyQueued } = await supabase
        .from('dm_queue')
        .select('recipient_ig_id')
        .eq('automation_id', automationId)
        .in('status', ['pending', 'processing', 'sent']);

    for (const r of (alreadyQueued || [])) sentSet.add(r.recipient_ig_id);

    // ── Trigger config ────────────────────────────────────────────────
    const triggerConfig = automation.trigger_config || {};
    const keywords      = (triggerConfig.keywords || []).map((k) => k.toLowerCase());
    const triggerType   = triggerConfig.type || triggerConfig.triggerType || 'keywords';

    // ── Click-tracking map ────────────────────────────────────────────
    const appUrl       = process.env.NEXT_PUBLIC_APP_URL || '';
    const trackingMap  = {};
    try {
        const { data: linkCodes } = await supabase
            .from('dm_link_codes')
            .select('code, original_url')
            .eq('automation_id', automationId)
            .limit(500);
        for (const row of (linkCodes || [])) {
            trackingMap[row.original_url] = `${appUrl}/r/${row.code}`;
        }
    } catch { /* non-fatal */ }

    // ── Paginate comments and enqueue matching ones ───────────────────
    let commentsFetched   = 0;
    let queued            = 0;
    let skipped           = 0;
    let skippedOutOfWindow = 0;
    let nextUrl           = `${graphBase}/${igPostId}/comments?fields=id,text,from,timestamp&limit=${MAX_COMMENTS_PER_PAGE}&access_token=${encodeURIComponent(token)}`;
    let page              = 0;

    while (nextUrl && page < MAX_PAGES) {
        const res  = await fetch(nextUrl);
        const data = await res.json();

        if (!res.ok) {
            console.error('[Backfill] Graph API error:', data.error?.message);
            break;
        }

        const comments = data.data || [];
        commentsFetched += comments.length;
        page++;

        for (const comment of comments) {
            const commenterId = comment.from?.id;
            const commentText = comment.text || '';
            const commentId   = comment.id;

            if (!commenterId || !commentText || !commentId) continue;
            if (commenterId === account.ig_user_id) continue;          // skip own comments
            if (sentSet.has(commenterId)) { skipped++; continue; }     // skip already sent/queued

            // 7-day window — IG's Private Reply endpoint rejects
            // anything older. Comments are returned newest-first, so
            // once we hit one outside the window we can stop the
            // outer loop entirely (paging older won't help).
            const ts = comment.timestamp ? Date.parse(comment.timestamp) : 0;
            if (ts && ts < oldestAllowedMs) {
                skippedOutOfWindow++;
                nextUrl = null; // bail the outer pagination
                break;
            }

            // Trigger matching
            const lower = commentText.toLowerCase().trim();
            let matches = false;

            if (triggerType === 'all_comments') {
                matches = true;
            } else if (triggerType === 'emojis_only') {
                const EMOJI_RE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
                const plain    = lower.replace(EMOJI_RE, '').trim();
                matches = EMOJI_RE.test(commentText) && plain.replace(/[^a-z0-9]/g, '') === '';
            } else if (triggerType === 'mentions_only') {
                matches = /@\w+/.test(commentText);
            } else {
                // keywords — empty list = no fire (parity with webhook)
                matches = keywords.length > 0 && keywords.some((kw) => lower.includes(kw));
            }

            if (!matches) { skipped++; continue; }

            // Enqueue
            const { error: insertErr } = await supabase.from('dm_queue').insert({
                user_id:         automation.user_id,
                account_id:      account.id,
                automation_id:   automationId,
                post_id:         postId,
                recipient_ig_id: commenterId,
                comment_id:      commentId,
                comment_text:    commentText,
                platform:        'instagram',
                dm_type:         automation.dm_type,
                dm_config:       automation.dm_config,
                tracking_map:    trackingMap,
                user_plan:       'free', // billing enforced at queue-drain time, not here
                queue_reason:    'backfill',
                is_upsell:       false,
                priority:        8,
                status:          'pending',
                scheduled_after: new Date().toISOString(),
            });

            if (!insertErr) {
                sentSet.add(commenterId);
                queued++;
            }
        }

        nextUrl = data.paging?.next || null;
    }

    console.log(
        `[Backfill] automation=${automationId} fetched=${commentsFetched} queued=${queued} ` +
        `skipped=${skipped} skippedOutOfWindow=${skippedOutOfWindow}`
    );

    return { commentsFetched, queued, skipped, skippedOutOfWindow, pages: page };
}
