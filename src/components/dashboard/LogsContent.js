'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Search, Download, RefreshCw, CheckCircle, XCircle, X, ChevronDown, Check,
  MessageSquare, Send, AlertTriangle, Instagram, Facebook,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

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

function formatRelative(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  const hr  = Math.floor(ms / 3_600_000);
  const day = Math.floor(ms / 86_400_000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24)  return `${hr}h ago`;
  if (day === 1) return 'Yesterday';
  if (day < 7)  return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

// ─── Compact custom dropdown — same shape as the AutomationsView one ─────
function Dropdown({ value, onChange, options, className = '' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const selected = opts.find((o) => o.value === value) || opts[0];

  return (
    <div ref={wrapRef} className={['relative inline-block', className].join(' ')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'inline-flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-sm font-medium text-neutral-700 transition-colors',
          open ? 'border-[#E63946] ring-2 ring-[#E63946]/20' : 'border-neutral-200 hover:border-neutral-300',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown className={['h-4 w-4 flex-shrink-0 text-neutral-500 transition-transform', open ? 'rotate-180' : ''].join(' ')} strokeWidth={2.5} />
      </button>
      {open && (
        <ul role="listbox" className="absolute right-0 z-20 mt-1 max-h-64 min-w-[180px] overflow-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
          {opts.map((o) => {
            const active = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={active}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={[
                  'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  active ? 'bg-[#FFF1F2] text-[#E63946] font-semibold' : 'text-neutral-700 hover:bg-neutral-50',
                ].join(' ')}
              >
                <span className="truncate">{o.label}</span>
                {active && <Check className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={3} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
        <CheckCircle className="h-2.5 w-2.5" strokeWidth={3} /> Sent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
      <XCircle className="h-2.5 w-2.5" strokeWidth={3} /> Failed
    </span>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent = 'neutral' }) {
  const accents = {
    neutral:  { bg: 'bg-neutral-100',  fg: 'text-neutral-700' },
    emerald:  { bg: 'bg-emerald-50',   fg: 'text-emerald-600' },
    red:      { bg: 'bg-red-50',       fg: 'text-red-600' },
    amber:    { bg: 'bg-amber-50',     fg: 'text-amber-600' },
  }[accent];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <span className={['inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', accents.bg, accents.fg].join(' ')}>
        <Icon className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight text-neutral-900">{value}</p>
        <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────
export default function LogsContent({ totalSent, totalFailed, todaySent }) {
  const [rows,        setRows]        = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page,        setPage]        = useState(0);
  const [hasMore,     setHasMore]     = useState(false);

  // Filter state in URL — survives nav-away-and-back so users don't
  // lose hand-crafted filter selections.
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const status   = searchParams.get('status')   || 'all';
  const platform = searchParams.get('platform') || 'all';
  const range    = searchParams.get('range')    || '7d';
  const search   = searchParams.get('search')   || '';

  const updateFilter = useCallback((key, value) => {
    const params = new URLSearchParams(searchParams.toString());
    const defaults = { status: 'all', platform: 'all', range: '7d', search: '' };
    if (!value || value === defaults[key]) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const setStatus   = (v) => updateFilter('status',   v);
  const setPlatform = (v) => updateFilter('platform', v);
  const setRange    = (v) => updateFilter('range',    v);
  const setSearch   = (v) => updateFilter('search',   v);

  // Search input is debounced into the URL via a 400ms timer.
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => { setSearchInput(search); }, [search]);
  const searchTimer = useRef(null);
  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val), 400);
  };

  const [exporting, setExporting] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  // ── Data fetching ─────────────────────────────────────────────
  const fetchLogs = useCallback(async (pg = 0, reset = true) => {
    if (pg === 0) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ status, range, platform, page: pg, search });
      const res = await fetch(`/api/logs?${params}`);
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

  // ── Export ────────────────────────────────────────────────────
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    const tId = toast.loading('Preparing your CSV…');
    try {
      const params = new URLSearchParams({ status, range, search, platform, scope: 'filtered' });
      const res = await fetch(`/api/logs/export?${params}`);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Export failed (${res.status})`);
      }
      const rowHeader = res.headers.get('X-Row-Count');
      const rowCount  = rowHeader == null ? null : parseInt(rowHeader, 10);
      if (rowCount === 0) {
        toast.warning('No rows match the current filters', { id: tId });
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `autodm-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(rowCount == null ? 'CSV downloaded' : `Downloaded ${rowCount.toLocaleString()} row${rowCount !== 1 ? 's' : ''}`, { id: tId });
    } catch (err) {
      toast.error(err.message || 'Export failed. Please try again.', { id: tId });
    } finally {
      setExporting(false);
    }
  };

  const totalAll = totalSent + totalFailed;
  const failRate = totalAll > 0 ? Math.round((totalFailed / totalAll) * 100) : 0;

  const dateLabel = useMemo(
    () => DATE_RANGES.find((r) => r.key === range)?.label || 'Last 7 days',
    [range],
  );

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">DM Logs</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Every DM AutoDM has sent — searchable, filterable, exportable.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => fetchLogs(0, true)}
            disabled={loading}
            title="Refresh"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={['h-4 w-4', loading ? 'animate-spin' : ''].join(' ')} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={handleExport}
            // Only block when nothing is visible to export (filtered
            // total is 0) or while a request is in flight. Lifetime
            // totals shouldn't gate this — users can hit Export to
            // grab whatever the current filters surface.
            disabled={exporting || (!loading && total === 0)}
            title="Download CSV of the current filtered view"
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" strokeWidth={2.5} />}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* ── Stat row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Send}           label="Total sent"     value={totalSent.toLocaleString()}   accent="neutral" />
        <StatCard icon={CheckCircle}    label="Today"          value={todaySent.toLocaleString()}   accent="emerald" />
        <StatCard icon={XCircle}        label="Failed"         value={totalFailed.toLocaleString()} accent="red" />
        <StatCard icon={AlertTriangle}  label="Failure rate"   value={`${failRate}%`}               accent="amber" />
      </div>

      {/* ── Filter row ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" strokeWidth={2} />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by comment or recipient ID…"
            className="block h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); setSearch(''); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            value={status}
            onChange={setStatus}
            options={STATUS_FILTERS.map((f) => ({ value: f.key, label: f.label }))}
            className="min-w-[120px]"
          />
          <Dropdown
            value={platform}
            onChange={setPlatform}
            options={PLATFORM_FILTERS.map((f) => ({ value: f.key, label: f.label }))}
            className="min-w-[140px]"
          />
          <Dropdown
            value={range}
            onChange={setRange}
            options={DATE_RANGES.map((r) => ({ value: r.key, label: r.label }))}
            className="min-w-[150px]"
          />
        </div>
      </div>

      {/* ── Result count ───────────────────────────────────────── */}
      {!loading && total > 0 && (
        <p className="text-xs text-neutral-500">
          {total.toLocaleString()} result{total !== 1 ? 's' : ''}
          {search && (
            <span className="ml-1.5 inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
              for &ldquo;{search}&rdquo;
            </span>
          )}
          {' '}<span className="text-neutral-400">· {dateLabel}</span>
        </p>
      )}

      {/* ── Table ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-16 text-center shadow-sm">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-neutral-400" />
          <p className="mt-3 text-sm text-neutral-500">Loading logs…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-16 text-center">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
            <MessageSquare className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <p className="mt-4 text-sm font-semibold text-neutral-900">No DMs found</p>
          <p className="mt-1 text-xs text-neutral-500">
            {status !== 'all' || range !== 'all' || platform !== 'all' || search
              ? 'Try widening the filters or changing the date range.'
              : 'Once AutoDM sends its first message, every DM will appear here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[28%]" />
              <col className="hidden w-[10%] sm:table-column" />
              <col className="hidden w-[16%] md:table-column" />
              <col className="hidden w-[26%] lg:table-column" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/60 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                <th className="px-5 py-3.5">Post</th>
                <th className="hidden px-4 py-3.5 sm:table-cell">Platform</th>
                <th className="hidden px-4 py-3.5 md:table-cell">Recipient</th>
                <th className="hidden px-4 py-3.5 lg:table-cell">Comment</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((row) => {
                const isExpanded = expandedRow === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                      className={[
                        'cursor-pointer transition-colors hover:bg-neutral-50',
                        isExpanded ? 'bg-neutral-50' : '',
                      ].join(' ')}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {row.post?.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.post.thumbnailUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-md border border-neutral-200 object-cover" />
                          ) : (
                            <div className="h-9 w-9 flex-shrink-0 rounded-md border border-dashed border-neutral-200 bg-neutral-50" />
                          )}
                          <p className="truncate text-sm text-neutral-700">
                            {row.post?.caption || 'Unknown post'}
                          </p>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3.5 sm:table-cell">
                        {row.platform === 'facebook' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                            <Facebook className="h-2.5 w-2.5" strokeWidth={2.5} fill="currentColor" /> FB
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-pink-50 px-1.5 py-0.5 text-[10px] font-semibold text-pink-700">
                            <Instagram className="h-2.5 w-2.5" strokeWidth={2.5} /> IG
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3.5 md:table-cell">
                        <span className="font-mono text-[11px] text-neutral-600">
                          {row.recipient_ig_id ? `${row.recipient_ig_id.slice(0, 12)}…` : '—'}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3.5 lg:table-cell">
                        <p className="truncate text-[12px] text-neutral-600">
                          {row.comment_text
                            ? (row.comment_text.length > 48 ? row.comment_text.slice(0, 48) + '…' : row.comment_text)
                            : <span className="text-neutral-400">—</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right text-[12px] text-neutral-600">
                        <span title={row.sent_at ? new Date(row.sent_at).toLocaleString('en-US') : ''}>
                          {formatRelative(row.sent_at)}
                        </span>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-neutral-50/60">
                        <td colSpan={6} className="px-5 py-3.5">
                          <div className="space-y-1 text-[12px] text-neutral-700">
                            {row.status === 'failed' && row.error_message && (
                              <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                                <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.5} />
                                <span className="font-medium">{row.error_message}</span>
                              </p>
                            )}
                            <p>
                              <span className="font-semibold text-neutral-900">Recipient ID:</span>{' '}
                              <span className="font-mono text-neutral-700">{row.recipient_ig_id || '—'}</span>
                            </p>
                            <p>
                              <span className="font-semibold text-neutral-900">Full comment:</span>{' '}
                              <span className="text-neutral-700">{row.comment_text || '—'}</span>
                            </p>
                            <p>
                              <span className="font-semibold text-neutral-900">Sent at:</span>{' '}
                              <span className="text-neutral-700">{row.sent_at ? new Date(row.sent_at).toLocaleString('en-US') : '—'}</span>
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fetchLogs(page + 1, false)}
            disabled={loadingMore}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {loadingMore ? 'Loading…' : `Load more (${Math.min(50, total - rows.length)} more)`}
          </button>
        </div>
      )}
    </div>
  );
}
