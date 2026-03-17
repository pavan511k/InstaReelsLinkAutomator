'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search, Download, RefreshCw, CheckCircle, XCircle,
    MessageSquare, Send, AlertTriangle, FileDown, X,
} from 'lucide-react';
import styles from './LogsContent.module.css';

const STATUS_FILTERS = [
    { key: 'all',    label: 'All' },
    { key: 'sent',   label: 'Sent' },
    { key: 'failed', label: 'Failed' },
];

const DATE_RANGES = [
    { key: 'today', label: 'Today' },
    { key: '7d',    label: 'Last 7 days' },
    { key: '30d',   label: 'Last 30 days' },
    { key: 'all',   label: 'All time' },
];

const SCOPE_OPTIONS = [
    { key: 'filtered', label: 'Current filters' },
    { key: 'all',      label: 'All time (everything)' },
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

function StatusBadge({ status }) {
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
    const [rows,        setRows]        = useState([]);
    const [total,       setTotal]       = useState(0);
    const [loading,     setLoading]     = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page,        setPage]        = useState(0);
    const [hasMore,     setHasMore]     = useState(false);

    // Filter state
    const [status,      setStatus]      = useState('all');
    const [range,       setRange]       = useState('7d');
    const [search,      setSearch]      = useState('');
    const [searchInput, setSearchInput] = useState('');

    // Export panel state
    const [showExport,   setShowExport]   = useState(false);
    const [exportScope,  setExportScope]  = useState('filtered');
    const [exporting,    setExporting]    = useState(false);
    const [exportError,  setExportError]  = useState('');
    const [exportToast,  setExportToast]  = useState(''); // success message

    // Expanded row
    const [expandedRow, setExpandedRow] = useState(null);

    const searchTimer  = useRef(null);
    const toastTimer   = useRef(null);

    // ── Data fetching ─────────────────────────────────────────────
    const fetchLogs = useCallback(async (pg = 0, reset = true) => {
        if (pg === 0) setLoading(true); else setLoadingMore(true);
        try {
            const params = new URLSearchParams({ status, range, page: pg, search });
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
    }, [status, range, search]);

    useEffect(() => { fetchLogs(0, true); }, [fetchLogs]);

    const handleSearchChange = (val) => {
        setSearchInput(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setSearch(val), 400);
    };

    // ── Export ────────────────────────────────────────────────────
    const showToast = (msg) => {
        setExportToast(msg);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setExportToast(''), 4000);
    };

    const handleExport = async () => {
        setExporting(true);
        setExportError('');

        try {
            const params = new URLSearchParams({
                status: exportScope === 'all' ? 'all' : status,
                range:  exportScope === 'all' ? 'all' : range,
                search: exportScope === 'all' ? ''    : search,
                scope:  exportScope,
            });

            const res = await fetch(`/api/logs/export?${params}`);

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || `Export failed (${res.status})`);
            }

            const blob        = await res.blob();
            const rowCount    = parseInt(res.headers.get('X-Row-Count') || '0', 10);
            const url         = URL.createObjectURL(blob);
            const filename    = `autodm-logs-${new Date().toISOString().split('T')[0]}.csv`;
            const a           = document.createElement('a');
            a.href            = url;
            a.download        = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setShowExport(false);
            showToast(`✅ CSV downloaded successfully`);
        } catch (err) {
            console.error('Export failed:', err);
            setExportError(err.message || 'Export failed. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    // ── Derived ───────────────────────────────────────────────────
    const totalAll = totalSent + totalFailed;
    const failRate = totalAll > 0 ? Math.round((totalFailed / totalAll) * 100) : 0;

    const exportRowEstimate = exportScope === 'all' ? totalAll : total;

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
                        className={`${styles.exportBtn} ${showExport ? styles.exportBtnActive : ''}`}
                        onClick={() => { setShowExport(!showExport); setExportError(''); }}
                        disabled={totalAll === 0}
                    >
                        <Download size={14} />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* ── Export panel ─────────────────────────────────── */}
            {showExport && (
                <div className={styles.exportPanel}>
                    <div className={styles.exportPanelHeader}>
                        <div className={styles.exportPanelTitle}>
                            <FileDown size={15} />
                            Export DM Logs
                        </div>
                        <button className={styles.exportPanelClose} onClick={() => setShowExport(false)}>
                            <X size={14} />
                        </button>
                    </div>

                    {/* Scope picker */}
                    <div className={styles.exportScopeRow}>
                        {SCOPE_OPTIONS.map((opt) => (
                            <button
                                key={opt.key}
                                className={`${styles.scopeBtn} ${exportScope === opt.key ? styles.scopeBtnActive : ''}`}
                                onClick={() => setExportScope(opt.key)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Preview of what will be exported */}
                    <div className={styles.exportMeta}>
                        <div className={styles.exportMetaRow}>
                            <span className={styles.exportMetaLabel}>Rows to export</span>
                            <span className={styles.exportMetaValue}>
                                {exportRowEstimate > 0
                                    ? <><strong>{exportRowEstimate.toLocaleString()}</strong> DM{exportRowEstimate !== 1 ? 's' : ''}</>
                                    : <span style={{ color: 'rgba(255,255,255,0.25)' }}>None</span>}
                            </span>
                        </div>
                        {exportScope === 'filtered' && (
                            <>
                                <div className={styles.exportMetaRow}>
                                    <span className={styles.exportMetaLabel}>Status filter</span>
                                    <span className={styles.exportMetaValue}>{STATUS_FILTERS.find(f => f.key === status)?.label || 'All'}</span>
                                </div>
                                <div className={styles.exportMetaRow}>
                                    <span className={styles.exportMetaLabel}>Date range</span>
                                    <span className={styles.exportMetaValue}>{DATE_RANGES.find(r => r.key === range)?.label || 'All time'}</span>
                                </div>
                                {search && (
                                    <div className={styles.exportMetaRow}>
                                        <span className={styles.exportMetaLabel}>Search filter</span>
                                        <span className={styles.exportMetaValue}>&ldquo;{search}&rdquo;</span>
                                    </div>
                                )}
                            </>
                        )}
                        <div className={styles.exportMetaRow}>
                            <span className={styles.exportMetaLabel}>Format</span>
                            <span className={styles.exportMetaValue}>CSV (Excel-compatible, UTF-8)</span>
                        </div>
                        <div className={styles.exportMetaRow}>
                            <span className={styles.exportMetaLabel}>Columns</span>
                            <span className={styles.exportMetaValue}>Post · DM Type · Recipient · Comment · Status · Error · Sent At (UTC + IST)</span>
                        </div>
                    </div>

                    {exportError && (
                        <div className={styles.exportError}>
                            <XCircle size={13} style={{ flexShrink: 0 }} />
                            {exportError}
                        </div>
                    )}

                    <button
                        className={styles.exportDownloadBtn}
                        onClick={handleExport}
                        disabled={exporting || exportRowEstimate === 0}
                    >
                        {exporting ? (
                            <><RefreshCw size={14} className={styles.spin} /> Preparing…</>
                        ) : (
                            <><FileDown size={14} /> Download {exportRowEstimate > 0 ? `${exportRowEstimate.toLocaleString()} rows` : ''}</>
                        )}
                    </button>
                </div>
            )}

            {/* ── Success toast ─────────────────────────────────── */}
            {exportToast && (
                <div className={styles.exportToast}>
                    {exportToast}
                </div>
            )}

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
                        <select
                            className={styles.rangeSelect}
                            value={range}
                            onChange={(e) => setRange(e.target.value)}
                        >
                            {DATE_RANGES.map((r) => (
                                <option key={r.key} value={r.key}>{r.label}</option>
                            ))}
                        </select>
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
                                onClick={() => { setExportScope('filtered'); setShowExport(true); }}
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
                                    <th>Recipient</th>
                                    <th>Comment</th>
                                    <th>Status</th>
                                    <th>Sent at</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <>
                                        <tr
                                            key={row.id}
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
                                            <td><StatusBadge status={row.status} /></td>
                                            <td>
                                                <span className={styles.timeCell} title={row.sent_at ? new Date(row.sent_at).toLocaleString('en-IN') : ''}>
                                                    {formatTime(row.sent_at)}
                                                </span>
                                            </td>
                                        </tr>

                                        {expandedRow === row.id && row.status === 'failed' && row.error_message && (
                                            <tr key={`${row.id}-err`} className={styles.errorRow}>
                                                <td colSpan={5}>
                                                    <div className={styles.errorDetail}>
                                                        <XCircle size={13} style={{ color: '#FCA5A5', flexShrink: 0 }} />
                                                        <span>{row.error_message}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}

                                        {expandedRow === row.id && row.status !== 'failed' && (
                                            <tr key={`${row.id}-detail`} className={styles.detailRow}>
                                                <td colSpan={5}>
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
                                    </>
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
