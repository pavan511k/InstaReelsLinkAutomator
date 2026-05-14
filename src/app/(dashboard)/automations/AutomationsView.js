'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { MessageCircle, BookOpen, Send, Sparkles, Plus, Search, ArrowLeft, X, ChevronRight, ChevronDown, Check, Loader2, Trash2, Power, RefreshCw, RotateCcw, Copy, MousePointerClick, Zap, Mail, Lock, Crown, HelpCircle } from 'lucide-react';
import AutomationRulesModal from '@/components/dashboard/AutomationRulesModal';
import { getAutomationLimit } from '@/lib/plans';
import PricingModal from '@/components/dashboard/PricingModal';

// Tab labels used in the list-state filter; mapped to the
// `templateType` value stored on each automation row so the filter
// is a simple equality check.
//
// Note: Ice Breakers is intentionally NOT in this list — it's an
// account-level config (one set of inbox openers per account, not
// a per-trigger automation), and lives at /tools/ice-breakers.
const TAB_TO_TYPE = {
  'All':              null,
  'Comment to DM':    'comment-to-dm',
  'Story Reply':      'story-reply',
  'DM Auto':          'dm-auto-responder',
  'Email Collector':  'email-collector',
};

const TYPE_LABEL = {
  'comment-to-dm':     'Comment to DM',
  'story-reply':       'Story Reply',
  'dm-auto-responder': 'DM Auto Responder',
  'email-collector':   'Email Collector',
};

const TEMPLATES = [
  {
    id:    'comment-to-dm',
    Icon:  MessageCircle,
    label: 'Comment to DM Flow',
    body:  'Auto-reply with a DM when someone comments a keyword on your post or Reel.',
    iconBg:'bg-[#E63946] text-white',
    badge: 'quick',
  },
  {
    id:    'story-reply',
    Icon:  BookOpen,
    label: 'Story Reply Flow',
    body:  'Auto-reply with a DM when someone replies to your story with a keyword.',
    iconBg:'bg-blue-600 text-white',
    badge: 'quick',
    // Stories don't exist on Facebook Pages. Hide this template when the
    // user's only connected platform is Facebook so they don't build a
    // flow that can never fire.
    igOnly: true,
  },
  // Ice Breakers moved to /tools/ice-breakers (account-level config,
  // not a per-trigger automation). Removed from the template picker.
  {
    id:    'dm-auto-responder',
    Icon:  Send,
    label: 'DM Auto Responder',
    body:  'Auto-reply with a DM when someone messages you a keyword.',
    iconBg:'bg-purple-600 text-white',
    badge: 'quick',
  },
  {
    id:    'email-collector',
    Icon:  Mail,
    label: 'Email Collector',
    body:  'Ask for an email after they comment or DM, then capture the reply as a lead.',
    iconBg:'bg-amber-500 text-white',
    badge: 'lead',
    proOnly: true, // Email Collector requires Pro/Trial — gated server-side too.
  },
];

