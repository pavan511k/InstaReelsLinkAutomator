'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronLeft, Save, MessageSquarePlus, Plus, X, Trash2, Loader2, User,
  Camera, Mic, Smile,
} from 'lucide-react';

/**
 * IceBreakersView — account-level Ice Breakers editor.
 *
 * Same split-pane layout as the automations builder (phone preview
 * left, editor right) so the experience reads as one consistent
 * tool. Differences:
 *   - One config per account (no list / no template picker)
 *   - No Go Live — single Save action that hits /api/ice-breakers
 *   - Phone preview shows IG inbox header + tappable Ice Breaker chips
 */

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Same layout-strip hook as BuilderView so /tools/ice-breakers
// also gets the full-bleed split-pane on lg+. Centralizing this
// would be cleaner — for now the duplication is intentional so
// each editor stays self-contained.
function useToolFullBleed() {
  useIsoLayoutEffect(() => {
    const main = document.querySelector('main');
    if (!main) return undefined;
    const isLg = () => window.innerWidth >= 1024;
    const origMainStyle    = main.getAttribute('style') || '';
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

// Reusable IG avatar — copied from BuilderView's IgAvatar so the
// preview header matches the rest of the app. Falls back to a
// neutral User icon when no profile picture is available.
function IgAvatar({ url, size = 24 }) {
  const dim = `${size}px`;
  if (url) {
    return (
      <span className="inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ width: dim, height: dim }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full rounded-full object-cover" />
      </span>
    );
  }
  return (
    <span className="inline-flex flex-shrink-0 items-center justify-center rounded-full bg-neutral-700" style={{ width: dim, height: dim }}>
      <User className="text-white/80" style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2} />
    </span>
  );
}

const MAX_QUESTIONS = 4;
const QUESTION_MAX  = 80;
const RESPONSE_MAX  = 640;

export default function IceBreakersView({
  accountId,
  igUsername = 'your_handle',
  igAvatarUrl = null,
  initialEnabled = false,
  initialQuestions = [],
  effectivePlan = 'free',
}) {
  useToolFullBleed();
  const router = useRouter();

  const isPro = ['pro', 'business', 'trial'].includes(effectivePlan);

  const [enabled, setEnabled]     = useState(initialEnabled);
  const [questions, setQuestions] = useState(
    initialQuestions.length > 0
      ? initialQuestions.map((q) => ({ title: q.title || '', responseMessage: q.responseMessage || '' }))
      : [{ title: '', responseMessage: '' }],
  );
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const validQuestions = questions.filter(
    (q) => q.title.trim() && q.responseMessage.trim(),
  );

  const updateQuestion = (i, patch) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const removeQuestion = (i) =>
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  const addQuestion = () => {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions((qs) => [...qs, { title: '', responseMessage: '' }]);
  };

  const persist = async () => {
    if (saving) return;
    if (!isPro) {
      toast.error('Ice Breakers require a Pro plan.');
      return;
    }
    if (enabled && validQuestions.length === 0) {
      toast.error('Add at least one question with a response, or turn off Ice Breakers.');
      return;
    }
    setSaving(true);
    const tId = toast.loading('Saving…');
    try {
      const res = await fetch('/api/ice-breakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          // Sending an empty array when disabled clears Meta + local.
          iceBreakers: enabled ? validQuestions : [],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed.');
      toast.success(
        enabled ? 'Ice Breakers are live.' : 'Ice Breakers cleared.',
        { id: tId },
      );
      router.refresh();
    } catch (err) {
      toast.error(err.message || 'Save failed.', { id: tId });
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    if (saving) return;
    setSaving(true);
    const tId = toast.loading('Clearing…');
    try {
      const res = await fetch(`/api/ice-breakers?accountId=${encodeURIComponent(accountId)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Clear failed.');
      toast.success('Cleared.', { id: tId });
      setEnabled(false);
      setQuestions([{ title: '', responseMessage: '' }]);
      router.refresh();
    } catch (err) {
      toast.error(err.message || 'Clear failed.', { id: tId });
    } finally {
      setSaving(false);
      setConfirmClear(false);
    }
  };

  return (
    // builder-fullbleed marker triggers the main:has() override + the
    // JS height clamp via useToolFullBleed above. Same pattern as the
    // automations builder.
    <div className="builder-fullbleed grid h-full min-h-0 grid-rows-[auto_1fr] lg:h-[100dvh]">
      {/* Top bar */}
      <div className="flex flex-shrink-0 flex-col gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="min-w-0">
          <Link
            href="/automations"
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
            Tools / Ice Breakers
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900">Ice Breakers</h1>
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
            onClick={persist}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" strokeWidth={2} />}
            Save
          </button>
        </div>
      </div>

      {/* Body: split-pane (phone preview + editor) */}
      <div className="grid min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_440px]">
        {/* Phone column */}
        <div className="flex h-full min-h-0 items-center justify-center overflow-hidden bg-neutral-100 px-4 py-3">
          <PhonePreview
            igUsername={igUsername}
            igAvatarUrl={igAvatarUrl}
            questions={enabled ? validQuestions : []}
          />
        </div>

        {/* Editor column */}
        <div className="scrollbar-none h-full min-h-0 overflow-y-auto border-l border-neutral-200 bg-white px-4 py-5 lg:px-6">
          <div className="space-y-4">
            <SetupCard
              enabled={enabled}
              onEnabledChange={setEnabled}
              questions={questions}
              onUpdateQuestion={updateQuestion}
              onRemoveQuestion={removeQuestion}
              onAddQuestion={addQuestion}
              isPro={isPro}
            />

            <HowItWorksCard />

            {validQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Delete all Ice Breakers
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirm-clear modal */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" aria-hidden />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-neutral-900">Delete all Ice Breakers?</h2>
            <p className="mt-2 text-sm text-neutral-600">
              This removes the questions from your IG inbox immediately. You can
              add them back any time.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                disabled={saving}
                className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={saving}
                className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 transition-colors"
              >
                Delete all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Editor: Setup card ───────────────────────────────────────────────────
function SetupCard({ enabled, onEnabledChange, questions, onUpdateQuestion, onRemoveQuestion, onAddQuestion, isPro }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
            1
          </span>
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
              <MessageSquarePlus className="h-4 w-4 text-neutral-500" strokeWidth={2} />
              Setup Ice Breakers
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Up to {MAX_QUESTIONS} questions visitors can tap when they open
              your DM thread for the first time.
            </p>
          </div>
        </div>
        <Toggle checked={enabled} onChange={onEnabledChange} disabled={!isPro} proGated={!isPro} />
      </div>

      {enabled && (
        <div className="mt-4 space-y-3">
          {questions.map((q, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 bg-neutral-50/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Question {i + 1}
                </p>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveQuestion(i)}
                    aria-label="Remove question"
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700">Question button text</label>
                  <input
                    type="text"
                    value={q.title}
                    onChange={(e) => onUpdateQuestion(i, { title: e.target.value.slice(0, QUESTION_MAX) })}
                    placeholder="How can I help?"
                    className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
                  />
                  <p className="mt-1 text-[10px] text-neutral-500">{q.title.length} / {QUESTION_MAX}</p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700">Auto-reply when tapped</label>
                  <textarea
                    value={q.responseMessage}
                    onChange={(e) => onUpdateQuestion(i, { responseMessage: e.target.value.slice(0, RESPONSE_MAX) })}
                    placeholder="Hey! Glad you reached out — here's what I can help with…"
                    rows={3}
                    className="mt-1 block w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 transition-colors"
                  />
                  <p className="mt-1 text-[10px] text-neutral-500">{q.responseMessage.length} / {RESPONSE_MAX}</p>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={onAddQuestion}
            disabled={questions.length >= MAX_QUESTIONS}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-2.5 text-xs font-semibold text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add Question ({questions.length}/{MAX_QUESTIONS})
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Editor: How it works (informational) ─────────────────────────────────
function HowItWorksCard() {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
      <h3 className="text-sm font-bold text-blue-900">How Ice Breakers work</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-blue-900/85 marker:text-blue-400">
        <li>Visitors see your questions when they open the DM thread for the first time.</li>
        <li>Tapping a question sends it as a DM and we auto-reply with the configured response.</li>
        <li>Maximum {MAX_QUESTIONS} questions allowed.</li>
        <li>Available on the Instagram mobile app (not on web).</li>
      </ul>
    </div>
  );
}

// ─── Phone preview ────────────────────────────────────────────────────────
function PhonePreview({ igUsername, igAvatarUrl, questions }) {
  return (
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
        {/* Header */}
        <div className="mt-5 flex items-center gap-2 border-b border-white/5 px-3 pb-2 text-white">
          <ChevronLeft className="h-4 w-4" />
          <IgAvatar url={igAvatarUrl} size={28} />
          <span className="text-xs font-semibold">{igUsername}</span>
        </div>
        {/* Conversation area: empty thread + ice breaker chips above
            the input bar. `pb-14` reserves enough vertical space for
            the absolutely-positioned input bar (h-9 + bottom-3 + a
            small breathing margin) so the bottommost chip never
            collides with it, even with the max of 4 questions. */}
        <div className="relative flex h-[calc(100%-7rem)] flex-col justify-end px-3 pb-14 pt-3">
          <div className="space-y-1.5">
            {questions.length === 0 ? (
              <div className="mx-auto max-w-[78%] rounded-2xl border border-dashed border-white/10 px-3 py-3 text-center text-[10px] italic text-white/30">
                Add a question and enable Ice Breakers to preview.
              </div>
            ) : (
              <>
                <p className="mb-1 text-center text-[9px] uppercase tracking-widest text-white/40">
                  Start a conversation
                </p>
                {questions.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    className="block w-full truncate rounded-md bg-neutral-700 px-3 py-1.5 text-center text-[11px] font-semibold text-white"
                  >
                    {q.title || `Question ${i + 1}`}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
        {/* Input bar */}
        <div className="absolute inset-x-3 bottom-3 flex h-9 items-center gap-2 rounded-full bg-neutral-800/90 px-3 text-[11px] text-white/40">
          <Camera className="h-3.5 w-3.5" />
          <span className="flex-1 truncate">Message…</span>
          <Mic className="h-3.5 w-3.5" />
          <Smile className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}

// ─── Atom: Toggle (matches builder's Toggle styling) ──────────────────────
function Toggle({ checked, onChange, disabled, proGated }) {
  return (
    <div className="flex items-center gap-2">
      {proGated && (
        <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
          Pro
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={[
          'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-[#E63946]' : 'bg-neutral-200',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          ].join(' ')}
        />
      </button>
    </div>
  );
}
