import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { fetchAllCommenters, parseKeywords } from '@/lib/broadcast-helpers';

/**
 * GET /api/broadcast/preview?postId=xxx
 *
 * Returns the audience breakdown for a broadcast without creating any job.
 * Used by BroadcastModal's confirm phase to show real counts before the user commits.
 *
 * Response: { total, newCount, skippedCount }
 *   total       — unique commenters found on the post (excluding the owner)
 *   newCount    — recipients who haven't received a DM from this automation yet
 *   skippedCount — already DM'd; will be skipped if the broadcast runs
 */
export async function GET(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 });

    const keywords = parseKeywords(searchParams.get('keywords') || '');

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
    const useIgApi    = !account.fb_page_access_token;

    // ── Fetch all commenters ──────────────────────────────────────
    const commenterIds = await fetchAllCommenters(post.ig_post_id, accessToken, igAccountId, useIgApi, keywords);

    if (commenterIds.length === 0) {
        return NextResponse.json({ total: 0, newCount: 0, skippedCount: 0 });
    }

    // ── Check who already received a DM from this automation ─────
    let skippedCount = 0;

    const { data: automation } = await supabase
        .from('dm_automations')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (automation?.id) {
        const { data: prevLogs } = await supabase
            .from('dm_sent_log')
            .select('recipient_ig_id')
            .eq('automation_id', automation.id)
            .eq('status', 'sent')
            .in('recipient_ig_id', commenterIds);

        skippedCount = (prevLogs || []).length;
    }

    return NextResponse.json({
        total:        commenterIds.length,
        newCount:     commenterIds.length - skippedCount,
        skippedCount,
    });
}
