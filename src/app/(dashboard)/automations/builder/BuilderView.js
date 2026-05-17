'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Use useLayoutEffect on the client (runs synchronously before paint,
// no FOUC) and useEffect on the server (avoids the React warning that
// useLayoutEffect doesn't do anything during SSR).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronLeft, Pencil, Save, Zap, MessageCircle, Hash, Send, Settings2,
  X, Plus, Link2, Heart, Camera, Mic, Smile, RefreshCw, Loader2,
  UploadCloud, Shuffle, Check, User, SquarePen,
  // IG post-view chrome
  Home, Search, PlusSquare, Film, Bookmark, MoreHorizontal,
} from 'lucide-react';
import PricingModal from '@/components/dashboard/PricingModal';

// ─── Defaults / suggestion pools ──────────────────────────────────────────
// Opening message — short two-paragraph hook that introduces the
// quick-reply button below it. We pre-fill this so brand-new
// automations have a sensible starting point instead of an empty
// textarea, which felt unfinished to first-time users.
const DEFAULT_OPENING_MESSAGE = "Thanks for the interest! 🙌\n\nClick below and I'll send the link right away 🔥";

// Pool of DM-message suggestions. Users can shuffle between these
// (Shuffle button next to the textarea); the pool is small enough
// that picking by index keeps the experience predictable. Each entry
// is two short lines so it reads naturally in the IG chat bubble.
const DM_MESSAGE_POOL = [
  "Here's the info you requested 🔗\nFeel free to check it out.",
  "All good 😊\nYou'll find the details below.",
  "Thanks for reaching out! 👋\nSharing the details you were looking for below.",
  "Sharing it with you now 👀\nLet me know what you think.",
  "This should help 😊\nLet me know if you have any questions.",
  "Here it is 👇\nLet me know if you need anything else.",
];

const CARDS_BY_TEMPLATE = {
  'comment-to-dm':     ['select-post', 'keywords', 'send-dm', 'advanced'],
  'story-reply':       ['select-story', 'keywords', 'send-dm', 'advanced'],
  // 'ice-breakers' lives at /tools/ice-breakers — not a per-trigger
  // automation, so it isn't part of CARDS_BY_TEMPLATE anymore.
  'dm-auto-responder': ['keywords', 'send-dm', 'advanced'],
  // Email Collector replaces the main DM with an email-ask + capture.
  // Trigger pattern is the same as DM Auto Responder (keyword-based);
  // the bot's reply is the ask message + a thank-you message that
  // fires when a valid email is captured.
  'email-collector':   ['keywords', 'email-capture', 'advanced'],
};

const TEMPLATE_LABEL = {
  'comment-to-dm':     { label: 'Comment to DM Flow', breadcrumb: 'Flow Builder' },
  'story-reply':       { label: 'Story Reply Flow',   breadcrumb: 'Story Reply' },
  'dm-auto-responder': { label: 'DM Auto Responder',  breadcrumb: 'DM Responder' },
  'email-collector':   { label: 'Email Collector',    breadcrumb: 'Email Capture' },
};

// ─── Reusable atoms ────────────────────────────────────────────────────────
function CardShell({ num, title, hint, icon: Icon, children, isFocused, onFocus }) {
  return (
    <div
      onClick={onFocus}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        // Only fire on Enter/Space if the card itself is the target —
        // never swallow keystrokes meant for inputs/buttons inside.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus?.(); }
      }}
      className={[
        'cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition-all',
        isFocused
          ? 'border-[#E63946] ring-2 ring-[#E63946]/15 shadow-md'
          : 'border-neutral-200 hover:border-neutral-300',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
          {num}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            {Icon && <Icon className="h-4 w-4 text-neutral-500" strokeWidth={2} />}
            {title}
          </h3>
          {hint && <p className="mt-1 text-xs leading-relaxed text-neutral-500">{hint}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label, sublabel, disabled, proGated }) {
  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-neutral-900">{label}</p>
          {proGated && (
            <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
              Pro
            </span>
          )}
        </div>
        {sublabel && <p className="mt-0.5 text-xs text-neutral-500">{sublabel}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={[
          'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-[#E63946]' : 'bg-neutral-200',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          ].join(' ')}
        />
      </button>
    </label>
  );
}

function Radio({ value, current, onChange, label, sublabel }) {
  const checked = current === value;
  return (
    <label
      className={[
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
        checked ? 'border-[#E63946] bg-[#FFF1F2]' : 'border-neutral-200 bg-white hover:border-neutral-300',
      ].join(' ')}
    >
      <input
        type="radio"
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span
        className={[
          'mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2',
          checked ? 'border-[#E63946]' : 'border-neutral-300',
        ].join(' ')}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-[#E63946]" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${checked ? 'text-[#E63946]' : 'text-neutral-900'}`}>
          {label}
        </p>
        {sublabel && <p className="mt-0.5 text-xs text-neutral-500">{sublabel}</p>}
      </div>
    </label>
  );
}

// ─── Add-link modal ────────────────────────────────────────────────────────
function AddLinkModal({ open, initial, defaultLabel = '', onSave, onClose }) {
  const [label, setLabel] = useState('');
  const [url,   setUrl]   = useState('');
  // Track whether the user has interacted with each field so errors
  // only appear after a field has been blurred (or submit attempted).
  const [labelTouched, setLabelTouched] = useState(false);
  const [urlTouched,   setUrlTouched]   = useState(false);

  useEffect(() => {
    if (open) {
      // When adding a new button (initial=null), seed from the user's
      // saved default button name from Settings → Default Configuration.
      // Editing an existing button always uses its own label.
      setLabel(initial?.label ?? defaultLabel ?? '');
      setUrl(initial?.url || '');
      // When editing, treat both fields as already touched so any
      // existing invalid value surfaces its message immediately.
      setLabelTouched(Boolean(initial));
      setUrlTouched(Boolean(initial));
    }
  }, [open, initial, defaultLabel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Validate fields independently so we can surface specific messages.
  // Errors only render after the user has actually typed something or
  // attempted to submit — avoids barking before they've started.
  const labelTrim = label.trim();
  const urlTrim   = url.trim();
  const labelError = labelTrim.length === 0
    ? 'Button text is required.'
    : null;
  const urlError = urlTrim.length === 0
    ? 'URL is required.'
    : !/^https?:\/\//i.test(urlTrim)
      ? 'Please enter a valid URL starting with http:// or https://'
      : null;
  const valid = !labelError && !urlError;

  // Show errors as the user types after they've blurred the field at
  // least once. State flag per field.
  const labelTouchedShow = labelTouched && labelError;
  const urlTouchedShow   = urlTouched && urlError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-neutral-900">{initial ? 'Edit Link Button' : 'Add Link Button'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-700">Button text</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => setLabelTouched(true)}
              placeholder="Send me the link"
              maxLength={20}
              aria-invalid={Boolean(labelTouchedShow)}
              className={[
                'mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2',
                labelTouchedShow
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-neutral-300 focus:border-[#E63946] focus:ring-[#E63946]/20',
              ].join(' ')}
            />
            {labelTouchedShow && (
              <p className="mt-1 text-[11px] text-red-600">{labelError}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => setUrlTouched(true)}
              placeholder="https://example.com"
              aria-invalid={Boolean(urlTouchedShow)}
              className={[
                'mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2',
                urlTouchedShow
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-neutral-300 focus:border-[#E63946] focus:ring-[#E63946]/20',
              ].join(' ')}
            />
            {urlTouchedShow && (
              <p className="mt-1 text-[11px] text-red-600">{urlError}</p>
            )}
          </div>
        </div>

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
            onClick={() => {
              // Don't disable on invalid — surface the field-level
              // errors on attempted submit so the user understands what
              // to fix instead of a silently-greyed-out button.
              if (!valid) {
                setLabelTouched(true);
                setUrlTouched(true);
                return;
              }
              onSave({ label: labelTrim, url: urlTrim });
            }}
            className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors"
          >
            {initial ? 'Update Button' : 'Add Button'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Public Reply modal ────────────────────────────────────────────────
// Simple text-only modal — public replies are short text strings, no URL or
// image like the link-button modal. New replies land enabled in the pool.
function AddPublicReplyModal({ open, onClose, onSave }) {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setText(''); setTouched(false); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const trimmed = text.trim();
  const error   = trimmed.length === 0 ? 'Reply text is required.' : null;
  const valid   = !error;
  const showError = touched && error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-neutral-900">Add Public Reply</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-neutral-700">Reply text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 100))}
            onBlur={() => setTouched(true)}
            placeholder="Check your DMs! 📬"
            rows={3}
            className={[
              'mt-1 block w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2',
              showError
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                : 'border-neutral-300 focus:border-[#E63946] focus:ring-[#E63946]/20',
            ].join(' ')}
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
            <span>{showError ? <span className="text-red-600">{error}</span> : 'Up to 100 characters.'}</span>
            <span>{trimmed.length} / 100</span>
          </div>
        </div>

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
            onClick={() => {
              if (!valid) { setTouched(true); return; }
              onSave({ text: trimmed, enabled: true, isCustom: true });
            }}
            className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors"
          >
            Add Reply
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sync button — pulls fresh posts/stories from Instagram ───────────────
// Sits next to the "Specific Post"/"Specific Story" picker so the user
// can refresh without leaving the builder. POSTs to /api/posts/sync,
// then `router.refresh()` re-runs the server component to re-read
// instagram_posts. Showing a spinner during the call so the user
// understands they should wait.
function SyncPostsButton({ label = 'Sync' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onSync = async (e) => {
    e.stopPropagation(); // don't trigger CardShell focus
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/posts/sync', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Sync failed');
      }
      router.refresh();
    } catch (err) {
      setError(err.message || 'Sync failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSync}
        disabled={busy}
        title="Pull fresh posts from Instagram"
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" strokeWidth={2.5} />
        )}
        {busy ? 'Syncing…' : label}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}

// ─── Reusable: post/story tile grid ────────────────────────────────────────
// Renders a 3-column thumbnail grid of the user's Instagram media. Click
// to select; selected tile gets a coral ring + check overlay. Empty
// state surfaces a helpful hint instead of a silent zero-row UI.
//
// Shows the first `maxVisible` posts inline and surfaces a "Show More"
// button when there are more — the parent opens a fullscreen modal
// (AllPostsModal) with engagement counts so the user can pick by
// performance rather than reorder by date alone.
function PostGrid({ posts, selectedPostId, onSelect, onShowMore, emptyLabel, maxVisible = 3 }) {
  if (!posts || posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center">
        <p className="text-xs text-neutral-500">{emptyLabel}</p>
      </div>
    );
  }
  const visible  = posts.slice(0, maxVisible);
  const hasMore  = posts.length > maxVisible;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {visible.map((p) => (
          <PostTile
            key={p.id}
            post={p}
            isSelected={selectedPostId === p.id}
            onSelect={onSelect}
          />
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onShowMore?.(); }}
          className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Show More
        </button>
      )}
    </div>
  );
}

// Single post tile — thumbnail + selection ring/check. Shared between
// PostGrid (compact in the card) and AllPostsModal (with engagement
// numbers overlaid in the bottom-left corner).
function PostTile({ post, isSelected, onSelect, showStats = false }) {
  const thumb = post.thumbnail_url || post.media_url;
  const likes = typeof post.like_count === 'number' ? post.like_count : null;
  const comments = typeof post.comments_count === 'number' ? post.comments_count : null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onSelect(post.id); }}
      className={[
        'group relative aspect-square overflow-hidden rounded-lg border bg-neutral-100 transition-all',
        isSelected ? 'border-[#E63946] ring-2 ring-[#E63946]/20' : 'border-neutral-200 hover:border-neutral-300',
      ].join(' ')}
      title={post.caption || ''}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
          no preview
        </div>
      )}
      {isSelected && (
        <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E63946] text-white shadow">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 8 7 12 13 4" />
          </svg>
        </span>
      )}
      {showStats && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] font-semibold text-white">
          <span className="inline-flex items-center gap-0.5">
            <Heart className="h-3 w-3" strokeWidth={2} />
            {likes ?? '—'}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <MessageCircle className="h-3 w-3" strokeWidth={2} />
            {comments ?? '—'}
          </span>
        </div>
      )}
    </button>
  );
}

