import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/logs/export
 *
 * Query params:
 *   status  — all | sent | failed
 *   range   — today | 7d | 30d | all
 *   search  — free text (matches comment_text or recipient_ig_id)
 *   scope   — filtered (honours all params) | all (ignores range/status/search, exports everything)
 *
 * Returns a UTF-8 CSV with BOM so Excel opens it correctly without needing
 * an import wizard. Capped at 50,000 rows for edge memory safety.
 */
export async function GET(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return new Response('Not authenticated', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status   = searchParams.get('status')   || 'all';
    const range    = searchParams.get('range')    || '30d';
    const search   = searchParams.get('search')   || '';
    const scope    = searchParams.get('scope')    || 'filtered'; // filtered | all
    const platform = searchParams.get('platform') || 'all';      // all | instagram | facebook

    try {
        // Fetch the user's automations only for the post-info enrichment
        // map (caption + ig_post_id per row). The dm_sent_log query
        // filters by user_id directly so historical rows survive automation
        // deletions and stay in the export.
        const { data: userAutomations } = await supabase
            .from('dm_automations')
            .select('id, dm_type, instagram_posts(id, caption, ig_post_id)')
            .eq('user_id', user.id);

        // automation_id → { caption, dmType, postId }
        const autoMap = {};
        for (const a of (userAutomations || [])) {
            autoMap[a.id] = {
                caption:   a.instagram_posts?.caption   || 'No caption',
                igPostId:  a.instagram_posts?.ig_post_id || '',
                postDbId:  a.instagram_posts?.id        || '',
                dmType:    a.dm_type                    || '',
            };
        }

        // ── Build date range filter ───────────────────────────────
        let fromDate = null;
        if (scope === 'filtered' && range !== 'all') {
            const now = new Date();
            if (range === 'today') {
                fromDate = new Date(now); fromDate.setHours(0, 0, 0, 0);
            } else if (range === '7d') {
                fromDate = new Date(now); fromDate.setDate(now.getDate() - 7);
            } else if (range === '30d') {
                fromDate = new Date(now); fromDate.setDate(now.getDate() - 30);
            }
        }

        // ── Query ─────────────────────────────────────────────────
        // Filter by user_id directly — same source of truth as the sidebar
        // counter, captures rows whose automation has since been deleted.
        let query = supabase
            .from('dm_sent_log')
            .select('id, automation_id, recipient_ig_id, comment_id, comment_text, status, error_message, sent_at, platform')
            .eq('user_id', user.id)
            .order('sent_at', { ascending: false })
            .limit(50_000);

        if (scope === 'filtered') {
            if (status !== 'all')   query = query.eq('status', status);
            if (fromDate)           query = query.gte('sent_at', fromDate.toISOString());
            if (search.trim()) {
                // See logs/route.js — strip PostgREST filter metacharacters before splice.
                const safeSearch = search.replace(/[%,()'"*\\]/g, '').trim();
                if (safeSearch) {
                    query = query.or(`comment_text.ilike.%${safeSearch}%,recipient_ig_id.ilike.%${safeSearch}%`);
                }
            }
        }
        // Platform filter applies in both scopes — 'all' here means "all time".
        if (platform !== 'all') {
            query = query.eq('platform', platform);
        }

        const { data: logs, error } = await query;
        if (error) throw error;

        // ── Build rows ────────────────────────────────────────────
        const enriched = (logs || []).map((log) => {
            const meta = autoMap[log.automation_id] || {};
            return {
                platform:       log.platform || 'instagram',
                post_caption:   meta.caption   || '',
                ig_post_id:     meta.igPostId  || '',
                dm_type:        formatDmType(meta.dmType),
                automation_id:  log.automation_id || '',
                recipient_id:   log.recipient_ig_id || '',
                comment_text:   log.comment_text || '',
                comment_id:     log.comment_id || '',
                status:         log.status || '',
                error_message:  log.error_message || '',
                sent_at_utc:    log.sent_at ? new Date(log.sent_at).toISOString() : '',
                sent_at_ist:    log.sent_at ? toIST(log.sent_at) : '',
            };
        });

        const filename = `autodm-logs-${new Date().toISOString().split('T')[0]}.csv`;
        return csvResponse(buildCsv(enriched), filename, enriched.length);

    } catch (err) {
        console.error('[Export]', err);
        return new Response(`Export failed: ${err.message}`, { status: 500 });
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DM_TYPE_LABELS = {
    button_template:  'Button Card',
    message_template: 'Text Message',
    quick_reply:      'Quick Reply',
    multi_cta:        'Multi-CTA',
    follow_up:        'Follow Gate',
};

function formatDmType(raw) {
    return DM_TYPE_LABELS[raw] || raw || '';
}

/** Convert UTC ISO string to IST display string (UTC+5:30) */
function toIST(isoString) {
    const d = new Date(isoString);
    // IST = UTC + 5h30m
    const istMs = d.getTime() + (5 * 60 + 30) * 60_000;
    const ist   = new Date(istMs);
    const pad   = (n) => String(n).padStart(2, '0');
    return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ` +
           `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())} IST`;
}

const CSV_HEADERS = [
    'Post Caption',
    'Instagram Post ID',
    'DM Type',
    'Automation ID',
    'Recipient IG ID',
    'Comment Text',
    'Comment ID',
    'Status',
    'Error Message',
    'Sent At (UTC)',
    'Sent At (IST)',
];

function buildCsv(rows) {
    const headerLine = CSV_HEADERS.map(esc).join(',');
    const dataLines  = rows.map((r) => [
        esc(r.post_caption),
        esc(r.ig_post_id),
        esc(r.dm_type),
        esc(r.automation_id),
        esc(r.recipient_id),
        esc(r.comment_text),
        esc(r.comment_id),
        esc(r.status),
        esc(r.error_message),
        esc(r.sent_at_utc),
        esc(r.sent_at_ist),
    ].join(','));

    return [headerLine, ...dataLines].join('\r\n');
}

function esc(val) {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
}

function csvResponse(csv, filename, rowCount = 0) {
    // Prepend UTF-8 BOM (\uFEFF) so Excel auto-detects encoding correctly
    const bom = '\uFEFF';
    return new Response(bom + csv, {
        headers: {
            'Content-Type':        'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control':       'no-store',
            // Surface the data-row count so the client can show an accurate
            // "Downloaded N rows" toast and detect genuinely-empty exports.
            'X-Row-Count':         String(rowCount),
        },
    });
}
