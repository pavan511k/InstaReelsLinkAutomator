'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Eye, X, Download, User, Mail, Zap, Calendar, MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * /contacts — recipient-aggregated view of every fan who has gotten
 * a DM from one of this user's automations. Pure client-side
 * filtering / sorting on the array passed in from the server (one
 * RPC fetch upstream). Eye icon opens a detail modal; CSV / JSON
 * export buttons in the header dump the currently-filtered list.
 */
export default function ContactsView({ contacts: initialContacts = [] }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('lastActive'); // 'lastActive' | 'interactions'
  const [openContactId, setOpenContactId] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = initialContacts;
    if (q) {
      list = list.filter((c) => {
        const haystack = [c.username, c.firstName, c.recipientIgId, c.email, c.automationNames]
          .filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'interactions') return (b.interactions || 0) - (a.interactions || 0);
      // default lastActive desc — null timestamps sink to the bottom
      const ta = a.lastActive ? new Date(a.lastActive).getTime() : 0;
      const tb = b.lastActive ? new Date(b.lastActive).getTime() : 0;
      return tb - ta;
    });
    return list;
  }, [initialContacts, search, sortBy]);

  const openContact = filtered.find((c) => c.recipientIgId === openContactId) || null;

  const isEmpty = initialContacts.length === 0;
  const noMatches = !isEmpty && filtered.length === 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Contacts
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Everyone your automations have DM&apos;d, with how often they&apos;ve
            engaged and the latest captured email.
          </p>
        </div>
        {!isEmpty && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <ExportButton label="CSV"  contacts={filtered} format="csv" />
            <ExportButton label="JSON" contacts={filtered} format="json" />
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* Filter row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" strokeWidth={2} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by username, name, email, or automation…"
                className="block h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 text-xs font-semibold">
              {[
                { key: 'lastActive',   label: 'Last active' },
                { key: 'interactions', label: 'Most active' },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSortBy(s.key)}
                  className={[
                    'whitespace-nowrap rounded-md px-3 py-1.5 transition-colors',
                    sortBy === s.key
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900',
                  ].join(' ')}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {noMatches ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-10 text-center text-sm text-neutral-500">
              No contacts match your search.
            </div>
          ) : (
            <ContactsTable
              contacts={filtered}
              onOpen={setOpenContactId}
            />
          )}
        </>
      )}

      <ContactDetailModal
        contact={openContact}
        onClose={() => setOpenContactId(null)}
      />
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-10 shadow-sm sm:p-14">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1F2] text-[#E63946] shadow-sm">
          <User className="h-7 w-7" strokeWidth={2} />
        </span>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">
          No contacts yet
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Every recipient your automations DM will show up here. Once your
          first comment-to-DM or story-reply fires, the contact list starts
          populating automatically.
        </p>
      </div>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────
function ContactsTable({ contacts, onOpen }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[36%]" />
          <col className="hidden w-[14%] sm:table-column" />
          <col className="hidden w-[14%] sm:table-column" />
          <col className="hidden w-[24%] md:table-column" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50/60 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            <th className="px-5 py-3.5">Contact</th>
            <th className="hidden px-4 py-3.5 text-right sm:table-cell">Interactions</th>
            <th className="hidden px-4 py-3.5 sm:table-cell">Last active</th>
            <th className="hidden px-4 py-3.5 md:table-cell">Automations</th>
            <th className="px-5 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {contacts.map((c) => (
            <tr
              key={c.recipientIgId}
              onClick={() => onOpen(c.recipientIgId)}
              className="cursor-pointer transition-colors hover:bg-neutral-50"
            >
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-700">
                    <User className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {c.username ? `@${c.username}` : c.firstName || 'Unknown user'}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {c.email
                        ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>
                        : `IG ID ${c.recipientIgId.slice(0, 8)}…`}
                    </p>
                  </div>
                </div>
              </td>

              <td className="hidden px-4 py-4 text-right text-sm font-semibold sm:table-cell">
                <span className="inline-flex items-center gap-1.5 text-neutral-700">
                  <Zap className="h-3 w-3 text-neutral-400" strokeWidth={2.5} />
                  {c.interactions}
                </span>
              </td>

              <td className="hidden px-4 py-4 text-[12px] text-neutral-600 sm:table-cell">
                {c.lastActive ? formatRelative(c.lastActive) : '—'}
              </td>

              <td className="hidden px-4 py-4 text-[12px] text-neutral-600 md:table-cell">
                <p className="truncate" title={c.automationNames}>
                  {c.automationNames || '—'}
                </p>
              </td>

              <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onOpen(c.recipientIgId)}
                    aria-label="View contact details"
                    title="View details"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Contact detail modal ─────────────────────────────────────────────────
function ContactDetailModal({ contact, onClose }) {
  useEffect(() => {
    if (!contact) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contact, onClose]);

  if (!contact) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-700">
              <User className="h-6 w-6" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-neutral-900">
                {contact.username ? `@${contact.username}` : contact.firstName || 'Unknown user'}
              </h2>
              <p className="truncate text-[11px] text-neutral-500">
                IG ID {contact.recipientIgId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          {contact.firstName && (
            <DetailRow icon={User} label="Name" value={contact.firstName} />
          )}
          {contact.email && (
            <DetailRow
              icon={Mail}
              label="Email"
              value={
                <a href={`mailto:${contact.email}`} className="text-[#E63946] hover:underline">
                  {contact.email}
                </a>
              }
            />
          )}
          <DetailRow
            icon={MessageSquare}
            label="Interactions"
            value={`${contact.interactions} DM${contact.interactions === 1 ? '' : 's'} sent`}
          />
          <DetailRow
            icon={Calendar}
            label="Last active"
            value={contact.lastActive ? formatAbsolute(contact.lastActive) : '—'}
          />
          <DetailRow
            icon={Zap}
            label="Engaged automations"
            value={
              contact.automationNames
                ? <span className="text-neutral-700">{contact.automationNames}</span>
                : '—'
            }
          />
        </dl>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-500">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          {label}
        </dt>
        <dd className="mt-0.5 truncate text-sm text-neutral-900">{value}</dd>
      </div>
    </div>
  );
}

// ─── Export buttons ───────────────────────────────────────────────────────
function ExportButton({ label, contacts, format }) {
  const [busy, setBusy] = useState(false);
  const onClick = () => {
    if (busy || contacts.length === 0) return;
    setBusy(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      let blob;
      if (format === 'json') {
        blob = new Blob([JSON.stringify(contacts, null, 2)], { type: 'application/json' });
      } else {
        // Minimal CSV — quote any field containing a comma/newline/quote.
        const headers = ['username', 'firstName', 'email', 'interactions', 'lastActive', 'automationNames', 'recipientIgId'];
        const escape = (v) => {
          if (v == null) return '';
          const s = String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const rows = [
          headers.join(','),
          ...contacts.map((c) => headers.map((h) => escape(c[h])).join(',')),
        ];
        blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts-${stamp}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${contacts.length} contact${contacts.length === 1 ? '' : 's'}.`);
    } catch (err) {
      toast.error(err.message || 'Export failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || contacts.length === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" strokeWidth={2.5} />}
      {label}
    </button>
  );
}

// ─── Date formatters ──────────────────────────────────────────────────────
function formatRelative(ts) {
  const ms = Date.now() - new Date(ts).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function formatAbsolute(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}
