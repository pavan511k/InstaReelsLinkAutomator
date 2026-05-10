'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronLeft, Save, AtSign, Loader2, User, Camera, Mic, Smile, Sparkles, Lock,
} from 'lucide-react';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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

const MESSAGE_MAX = 1000;

export default function StoryMentionView({
  accountId,
  defaultConfig = {},
  igUsername = 'your_handle',
  igAvatarUrl = null,
  initialEnabled = false,
  initialMessage = '',
  effectivePlan = 'free',
}) {
  useToolFullBleed();
  const router = useRouter();

  const isPro = ['pro', 'business', 'trial'].includes(effectivePlan);

  const [enabled, setEnabled] = useState(initialEnabled);
  const [message, setMessage] = useState(initialMessage);
  const [saving, setSaving]   = useState(false);

  const persist = async () => {
    if (saving) return;
    if (!isPro) {
      toast.error('Story Mention Auto-DM requires a Pro plan.');
      return;
    }
    if (enabled && !message.trim()) {
      toast.error('Add a message, or turn off Story Mention Auto-DM.');
      return;
    }
    setSaving(true);
    const tId = toast.loading('Saving…');
    try {
      const merged = {
        ...defaultConfig,
        mentionDm: { enabled, message: message.trim() },
      };
      const res = await fetch('/api/accounts/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, config: merged }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Save failed.');
      }
      toast.success(
        enabled ? 'Story Mention Auto-DM is live.' : 'Story Mention Auto-DM disabled.',
        { id: tId },
      );
      router.refresh();
    } catch (err) {
      toast.error(err.message || 'Save failed.', { id: tId });
    } finally {
      setSaving(false);
    }
  };

  const previewMessage = (message || initialMessage || '')
    .replace(/{username}/g, igUsername)
    .replace(/{first_name}/g, igUsername.split(/[._]/)[0] || igUsername);

  return (
    <div className="builder-fullbleed grid h-full min-h-0 grid-rows-[auto_1fr] lg:h-[100dvh]">
      {/* Top bar */}
      <div className="flex flex-shrink-0 flex-col gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="min-w-0">
          <Link
            href="/automations"
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
            Tools / Story Mention Auto-DM
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900">Story Mention Auto-DM</h1>
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

      {/* Body: split-pane */}
      <div className="grid min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_440px]">
        {/* Phone column */}
        <div className="flex h-full min-h-0 items-center justify-center overflow-hidden bg-neutral-100 px-4 py-3">
          <PhonePreview
            igUsername={igUsername}
            igAvatarUrl={igAvatarUrl}
            message={enabled ? previewMessage : ''}
          />
        </div>

        {/* Editor column */}
        <div className="scrollbar-none h-full min-h-0 overflow-y-auto border-l border-neutral-200 bg-white px-4 py-5 lg:px-6">
          <div className="space-y-4">
            {!isPro && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <Sparkles className="h-4 w-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-amber-900">Pro feature</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80">
                    Story Mention Auto-DM is available on Pro and Trial plans.
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="inline-flex flex-shrink-0 items-center rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black transition-colors"
                >
                  Upgrade
                </Link>
              </div>
            )}

            <SetupCard
              enabled={enabled}
              onEnabledChange={setEnabled}
              message={message}
              onMessageChange={setMessage}
              isPro={isPro}
            />

            <HowItWorksCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupCard({ enabled, onEnabledChange, message, onMessageChange, isPro }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
            1
          </span>
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
              <AtSign className="h-4 w-4 text-neutral-500" strokeWidth={2} />
              Setup auto-reply
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Auto-DM anyone who @mentions your account in their Instagram story.
            </p>
          </div>
        </div>
        <Toggle checked={enabled} onChange={onEnabledChange} disabled={!isPro} proGated={!isPro} />
      </div>

      {enabled && (
        <div className="mt-4 space-y-2">
          <label className="block text-[11px] font-semibold text-neutral-700">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value.slice(0, MESSAGE_MAX))}
            placeholder="Hey! Thanks for mentioning us 🙌 We saw your story and wanted to reach out!"
            rows={4}
            disabled={!isPro}
            className="block w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E63946] focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-neutral-500">
              Supports <code className="rounded bg-neutral-100 px-1 text-[10px] font-mono text-neutral-700">{'{username}'}</code> and <code className="rounded bg-neutral-100 px-1 text-[10px] font-mono text-neutral-700">{'{first_name}'}</code>.
            </p>
            <p className="text-[10px] text-neutral-500">{message.length} / {MESSAGE_MAX}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function HowItWorksCard() {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
      <h3 className="text-sm font-bold text-blue-900">How Story Mention Auto-DM works</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-blue-900/85 marker:text-blue-400">
        <li>When someone @mentions your account in their story, Instagram sends us a webhook.</li>
        <li>AutoDM replies with this message in their DM thread automatically.</li>
        <li>Great for rewarding fans who share your content and starting conversations.</li>
        <li>Each user only receives the auto-DM once per story mention to avoid duplicates.</li>
      </ul>
    </div>
  );
}

function PhonePreview({ igUsername, igAvatarUrl, message }) {
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
        {/* Conversation area */}
        <div className="relative flex h-[calc(100%-7rem)] flex-col justify-end px-3 pb-14 pt-3">
          <div className="space-y-2">
            {/* Story mention stub — incoming */}
            <div className="flex items-end gap-1.5">
              <IgAvatar url={igAvatarUrl} size={18} />
              <div className="max-w-[78%] rounded-2xl rounded-bl-sm border border-white/10 bg-neutral-800 px-3 py-2 text-[11px] text-white/85">
                <p className="text-[9px] uppercase tracking-wider text-white/40">Mentioned you in their story</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="inline-block h-8 w-6 rounded bg-gradient-to-br from-pink-500 via-orange-400 to-amber-300" />
                  <span className="text-[10px] text-white/60">Tap to view</span>
                </div>
              </div>
            </div>

            {/* Auto-DM reply */}
            {message ? (
              <div className="flex justify-end">
                <div className="max-w-[78%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-[#3797F0] px-3 py-2 text-[11px] text-white">
                  {message}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-[78%] rounded-2xl border border-dashed border-white/10 px-3 py-3 text-center text-[10px] italic text-white/30">
                Add a message and enable Story Mention Auto-DM to preview.
              </div>
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

function Toggle({ checked, onChange, disabled, proGated }) {
  return (
    <div className="flex items-center gap-2">
      {proGated && (
        <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
          <Lock className="mr-0.5 h-2.5 w-2.5" strokeWidth={2.5} /> Pro
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
