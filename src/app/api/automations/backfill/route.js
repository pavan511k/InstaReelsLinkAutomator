import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const GRAPH = 'https://graph.facebook.com/v21.0';
const MAX_COMMENTS_PER_PAGE = 100;
const MAX_PAGES = 5; // fetch up to 500 comments max per backfill run

/**
 * POST /api/automations/backfill
 *
 * Fetches historical comments on an Instagram post and enqueues DMs for any
 * that match the automation's trigger — skipping users who already received a DM.
 *
 * Called automatically from POST /api/automations when settingsConfig.sendToPreviousComments=true.
 * Can also be called manually from the UI to re-trigger.
 *
 * Body: { automationId: string, postId: string }
 */
export async function POST(request) {
    // Allow both: user auth (from client) and internal server-to-server calls
    const isInternal = request.headers.get('x-backfill-internal') === '1';

    let userId;
    let supabaseClient;

    if (isInternal) {
        // Internal call from automations API — use service client, trust the data
        supabaseClient = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
        );
    } else {
        supabaseClient = await createClient();
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        userId = user.id;
    }

    const supabase = supabaseClient;
    const body = await request.json();
    const { automationId, postId } = body;

    if (!automationId || !postId) {
        return NextResponse.json({ error: 'automationId and postId are required' }, { status: 400 });
    }

    try {
        // ── Fetch automation + post + account ─────────────────────────────
        const autoQuery = supabase
            .from('dm_automations')
            .select('*, connected_accounts!inner(id, access_token, ig_user_id)')
            .eq('id', automationId);
        if (!isInternal && userId) autoQuery.eq('user_id', userId);
        const { data: automation, error: autoErr } = await autoQuery.single();

        if (autoErr || !automation) {
            return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
        }

        const { data: post, error: postErr } = await supabase
            .from('instagram_posts')
            .select('id, ig_post_id, account_id')
            .eq('id', postId)
            .single();

        if (postErr || !post) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        const account   = automation.connected_accounts;
        const token     = account.access_token;
        const igPostId  = post.ig_post_id;

        if (!igPostId || igPostId.startsWith('fb_')) {
            return NextResponse.json({ error: 'Backfill only supported for Instagram posts' }, { status: 400 });
        }

        // ── Fetch existing recipients to avoid duplicate DMs ──────────────
        const { data: alreadySent } = await supabase
            .from('dm_sent_log')
            .select('recipient_ig_id')
            .eq('automation_id', automationId)
            .eq('status', 'sent');

        const sentSet = new Set((alreadySent || []).map((r) => r.recipient_ig_id));

        // Also check dm_queue for pending items
        const { data: alreadyQueued } = await supabase
            .from('dm_queue')
            .select('recipient_ig_id')
            .eq('automation_id', automationId)
            .in('status', ['pending', 'processing', 'sent']);

        for (const r of (alreadyQueued || [])) sentSet.add(r.recipient_ig_id);

        // ── Fetch comments from Instagram Graph API ───────────────────────
        const triggerConfig = automation.trigger_config || {};
        const keywords = (triggerConfig.keywords || []).map((k) => k.toLowerCase());
        const triggerType = triggerConfig.type || triggerConfig.triggerType || 'keywords';

        let commentsFetched = 0;
        let queued = 0;
        let skipped = 0;

        // Use service client for queue inserts (bypasses RLS)
        const serviceDb = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
        );

        // Fetch click-tracking map for this automation
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        let trackingMap = {};
        try {
            const { data: linkCodes } = await serviceDb
                .from('dm_link_codes')
                .select('code, original_url')
                .eq('automation_id', automationId);
            for (const row of (linkCodes || [])) {
                trackingMap[row.original_url] = `${appUrl}/r/${row.code}`;
            }
        } catch { /* non-fatal */ }

        let nextUrl = `${GRAPH}/${igPostId}/comments?fields=id,text,from,timestamp&limit=${MAX_COMMENTS_PER_PAGE}&access_token=${encodeURIComponent(token)}`;
        let page = 0;

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

                // Skip the account's own comments
                if (commenterId === account.ig_user_id) continue;

                // Skip already sent
                if (sentSet.has(commenterId)) { skipped++; continue; }

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
                    // keywords
                    matches = keywords.length === 0 || keywords.some((kw) => lower.includes(kw));
                }

                if (!matches) { skipped++; continue; }

                // Enqueue the DM
                const { error: insertErr } = await serviceDb.from('dm_queue').insert({
                    user_id:         userId || automation.user_id,
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
                    user_plan:       'free', // billing enforced at webhook/queue level, not backfill
                    queue_reason:    'backfill',
                    is_upsell:       false,
                    priority:        8,
                    status:          'pending',
                    scheduled_after: new Date().toISOString(),
                });

                if (!insertErr) {
                    sentSet.add(commenterId); // prevent duplicate queuing
                    queued++;
                }
            }

            nextUrl = data.paging?.next || null;
        }

        console.log(`[Backfill] automation=${automationId} fetched=${commentsFetched} queued=${queued} skipped=${skipped}`);

        return NextResponse.json({
            success: true,
            commentsFetched,
            queued,
            skipped,
            pages: page,
        });

    } catch (err) {
        console.error('[Backfill] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
