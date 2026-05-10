import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const PAGE_SIZE = 50;

/**
 * GET /api/logs?status=all&range=7d&page=0&search=
 * Returns paginated DM sent log rows for the authenticated user.
 */
export async function GET(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status   = searchParams.get('status')   || 'all';   // all | sent | failed
    const range    = searchParams.get('range')    || '7d';    // today | 7d | 30d | all
    const platform = searchParams.get('platform') || 'all';   // all | instagram | facebook
    const page     = parseInt(searchParams.get('page') || '0', 10);
    const search   = searchParams.get('search')   || '';

    try {
        // Date range filter
        let fromDate = null;
        if (range !== 'all') {
            const now = new Date();
            if (range === 'today') {
                fromDate = new Date(now); fromDate.setHours(0, 0, 0, 0);
            } else if (range === '7d') {
                fromDate = new Date(now); fromDate.setDate(now.getDate() - 7);
            } else if (range === '30d') {
                fromDate = new Date(now); fromDate.setDate(now.getDate() - 30);
            }
        }

        // Build query — filter by user_id, the source of truth that matches
        // the sidebar's cached counter and survives automation deletions.
        // post_id is included so we can resolve post info even when the
        // automation has been deleted (FK SET NULLs automation_id on
        // dm_sent_log; post_id stays intact since instagram_posts isn't
        // cascade-deleted with the automation).
        let query = supabase
            .from('dm_sent_log')
            .select('id, automation_id, post_id, recipient_ig_id, comment_text, status, error_message, sent_at, platform', { count: 'exact' })
            .eq('user_id', user.id)
            .order('sent_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (status !== 'all') {
            query = query.eq('status', status);
        }
        if (platform !== 'all') {
            // Direct read from the new dm_sent_log.platform column.
            query = query.eq('platform', platform);
        }
        if (fromDate) {
            query = query.gte('sent_at', fromDate.toISOString());
        }
        if (search.trim()) {
            // PostgREST parses or() as a comma/paren-delimited mini-DSL.
            // Strip characters that can break or extend the filter expression
            // (commas, parens, quotes, the ilike wildcard, backslash). What
            // remains is safe to splice into the template.
            const safeSearch = search.replace(/[%,()'"*\\]/g, '').trim();
            if (safeSearch) {
                query = query.or(`comment_text.ilike.%${safeSearch}%,recipient_ig_id.ilike.%${safeSearch}%`);
            }
        }

        const { data: logs, count, error } = await query;

        if (error) throw error;

        // Resolve post info via dm_sent_log.post_id directly. This survives
        // automation deletion — RLS scopes the read to posts the user owns.
        // Falls back to looking up via the automation only when post_id is
        // null on the row (e.g. story-mention or chip-tap rows that don't
        // have a post_id stored).
        const postIds       = [...new Set((logs || []).map((l) => l.post_id).filter(Boolean))];
        const orphanAutoIds = [...new Set((logs || [])
            .filter((l) => !l.post_id && l.automation_id)
            .map((l) => l.automation_id))];

        const postMap = {};
        if (postIds.length > 0) {
            const { data: postRows } = await supabase
                .from('instagram_posts')
                .select('id, caption, thumbnail_url, media_url')
                .in('id', postIds);
            for (const p of (postRows || [])) {
                postMap[p.id] = {
                    caption:      p.caption || 'No caption',
                    thumbnailUrl: p.thumbnail_url || p.media_url || null,
                };
            }
        }

        const autoMap = {};
        if (orphanAutoIds.length > 0) {
            const { data: autoRows } = await supabase
                .from('dm_automations')
                .select('id, instagram_posts(caption, thumbnail_url, media_url)')
                .in('id', orphanAutoIds);
            for (const a of (autoRows || [])) {
                autoMap[a.id] = {
                    caption:      a.instagram_posts?.caption || 'No caption',
                    thumbnailUrl: a.instagram_posts?.thumbnail_url || a.instagram_posts?.media_url || null,
                };
            }
        }

        // Enrich with post info — platform comes straight off the row.
        const rows = (logs || []).map((log) => {
            const info = postMap[log.post_id]
                || autoMap[log.automation_id]
                || { caption: 'Unknown post', thumbnailUrl: null };
            return {
                ...log,
                platform: log.platform || 'instagram',
                post: { caption: info.caption, thumbnailUrl: info.thumbnailUrl },
            };
        });

        return NextResponse.json({
            rows,
            total: count || 0,
            hasMore: (page + 1) * PAGE_SIZE < (count || 0),
        });

    } catch (err) {
        console.error('[Logs API]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