// Fullscreen-ish modal shown when the user clicks "Show More" under
// the post grid. Renders all posts with engagement counts overlaid
// so the user can pick a high-performing post quickly. Uses a staged
// `pending` selection so cancelling doesn't apply the change.
function AllPostsModal({ open, posts, isStoryFlow, initialSelectedId, onClose, onConfirm }) {
  const [pending, setPending] = useState(initialSelectedId);

  useEffect(() => {
    if (open) setPending(initialSelectedId);
  }, [open, initialSelectedId]);

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
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-bold text-neutral-900">
            {isStoryFlow ? 'Select Story' : 'Select Post or Reel'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Grid (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {posts.map((p) => (
              <PostTile
                key={p.id}
                post={p}
                isSelected={pending === p.id}
                onSelect={setPending}
                showStats
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-6 py-3">
          <p className="text-xs text-neutral-500">
            {pending ? '1 selected' : 'Pick a post to continue'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!pending}
              onClick={() => onConfirm(pending)}
              className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card: Select Post (comment-to-dm) ─────────────────────────────────────
function SelectPostCard({ mode, onMode, posts, selectedPostId, onSelectPost, isFocused, onFocus }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <CardShell num={1} title="Select a Post" icon={MessageCircle} hint="Pick which post triggers the automation." isFocused={isFocused} onFocus={onFocus}>
      <div className="space-y-2">
        <Radio value="specific" current={mode} onChange={onMode} label="Specific Post" sublabel="Pick from your existing posts." />
        <Radio value="next"     current={mode} onChange={onMode} label="Next Post"     sublabel="Activates on your next published post." />
        <Radio value="any"      current={mode} onChange={onMode} label="Any Post"      sublabel="Fires on every post in your account." />
      </div>

      {mode === 'specific' && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Choose a post
            </p>
            <SyncPostsButton label="Sync posts" />
          </div>
          <PostGrid
            posts={posts}
            selectedPostId={selectedPostId}
            onSelect={onSelectPost}
            onShowMore={() => setModalOpen(true)}
            emptyLabel="No synced posts yet — click Sync above to pull fresh posts from Instagram."
          />
        </div>
      )}

      <AllPostsModal
        open={modalOpen}
        posts={posts}
        isStoryFlow={false}
        initialSelectedId={selectedPostId}
        onClose={() => setModalOpen(false)}
        onConfirm={(id) => { onSelectPost(id); setModalOpen(false); }}
      />
    </CardShell>
  );
}

function SelectStoryCard({ mode, onMode, posts, selectedPostId, onSelectPost, isFocused, onFocus }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <CardShell num={1} title="Select a Story" icon={MessageCircle} hint="Pick which story triggers the automation." isFocused={isFocused} onFocus={onFocus}>
      <div className="space-y-2">
        <Radio value="specific" current={mode} onChange={onMode} label="Specific Story" sublabel="Pick from your active stories." />
        <Radio value="any"      current={mode} onChange={onMode} label="Any Story"      sublabel="Fires on replies to any of your stories." />
      </div>
      {mode === 'specific' && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Choose a story
            </p>
            <SyncPostsButton label="Sync stories" />
          </div>
          <PostGrid
            posts={posts}
            selectedPostId={selectedPostId}
            onSelect={onSelectPost}
            onShowMore={() => setModalOpen(true)}
            emptyLabel="No active stories right now. Click Sync to refresh."
          />
        </div>
      )}

      <AllPostsModal
        open={modalOpen}
        posts={posts}
        isStoryFlow
        initialSelectedId={selectedPostId}
        onClose={() => setModalOpen(false)}
        onConfirm={(id) => { onSelectPost(id); setModalOpen(false); }}
      />
    </CardShell>
  );
}

// ─── Card: Keywords (shared) ───────────────────────────────────────────────
function KeywordsCard({ num, anyKeyword, onAnyKeyword, keywords, onAddKeyword, onRemoveKeyword, isFocused, onFocus }) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed || keywords.includes(trimmed)) {
      setInput('');
      return;
    }
    onAddKeyword(trimmed);
    setInput('');
  };

  return (
    <CardShell num={num} title="Add Keywords" icon={Hash} hint="Comments matching these will fire the DM." isFocused={isFocused} onFocus={onFocus}>
      <Toggle
        checked={anyKeyword}
        onChange={onAnyKeyword}
        label="Any keyword"
        sublabel="Fire on ANY comment, regardless of content."
      />

      {!anyKeyword && (
        <>
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              placeholder="Type keyword and press Enter"
              className="block flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white hover:bg-black transition-colors"
              aria-label="Add keyword"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          {keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 rounded-full bg-[#FFF1F2] px-2.5 py-1 text-xs font-medium text-[#E63946]"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => onRemoveKeyword(kw)}
                    className="text-[#E63946]/60 hover:text-[#E63946]"
                    aria-label={`Remove ${kw}`}
                  >
                    <X className="h-3 w-3" strokeWidth={3} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </CardShell>
  );
}

// ─── LockedTextField — locked-by-default inline editor ────────────────────
// Shared between the Opening button text and the Follow-confirmation
// button text. The button text is the postback label IG shows users,
// so accidental edits change the user-facing CTA. We render it locked
// behind a square-pen — click to unlock + autofocus, click the check
// (or blur) to lock it again.
function LockedTextField({ value, onChange, label, placeholder, maxLength = 20 }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <label className="block text-[11px] font-semibold text-neutral-700">{label}</label>
      <div className={[
        'mt-1 flex items-center gap-1 rounded-lg border bg-white pr-1 transition-colors',
        editing ? 'border-[#E63946] ring-2 ring-[#E63946]/20' : 'border-neutral-300',
      ].join(' ')}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          readOnly={!editing}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false); }}
          placeholder={placeholder}
          className={[
            'block w-full rounded-l-lg border-0 bg-transparent px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition-colors',
            editing ? '' : 'cursor-default text-neutral-700',
          ].join(' ')}
        />
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label={editing ? 'Lock button text' : 'Edit button text'}
          title={editing ? 'Done — lock button text' : 'Edit button text'}
          className={[
            'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
            editing
              ? 'bg-[#E63946] text-white hover:bg-[#CC2E3B]'
              : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900',
          ].join(' ')}
        >
          {editing ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <SquarePen className="h-3.5 w-3.5" strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}

// ─── DM-trigger overlap notice ─────────────────────────────────────────────
// Surfaces a small callout below the keyword card when this automation's
// shape would overlap with another active DM-triggered automation in the
// same workspace. Helps creators understand precedence without reading
// the "How it works" modal:
//   • Editing an Email Collector while an any-keyword Auto-Responder
//     exists: Auto-Responder won't intercept this collector's keywords
//     or the fan's email reply.
//   • Editing a DM Auto-Responder with "Any keyword" on while specific-
//     keyword Email Collectors exist: those keywords stay claimed by the
//     collectors; this catch-all handles everything else.
// Renders nothing for templates that don't share the DM-trigger surface
// (comment-to-dm, story-reply) or when no overlap exists.
function DmOverlapNotice({ type, anyKeyword, relatedDmAutomations }) {
  if (type !== 'email-collector' && type !== 'dm-auto-responder') return null;
  if (!relatedDmAutomations || relatedDmAutomations.length === 0) return null;

  // Editing an Email Collector → look for catch-all Auto-Responders.
  if (type === 'email-collector') {
    const catchAlls = relatedDmAutomations.filter(
      (a) => a.templateType === 'dm-auto-responder' && a.anyKeyword,
    );
    if (catchAlls.length === 0) return null;
    return (
      <NoticeCard
        tone="info"
        title="Your catch-all auto-responder won't interfere"
      >
        You have an &quot;any-keyword&quot; DM Auto-Responder
        {catchAlls.length === 1 ? (
          <> (<strong className="font-semibold">{catchAlls[0].name}</strong>)</>
        ) : (
          <> ({catchAlls.length} active)</>
        )}
        . Don&apos;t worry — this Email Collector will still fire on its
        keywords, and the fan&apos;s email reply will route back here for
        up to 24 hours.
      </NoticeCard>
    );
  }

  // Editing a DM Auto-Responder with anyKeyword on → list overlapping
  // Email Collectors so the creator can see what's claimed.
  if (!anyKeyword) return null;
  const collectors = relatedDmAutomations.filter(
    (a) => a.templateType === 'email-collector',
  );
  if (collectors.length === 0) return null;

  return (
    <NoticeCard
      tone="info"
      title="Existing Email Collectors keep their keywords"
    >
      This catch-all will handle every DM <em>except</em> those claimed by
      your Email Collectors:
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12px] text-neutral-700">
        {collectors.map((c) => (
          <li key={c.id}>
            <strong className="font-semibold">{c.name}</strong>
            {c.anyKeyword
              ? <> &mdash; <span className="text-neutral-500">any keyword</span></>
              : c.keywords.length > 0
                ? <> &mdash; <span className="font-mono text-neutral-700">{c.keywords.slice(0, 5).join(', ')}{c.keywords.length > 5 ? '…' : ''}</span></>
                : null}
          </li>
        ))}
      </ul>
    </NoticeCard>
  );
}

