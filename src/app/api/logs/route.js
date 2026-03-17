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
    const status = searchParams.get('status') || 'all';   // all | sent | failed
    const range  = searchParams.get('range')  || '7d';    // today | 7d | 30d | all
    const page   = parseInt(searchParams.get('page') || '0', 10);
    const search = searchParams.get('search') || '';

    try {
        // Get all automation IDs for this user
        const { data: userAutomations } = await supabase
            .from('dm_automations')
            .select('id, post_id, instagram_posts(caption, thumbnail_url, media_url)')
            .eq('user_id', user.id);

        if (!userAutomations || userAutomations.length === 0) {
            return NextResponse.json({ rows: [], total: 0, hasMore: false });
        }

        const allIds = userAutomations.map((a) => a.id);

        // Build automation → post map
        const autoMap = {};
        for (const a of userAutomations) {
            autoMap[a.id] = {
                caption:      a.instagram_posts?.caption || 'No caption',
                thumbnailUrl: a.instagram_posts?.thumbnail_url || a.instagram_posts?.media_url || null,
            };
        }

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

        // Build query
        let query = supabase
            .from('dm_sent_log')
            .select('id, automation_id, recipient_ig_id, comment_text, status, error_message, sent_at', { count: 'exact' })
            .in('automation_id', allIds)
            .order('sent_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (status !== 'all') {
            query = query.eq('status', status);
        }
        if (fromDate) {
            query = query.gte('sent_at', fromDate.toISOString());
        }
        if (search.trim()) {
            // Search in comment_text or recipient_ig_id
            query = query.or(`comment_text.ilike.%${search}%,recipient_ig_id.ilike.%${search}%`);
        }

        const { data: logs, count, error } = await query;

        if (error) throw error;

        // Enrich with post info
        const rows = (logs || []).map((log) => ({
            ...log,
            post: autoMap[log.automation_id] || { caption: 'Unknown post', thumbnailUrl: null },
        }));

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
