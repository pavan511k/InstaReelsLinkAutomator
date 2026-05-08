'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    Search, Download, RefreshCw, CheckCircle, XCircle, X,
    MessageSquare, Send, AlertTriangle, Instagram, Facebook, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStyles } from '@/lib/useStyles';
import Select from '@/components/ui/Select';
import darkStyles from './LogsContent.module.css';
import lightStyles from './LogsContent.light.module.css';

const STATUS_FILTERS = [
    { key: 'all',    label: 'All' },
    { key: 'sent',   label: 'Sent' },
    { key: 'failed', label: 'Failed' },
];

const PLATFORM_FILTERS = [
    { key: 'all',       label: 'All' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'facebook',  label: 'Facebook' },
];

const DATE_RANGES = [
    { key: 'today', label: 'Today' },
    { key: '7d',    label: 'Last 7 days' },
    { key: '30d',   label: 'Last 30 days' },
    { key: 'all',   label: 'All time' },
];

const DM_TYPE_LABELS = {
    button_template:  'Button Card',
    message_template: 'Text Message',
    quick_reply:      'Quick Reply',
    multi_cta:        'Multi-CTA',
    follow_up:        'Follow Gate',
};

function formatTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diffMs  = now - d;
    const diffMin = Math.floor(diffMs / 60_000);
    const diffH   = Math.floor(diffMs / 3_600_000);
    const diffD   = Math.floor(diffMs / 86_400_000);
    if (diffMin < 1)  return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffH < 24)   return `${diffH}h ago`;
    if (diffD === 1)  return 'Yesterday';
    if (diffD < 7)    return `${diffD}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function StatusBadge({ status, styles }) {
    if (status === 'sent') {
        return (
            <span className={styles.badgeSent}>
                <CheckCircle size={11} strokeWidth={2.5} /> Sent
            </span>
        );
    }
    return (
        <span className={styles.badgeFailed}>
            <XCircle size={11} strokeWidth={2.5} /> Failed
        </span>
    );
}

export default function LogsContent({ automationPostMap, totalSent, totalFailed, todaySent }) {
    const styles = useStyles(darkStyles, lightStyles);
    const [rows,        setRows]        = useState([]);
    const [total,       setTotal]       = useState(0);
    const [loading,     setLoading]     = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page,        setPage]        = useState(0);
    const [hasMore,     setHasMore]     = useState(false);

    /* Filter state lives in the URL (?status=&platform=&range=&search=) so
       it survives navigating away (Posts, Stories) and back. Was local
       useState before — clicking another nav item then returning would
       blow away the user's hand-crafted filter selection. URL is the
       single source of truth; we mirror to a tiny derived object on each
       render and write back via router.replace on change. */
    const router        = useRouter();
    const pathname      = usePathname();
    const searchParams  = useSearchParams();
    const status     = searchParams.get('status')   || 'all';
    const platform   = searchParams.get('platform') || 'all';
    const range      = searchParams.get('range')    || '7d';
    const search     = searchParams.get('search')   || '';

    /* Update URL — uses router.replace (not push) so the filter changes
       don't pollute browser history. Also passes scroll: false so the
       page doesn't scroll to top on every filter click. */
    const updateFilter = useCallback((key, value) => {
        const params = new URLSearchParams(searchParams.toString());
        // Default values get pruned from the URL — keeps URLs clean and
        // means "no filter" reads the same as "explicit default".
        const defaults = { status: 'all', platform: 'all', range: '7d', search: '' };
        if (!value || value === defaults[key]) {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [pathname, router, searchParams]);

    const setStatus   = (v) => updateFilter('status',   v);
    const setPlatform = (v) => updateFilter('platform', v);
    const setRange    = (v) => updateFilter('range',    v);
    const setSearch   = (v) => updateFilter('search',   v);

    /* Search has its own input state for the in-progress text — it's
       debounced into the URL via the 400ms timer below. Initialize to
       the URL value so reloading mid-search shows what was searched. */
    const [searchInput, setSearchInput] = useState(search);
    /* Keep the search text input synced if the URL changes via back/
       forward navigation (browser-driven, not user-typed). */
    useEffect(() => {
        setSearchInput(search);
    }, [search]);

    // Export state — one-click flow, no panel.
    const [exporting, setExporting] = useState(false);

    // Expanded row
    const [expandedRow, setExpandedRow] = useState(null);

    const searchTimer = useRef(null);

    // ── Data fetching ─────────────────────────────────────────────
    const fetchLogs = useCallback(async (pg = 0, reset = true) => {
        if (pg === 0) setLoading(true); else setLoadingMore(true);
        try {
            const params = new URLSearchParams({ status, range, platform, page: pg, search });
            const res    = await fetch(`/api/logs?${params}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            if (reset || pg === 0) setRows(data.rows || []);
            else setRows((prev) => [...prev, ...(data.rows || [])]);
            setTotal(data.total || 0);
            setHasMore(data.hasMore || false);
            setPage(pg);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [status, range, platform, search]);

    useEffect(() => { fetchLogs(0, true); }, [fetchLogs]);

    const handleSearchChange = (val) => {
        setSearchInput(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setSearch(val), 400);
    };

    // ── Export ────────────────────────────────────────────────────
    // One click → download the CSV for whatever filters are currently
    // applied to the visible table (status / range / platform / search).
    // The previous configuration panel only added an explicit "all" scope
    // toggle — users who want everything can just clear the filters first.
    const handleExport = async () => {
        if (exporting) return;
        setExporting(true);
        const toastId = toast.loading('Preparing your CSV…');

        try {
            const params = new URLSearchParams({
                status,
                range,
                search,
                platform,
                scope: 'filtered',
            });

            const res = await fetch(`/api/logs/export?${params}`);

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || `Export failed (${res.status})`);
            }

            // X-Row-Count is set by /api/logs/export. Treat a missing header
            // as "unknown" — never as zero — so older deployments don't
            // false-warn while the new route is still rolling out.
            const rowHeader = res.headers.get('X-Row-Count');
            const rowCount  = rowHeader == null ? null : parseInt(rowHeader, 10);

            if (rowCount === 0) {
                toast.warning('No rows match the current filters', { id: toastId });
                return;
            }

            const blob     = await res.blob();
            const url      = URL.createObjectURL(blob);
            const filename = `autodm-logs-${new Date().toISOString().split('T')[0]}.csv`;
            const a        = document.createElement('a');
            a.href         = url;
            a.download     = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            const successMsg = rowCount == null
                ? 'CSV downloaded'
                : `Downloaded ${rowCount.toLocaleString()} row${rowCount !== 1 ? 's' : ''}`;
            toast.success(successMsg, { id: toastId });
        } catch (err) {
            console.error('Export failed:', err);
            toast.error(err.message || 'Export failed. Please try again.', { id: toastId });
        } finally {
            setExporting(false);
        }
    };

    // ── Derived ───────────────────────────────────────────────────
    const totalAll = totalSent + totalFailed;
    const failRate = totalAll > 0 ? Math.round((totalFailed / totalAll) * 100) : 0;

    return (
        <div className={styles.page}>

            {/* ── Header ───────────────────────────────────────── */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>DM Logs</h1>
                    <p className={styles.sub}>Every DM AutoDM has sent — searchable, filterable, exportable.</p>
                </div>
                <div className={styles.headerActions}>
                    <button
                        className={styles.refreshBtn}
                        onClick={() => fetchLogs(0, true)}
                        disabled={loading}
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={loading ? styles.spin : ''} />
                    </button>
                    <button
                        className={styles.exportBtn}
                        onClick={handleExport}
                        disabled={totalAll === 0 || exporting}
                        title="Download CSV of the current filtered view"
                    >
                        {exporting
                            ? <RefreshCw size={14} className={styles.spin} />
                            : <Download size={14} />}
                        {exporting ? 'Exporting…' : 'Export CSV'}
                    </button>
                </div>
            </div>

            {/* ── Stats row ─────────────────────────────────────── */}
            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(124,58,237,0.12)', color: '#A78BFA' }}>
                        <Send size={15} strokeWidth={2} />
                    </div>
                    <div>
                        <p className={styles.statValue}>{totalSent.toLocaleString()}</p>
                        <p className={styles.statLabel}>Total sent</p>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                        <CheckCircle size={15} strokeWidth={2} />
                    </div>
                    <div>
                        <p className={styles.statValue}>{todaySent.toLocaleString()}</p>
                        <p className={styles.statLabel}>Today</p>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5' }}>
                        <XCircle size={15} strokeWidth={2} />
                    </div>
                    <div>
                        <p className={styles.statValue}>{totalFailed.toLocaleString()}</p>
                        <p className={styles.statLabel}>Failed</p>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(245,158,11,0.1)', color: '#FCD34D' }}>
                        <AlertTriangle size={15} strokeWidth={2} />
                    </div>
                    <div>
                        <p className={styles.statValue}>{failRate}%</p>
                        <p className={styles.statLabel}>Failure rate</p>
                    </div>
                </div>
            </div>

            {/* ── Log table card ───────────────────────────────── */}
            <div className={styles.tableCard}>

                {/* Toolbar */}
                <div className={styles.toolbar}>
                    <div className={styles.toolbarLeft}>
                        <div className={styles.filterPills}>
                            {STATUS_FILTERS.map((f) => (
                                <button
                                    key={f.key}
                                    className={`${styles.filterPill} ${status === f.key ? styles.filterPillActive : ''}`}
                                    onClick={() => setStatus(f.key)}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        <div className={styles.platformPills}>
                            {PLATFORM_FILTERS.map((f) => (
                                <button
                                    key={f.key}
                                    className={`${styles.platformPill} ${platform === f.key ? styles.platformPillActive : ''} ${f.key !== 'all' ? styles[`platformPill_${f.key}`] : ''}`}
                                    onClick={() => setPlatform(f.key)}
                                    title={`Show ${f.label} DMs`}
                                >
                                    {f.key === 'instagram' && <Instagram size={11} strokeWidth={2.4} />}
                                    {f.key === 'facebook'  && <Facebook  size={11} strokeWidth={2.4} fill="currentColor" />}
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        <div className={styles.rangeWrap}>
                            <Select
                                value={range}
                                size="sm"
                                aria-label="Date range"
                                onChange={(v) => setRange(v)}
                                options={DATE_RANGES.map((r) => ({
                                    value: r.key,
                                    label: r.label,
                                    icon: <Calendar size={13} />,
                                }))}
                            />
                        </div>
                    </div>

                    <div className={styles.searchWrap}>
                        <Search size={14} className={styles.searchIcon} />
                        <input
                            className={styles.searchInput}
                            placeholder="Search by comment or recipient ID…"
                            value={searchInput}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                        {searchInput && (
                            <button
                                className={styles.searchClear}
                                onClick={() => { setSearchInput(''); setSearch(''); }}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Result count */}
                {!loading && (
                    <div className={styles.resultCount}>
                        {total === 0
                            ? 'No results'
                            : `${total.toLocaleString()} result${total !== 1 ? 's' : ''}`}
                        {search && <span className={styles.searchTag}>for &ldquo;{search}&rdquo;</span>}
                        {!loading && total > 0 && (
                            <button
                                className={styles.quickExportLink}
                                onClick={handleExport}
                                disabled={exporting}
                            >
                                <Download size={11} /> Export these {total.toLocaleString()}
                            </button>
                        )}
                    </div>
                )}

                {/* Table */}
                <div className={styles.tableWrap}>
                    {loading ? (
                        <div className={styles.loadingState}>
                            <RefreshCw size={22} className={styles.spin} style={{ color: 'rgba(255,255,255,0.25)' }} />
                            <p>Loading logs…</p>
                        </div>
                    ) : rows.length === 0 ? (
                        <div className={styles.emptyState}>
                            <MessageSquare size={32} style={{ color: 'rgba(255,255,255,0.15)' }} />
                            <p className={styles.emptyTitle}>No DMs found</p>
                            <p className={styles.emptyDesc}>
                                {status !== 'all' || range !== 'all'
                                    ? 'Try widening the filters or changing the date range.'
                                    : 'Once AutoDM sends its first message, every DM will appear here.'}
                            </p>
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Post</th>
                                    <th className={styles.platformCol}>Platform</th>
                                    <th>Recipient</th>
                                    <th>Comment</th>
                                    <th>Status</th>
                                    <th>Sent at</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <Fragment key={row.id}>
                                        <tr
                                            className={`${styles.row} ${row.status === 'failed' ? styles.rowFailed : ''} ${expandedRow === row.id ? styles.rowExpanded : ''}`}
                                            onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                                        >
                                            <td>
                                                <div className={styles.postCell}>
                                                    {row.post?.thumbnailUrl ? (
                                                        <img src={row.post.thumbnailUrl} alt="" className={styles.thumb} />
                                                    ) : (
                                                        <div className={styles.thumbPlaceholder} />
                                                    )}
                                                    <span className={styles.postCaption}>
                                                        {row.post?.caption || 'Unknown post'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={styles.platformCol}>
                                                {row.platform === 'facebook' ? (
                                                    <span className={`${styles.platformBadge} ${styles.platformBadge_facebook}`} title="Facebook">
                                                        <Facebook size={10} strokeWidth={2.4} fill="currentColor" /> FB
                                                    </span>
                                                ) : (
                                                    <span className={`${styles.platformBadge} ${styles.platformBadge_instagram}`} title="Instagram">
                                                        <Instagram size={10} strokeWidth={2.4} /> IG
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={styles.recipientId}>
                                                    {row.recipient_ig_id || '—'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={styles.commentText}>
                                                    {row.comment_text
                                                        ? row.comment_text.length > 48
                                                            ? row.comment_text.slice(0, 48) + '…'
                                                            : row.comment_text
                                                        : <span className={styles.na}>—</span>}
                                                </span>
                                            </td>
                                            <td><StatusBadge status={row.status} styles={styles} /></td>
                                            <td>
                                                <span className={styles.timeCell} title={row.sent_at ? new Date(row.sent_at).toLocaleString('en-IN') : ''}>
                                                    {formatTime(row.sent_at)}
                                                </span>
                                            </td>
                                        </tr>

                                        {expandedRow === row.id && row.status === 'failed' && row.error_message && (
                                            <tr key={`${row.id}-err`} className={styles.errorRow}>
                                                <td colSpan={6}>
                                                    <div className={styles.errorDetail}>
                                                        <XCircle size={13} style={{ color: '#FCA5A5', flexShrink: 0 }} />
                                                        <span>{row.error_message}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}

                                        {expandedRow === row.id && row.status !== 'failed' && (
                                            <tr key={`${row.id}-detail`} className={styles.detailRow}>
                                                <td colSpan={6}>
                                                    <div className={styles.detailInner}>
                                                        <span className={styles.detailItem}>
                                                            <strong>Recipient ID:</strong> {row.recipient_ig_id}
                                                        </span>
                                                        <span className={styles.detailItem}>
                                                            <strong>Full comment:</strong> {row.comment_text || '—'}
                                                        </span>
                                                        <span className={styles.detailItem}>
                                                            <strong>Sent:</strong> {row.sent_at ? new Date(row.sent_at).toLocaleString('en-IN') : '—'}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {hasMore && !loading && (
                    <div className={styles.loadMoreRow}>
                        <button
                            className={styles.loadMoreBtn}
                            onClick={() => fetchLogs(page + 1, false)}
                            disabled={loadingMore}
                        >
                            {loadingMore ? (
                                <><RefreshCw size={13} className={styles.spin} /> Loading…</>
                            ) : (
                                `Load more (${Math.min(50, total - rows.length)} more)`
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