function NoticeCard({ tone = 'info', title, children }) {
  // Tone is reserved for future variants (warn/error). Today only `info`.
  void tone;
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex items-start gap-2.5">
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">i</div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-blue-900">{title}</p>
          <div className="mt-1 text-[12px] leading-relaxed text-blue-900/85">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Card: Send DM Message (shared) ────────────────────────────────────────
function SendDMCard({
  num, title, hint, dmMessage, onDmMessage, charLimit,
  dmImage, onDmImage,
  dmImageHeadline, onDmImageHeadline,
  linkButtons, onAddLinkButton, onEditLinkButton, onRemoveLinkButton,
  openingEnabled, onOpeningEnabled,
  openingMessage, onOpeningMessage,
  openingButtonText, onOpeningButtonText,
  isFocused, onFocus,
}) {
  // IG caps the button-list element at 3 CTA buttons in a DM.
  const maxButtons = 3;
  const canAddMore = linkButtons.length < maxButtons;

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handleFileSelect = async (e) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setUploadError('Please pick an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5 MB.');
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const { createClient } = await import('@/lib/supabase-client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in.');
      const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const filename = `${user.id}/builder_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('dm_images')
        .upload(filename, file, { upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { data: { publicUrl } } = supabase.storage.from('dm_images').getPublicUrl(filename);
      onDmImage(publicUrl);
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // Shuffle to the next entry in DM_MESSAGE_POOL. We avoid re-picking
  // the current value so consecutive shuffles never feel like a no-op.
  const handleShuffleDm = (e) => {
    e.stopPropagation();
    const others = DM_MESSAGE_POOL.filter((m) => m !== dmMessage);
    const next = others.length > 0
      ? others[Math.floor(Math.random() * others.length)]
      : DM_MESSAGE_POOL[0];
    onDmMessage(next.slice(0, charLimit));
  };

  return (
    <CardShell num={num} title={title} icon={Send} hint={hint} isFocused={isFocused} onFocus={onFocus}>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Message
          </p>
          <button
            type="button"
            onClick={handleShuffleDm}
            title="Shuffle to a different suggestion"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
          >
            <Shuffle className="h-3 w-3" strokeWidth={2.5} />
            Shuffle
          </button>
        </div>
        <textarea
          value={dmMessage}
          onChange={(e) => onDmMessage(e.target.value.slice(0, charLimit))}
          placeholder="Enter your message here…"
          rows={4}
          className="block w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
          <span>{dmMessage.length} / {charLimit}</span>
        </div>
      </div>

      {/* Image upload — sent above the text bubble in the DM. Files
          land in the `dm_images` storage bucket; we keep the public
          URL in state so the phone preview can render it live. */}
      <div className="mt-3">
        {dmImage ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dmImage} alt="" className="max-h-32 rounded-lg border border-neutral-200 object-cover" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDmImage(null); }}
              className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow hover:text-red-600"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <label
            className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-center hover:border-[#E63946] hover:bg-[#FFF1F2]/40 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-[#E63946]" />
                <span className="text-sm font-semibold text-neutral-700">Uploading…</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-6 w-6 text-[#E63946]" strokeWidth={2} />
                <span className="text-sm font-semibold text-neutral-900">Click to upload an image</span>
                <span className="text-[11px] text-neutral-500">PNG, JPG, WebP · up to 5 MB</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
        )}
        {uploadError && (
          <p className="mt-1 text-[11px] text-red-600">{uploadError}</p>
        )}

        {/* Optional image-card title — appears above the buttons in the
            DM bubble. Only shown when an image is attached. Leave blank
            to use the first line of the message automatically. Capped at
            80 chars per Meta's generic_template title limit. */}
        {dmImage && (
          <div className="mt-3">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
              Image headline <span className="text-neutral-400 normal-case font-normal tracking-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={dmImageHeadline || ''}
              onChange={(e) => onDmImageHeadline(e.target.value.slice(0, 80))}
              placeholder="e.g. 🍪 Chakli Special — 20% off"
              maxLength={80}
              className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
              <span className="text-neutral-400">
                Leave blank to use the message&apos;s first line.
              </span>
              <span>{(dmImageHeadline || '').length} / 80</span>
            </div>
          </div>
        )}
      </div>

      {linkButtons.length > 0 && (
        <div className="mt-3 space-y-2">
          {linkButtons.map((btn, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white">
                <Link2 className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-neutral-900">{btn.label}</p>
                <p className="truncate text-[11px] text-neutral-500">{btn.url}</p>
              </div>
              <button
                type="button"
                onClick={() => onEditLinkButton(i)}
                className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onRemoveLinkButton(i)}
                className="text-[11px] font-semibold text-red-600 hover:text-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAddLinkButton}
        disabled={!canAddMore}
        title={canAddMore ? '' : `Up to ${maxButtons} CTA buttons per DM`}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        {linkButtons.length === 0 ? 'Add Link Button' : `Add another (${linkButtons.length}/${maxButtons})`}
      </button>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <Toggle
          checked={openingEnabled}
          onChange={onOpeningEnabled}
          label="Opening message"
          sublabel="Sent as the first bubble before the main DM."
        />

        {openingEnabled && (
          <div className="mt-3 space-y-3">
            <div>
              <textarea
                value={openingMessage}
                onChange={(e) => onOpeningMessage(e.target.value.slice(0, 640))}
                placeholder="Hey there! Thanks for the comment — your link's on its way 🙌"
                rows={3}
                className="block w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
              />
              <div className="mt-1 text-[11px] text-neutral-500">{openingMessage.length} / 640</div>
            </div>

            <LockedTextField
              value={openingButtonText}
              onChange={onOpeningButtonText}
              label="Opening button text"
              placeholder="Send me the link"
              maxLength={20}
            />
          </div>
        )}
      </div>
    </CardShell>
  );
}

// ─── Card: Email Capture (email-collector template) ──────────────────────
// Two messages drive the conversation: the "ask" message (sent when
// the trigger fires) and the "thanks" message (sent when we receive
// a valid email reply). We don't expose the storage destination
// here — captured leads land in the Email Leads page automatically.
function EmailCaptureCard({
  num, askMessage, onAskMessage, thanksMessage, onThanksMessage,
  isFocused, onFocus,
}) {
  return (
    <CardShell num={num} title="Ask for email" icon={Send} hint="The DM that asks for the email — and the reply that thanks them once captured." isFocused={isFocused} onFocus={onFocus}>
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700">Ask message</label>
          <textarea
            value={askMessage || ''}
            onChange={(e) => onAskMessage(e.target.value.slice(0, 640))}
            placeholder="Drop your email below and I'll send the link 📩"
            rows={3}
            className="mt-1 block w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
          />
          <p className="mt-1 text-[10px] text-neutral-500">{(askMessage || '').length} / 640</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700">Thank-you message</label>
          <textarea
            value={thanksMessage || ''}
            onChange={(e) => onThanksMessage(e.target.value.slice(0, 640))}
            placeholder="Got it — thanks! 🙏 Check your inbox in a few minutes."
            rows={2}
            className="mt-1 block w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
          />
          <p className="mt-1 text-[10px] text-neutral-500">{(thanksMessage || '').length} / 640</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-[11.5px] leading-snug text-blue-800">
          Captured emails land in <strong>Email Leads</strong> for export and follow-up.
        </div>
      </div>
    </CardShell>
  );
}

// ─── Card: Advanced Automations (shared, template-aware toggles) ───────────
function AdvancedCard({
  num, type,
  replyPublicly, onReplyPublicly,
  publicReplies = [], onTogglePublicReply, onRemovePublicReply, onOpenAddPublicReply,
  reactWithHeart, onReactWithHeart,
  // Pro features now wired end-to-end (Phase 11). When askToFollow is
  // on the row saves with dm_type='follow_up' and the existing gate
  // flow handles YES verification before delivering the main DM.
  // sendFollowUp populates settings_config.upsell so the upsell cron
  // delivers a 24h reminder to non-clickers.
  askToFollow, onAskToFollow,
  askToFollowMessage, onAskToFollowMessage,
  askToFollowButtonText, onAskToFollowButtonText,
  sendFollowUp, onSendFollowUp,
  followUpMessage, onFollowUpMessage,
  openingEnabled = false,
  isPro = false,
  activePlatform = 'instagram',
  isFocused, onFocus,
}) {
  const isFacebookOnly  = activePlatform === 'facebook';
  const showReplyPublicly = type === 'comment-to-dm';
  // Heart reaction (sender_action: 'react') is rejected by FB's Send API.
  // We already gate the actual send in the webhook by platform; hide the
  // toggle so FB-only creators don't see a feature that will never fire.
  const showReactWithHeart = (type === 'story-reply' || type === 'dm-auto-responder') && !isFacebookOnly;
  // Follow Gate relies on the IG-only `is_user_follow_business` field;
  // FB Pages don't expose an equivalent. Hide the toggle for FB-only.
  const showAskToFollow = !isFacebookOnly;

  return (
    <CardShell num={num} title="Advanced Automations" icon={Settings2} hint="Optional engagement boosters." isFocused={isFocused} onFocus={onFocus}>
      <div className="space-y-4">
        {showReplyPublicly && (
          <div>
            <Toggle
              checked={replyPublicly}
              onChange={onReplyPublicly}
              label="Publicly reply to comments"
              sublabel="Post a public reply on the comment alongside the DM."
            />
            {replyPublicly && (
              // Pool of canned replies — webhook picks one at random
              // from those currently enabled when firing. Defaults are
              // pre-seeded; user can disable any, remove their own
              // customs (default replies aren't removable so the pool
              // can never empty silently), and add new ones.
              <div className="mt-3 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                {publicReplies.length === 0 ? (
                  <p className="text-xs text-neutral-500">No replies yet — add one below.</p>
                ) : (
                  publicReplies.map((reply, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3"
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={reply.enabled}
                        onClick={(e) => { e.stopPropagation(); onTogglePublicReply(i); }}
                        className={[
                          'relative mt-0.5 inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
                          reply.enabled ? 'bg-[#E63946]' : 'bg-neutral-200',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                            reply.enabled ? 'translate-x-4' : 'translate-x-0.5',
                          ].join(' ')}
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={[
                          'text-sm leading-snug',
                          reply.enabled ? 'text-neutral-900' : 'text-neutral-500',
                        ].join(' ')}>
                          {reply.text}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">{reply.text.length} chars</p>
                      </div>
                      {reply.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onRemovePublicReply(i); }}
                          aria-label="Remove reply"
                          className="text-neutral-400 hover:text-red-600 transition-colors"
                        >
                          <X className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenAddPublicReply(); }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  Add Public Reply
                </button>
              </div>
            )}
          </div>
        )}

        {showReactWithHeart && (
          <Toggle
            checked={reactWithHeart}
            onChange={onReactWithHeart}
            label="React with heart"
            sublabel="Send a ❤️ reaction before the DM."
          />
        )}

        {/* Ask to follow before sending DM — Pro feature, IG-only.
            We send a gate message with a "I followed!" tap; webhook
            verifies follow status; the actual DM only fires once they're
            a confirmed follower. Hidden on FB-only accounts since FB
            Pages don't expose follower-relationship data. */}
        {showAskToFollow && (
          <div>
            <Toggle
              checked={Boolean(askToFollow)}
              onChange={onAskToFollow}
              label="Ask to follow before sending DM"
              sublabel="Send a gate message; the DM only fires after we verify they followed."
              proGated
              disabled={!isPro}
            />
            {askToFollow && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700">Follow request message</label>
                  <textarea
                    value={askToFollowMessage || ''}
                    onChange={(e) => onAskToFollowMessage(e.target.value.slice(0, 640))}
                    placeholder="Hey {first_name}! Follow us first and reply YES so I can send your link 🎁"
                    rows={3}
                    className="mt-1 block w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
                  />
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Sent only when the commenter doesn&apos;t already follow you. Existing
                    followers skip this step and go straight to the DM.
                  </p>
                </div>
                <LockedTextField
                  value={askToFollowButtonText}
                  onChange={onAskToFollowButtonText}
                  label="Confirmation button text"
                  placeholder="I'm following!"
                  maxLength={20}
                />
              </div>
            )}
          </div>
        )}

        {/* Send follow-up message — Pro feature. 24h after the main
            DM, we nudge anyone who hasn't clicked the link. Uses the
            existing upsell cron (which already does click-gating via
            click_events ?r=<igsid> attribution). */}
        <div>
          <Toggle
            checked={Boolean(sendFollowUp)}
            onChange={onSendFollowUp}
            label="Send follow-up message"
            sublabel="Nudge non-clickers 24 hours after the original DM."
            proGated
            disabled={!isPro}
          />
          {sendFollowUp && (
            <textarea
              value={followUpMessage || ''}
              onChange={(e) => onFollowUpMessage(e.target.value.slice(0, 640))}
              placeholder="Hey {first_name}, just checking in — did you get a chance to look at the link? 👀"
              rows={3}
              className="mt-3 block w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
            />
          )}
        </div>
      </div>
    </CardShell>
  );
}

// ─── Conversation preview (live phone preview) ─────────────────────────────
// Renders an Instagram-style conversation that mirrors the builder state.
// The phone itself is NOT internally scrollable — all scenes render at
// once and the focused step gets a soft highlight ring so the user's
// eye is drawn to whichever step they're editing on the right rail.
// Reusable IG-style avatar — renders the user's real profile picture
// when available; otherwise falls back to a person icon on a neutral
// circle (closest to IG's default placeholder). Sizes flow through
// `size` so we can use it everywhere the `@`-circle was used.
function IgAvatar({ url, size = 24, ringed = false }) {
  const dim = `${size}px`;
  const wrap = ringed
    ? 'inline-flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 p-[2px]'
    : 'inline-flex flex-shrink-0 items-center justify-center rounded-full overflow-hidden';
  if (url) {
    return (
      <span className={wrap} style={{ width: dim, height: dim }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full rounded-full object-cover" />
      </span>
    );
  }
  return (
    <span className={[wrap, 'bg-neutral-700'].filter(Boolean).join(' ')} style={{ width: dim, height: dim }}>
      <User className="text-white/80" style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2} />
    </span>
  );
}

function ConversationPreview({
  type,
  focusedStep,
  igUsername = 'your_handle',
  igAvatarUrl = null,
  postTargetMode,
  selectedPost,
  anyKeyword,
  keywords,
  dmMessage,
  dmImage,
  dmImageHeadline,
  linkButtons = [],
  openingEnabled,
  openingMessage,
  openingButtonText,
  replyPublicly,
  publicReplies = [],
  reactWithHeart,
  askToFollow = false,
  askToFollowMessage = '',
  askToFollowButtonText = "I'm following!",
  sendFollowUp = false,
  followUpMessage = '',
  emailAskMessage = '',
  emailThanksMessage = '',
  effectivePlan = 'free',
}) {
  // Free-tier DMs get "Powered by autodm.pro" appended to the MAIN message
  // at send time. Reflect that in the preview so the user sees exactly what
  // their recipients see. Only the main dmMessage gets branded — opening
  // message is a separate gate bubble and not subject to applyBranding.
  // Pro/Trial show a clean preview.
  const FREE_BRANDING    = 'Powered by autodm.pro';
  const isPaidPlan       = effectivePlan === 'pro' || effectivePlan === 'business' || effectivePlan === 'trial';
  const dmMessageBranded = (dmMessage && !isPaidPlan)
    ? (dmMessage.trimEnd().endsWith(FREE_BRANDING) ? dmMessage : `${dmMessage.trimEnd()}\n\n${FREE_BRANDING}`)
    : dmMessage;

  // Resolve the image-card headline the same way send-dm.js does so the
  // preview matches the rendered DM exactly:
  //   1. Explicit imageHeadline from the builder field
  //   2. First non-empty line of the message
  //   3. Final fallback to keep Meta from rejecting an empty title
  // Only computed/shown when an image is attached.
  const previewImageHeadline = (() => {
    if (!dmImage) return null;
    const explicit = (dmImageHeadline || '').trim();
    if (explicit) return explicit.slice(0, 80);
    const firstLine = (dmMessage || '').split('\n').find((l) => l.trim());
    if (firstLine) return firstLine.trim().slice(0, 80);
    return 'Take a look 👇';
  })();
  // Webhook picks one at random from the enabled pool when firing;
  // for the live preview we just show the first enabled reply so the
  // user can see what shape the response takes.
  const samplePublicReply = publicReplies.find((r) => r.enabled)?.text || '';
  // The card on the right rail already shows a focused state via its
  // border + ring, so highlighting the matching scene inside the phone
  // adds visual noise without telling the user anything new. Keep this
  // helper as a no-op for now; if we ever bring back per-scene focus
  // it can return a class string here.
  const focusRing = () => '';

  // ── Scene composition by template ────────────────────────────────────────
  const isCommentFlow = type === 'comment-to-dm';
  const isStoryFlow   = type === 'story-reply';
  const isDmFlow      = type === 'dm-auto-responder';
  const isIceBreakers = type === 'ice-breakers';

  // Scene 1: trigger context — the post / story / DM origin.
  const showSelected = postTargetMode === 'specific' && selectedPost;
  const thumb = selectedPost?.thumbnail_url || selectedPost?.media_url || null;
  const captionPreview = selectedPost?.caption
    ? selectedPost.caption.slice(0, 60) + (selectedPost.caption.length > 60 ? '…' : '')
    : 'Caption preview…';

  const renderTrigger = () => {
    if (isCommentFlow) {
      return (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-neutral-900">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-950 text-[8px] font-bold text-white">@</span>
            </span>
            <span className="text-[10px] font-semibold text-white">{igUsername}</span>
          </div>
          {/* Padding-bottom hack forces a 1:1 aspect ratio regardless of
              what's inside — `aspect-square` was collapsing in the
              placeholder branch because all children were
              position:absolute, leaving the parent with no intrinsic
              content height. padding-bottom: 100% derives height from
              width directly, so both branches render the same square. */}
          <div className="relative w-full bg-gradient-to-br from-neutral-700 via-neutral-800 to-neutral-900" style={{ paddingBottom: '100%' }}>
            {showSelected && thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/60">
                  Placeholder
                </span>
                <span className="text-lg font-bold uppercase tracking-wide text-white/85">
                  {postTargetMode === 'next' ? 'Next Post' : postTargetMode === 'any' ? 'Any Post' : 'Pick a Post'}
                </span>
                {(postTargetMode === 'next' || postTargetMode === 'any') && (
                  <span className="max-w-[80%] text-[10px] leading-snug text-white/50">
                    {postTargetMode === 'next'
                      ? 'Activates on the next post you publish'
                      : 'Runs on every post on your account'}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1 px-3 py-2">
            <p className="text-[10px] text-white/80">
              <span className="font-semibold">{igUsername}</span> {captionPreview}
            </p>
            <p className="text-[9px] text-white/50">View all comments</p>
          </div>
        </div>
      );
    }
    if (isStoryFlow) {
      return (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-700 via-pink-700 to-rose-700">
          {/* 9:16 aspect ratio via padding-bottom hack:
              16/9 × 100% = ~177.78%. Same reasoning as the comment-flow
              placeholder above — `aspect-[9/16]` collapses when all
              children are absolute. */}
          <div className="relative w-full" style={{ paddingBottom: '177.78%' }}>
            {showSelected && thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/85">
                  Placeholder
                </span>
                <span className="text-xl font-bold uppercase tracking-wide text-white">
                  {postTargetMode === 'any' ? 'Any Story' : 'Pick a Story'}
                </span>
                {postTargetMode === 'any' && (
                  <span className="max-w-[85%] text-[10px] leading-snug text-white/75">
                    Replies to any story you publish
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    if (isDmFlow) {
      return (
        <div className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2.5 text-[10px] text-white/60">
          User opens a fresh DM thread with you.
        </div>
      );
    }
    if (isIceBreakers) {
      return (
        <div className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2.5 text-[10px] text-white/60">
          User taps your inbox.
        </div>
      );
    }
    return null;
  };

  // Scene 2: the trigger event itself (comment, keyword chip tap, DM text).
  const renderTriggerEvent = () => {
    const triggerKeyword = anyKeyword
      ? (isCommentFlow ? 'love this!' : 'hey there')
      : keywords[0] || 'link';
    if (isCommentFlow) {
      return (
        <div className="space-y-1.5">
          <p className="text-[9px] uppercase tracking-widest text-white/40">Comment</p>
          <div className="flex items-start gap-2">
            <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-[9px] font-bold text-white">F</span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-white">fan.user</p>
              <p className="text-[11px] text-white/85">{triggerKeyword}</p>
              {reactWithHeart && (
                <span className="mt-1 inline-flex items-center gap-1 text-[9px] text-white/50">
                  <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                  Liked by you
                </span>
              )}
            </div>
          </div>
          {replyPublicly && replyPubliclyText && (
            <div className="ml-8 mt-1 flex items-start gap-2">
              <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 text-[8px] font-bold text-white">@</span>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold text-white">{igUsername}</p>
                <p className="text-[10px] text-white/75">{replyPubliclyText}</p>
              </div>
            </div>
          )}
        </div>
      );
    }
    if (isStoryFlow) {
      return (
        <div className="flex flex-col items-end gap-1.5">
          <p className="self-start text-[9px] uppercase tracking-widest text-white/40">Story reply</p>
          <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-500 to-fuchsia-600 px-3 py-2 text-[11px] text-white shadow">
            {triggerKeyword}
          </div>
          {reactWithHeart && (
            <span className="inline-flex items-center gap-1 text-[9px] text-white/50">
              <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
              You reacted
            </span>
          )}
        </div>
      );
    }
    if (isDmFlow) {
      return (
        <div className="flex flex-col items-end gap-1.5">
          <p className="self-start text-[9px] uppercase tracking-widest text-white/40">DM</p>
          <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-500 to-fuchsia-600 px-3 py-2 text-[11px] text-white shadow">
            {triggerKeyword}
          </div>
        </div>
      );
    }
    return null;
  };

  // Bot avatar — small inline avatar next to inbound DM bubbles.
  // Uses the connected account's real IG profile picture when present,
  // falling back to the user-icon placeholder.
  const BotAvatar = () => <IgAvatar url={igAvatarUrl} size={24} />;

  // Single-flow DM thread that mirrors the actual user experience on
  // Instagram. We render the conversation in send-order so the user
  // can see exactly what their target audience will read:
  //   1. Bot's opening bubble (if opening message enabled)
  //   2. Opening button (left-aligned, tappable-looking)
  //   3. User's reply (purple bubble — what tapping the button sends)
  //   4. Bot's main DM (image + message + link buttons)
  // chatautodm parity. We deliberately don't render a "comment" scene
  // up top — the trigger context is already shown in the post view
  // on Step 1, and including the comment in the DM thread confused
  // users into thinking it would appear inline in the DM.
  const isEmailCollector = type === 'email-collector';
  const renderDmReply = () => {
    const hasOpening  = openingEnabled && (openingMessage || openingButtonText);
    const hasMainDm   = dmMessage || dmImage || linkButtons.length > 0;
    const hasFollowUp = sendFollowUp && (followUpMessage || '').trim();

    // Renders a "+24h later" divider followed by the follow-up bubble.
    // Used at the bottom of every render path so users see the full
    // delivery sequence regardless of whether the gate is on. The
    // upsell cron skips recipients who clicked, so this only fires
    // for non-clickers — the divider copy mentions that.
    const followUpBubble = hasFollowUp ? (
      <>
        <div className="flex items-center gap-2 pt-1">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[9px] uppercase tracking-widest text-white/40">
            24 h later · if no click
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <div className="flex items-start gap-1.5">
          <BotAvatar />
          <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-neutral-800 px-3 py-2 text-[11px] leading-snug text-white whitespace-pre-wrap">
            {followUpMessage}
          </div>
        </div>
      </>
    ) : null;

    // Email Collector exchange — bot asks for email, user (sample)
    // replies, bot thanks them. Reused inside the gate-on path below
    // so it renders AFTER the follow-confirm exchange when both are
    // enabled.
    const emailExchange = (
      <>
        {emailAskMessage && (
          <div className="flex items-start gap-1.5">
            <BotAvatar />
            <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-neutral-800 px-3 py-2 text-[11px] leading-snug text-white whitespace-pre-wrap">
              {emailAskMessage}
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-500 to-fuchsia-600 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow">
            fan@example.com
          </div>
        </div>
        {emailThanksMessage && (
          <div className="flex items-start gap-1.5">
            <BotAvatar />
            <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-neutral-800 px-3 py-2 text-[11px] leading-snug text-white whitespace-pre-wrap">
              {emailThanksMessage}
            </div>
          </div>
        )}
        {!emailAskMessage && !emailThanksMessage && (
          <div className="mx-auto max-w-[78%] rounded-2xl border border-dashed border-white/10 px-3 py-3 text-center text-[10px] italic text-white/30">
            Add an ask + thank-you message to preview the email exchange.
          </div>
        )}
      </>
    );

    if (isEmailCollector && !askToFollow) {
      return (
        <div className="space-y-3">
          {emailExchange}
          {followUpBubble}
        </div>
      );
    }

    // When ask-to-follow is on, prepend the gate exchange to whatever
    // would normally render. The full preview reads top-to-bottom in
    // delivery order so users can see exactly what their non-follower
    // commenters experience: gate → "I'm following!" tap → opening
    // (if enabled) → tap → main DM. Existing followers skip the
    // gate at runtime; we annotate that under the toggle in the
    // builder rather than splitting the preview.
    if (askToFollow) {
      return (
        <div className="space-y-3">
          {/* Bot — gate bubble with confirm pill button */}
          {askToFollowMessage && (
            <div className="flex items-start gap-1.5">
              <BotAvatar />
              <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-neutral-800 p-2">
                <div className="px-1 pb-1.5 pt-0.5 text-[11px] leading-snug text-white whitespace-pre-wrap">
                  {askToFollowMessage}
                </div>
                <button
                  type="button"
                  className="block w-full rounded-md bg-neutral-700 px-3 py-1.5 text-center text-[11px] font-semibold text-white"
                >
                  {askToFollowButtonText || "I'm following!"}
                </button>
              </div>
            </div>
          )}

          {/* User — taps confirm */}
          {askToFollowMessage && (
            <div className="flex justify-end">
              <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-500 to-fuchsia-600 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow">
                {askToFollowButtonText || "I'm following!"}
              </div>
            </div>
          )}

          {/* Email Collector skips the opening + DM bubbles in favor
              of the email exchange. The trigger here is "after gate
              passes, ask for email + capture + thank". */}
          {isEmailCollector ? (
            emailExchange
          ) : (
            <>
              {/* Bot — opening interactive (only when openingEnabled) */}
              {hasOpening && (
                <div className="flex items-start gap-1.5">
                  <BotAvatar />
                  <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-neutral-800 p-2">
                    {openingMessage && (
                      <div className="px-1 pb-1.5 pt-0.5 text-[11px] leading-snug text-white whitespace-pre-wrap">
                        {openingMessage}
                      </div>
                    )}
                    {openingButtonText && (
                      <button
                        type="button"
                        className="block w-full rounded-md bg-neutral-700 px-3 py-1.5 text-center text-[11px] font-semibold text-white"
                      >
                        {openingButtonText}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* User — taps opening button */}
              {hasOpening && openingButtonText && (
                <div className="flex justify-end">
                  <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-500 to-fuchsia-600 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow">
                    {openingButtonText}
                  </div>
                </div>
              )}

              {/* Bot — main DM */}
              {hasMainDm ? (
                <div className="flex items-start gap-1.5">
                  <BotAvatar />
                  <div className="max-w-[78%] overflow-hidden rounded-2xl rounded-bl-sm bg-neutral-800">
                    {dmImage && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={dmImage} alt="" className="block w-full object-cover" />
                    )}
                    {dmImage && previewImageHeadline && (
                      <div className="px-3 pt-2 text-[11px] font-semibold leading-snug text-white">
                        {previewImageHeadline}
                      </div>
                    )}
                    {(dmMessage || linkButtons.length > 0) && (
                      <div className="space-y-1.5 p-2">
                        {dmMessage && (
                          <div className="px-1 pb-0.5 pt-0.5 text-[11px] leading-snug text-white whitespace-pre-wrap">
                            {dmMessageBranded}
                          </div>
                        )}
                        {linkButtons.map((btn, i) => (
                          <a
                            key={i}
                            href="#"
                            onClick={(e) => e.preventDefault()}
                            className="block w-full truncate rounded-md bg-neutral-700 px-3 py-1.5 text-center text-[11px] font-semibold text-white"
                          >
                            {btn.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-[78%] rounded-2xl border border-dashed border-white/10 px-3 py-3 text-center text-[10px] italic text-white/30">
                  Your DM lands here once they confirm following.
                </div>
              )}
            </>
          )}
          {followUpBubble}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Bot — opening interactive message: message text on top, then
            a discrete pill button INSIDE the same bubble. Matches IG's
            real quick-reply rendering (gray pill on a darker bubble). */}
        {hasOpening && (
          <div className="flex items-start gap-1.5">
            <BotAvatar />
            <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-neutral-800 p-2">
              {openingMessage && (
                <div className="px-1 pb-1.5 pt-0.5 text-[11px] leading-snug text-white whitespace-pre-wrap">
                  {openingMessage}
                </div>
              )}
              {openingButtonText && (
                <button
                  type="button"
                  className="block w-full rounded-md bg-neutral-700 px-3 py-1.5 text-center text-[11px] font-semibold text-white"
                >
                  {openingButtonText}
                </button>
              )}
            </div>
          </div>
        )}

        {/* User — auto reply when they tap the opening button. This is
            what the recipient's tap looks like in IG: their button
            text gets sent as a user message. */}
        {hasOpening && openingButtonText && (
          <div className="flex justify-end">
            <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-500 to-fuchsia-600 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow">
              {openingButtonText}
            </div>
          </div>
        )}

        {/* Bot — main DM combined bubble: image at top (full-bleed if
            present), message text, then CTA buttons rendered as
            discrete pills inside the same bubble. Matches the IG
            generic-template look from delete34.png (gray pill on the
            darker bubble background). */}
        {hasMainDm && (
          <div className="flex items-start gap-1.5">
            <BotAvatar />
            <div className="max-w-[78%] overflow-hidden rounded-2xl rounded-bl-sm bg-neutral-800">
              {dmImage && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={dmImage} alt="" className="block w-full object-cover" />
              )}
              {dmImage && previewImageHeadline && (
                <div className="px-3 pt-2 text-[11px] font-semibold leading-snug text-white">
                  {previewImageHeadline}
                </div>
              )}
              {(dmMessage || linkButtons.length > 0) && (
                <div className="space-y-1.5 p-2">
                  {dmMessage && (
                    <div className="px-1 pb-0.5 pt-0.5 text-[11px] leading-snug text-white whitespace-pre-wrap">
                      {dmMessageBranded}
                    </div>
                  )}
                  {linkButtons.map((btn, i) => (
                    <a
                      key={i}
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="block w-full truncate rounded-md bg-neutral-700 px-3 py-1.5 text-center text-[11px] font-semibold text-white"
                    >
                      {btn.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state — nothing entered yet */}
        {!hasOpening && !hasMainDm && (
          <div className="mx-auto max-w-[78%] rounded-2xl border border-dashed border-white/10 px-3 py-3 text-center text-[10px] italic text-white/30">
            Your DM lands here as you type…
          </div>
        )}
        {followUpBubble}
      </div>
    );
  };

  // Scene 4: advanced effects placeholder.
  const renderAdvanced = () => (
    <div className="space-y-1.5">
      <p className="text-[9px] uppercase tracking-widest text-white/40">Advanced</p>
      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-[10px] text-white/50">
        Reactions and follow-ups appear inline above as you toggle them.
      </div>
    </div>
  );

  // When the user is on Step 1 (Select Post / Select Story), the phone
  // shows an IG-style post-browsing view (post image, action row,
  // caption, bottom nav) so it reads like the real Instagram surface
  // the trigger fires on. From Step 2 onward, the phone switches to a
  // DM thread view where the comment + bot replies + buttons render.
  const showPostView = focusedStep === 1 && (isCommentFlow || isStoryFlow);

  return (
    // Phone scales to fit its column's height, capped at 320×640 so it
    // doesn't get oversized on tall viewports. Aspect 9/18 is closer
    // to a real iPhone (≈19.5:9 hardware, but 18:9 reads better in a
    // smaller preview frame than 19:9). h-full pulls height from the
    // (bounded) parent column; max-h caps it; aspect-ratio derives
    // width; max-w caps that. With the chain of `min-h-0` /
    // `overflow-hidden` up to <main>, this never causes the page to
    // scroll.
    <div className="relative aspect-[9/18] h-full max-h-[640px] max-w-[320px]">
      <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-to-br from-neutral-100 to-neutral-200" />
      <div className="relative h-full w-full overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-950 shadow-xl">
        {/* Notch */}
        <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-3 text-[10px] font-semibold text-white/80">
          <span>9:41</span>
          <span />
        </div>

        {showPostView ? (
          <PostBrowsingView
            igUsername={igUsername}
            igAvatarUrl={igAvatarUrl}
            selectedPost={selectedPost}
            postTargetMode={postTargetMode}
            isStoryFlow={isStoryFlow}
          />
        ) : (
          <>
            {/* Header */}
            <div className="mt-5 flex items-center gap-2 border-b border-white/5 px-3 pb-2 text-white">
              <ChevronLeft className="h-4 w-4" />
              <IgAvatar url={igAvatarUrl} size={28} />
              <span className="text-xs font-semibold">{igUsername}</span>
            </div>
            {/* Conversation — scrollable when content overflows so long
                messages, an image, and CTA buttons can all be inspected.
                We keep the input bar pinned at the bottom (rendered
                separately below) so the scroll surface is just the
                bubbles. The fan-user comment scene is intentionally
                not rendered here — Step 1's post view already shows
                the trigger surface, and inline-comment-in-DM was
                confusing. */}
            <div className="scrollbar-none relative h-[calc(100%-7rem)] space-y-3 overflow-y-auto px-3 py-3">
              {isStoryFlow && <StoryReplyContext
                igUsername={igUsername}
                selectedPost={selectedPost}
                postTargetMode={postTargetMode}
                anyKeyword={anyKeyword}
                keywords={keywords}
                reactWithHeart={reactWithHeart}
              />}
              <div className={focusRing(3)}>{renderDmReply()}</div>
              {focusedStep === 4 && <div className={focusRing(4)}>{renderAdvanced()}</div>}
            </div>
            {/* Input bar */}
            <div className="absolute inset-x-3 bottom-3 flex h-9 items-center gap-2 rounded-full bg-neutral-800/90 px-3 text-[11px] text-white/40">
              <Camera className="h-3.5 w-3.5" />
              <span className="flex-1 truncate">Message…</span>
              <Mic className="h-3.5 w-3.5" />
              <Smile className="h-3.5 w-3.5" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Story-reply attachment shown above the DM reply chain when the
// template is `story-reply`. Mimics how Instagram renders an
// inbound story reply in the DM thread: a small vertical thumbnail
// of the story they replied to, sitting next to the user's text
// reply bubble (right-aligned, since this is the "user side" of
// the conversation). The bot's automated reply renders below this
// via the existing renderDmReply path.
function StoryReplyContext({ igUsername, selectedPost, postTargetMode, anyKeyword, keywords, reactWithHeart = false }) {
  const showThumb = postTargetMode === 'specific' && selectedPost;
  const thumb     = showThumb ? (selectedPost.thumbnail_url || selectedPost.media_url || null) : null;
  // Pick the keyword the user "said" — first keyword or a friendly
  // fallback when "Any keyword" is on so the bubble isn't empty.
  const reply = anyKeyword
    ? 'hey there'
    : keywords[0] || 'link';

  return (
    <div className="flex justify-end">
      <div className="flex items-end gap-1.5">
        {/* Tiny meta line so the user understands what this attachment is */}
        <div className="flex flex-col items-end gap-1">
          <p className="text-[9px] uppercase tracking-widest text-white/40">
            Replied to your story
          </p>
          <div className="flex items-end gap-1.5">
            <div className="relative max-w-[180px] rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-500 to-fuchsia-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow">
              {reply}
              {/* Heart reaction overlay — sits at the bottom-left of
                  the user's bubble, matches IG's actual reaction
                  rendering. Only shown when the toggle is on. */}
              {reactWithHeart && (
                <span className="absolute -bottom-2 -left-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900 ring-2 ring-neutral-950">
                  <Heart className="h-2.5 w-2.5 fill-rose-500 text-rose-500" strokeWidth={2} />
                </span>
              )}
            </div>
            {/* Story thumbnail — vertical 9/16 with a soft purple ring
                that mimics the IG story preview frame. */}
            <div className="overflow-hidden rounded-md ring-2 ring-fuchsia-500/70">
              <div className="aspect-[9/16] w-10 bg-gradient-to-br from-fuchsia-700 via-pink-700 to-rose-700">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[7px] uppercase tracking-widest text-white/70">
                    {postTargetMode === 'any' ? 'Any' : 'Story'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// IG post-browsing view — used by ConversationPreview when the user is
// on Step 1 of comment-to-dm or story-reply. Mimics the IG mobile post
// detail screen: header → user row → media → actions → caption → bottom
// nav. The selected post's thumbnail renders if one's picked, else a
// placeholder explains which mode is active.
function PostBrowsingView({ igUsername, igAvatarUrl, selectedPost, postTargetMode, isStoryFlow }) {
  // Only honor the selected post when the mode is 'specific'. Switching
  // to 'next' or 'any' must clear the rendered post so the preview
  // matches what the automation will actually fire on — keeping a
  // stale thumbnail there confuses users (they think the automation
  // is still tied to that post).
  const showSelected   = postTargetMode === 'specific' && Boolean(selectedPost);
  const thumb          = showSelected ? (selectedPost.thumbnail_url || selectedPost.media_url || null) : null;
  const captionPreview = showSelected && selectedPost.caption
    ? selectedPost.caption.slice(0, 50) + (selectedPost.caption.length > 50 ? '…' : '')
    : 'Post caption…';
  const placeholderLabel = isStoryFlow
    ? (postTargetMode === 'any' ? 'Any story' : 'Pick a story')
    : (postTargetMode === 'next' ? 'Next post' : postTargetMode === 'any' ? 'Any post' : 'Pick a post');

  return (
    // After we shortened the phone (9/18 + 640px max), a full-width
    // square media was eating enough vertical space that the action
    // row, caption, and bottom nav got clipped. Fix: every non-media
    // band gets `flex-shrink-0` so it's guaranteed to render, the
    // media is capped at 50% of the parent's height (still
    // proportionally accurate for IG's square default), and the
    // caption row can shrink + overflow-hide to absorb slack.
    <div className="flex h-[calc(100%-1.75rem)] flex-col overflow-hidden text-white">
      {/* Top: "Posts" title with back arrow */}
      <div className="flex flex-shrink-0 items-center px-3 pb-1.5 pt-1">
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        <span className="flex-1 text-center text-[12px] font-semibold">{isStoryFlow ? 'Stories' : 'Posts'}</span>
        <span className="w-4" />
      </div>
      {/* Profile row */}
      <div className="flex flex-shrink-0 items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <IgAvatar url={igAvatarUrl} size={24} />
          <span className="truncate text-[11px] font-semibold">@{igUsername}</span>
        </div>
        <MoreHorizontal className="h-3.5 w-3.5 flex-shrink-0 text-white/70" strokeWidth={2.5} />
      </div>
      {/* Media (square — IG default), capped so action row + caption
          + bottom nav stay visible on the shorter phone preview. */}
      <div className="flex flex-shrink-0 max-h-[50%] w-full justify-center bg-gradient-to-br from-neutral-700 via-neutral-800 to-neutral-900">
        <div className="aspect-square h-full">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-widest text-white/40">
              {placeholderLabel}
            </div>
          )}
        </div>
      </div>
      {/* Action row */}
      <div className="flex flex-shrink-0 items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <Heart className="h-4 w-4" strokeWidth={1.75} />
          <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
          <Send className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <Bookmark className="h-4 w-4" strokeWidth={1.75} />
      </div>
      {/* Caption + comments hint — flex-1 absorbs slack, min-h-0 +
          overflow-hidden lets it shrink if the parent gets tight. */}
      <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden px-3 pb-1">
        <p className="truncate text-[10px] leading-snug text-white">
          <span className="font-semibold">{igUsername}</span>{' '}
          <span className="text-white/85">{captionPreview}</span>
        </p>
        <p className="text-[9px] text-white/50">View all comments</p>
      </div>
      {/* Bottom nav (IG tab bar) */}
      <div className="flex flex-shrink-0 items-center justify-between border-t border-white/5 px-4 py-2.5">
        <Home className="h-4 w-4 fill-white text-white" strokeWidth={1.75} />
        <Search className="h-4 w-4 text-white" strokeWidth={1.75} />
        <PlusSquare className="h-4 w-4 text-white" strokeWidth={1.75} />
        <Film className="h-4 w-4 text-white" strokeWidth={1.75} />
        <IgAvatar url={igAvatarUrl} size={16} />
      </div>
    </div>
  );
}

// Fullbleed effect — strips the dashboard layout's `<main>` shell
// constraints from the client side as a guaranteed override. The
// CSS-only `:has()` rule in globals.css handles this too, but JS
// inline styles win on specificity in every browser without any
// reliance on @layer ordering or selector quirks. On lg+ we also
// freeze the page (body overflow hidden + main height: 100dvh) so
// only the cards column scrolls.
function useBuilderFullBleed() {
  useIsoLayoutEffect(() => {
    const main = document.querySelector('main');
    if (!main) return undefined;
    const isLg = () => window.innerWidth >= 1024;
    // Snapshot the inline style we're about to mutate so we can put it
    // back on unmount (navigating away from the builder).
    const origMainStyle = main.getAttribute('style') || '';
    const origBodyOverflow = document.body.style.overflow;
    const origHtmlOverflow = document.documentElement.style.overflow;

    const apply = () => {
      main.style.maxWidth = 'none';
      main.style.marginLeft = '0';
      main.style.marginRight = '0';
      main.style.padding = '0';
      main.style.display = 'flex';
      main.style.flexDirection = 'column';
      main.style.minHeight = '0';
      if (isLg()) {
        // 100dvh accounts for mobile browser chrome correctly. The
        // body/html freeze prevents the page from scrolling — the
        // cards column inside is the only scroll surface.
        main.style.height = '100dvh';
        main.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      } else {
        main.style.height = '';
        main.style.overflow = '';
        document.body.style.overflow = origBodyOverflow;
        document.documentElement.style.overflow = origHtmlOverflow;
      }
    };

    apply();
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      main.setAttribute('style', origMainStyle);
      document.body.style.overflow = origBodyOverflow;
      document.documentElement.style.overflow = origHtmlOverflow;
    };
  }, []);
}

// ─── Main builder view ─────────────────────────────────────────────────────
export default function BuilderView({
  type,
  initialName,
  igUsername = 'your_handle',
  igAvatarUrl = null,
  posts = [],
  initialAutomation = null, // present when editing — hydrates state below
  effectivePlan = 'free',   // 'free' | 'trial' | 'pro' | 'business'
  accountDefaults = {},     // Settings → Default Configuration. Used to
                            // seed keywords/message/button on NEW
                            // automations only (edit mode ignores these).
  activePlatform = 'instagram', // 'instagram' | 'facebook' | 'both' — hides
                                // IG-only toggles when only FB is connected.
  relatedDmAutomations = [],    // Other active DM-triggered automations in this
                                // workspace, used to surface overlap warnings.
}) {
  useBuilderFullBleed();
  const router = useRouter();

  // Edit mode = we received an existing row to hydrate from. The id is
  // also what the PUT handler keys on when persisting changes.
  const automationId = initialAutomation?.id || null;
  const isEditMode   = Boolean(automationId);
  const cards = CARDS_BY_TEMPLATE[type] || [];
  const labels = TEMPLATE_LABEL[type];

  // ── Convenience: pull persisted JSON blocks from the row (if any) ────────
  // dm_type stays 'builder_v2' regardless of askToFollow now (the gate
  // is decided at runtime by the webhook), so dm_config holds the
  // inner shape directly — no unwrap needed.
  const dmCfg       = initialAutomation?.dm_config || {};
  const triggerCfg  = initialAutomation?.trigger_config || {};
  const settingsCfg = initialAutomation?.settings_config || {};

  // Top bar
  const [name, setName] = useState(settingsCfg.automationName || initialName);
  const [editingName, setEditingName] = useState(false);

  // Step focus — drives which scene the phone preview scrolls to.
  // Defaults to step 1 so the preview starts at the trigger.
  const [focusedStep, setFocusedStep] = useState(1);

  // Card 1 (Select Post / Select Story)
  const [postTargetMode, setPostTargetMode] = useState(triggerCfg.postTargetMode || 'specific');
  const [selectedPostId, setSelectedPostId] = useState(initialAutomation?.post_id || null);

  // Card 2 (Keywords)
  // New automations seed keywords from the user's saved Settings
  // defaults so each new flow starts with a sensible baseline.
  // Edit mode hydrates from the saved row's own keywords.
  const seededKeywords = Array.isArray(accountDefaults?.keywords) ? accountDefaults.keywords : [];
  const [anyKeyword, setAnyKeyword] = useState(Boolean(triggerCfg.anyKeyword));
  const [keywords, setKeywords] = useState(
    Array.isArray(triggerCfg.keywords) && triggerCfg.keywords.length > 0
      ? triggerCfg.keywords
      : (isEditMode ? [] : seededKeywords)
  );

  // Card 3 (Send DM)
  // Char limit differs by template — IG enforces 1000 for comment-DMs, 640 for story replies.
  const dmCharLimit = type === 'story-reply' ? 640 : 1000;
  // Edit mode hydrates from saved message; new mode prefers the
  // saved Settings default, falling back to the first suggestion in
  // the pool (deterministic — Math.random() at init mismatches SSR
  // hydration char counts).
  const seededMessage = typeof accountDefaults?.defaultMessage === 'string' && accountDefaults.defaultMessage
    ? accountDefaults.defaultMessage
    : DM_MESSAGE_POOL[0];
  const [dmMessage, setDmMessage] = useState(
    typeof dmCfg.message === 'string' && dmCfg.message
      ? dmCfg.message
      : (isEditMode ? '' : seededMessage)
  );
  // dmImage is a publicly-accessible URL after upload (Supabase Storage
  // bucket `dm_images`). Null means no image attached.
  const [dmImage, setDmImage] = useState(dmCfg.imageUrl || null);
  // Optional product/card title shown above the image-card buttons.
  // Capped at 80 chars by Meta's generic_template title limit.
  //
  // Prefill behavior:
  //   - Edit mode: use whatever was saved (including a deliberately empty
  //     string, which means "let send-dm derive from message first line").
  //   - New automation: seed with the friendly fallback so creators see
  //     a sensible default in the field — they can erase or replace it.
  const [dmImageHeadline, setDmImageHeadline] = useState(
    isEditMode
      ? (dmCfg.imageHeadline || '')
      : (dmCfg.imageHeadline || 'Take a look 👇')
  );
  // IG limits CTA buttons on outgoing DMs to 3 (button list element).
  // We enforce that cap when the user adds; modal also disables 'Add'
  // when limit reached.
  const [linkButtons, setLinkButtons] = useState(Array.isArray(dmCfg.buttons) ? dmCfg.buttons : []);
  const [openingEnabled, setOpeningEnabled] = useState(Boolean(dmCfg.openingEnabled));
  const [openingMessage, setOpeningMessage] = useState(
    typeof dmCfg.openingMessage === 'string' && dmCfg.openingMessage ? dmCfg.openingMessage : DEFAULT_OPENING_MESSAGE
  );
  const [openingButtonText, setOpeningButtonText] = useState(dmCfg.openingButtonText || 'Send me the link');
  // Link modal: open/closed + the index being edited (-1 = new button)
  const [linkModalState, setLinkModalState] = useState({ open: false, editIndex: -1 });

  // Card 4 (Advanced)
  const [replyPublicly, setReplyPublicly] = useState(Boolean(settingsCfg.replyPublicly));
  // Public-reply pool: each item has its own enabled toggle. The
  // webhook picks one at random from the enabled pool when this
  // automation fires, so the same comment never gets the exact same
  // reply twice in a row. Defaults are seeded; the user can toggle
  // any off, edit/remove their own customs, and add new ones.
  const DEFAULT_PUBLIC_REPLIES = [
    { text: "DM'd you — let's continue there 👋", enabled: true, isCustom: false },
    { text: 'Please review the message we sent you.', enabled: true, isCustom: false },
    { text: 'Check your inbox.', enabled: true, isCustom: false },
  ];
  const [publicReplies, setPublicReplies] = useState(
    Array.isArray(settingsCfg.publicReplies) && settingsCfg.publicReplies.length > 0
      ? settingsCfg.publicReplies
      : DEFAULT_PUBLIC_REPLIES
  );
  const [publicReplyModalOpen, setPublicReplyModalOpen] = useState(false);
  const [reactWithHeart, setReactWithHeart] = useState(Boolean(settingsCfg.reactWithHeart));

  // Ask-to-follow + Send-follow-up (Pro features). Defaults pre-fill
  // sensible copy so a user enabling the toggle gets something
  // workable immediately rather than blanks.
  const DEFAULT_ASK_TO_FOLLOW =
    'Hey {first_name}! Follow us first and reply YES so I can send your link 🎁';
  const DEFAULT_FOLLOW_UP =
    'Hey {first_name}, just checking in — did you get a chance to look at the link? 👀';
  // Email Collector — ask + thank-you messages stored under
  // settings_config so they round-trip through edit mode without
  // touching the existing dm_config shape.
  const [emailAskMessage, setEmailAskMessage] = useState(
    settingsCfg.emailAskMessage
      || 'Hey {first_name}! Drop your email below and I\'ll send the link straight to your inbox 📩',
  );
  const [emailThanksMessage, setEmailThanksMessage] = useState(
    settingsCfg.emailThanksMessage
      || 'Got it — thanks! 🙏 Check your inbox in a few minutes for the link.',
  );

  const [askToFollow, setAskToFollow] = useState(Boolean(settingsCfg.askToFollow));
  const [askToFollowMessage, setAskToFollowMessage] = useState(
    settingsCfg.askToFollowMessage || DEFAULT_ASK_TO_FOLLOW,
  );
  // Confirm button shown alongside the gate message ("I'm following!").
  // Kept locked behind the SquarePen field by default so accidental
  // edits don't drift the recipient-facing label.
  const [askToFollowButtonText, setAskToFollowButtonText] = useState(
    settingsCfg.askToFollowButtonText || "I'm following!",
  );
  const [sendFollowUp, setSendFollowUp] = useState(Boolean(settingsCfg.sendFollowUp));
  const [followUpMessage, setFollowUpMessage] = useState(
    settingsCfg.followUpMessage || DEFAULT_FOLLOW_UP,
  );

  // Pro check — used to gate the two toggles above. Free users see
  // the Pro badge and can't toggle them on.
  const isPro = ['pro', 'business', 'trial'].includes(effectivePlan);

  // Save / Go Live status. The busy state disables both buttons
  // during a network call; user-facing feedback (validation errors,
  // success) goes through `sonner` toasts so it's consistent with
  // the rest of the dashboard (LogsContent, PostsTable, etc. all
  // use sonner).
  const [saving, setSaving] = useState(false);
  // Pricing modal opens when the API returns `upgradeRequired: true`
  // (free user hits the 5-automation cap or saves a Pro-only template
  // type like email-collector). Replaces the dead-end toast that
  // previously left the user stuck on the page with unsaved work.
  const [showPricingModal, setShowPricingModal] = useState(false);

  // Persist the current builder state. When `goLive` is true, the
  // automation is set active and we navigate back to /automations.
  // When false (Save), we stay on the page and (on first save) swap
  // the URL into edit mode so a subsequent Save updates instead of
  // inserting again. Validation errors from the API surface as a
  // toast — that single channel covers both client-side and
  // server-side problems without duplicating UI.
  const persist = async (goLive) => {
    if (saving) return;
    setSaving(true);
    const tId = toast.loading(goLive ? 'Going live…' : 'Saving…');
    const body = {
      ...(automationId ? { id: automationId } : {}),
      type,
      name,
      postId: selectedPostId,
      postTargetMode,
      anyKeyword,
      keywords,
      dmMessage,
      dmImageUrl:      dmImage,
      dmImageHeadline,
      linkButtons,
      openingEnabled,
      openingMessage,
      openingButtonText,
      replyPublicly,
      publicReplies,
      reactWithHeart,
      // Phase 11 Pro features. Server enforces the Pro gate again so
      // a free user can't bypass the disabled toggle by tampering
      // with the request body.
      askToFollow,
      askToFollowMessage,
      askToFollowButtonText,
      sendFollowUp,
      followUpMessage,
      emailAskMessage,
      emailThanksMessage,
      // Go Live forces is_active=true; Save respects current state
      // (existing automation keeps its is_active, new automation
      // saves inactive so users can iterate before launching).
      isActive: goLive ? true : (initialAutomation?.is_active ?? false),
    };
    try {
      const res = await fetch('/api/automations/builder', {
        method: automationId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Free-tier cap or Pro-only template — surface the upgrade
        // modal so the user has a clear path forward instead of just
        // an error toast on a builder page they can't save from.
        if (json?.upgradeRequired) {
          toast.dismiss(tId);
          setShowPricingModal(true);
          return;
        }
        toast.error(json?.error || 'Save failed.', { id: tId });
        return;
      }
      if (goLive) {
        toast.success('Automation is live.', { id: tId });
        router.push('/automations');
        return;
      }
      toast.success('Saved.', { id: tId });
      // Save (no redirect). If we just CREATED, swap the URL to edit
      // mode so a subsequent Save updates instead of inserting again.
      if (!automationId && json?.automation?.id) {
        router.replace(`/automations/builder?edit=${json.automation.id}`);
      }
    } catch (err) {
      toast.error(err?.message || 'Save failed.', { id: tId });
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const focusHandler = (n) => () => setFocusedStep(n);

  const renderCard = (cardKey, idx) => {
    const num = idx + 1;
    const isFocused = focusedStep === num;
    const onFocus = focusHandler(num);
    switch (cardKey) {
      case 'select-post':
        return (
          <SelectPostCard
            key={cardKey}
            mode={postTargetMode}
            onMode={setPostTargetMode}
            posts={posts}
            selectedPostId={selectedPostId}
            onSelectPost={setSelectedPostId}
            isFocused={isFocused}
            onFocus={onFocus}
          />
        );
      case 'select-story':
        return (
          <SelectStoryCard
            key={cardKey}
            mode={postTargetMode}
            onMode={setPostTargetMode}
            posts={posts}
            selectedPostId={selectedPostId}
            onSelectPost={setSelectedPostId}
            isFocused={isFocused}
            onFocus={onFocus}
          />
        );
      case 'keywords':
        return (
          <Fragment key={cardKey}>
            <KeywordsCard
              num={num}
              anyKeyword={anyKeyword}
              onAnyKeyword={setAnyKeyword}
              keywords={keywords}
              onAddKeyword={(kw) => setKeywords([...keywords, kw])}
              onRemoveKeyword={(kw) => setKeywords(keywords.filter((k) => k !== kw))}
              isFocused={isFocused}
              onFocus={onFocus}
            />
            <DmOverlapNotice
              type={type}
              anyKeyword={anyKeyword}
              relatedDmAutomations={relatedDmAutomations}
            />
          </Fragment>
        );
      case 'email-capture':
        return (
          <EmailCaptureCard
            key={cardKey}
            num={num}
            askMessage={emailAskMessage}
            onAskMessage={setEmailAskMessage}
            thanksMessage={emailThanksMessage}
            onThanksMessage={setEmailThanksMessage}
            isFocused={isFocused}
            onFocus={onFocus}
          />
        );
      case 'send-dm':
        return (
          <SendDMCard
            key={cardKey}
            num={num}
            title={type === 'dm-auto-responder' ? 'Send a DM' : 'Send DM Message'}
            hint="The DM that lands in the user's inbox."
            dmMessage={dmMessage}
            onDmMessage={setDmMessage}
            charLimit={dmCharLimit}
            dmImage={dmImage}
            onDmImage={setDmImage}
            dmImageHeadline={dmImageHeadline}
            onDmImageHeadline={setDmImageHeadline}
            linkButtons={linkButtons}
            onAddLinkButton={() => setLinkModalState({ open: true, editIndex: -1 })}
            onEditLinkButton={(i) => setLinkModalState({ open: true, editIndex: i })}
            onRemoveLinkButton={(i) => setLinkButtons(linkButtons.filter((_, idx) => idx !== i))}
            openingEnabled={openingEnabled}
            onOpeningEnabled={setOpeningEnabled}
            openingMessage={openingMessage}
            onOpeningMessage={setOpeningMessage}
            openingButtonText={openingButtonText}
            onOpeningButtonText={setOpeningButtonText}
            isFocused={isFocused}
            onFocus={onFocus}
          />
        );
      case 'advanced':
        return (
          <AdvancedCard
            key={cardKey}
            num={num}
            type={type}
            replyPublicly={replyPublicly}
            onReplyPublicly={setReplyPublicly}
            publicReplies={publicReplies}
            onTogglePublicReply={(i) => setPublicReplies(publicReplies.map((r, idx) => idx === i ? { ...r, enabled: !r.enabled } : r))}
            onRemovePublicReply={(i) => setPublicReplies(publicReplies.filter((_, idx) => idx !== i))}
            onOpenAddPublicReply={() => setPublicReplyModalOpen(true)}
            reactWithHeart={reactWithHeart}
            onReactWithHeart={setReactWithHeart}
            askToFollow={askToFollow}
            onAskToFollow={setAskToFollow}
            askToFollowMessage={askToFollowMessage}
            onAskToFollowMessage={setAskToFollowMessage}
            askToFollowButtonText={askToFollowButtonText}
            onAskToFollowButtonText={setAskToFollowButtonText}
            sendFollowUp={sendFollowUp}
            onSendFollowUp={setSendFollowUp}
            followUpMessage={followUpMessage}
            onFollowUpMessage={setFollowUpMessage}
            openingEnabled={openingEnabled}
            isPro={isPro}
            activePlatform={activePlatform}
            isFocused={isFocused}
            onFocus={onFocus}
          />
        );
      case 'ice-breakers':
        return (
          <CardShell
            key={cardKey}
            num={1}
            title="Setup Ice Breakers"
            icon={Hash}
            hint="Up to 4 questions visitors can tap to start a chat."
            isFocused={isFocused}
            onFocus={onFocus}
          >
            <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-[11px] text-neutral-400">
              Ice Breakers form lands in the next iteration.
            </div>
          </CardShell>
        );
      default:
        return null;
    }
  };

  return (
    // Edge-to-edge + split-pane. The `builder-fullbleed` class is what
    // triggers the `main:has(.builder-fullbleed)` CSS override in
    // globals.css AND the JS `useBuilderFullBleed` hook above — both
    // strip the layout shell and pin <main> to the viewport height on
    // lg+. We use CSS Grid rows (top bar = auto, body = 1fr) instead
    // of flex-col here because grid gives the body row a definite
    // height that h-full inside it can resolve against, even when
    // some parent in the chain misbehaves.
    <div className="builder-fullbleed grid h-full min-h-0 grid-rows-[auto_1fr] lg:h-[100dvh]">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 flex-col gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="min-w-0">
          <Link
            href="/automations"
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
            Automations / {labels.breadcrumb}
          </Link>
          <div className="mt-1 flex items-center gap-2">
            {editingName ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false); }}
                autoFocus
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xl font-bold text-neutral-900 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="group inline-flex items-center gap-2 text-xl font-bold text-neutral-900 hover:text-neutral-700 transition-colors"
              >
                {name}
                <Pencil className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-600 transition-colors" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live preview
          </span>

          <button
            type="button"
            disabled={saving}
            onClick={() => persist(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" strokeWidth={2} />}
            Save
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => persist(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" strokeWidth={2.5} />}
            {isEditMode && initialAutomation?.is_active ? 'Update' : 'Go Live'}
          </button>
        </div>
      </div>

      {/* ── Body: split-pane (phone fixed, cards scroll) ─────── */}
      {/* The outer is `grid-rows-[auto_1fr]`, so this row gets the
          remaining height (1fr) — h-full inside resolves against
          that definite height. */}
      <div className="grid min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_440px]">
        {/* Phone column — never scrolls. The phone scales to fit the
            column's height (max-h-full + aspect-ratio in the preview).
            Tight top padding so the phone sits high in the column. */}
        <div className="flex h-full min-h-0 items-center justify-center overflow-hidden bg-neutral-100 px-4 py-3">
          <ConversationPreview
            type={type}
            focusedStep={focusedStep}
            igUsername={igUsername}
            igAvatarUrl={igAvatarUrl}
            postTargetMode={postTargetMode}
            selectedPost={posts.find((p) => p.id === selectedPostId) || null}
            anyKeyword={anyKeyword}
            keywords={keywords}
            dmMessage={dmMessage}
            dmImage={dmImage}
            dmImageHeadline={dmImageHeadline}
            linkButtons={linkButtons}
            openingEnabled={openingEnabled}
            openingMessage={openingMessage}
            openingButtonText={openingButtonText}
            replyPublicly={replyPublicly}
            publicReplies={publicReplies}
            reactWithHeart={reactWithHeart}
            askToFollow={askToFollow}
            askToFollowMessage={askToFollowMessage}
            askToFollowButtonText={askToFollowButtonText}
            sendFollowUp={sendFollowUp}
            followUpMessage={followUpMessage}
            emailAskMessage={emailAskMessage}
            emailThanksMessage={emailThanksMessage}
            effectivePlan={effectivePlan}
          />
        </div>

        {/* Config rail — independently scrollable. The phone column stays
            put while the user works through the steps. h-full + min-h-0
            forces the column to honor the grid's bounded height so
            overflow-y-auto can engage. `scrollbar-none` hides the
            native scrollbar while keeping the surface scrollable
            (CSS rule lives in globals.css). */}
        <div className="scrollbar-none h-full min-h-0 overflow-y-auto border-l border-neutral-200 bg-white px-4 py-5 lg:px-6">
          <div className="space-y-4">
            {cards.map((cardKey, idx) => renderCard(cardKey, idx))}
          </div>
        </div>
      </div>

      {/* ── Add-link modal ─────────────────────────────────────── */}
      <AddLinkModal
        open={linkModalState.open}
        initial={linkModalState.editIndex >= 0 ? linkButtons[linkModalState.editIndex] : null}
        // Prefill new buttons with the user's saved default. If they
        // saved empty, new buttons start blank — their explicit choice.
        // `??` keeps a saved empty string empty; only a literal missing
        // value (legacy rows) gets the friendly "Shop now".
        defaultLabel={accountDefaults?.defaultButtonName ?? 'Shop now'}
        onSave={(data) => {
          if (linkModalState.editIndex >= 0) {
            // Edit existing
            setLinkButtons(linkButtons.map((b, i) => (i === linkModalState.editIndex ? data : b)));
          } else {
            // Add new (cap at 3)
            setLinkButtons([...linkButtons, data].slice(0, 3));
          }
          setLinkModalState({ open: false, editIndex: -1 });
        }}
        onClose={() => setLinkModalState({ open: false, editIndex: -1 })}
      />

      {/* ── Add-public-reply modal ─────────────────────────────── */}
      <AddPublicReplyModal
        open={publicReplyModalOpen}
        onClose={() => setPublicReplyModalOpen(false)}
        onSave={(reply) => {
          setPublicReplies([...publicReplies, reply]);
          setPublicReplyModalOpen(false);
        }}
      />

      {/* ── Upgrade modal ──────────────────────────────────────── */}
      <PricingModal
        open={showPricingModal}
        onClose={() => setShowPricingModal(false)}
      />
    </div>
  );
}