// ─── Modal: Choose Template ────────────────────────────────────────────────
function TemplatePickerModal({ open, onClose, onPick, isPro = false, onUpgradeRequired, activePlatform = 'instagram' }) {
  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Hide IG-only templates when the user's only connected platform is FB.
  // 'both' shows everything; 'instagram' shows everything; 'facebook' drops
  // the templates flagged igOnly (currently just story-reply since FB Pages
  // don't have stories).
  const visibleTemplates = TEMPLATES.filter(
    (t) => !t.igOnly || activePlatform !== 'facebook',
  );

  const handlePick = (t) => {
    if (t.proOnly && !isPro) {
      onUpgradeRequired?.();
      return;
    }
    onPick(t);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      {/* Backdrop — intentionally NOT click-to-close so the user can't
          dismiss the modal by misclicking outside it. ESC and the X
          button are the only exits. */}
      <div
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm"
        aria-hidden
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl sm:p-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="picker-title" className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              Choose a Template
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Pick the type of automation you want to build.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Templates grid */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibleTemplates.map((t) => {
            const locked = t.proOnly && !isPro;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handlePick(t)}
                className={[
                  'group flex items-start gap-3 rounded-xl border bg-white p-4 text-left transition-shadow',
                  locked
                    ? 'border-amber-200 hover:border-amber-300 hover:shadow-md'
                    : 'border-neutral-200 hover:border-neutral-300 hover:shadow-md',
                ].join(' ')}
              >
                <span className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${t.iconBg} shadow-sm`}>
                  <t.Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-neutral-900">{t.label}</p>
                    {locked ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">
                        <Lock className="h-2 w-2" strokeWidth={3} />
                        Pro
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#FFF1F2] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#E63946]">
                        {t.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600">{t.body}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Name Automation ────────────────────────────────────────────────
function NameAutomationModal({ open, template, onBack, onClose, onContinue }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset name when modal opens with a different template (or reopens)
  useEffect(() => {
    if (open) setName('');
  }, [open, template?.id]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !template) return null;

  const canContinue = name.trim().length > 0 && !submitting;

  const handleContinue = async () => {
    if (!canContinue) return;
    setSubmitting(true);
    await onContinue(template, name.trim());
    // submitting stays true through navigation
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm"
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-title"
        className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl sm:p-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to templates"
              className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <div>
              <h2 id="name-title" className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
                Name your Automation
              </h2>
              <p className="mt-1 text-xs font-medium text-neutral-500">
                Creating: <span className="text-neutral-700">{template.label}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Selected template summary */}
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <span className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${template.iconBg} shadow-sm`}>
            <template.Icon className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-neutral-900">{template.label}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{template.body}</p>
          </div>
        </div>

        {/* Name input */}
        <div className="mt-6">
          <label htmlFor="autom-name" className="block text-xs font-semibold text-neutral-700">
            Automation name
          </label>
          <input
            id="autom-name"
            type="text"
            placeholder="e.g. Summer sale campaign"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            autoFocus
            className="mt-1.5 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          />
          <p className="mt-1.5 text-xs text-neutral-500">
            Give it a name so you can identify it in your list.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                Continue to Builder
                <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Compact custom dropdown — used by the Status and Type filters on
// the automations list. Replaces the native <select> with a styled
// popover so the typography and chrome match the rest of the page.
// Closes on outside-click, Escape, or selection. Headless: just
// `value`, `options` (label or {value,label}), and `onChange`.
function Dropdown({ value, onChange, options, label, className = '' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Click-outside + Escape close. We don't use a portal because the
  // menu is short and the parent isn't clipped.
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
          // Explicit h-10 so the dropdown matches the search input
          // exactly (input is also h-10 below). py-2.5 + text-sm
          // resolves to the same 42px height in theory but the
          // chevron icon's line-height was shifting the button by a
          // pixel — h-10 + items-center pins both to 40px clean.
          'inline-flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-sm font-medium text-neutral-700 transition-colors',
          open
            ? 'border-[#E63946] ring-2 ring-[#E63946]/20'
            : 'border-neutral-200 hover:border-neutral-300',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label && <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</span>}
        <span className="truncate">{selected?.label}</span>
        <ChevronDown className={['h-4 w-4 flex-shrink-0 text-neutral-500 transition-transform', open ? 'rotate-180' : ''].join(' ')} strokeWidth={2.5} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-20 mt-1 max-h-64 min-w-[180px] overflow-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
        >
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

// Refresh button — pulls fresh data via Next.js router.refresh(),
// which re-runs page.js's server fetch and pushes the new prop to
// AutomationsView. The brief spin animation gives the user feedback
// even when the refresh resolves instantly. We skip toasts here
// because the visible row update IS the feedback.
function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const onClick = () => {
    if (busy) return;
    setBusy(true);
    router.refresh();
    // 600ms is long enough to read as "something happened" but short
    // enough that the user doesn't think we're stuck.
    setTimeout(() => setBusy(false), 600);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title="Refresh automations"
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 transition-colors"
    >
      <RefreshCw className={['h-4 w-4', busy ? 'animate-spin' : ''].join(' ')} strokeWidth={2.5} />
    </button>
  );
}

// Shared action-icon button used in the automation row's Actions
// cell. Keeps each icon button visually consistent (same size, same
// hover state) without re-typing the className over and over. The
// `danger` variant is reserved for delete; everything else uses the
// neutral styling.
function RowAction({ title, icon: Icon, onClick, busy = false, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={title}
      aria-label={title}
      className={[
        'inline-flex h-7 w-7 items-center justify-center rounded-md border bg-white text-neutral-500 transition-colors disabled:opacity-50',
        danger
          ? 'border-neutral-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
          : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900',
      ].join(' ')}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
    </button>
  );
}

// ─── List of saved automations ─────────────────────────────────────────────
// Renders one card per automation: type badge, name, target (post
// thumb / "Any post" / "Next post"), keyword chips, status pill,
// row actions. Clicking the row body navigates to the builder in
// edit mode. Active toggle and Delete are stopPropagation'd so they
// don't trigger the navigation.
function AutomationsList({ automations, onUpgradeRequired }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  // Resend modal: keyed by automation id when open. Only post-bound
  // active automations can be resent — we surface the button on every
  // row so users can see it, but the modal disables the actions when
  // the row isn't eligible.
  const [resendForId, setResendForId] = useState(null);

  // Format the "Last published" cell — falls back to last update
  // when nothing's actually fired yet, so the cell never reads
  // "—" when we *do* know when the row was edited.
  const formatLastRun = (a) => {
    const ts = a.lastRunAt || a.updatedAt || a.createdAt;
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const duplicate = async (a) => {
    if (busyId) return;
    setBusyId(a.id);
    const tId = toast.loading('Duplicating…');
    try {
      const res = await fetch('/api/automations/builder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surface the upgrade modal when the server says the user
        // hit the free-tier automation cap. Toast is dismissed so
        // the modal is the only thing on screen.
        if (json?.upgradeRequired && onUpgradeRequired) {
          toast.dismiss(tId);
          onUpgradeRequired();
          return;
        }
        throw new Error(json?.error || 'Duplicate failed');
      }
      toast.success('Duplicated. The copy starts paused.', { id: tId });
      router.refresh();
    } catch (err) {
      toast.error(err.message || 'Duplicate failed', { id: tId });
    } finally {
      setBusyId(null);
    }
  };

  const goEdit = (id) => router.push(`/automations/builder?edit=${id}`);

  const toggleActive = async (a) => {
    if (busyId) return;
    setBusyId(a.id);
    const next = !a.isActive;
    const tId = toast.loading(next ? 'Activating…' : 'Pausing…');
    try {
      const res = await fetch('/api/automations/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, isActive: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Toggle failed');
      toast.success(next ? 'Live.' : 'Paused.', { id: tId });
      router.refresh();
    } catch (err) {
      toast.error(err.message || 'Toggle failed', { id: tId });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (a) => {
    if (busyId) return;
    setBusyId(a.id);
    const tId = toast.loading('Deleting…');
    try {
      const res = await fetch(`/api/automations/builder?id=${encodeURIComponent(a.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      toast.success('Deleted.', { id: tId });
      router.refresh();
    } catch (err) {
      toast.error(err.message || 'Delete failed', { id: tId });
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  // Fire the resend backfill for a given automation. The API runs the
  // work in `after()`, so the toast resolving means "queued to run",
  // not "all DMs sent". Recipients already DM'd are skipped, and so
  // are comments older than IG's 7-day Private Reply window.
  const resend = async (a) => {
    if (busyId) return;
    setBusyId(a.id);
    const tId = toast.loading('Starting resend…');
    try {
      const res = await fetch('/api/automations/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Resend failed');
      toast.success('Replaying for missed comments in the last 7 days.', { id: tId });
      setResendForId(null);
    } catch (err) {
      toast.error(err.message || 'Resend failed', { id: tId });
    } finally {
      setBusyId(null);
    }
  };

  if (automations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-10 text-center text-sm text-neutral-500">
        No automations match your filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* `table-fixed` + per-column widths gives every cell breathing
          room — auto layout collapsed the middle columns when content
          was short. Numeric columns (Runs/Clicks) are narrow + right-
          aligned; metadata columns (Status/Last published) get wider
          fixed widths so they don't crowd the actions cell.
          Column order: Automation, Type, Runs, Clicks, Status,
          Last published, Actions. The inline JSX comments that were
          here previously triggered a hydration error — JSX comments
          inside <colgroup> render as whitespace text nodes that the
          HTML spec rejects, so we keep the colgroup tag-only. */}
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[28%]" />
          <col className="hidden w-[14%] md:table-column" />
          <col className="w-[8%]" />
          <col className="hidden w-[8%] sm:table-column" />
          <col className="hidden w-[12%] sm:table-column" />
          <col className="hidden w-[14%] lg:table-column" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50/60 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            <th className="px-5 py-3.5">Automation</th>
            <th className="hidden px-4 py-3.5 md:table-cell">Type</th>
            <th className="px-4 py-3.5 text-right">Runs</th>
            <th className="hidden px-4 py-3.5 text-right sm:table-cell">Clicks</th>
            <th className="hidden px-4 py-3.5 sm:table-cell">Status</th>
            <th className="hidden px-4 py-3.5 lg:table-cell">Last published</th>
            <th className="px-5 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {automations.map((a) => {
            const isScheduled = a.scheduledStartAt && new Date(a.scheduledStartAt) > new Date();
            const statusPill = isScheduled
              ? { label: 'Scheduled', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
              : a.isActive
                ? { label: 'Live',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                : { label: 'Paused',   cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
            const targetLabel =
              a.postTargetMode === 'next' ? 'Next post' :
              a.postTargetMode === 'any'  ? 'Any post'  : null;
            // Tooltip for the keyword hint — kept off the visible row
            // so the table stays compact, but still reachable on hover
            // for "what does this fire on?".
            const keywordHint = a.anyKeyword
              ? 'Fires on any comment'
              : a.keywords.length > 0
                ? `Keywords: ${a.keywords.join(', ')}`
                : 'No keywords configured';

            return (
              <tr
                key={a.id}
                onClick={() => goEdit(a.id)}
                className="cursor-pointer transition-colors hover:bg-neutral-50"
              >
                {/* AUTOMATION cell: thumb + name (with keyword tooltip) */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {a.postThumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.postThumbUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-md border border-neutral-200 object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-neutral-200 bg-neutral-50 text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
                        {targetLabel || '—'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900" title={keywordHint}>
                        {a.name}
                      </p>
                      <p className="truncate text-[11px] text-neutral-500" title={keywordHint}>
                        {a.anyKeyword
                          ? 'Any keyword'
                          : a.keywords.length > 0
                            ? a.keywords.slice(0, 3).join(', ') + (a.keywords.length > 3 ? `, +${a.keywords.length - 3}` : '')
                            : 'No keywords'}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="hidden px-4 py-4 text-[12px] text-neutral-700 md:table-cell">
                  <span className="inline-flex items-center rounded bg-neutral-100 px-2 py-0.5 font-semibold uppercase tracking-wider text-[10px] text-neutral-700">
                    {TYPE_LABEL[a.templateType] || a.templateType}
                  </span>
                </td>

                <td className="px-4 py-4 text-right text-sm font-semibold text-neutral-900">
                  <span className="inline-flex items-center gap-1.5 text-neutral-700">
                    <Zap className="h-3 w-3 text-neutral-400" strokeWidth={2.5} />
                    {a.runs}
                  </span>
                </td>

                <td className="hidden px-4 py-4 text-right text-sm font-semibold text-neutral-900 sm:table-cell">
                  <span className="inline-flex items-center gap-1.5 text-neutral-700">
                    <MousePointerClick className="h-3 w-3 text-neutral-400" strokeWidth={2.5} />
                    {a.clicks}
                  </span>
                </td>

                <td className="hidden px-4 py-4 sm:table-cell">
                  <span className={['inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', statusPill.cls].join(' ')}>
                    {statusPill.label}
                  </span>
                </td>

                <td className="hidden px-4 py-4 text-[12px] text-neutral-600 lg:table-cell">
                  {formatLastRun(a)}
                </td>

                <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Resend only meaningfully applies to comment-on-
                        post automations — story replies expire in 24h
                        and DM auto-responders / ice breakers are
                        inbound-DM triggers with no historical surface
                        to walk. We hide the icon entirely for those
                        templates so the row doesn't carry an action
                        that would just open an "ineligible" modal. */}
                    {a.templateType === 'comment-to-dm' && (
                      <RowAction
                        title="Resend to past comments"
                        icon={RotateCcw}
                        busy={busyId === a.id}
                        onClick={() => setResendForId(a.id)}
                      />
                    )}
                    <RowAction
                      title={a.isActive ? 'Pause' : 'Activate'}
                      icon={Power}
                      busy={busyId === a.id}
                      onClick={() => toggleActive(a)}
                    />
                    <RowAction
                      title="Duplicate"
                      icon={Copy}
                      busy={busyId === a.id}
                      onClick={() => duplicate(a)}
                    />
                    <RowAction
                      title="Delete"
                      icon={Trash2}
                      danger
                      busy={busyId === a.id}
                      onClick={() => setConfirmDeleteId(a.id)}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Delete-confirmation modal — keeps the action behind a real
          decision since the row click does navigate. */}
      <ConfirmDeleteModal
        open={Boolean(confirmDeleteId)}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          const target = automations.find((x) => x.id === confirmDeleteId);
          if (target) remove(target);
        }}
      />

      <ResendModal
        open={Boolean(resendForId)}
        automation={automations.find((x) => x.id === resendForId) || null}
        busy={busyId === resendForId}
        onClose={() => setResendForId(null)}
        onResend={() => {
          const target = automations.find((x) => x.id === resendForId);
          if (target) resend(target);
        }}
      />
    </div>
  );
}

// Resend modal — two clear options, with eligibility hints surfaced
// up-front so the user understands when each mode applies. We
// deliberately don't auto-fire either action; both require an
// explicit click so users can read the description and pick.
function ResendModal({ open, automation, busy, onClose, onResend }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);
  if (!open || !automation) return null;

  // Resend is post-bound. Surface the reason this row can't resend
  // instead of silently disabling — users otherwise wonder why nothing
  // happens when they click.
  // Resend only makes sense for comment-on-post automations. Story
  // replies have no historical surface (the story expires in 24h and
  // replies arrive as DMs, not as a comment thread we can walk). DM
  // auto-responders and ice breakers are inbound-DM triggers and
  // similarly have nothing to "resend" against.
  const ineligibleReason =
    automation.templateType === 'story-reply'
      ? 'Resend isn\'t available for story replies — Stories expire in 24 hours and replies arrive as DMs, so there\'s no historical comment list to walk.'
      : (automation.templateType === 'dm-auto-responder' || automation.templateType === 'ice-breakers')
        ? 'Resend only applies to comment-on-post automations.'
        : !automation.postId
          ? 'This automation isn\'t bound to a specific post yet (Next Post / Any Post automations need to fire on a real post first).'
          : !automation.isActive
            ? 'Activate this automation first so the resent DMs actually fire.'
            : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-neutral-900">Resend DMs</h2>
            <p className="mt-1 truncate text-xs text-neutral-500">{automation.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {ineligibleReason ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-snug text-amber-800">
            {ineligibleReason}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Coverage section: header + a count pill of how many
                commenters are still eligible for a DM (= total comments
                under the post, minus the ones we've already DM'd). It's
                an upper bound — the real send count drops a bit more
                once the 7-day window cutoff and keyword filter apply
                during the actual run. */}
            {(() => {
              const total = automation.postCommentsCount;
              const sent  = automation.runs || 0;
              const knownTotal = typeof total === 'number';
              const eligible   = knownTotal ? Math.max(0, total - sent) : null;
              return (
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-neutral-900">Current Coverage</h3>
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
                    {knownTotal ? `${eligible} comment${eligible === 1 ? '' : 's'} available` : 'Count unavailable'}
                  </span>
                </div>
              );
            })()}

            {/* THROTTLED PROCESSING notice — sets the expectation that
                large reruns aren't instant. Prevents users from
                wondering why nothing changed in the next 30 seconds. */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Throttled processing</p>
              <p className="mt-1 text-[12px] leading-relaxed text-amber-900/90">
                Large reruns are processed in batches with delays to avoid
                Instagram&apos;s spam detection. Expect the queue to drain over
                a few minutes rather than all at once.
              </p>
            </div>

            {/* Native list-disc keeps bullet spacing tight (one source
                of truth for the gap between the bullet and the text)
                instead of the flex+span+literal-space pattern that
                read as awkwardly wide. */}
            <ul className="list-disc space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-neutral-600 marker:text-neutral-400">
              <li>Already-DM&apos;d commenters are skipped automatically.</li>
              <li>Comments older than <strong className="text-neutral-700">7 days</strong> are skipped (Instagram policy).</li>
            </ul>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onResend()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 transition-colors"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.5} />}
                Resend missed
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function ConfirmDeleteModal({ open, onClose, onConfirm }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-neutral-900">Delete this automation?</h2>
        <p className="mt-2 text-sm text-neutral-600">
          The automation will stop firing immediately. Any DMs already in
          the queue will still send.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page View ─────────────────────────────────────────────────────────────
export default function AutomationsView({ automations = [], effectivePlan = 'free', activePlatform = 'instagram' }) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // No local copy of `automations` — we render straight from the prop.
  // Mutations (pause/activate/delete) call `router.refresh()` which
  // re-runs page.js's server fetch and pushes a fresh prop in. Keeping
  // local state out of the loop avoids the bug where the Pause button
  // stayed labeled "Pause" after pausing because the local copy never
  // received the updated is_active flag.
  const isEmpty = automations.length === 0;

  // Free-tier automation cap. atLimit gates the "New automation"
  // button: clicking opens the PricingModal instead of the picker.
  // The server-side check in /api/automations/builder is the
  // authoritative gate — this is just the UX nudge.
  const automationLimit = getAutomationLimit(effectivePlan);
  const atLimit         = automationLimit != null && automations.length >= automationLimit;
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showRulesModal,   setShowRulesModal]   = useState(false);

  // Filters (search + template tab + status). Derived list runs
  // through all three.
  const [search, setSearch]       = useState('');
  const [tab, setTab]             = useState('All');
  const [statusFilter, setStatus] = useState('All Status'); // All Status | Live | Paused | Scheduled

  const filteredAutomations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return automations.filter((a) => {
      if (tab !== 'All' && TAB_TO_TYPE[tab] !== a.templateType) return false;
      if (statusFilter !== 'All Status') {
        const isScheduled = a.scheduledStartAt && new Date(a.scheduledStartAt).getTime() > now;
        const status = isScheduled ? 'Scheduled' : (a.isActive ? 'Live' : 'Paused');
        if (statusFilter !== status) return false;
      }
      if (!q) return true;
      const haystack = [
        a.name, a.templateType,
        ...(a.keywords || []),
        a.postCaption || '',
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [automations, search, tab, statusFilter]);

  // Modal state machine: 'closed' | 'picker' | 'name'
  const [stage, setStage]                     = useState('closed');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Auto-open the picker if /automations was loaded with ?modal=picker.
  // The dashboard's "+ New automation" button uses this so the modal pops
  // open the moment the user lands here — no extra click required.
  useEffect(() => {
    if (searchParams.get('modal') === 'picker' && stage === 'closed') {
      setStage('picker');
    }
    // Only run on mount + when the param flips. Stage is intentionally
    // omitted from deps so closing the modal doesn't re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Auto-open the PricingModal when /automations was loaded with
  // ?upgrade=<type>. The builder page redirects here when a free user
  // tries to access a Pro-only template via direct URL — landing on
  // the upgrade flow keeps the funnel coherent.
  useEffect(() => {
    if (searchParams.get('upgrade')) {
      setShowPricingModal(true);
      // Strip the param so a refresh doesn't keep re-firing the modal.
      router.replace('/automations', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openPicker = () => {
    if (atLimit) {
      setShowPricingModal(true);
      return;
    }
    setSelectedTemplate(null);
    setStage('picker');
  };
  const closeAll = () => {
    setStage('closed');
    setSelectedTemplate(null);
    // Strip ?modal=picker from URL so a refresh doesn't re-open the modal.
    if (searchParams.get('modal')) {
      router.replace('/automations', { scroll: false });
    }
  };
  const handlePick = (template) => {
    setSelectedTemplate(template);
    setStage('name');
  };
  const handleBackToPicker = () => {
    setStage('picker');
    // keep selectedTemplate so the user can re-pick / change
  };
  const handleContinue = (template, name) => {
    // Phase 7 will build /automations/builder. For now this navigation
    // produces a 404 in the browser, which is intentional — state is
    // passed via the URL so Phase 7 can pick it up directly.
    router.push(
      `/automations/builder?type=${encodeURIComponent(template.id)}&name=${encodeURIComponent(name)}`
    );
  };

  return (
    <div className="space-y-8">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Automations
            </h1>
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              aria-label="How do automations decide which one fires?"
              title="Which automation fires? (rules)"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            Manage every automation in one place — comments, stories, DMs, and ice breakers.
          </p>
        </div>
        {!isEmpty && (
          <div className="flex flex-shrink-0 items-center gap-2">
            {automationLimit != null && (
              <span className={[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                atLimit
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-700',
              ].join(' ')}>
                {atLimit && <Lock className="h-3 w-3" strokeWidth={2.5} />}
                {automations.length} / {automationLimit} automations
              </span>
            )}
            <RefreshButton />
            <button
              type="button"
              onClick={openPicker}
              className={[
                'inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold shadow-sm transition-colors',
                atLimit
                  ? 'bg-[#E63946] text-white hover:bg-[#CC2E3B]'
                  : 'bg-neutral-900 text-white hover:bg-black',
              ].join(' ')}
              title={atLimit ? `Free plan limit reached (${automationLimit} automations). Upgrade to Pro for unlimited.` : undefined}
            >
              {atLimit ? <Crown className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
              {atLimit ? 'Upgrade for more' : 'New automation'}
            </button>
          </div>
        )}
      </div>

      {/* ── EMPTY STATE: hero card → opens template-picker modal ─── */}
      {isEmpty && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 shadow-sm sm:p-14">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1F2] text-[#E63946] shadow-sm">
              <Sparkles className="h-7 w-7" strokeWidth={2} />
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Create your first automation
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              Pick a template to start auto-replying to comments, stories, and DMs in minutes.
            </p>
            <button
              type="button"
              onClick={openPicker}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black transition-colors"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New automation
            </button>
          </div>
        </div>
      )}

      {/* ── LIST STATE: filters + automations table ──────────────── */}
      {!isEmpty && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" strokeWidth={2} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search automations…"
                /* h-10 locks the search box to the same 40px height
                   as the dropdowns next to it; pl-9 leaves room for
                   the inline search icon. */
                className="block h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Dropdown
                value={statusFilter}
                onChange={setStatus}
                options={['All Status', 'Live', 'Paused', 'Scheduled']}
                className="min-w-[150px]"
              />
              <Dropdown
                value={tab}
                onChange={setTab}
                options={Object.keys(TAB_TO_TYPE)}
                className="min-w-[170px]"
              />
            </div>
          </div>

          <AutomationsList
            automations={filteredAutomations}
            onUpgradeRequired={() => setShowPricingModal(true)}
          />
        </>
      )}

      {/* ── Modals ───────────────────────────────────────────────── */}
      <TemplatePickerModal
        open={stage === 'picker'}
        onClose={closeAll}
        onPick={handlePick}
        isPro={['pro', 'business', 'trial'].includes(effectivePlan)}
        onUpgradeRequired={() => {
          closeAll();
          setShowPricingModal(true);
        }}
        activePlatform={activePlatform}
      />
      <NameAutomationModal
        open={stage === 'name'}
        template={selectedTemplate}
        onBack={handleBackToPicker}
        onClose={closeAll}
        onContinue={handleContinue}
      />

      <PricingModal
        open={showPricingModal}
        onClose={() => setShowPricingModal(false)}
      />

      <AutomationRulesModal
        open={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />
    </div>
  );
}
