'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Users, Mail, RefreshCw, Download, AlertCircle, Lock, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 100;

// Defang CSV-formula-injection: prefix any cell starting with =, +, -, @, tab,
// or carriage return with a single quote so spreadsheet apps don't execute it.
function csvCell(value) {
  if (value == null) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export default function LeadsContent({ connectedAccounts = [], isPro = false }) {
  const firstActiveAccount = connectedAccounts.find((a) => a.is_active) || null;

  const [leads, setLeads]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [offset, setOffset]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');

  const loadLeads = useCallback(async (nextOffset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/leads?limit=${PAGE_SIZE}&offset=${nextOffset}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to load leads');
        return;
      }
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setOffset(nextOffset);
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isPro && firstActiveAccount) loadLeads(0);
  }, [isPro, firstActiveAccount, loadLeads]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      const haystack = [l.email, l.recipient_ig_id].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [leads, search]);

  const exportCsv = () => {
    if (!filteredLeads.length) return;
    const header = 'email,ig_user_id,captured_at\n';
    const rows = filteredLeads.map((l) =>
      [csvCell(l.email), csvCell(l.recipient_ig_id), csvCell(l.confirmed_at)].join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `autodm-email-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasNext = offset + leads.length < total;
  const hasPrev = offset > 0;

  // ── No connected account ────────────────────────────────────
  if (!firstActiveAccount) {
    return (
      <div className="space-y-8">
        <PageHeader />
        <EmptyCallout
          icon={Users}
          title="Connect your Instagram account first"
          body={<>Email Leads requires a connected Instagram account. Head to <strong>Settings → Permissions</strong> to connect.</>}
        />
      </div>
    );
  }

  // ── Free user ────────────────────────────────────────────────
  if (!isPro) {
    return (
      <div className="space-y-8">
        <PageHeader />
        <EmptyCallout
          icon={Lock}
          title="Email Leads is a Pro feature"
          body="Capture email addresses from your DM automations and export them as CSV. Available on the Pro plan."
          cta={
            <Link
              href="/pricing"
              className="mt-4 inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black transition-colors"
            >
              Upgrade to Pro
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">Email Leads</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Email addresses captured from your <strong>Email Collector</strong> automations.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => loadLeads(offset)}
            disabled={loading}
            title="Refresh"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={['h-4 w-4', loading ? 'animate-spin' : ''].join(' ')} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || filteredLeads.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.5} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-16 text-center shadow-sm">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-neutral-400" />
          <p className="mt-3 text-sm text-neutral-500">Loading leads…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center rounded-2xl border border-red-200 bg-red-50/50 px-6 py-12 text-center">
          <AlertCircle className="h-7 w-7 text-red-500" strokeWidth={2} />
          <p className="mt-3 text-sm font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => loadLeads(offset)}
            className="mt-4 inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && total === 0 && (
        <EmptyCallout
          icon={Mail}
          title="No email leads yet"
          body={<>Set up an <strong>Email Collector</strong> automation to start capturing leads. Anyone who replies with their email lands here automatically.</>}
        />
      )}

      {/* Loaded */}
      {!loading && !error && total > 0 && (
        <>
          {/* Filter row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" strokeWidth={2} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or IG ID…"
                className="block h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
              />
            </div>
            <p className="text-xs text-neutral-500">
              {total.toLocaleString()} lead{total !== 1 ? 's' : ''} captured
              {total > leads.length && ` · showing ${offset + 1}–${offset + leads.length}`}
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[44%]" />
                <col className="hidden w-[36%] sm:table-column" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/60 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="px-5 py-3.5">Email</th>
                  <th className="hidden px-4 py-3.5 sm:table-cell">IG User</th>
                  <th className="px-5 py-3.5 text-right">Captured</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-sm text-neutral-500">
                      No leads match your search.
                    </td>
                  </tr>
                ) : filteredLeads.map((lead) => (
                  <tr key={lead.id} className="transition-colors hover:bg-neutral-50">
                    <td className="px-5 py-3.5">
                      <a
                        href={`mailto:${lead.email}`}
                        className="truncate font-mono text-sm text-neutral-900 hover:text-[#E63946] hover:underline"
                      >
                        {lead.email}
                      </a>
                    </td>
                    <td className="hidden px-4 py-3.5 sm:table-cell">
                      <span className="font-mono text-[12px] text-neutral-600">
                        {lead.recipient_ig_id || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-[12px] text-neutral-600 whitespace-nowrap">
                      {new Date(lead.confirmed_at).toLocaleDateString('en-US', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(hasPrev || hasNext) && (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => loadLeads(Math.max(0, offset - PAGE_SIZE))}
                disabled={!hasPrev || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
                Prev
              </button>
              <button
                type="button"
                onClick={() => loadLeads(offset + PAGE_SIZE)}
                disabled={!hasNext || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────
function PageHeader() {
  return (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">Email Leads</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Email addresses captured from your <strong>Email Collector</strong> automations.
        </p>
      </div>
    </div>
  );
}

// ─── Empty / locked callout — same shape used by both ───────────────────
function EmptyCallout({ icon: Icon, title, body, cta = null }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-10 shadow-sm sm:p-14">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1F2] text-[#E63946] shadow-sm">
          <Icon className="h-7 w-7" strokeWidth={2} />
        </span>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">{body}</p>
        {cta}
      </div>
    </div>
  );
}
