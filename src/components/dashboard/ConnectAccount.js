'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Instagram, Check, ShieldCheck, Sparkles, ArrowRight, Loader2, ChevronRight } from 'lucide-react';

const CONNECTION_OPTIONS = [
  {
    id: 'instagram',
    title: 'Instagram Account',
    icon: 'instagram',
    description: 'Reply to comments and DMs from your Instagram Business or Creator account.',
    features: [
      'AutoDM on post, reel & story comments',
      'Story replies & Story Mention Auto-DM',
      'Ice Breakers & Ask-to-Follow gate',
      'Email Collector lead capture',
      'Real-time analytics & DM logs',
    ],
    buttonLabel: 'Connect Instagram',
    badge: { text: 'Recommended', tone: 'recommended' },
    cardTint: 'bg-[#FFF5F2]',          // soft peach (warm, on-brand)
    iconBg: 'bg-gradient-to-br from-amber-400 via-pink-500 to-fuchsia-600', // IG gradient on icon ONLY (small)
    badgeBg: 'bg-[#E63946]/10 text-[#E63946] border-[#E63946]/20',
  },
  {
    id: 'facebook',
    title: 'Facebook Page',
    icon: 'facebook',
    description: 'Comment-triggered DMs from your Facebook Page (text replies only).',
    features: [
      'Comment-triggered text DMs',
      'Auto-reply on comments',
      'Keyword triggers (any-post & per-post)',
      'Real-time analytics & DM logs',
    ],
    buttonLabel: 'Connect Facebook',
    badge: { text: 'Limited features', tone: 'limited' },
    cardTint: 'bg-[#EEF1F4]',          // cool blue-gray (neutral)
    iconBg: 'bg-[#1877F2]',
    badgeBg: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  // "Instagram + Facebook" combined connect was removed: managing one
  // platform per account row is simpler for the rest of the system
  // (FB closed-beta gate, IG-only feature toggles, billing). Existing
  // connected_accounts rows with platform='both' continue to work.
];

const ERROR_MESSAGES = {
  oauth_denied:        'You denied access. Please try again and grant the required permissions.',
  missing_params:      'Something went wrong. Please try connecting again.',
  invalid_state:       'Invalid session. Please try connecting again.',
  no_instagram_account:'No Instagram Business account found. Make sure your Instagram account is a Business or Creator account linked to a Facebook Page.',
  no_facebook_page:    'No Facebook Page found. You need at least one Facebook Page to connect.',
  fb_coming_soon:      'Facebook support is launching soon — we\'ll let you know the moment it goes live. For now, please connect Instagram instead.',
  disconnect_first:    'You already have a connected account. Please disconnect it from Settings → Permissions before connecting a different platform.',
  save_failed:         'Failed to save your account. Please try again.',
  oauth_failed:        'Connection failed. Please try again.',
};

function PlatformIcon({ icon, className = 'h-5 w-5' }) {
  if (icon === 'instagram') return <Instagram className={className} strokeWidth={2} />;
  if (icon === 'facebook') return <span className={`${className} flex items-center justify-center font-extrabold text-white`} style={{ fontFamily: 'Arial, sans-serif' }}>f</span>;
  return <Sparkles className={className} strokeWidth={2} />;
}

export default function ConnectAccount({ fbAllowed = true }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState('');

  // When FB_BETA_MODE is on and this user isn't allowlisted, downgrade the
  // FB tile to "Coming soon" so they can't initiate FB OAuth. The server
  // route enforces the same gate (defense-in-depth).
  const connectionOptions = CONNECTION_OPTIONS.map((opt) => {
    if (opt.id === 'facebook' && !fbAllowed) {
      return {
        ...opt,
        description: 'Facebook support is launching soon. Stay tuned — we\'ll let you know the moment it goes live.',
        buttonLabel: 'Coming soon',
        badge:    { text: 'Coming soon', tone: 'soon' },
        cardTint: 'bg-neutral-100',
        iconBg:   'bg-neutral-900',
        badgeBg:  'bg-neutral-200 text-neutral-700 border-neutral-300',
        disabled: true,
      };
    }
    return opt;
  });

  useEffect(() => {
    const error   = searchParams.get('error');
    const message = searchParams.get('message');
    if (error) setErrorMessage(ERROR_MESSAGES[error] || message || 'An unknown error occurred.');

    const connected = searchParams.get('connected');
    if (connected) router.refresh();
  }, [searchParams, router]);

  const handleConnect = (connectionType) => {
    setIsConnecting(connectionType);
    setErrorMessage('');
    window.location.href = `/api/auth/meta/connect?type=${connectionType}`;
  };

  return (
    <div className="relative min-h-screen">
      {/* Soft crimson tint, same gradient family as the auth pages — gives
          the "first time logging in" surface a brand bridge from signup. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(142,27,38,0.07) 0%, transparent 65%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:py-16">
        {/* Hero */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-[#E63946]" />
            Official Meta Business Partner
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Connect your account to get started
          </h1>
          <p className="mt-3 text-base text-neutral-600">
            Choose how you want to connect. Each platform unlocks different automation features.
          </p>
        </div>

        {/* Step indicator */}
        <ol className="mx-auto mt-8 flex max-w-xl items-center justify-center gap-2 text-xs font-medium text-neutral-500 sm:gap-3">
          <li className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E63946] text-[11px] font-bold text-white">1</span>
            <span className="text-neutral-900">Choose platform</span>
          </li>
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400" strokeWidth={2.5} />
          <li className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 bg-white text-[11px] font-semibold text-neutral-500">2</span>
            <span>Authorize</span>
          </li>
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400" strokeWidth={2.5} />
          <li className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 bg-white text-[11px] font-semibold text-neutral-500">3</span>
            <span>Start automating</span>
          </li>
        </ol>

        {/* Error banner */}
        {errorMessage && (
          <div role="alert" className="mx-auto mt-8 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="mr-2 font-semibold">Couldn&apos;t connect.</span>
            {errorMessage}
          </div>
        )}

        {/* Platform cards */}
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 max-w-3xl mx-auto">
          {connectionOptions.map((option) => {
            const isThisConnecting = isConnecting === option.id;
            const isDisabled       = option.disabled || (isConnecting && !isThisConnecting);

            return (
              <div
                key={option.id}
                className={[
                  'relative flex flex-col rounded-3xl border border-neutral-200 p-8 transition-shadow',
                  option.cardTint,
                  option.disabled
                    ? 'opacity-60'
                    : 'hover:border-neutral-300 hover:shadow-lg hover:shadow-neutral-200/80',
                ].join(' ')}
              >
                {/* Floating badge */}
                {option.badge && (
                  <span className={[
                    'absolute -top-3 left-6 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm',
                    option.badgeBg,
                  ].join(' ')}>
                    {option.badge.text}
                  </span>
                )}

                {/* Icon */}
                <span className={[
                  'inline-flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm',
                  option.iconBg,
                ].join(' ')}>
                  <PlatformIcon icon={option.icon} className="h-5 w-5" />
                </span>

                <h3 className="mt-5 text-lg font-bold text-neutral-900">{option.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{option.description}</p>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {option.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E63946]" strokeWidth={3} />
                      <span className="text-xs leading-relaxed text-neutral-700">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => !option.disabled && handleConnect(option.id)}
                  disabled={isDisabled}
                  className={[
                    'mt-7 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
                    option.disabled
                      ? 'cursor-not-allowed bg-neutral-200 text-neutral-500'
                      : 'bg-neutral-900 text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60',
                  ].join(' ')}
                >
                  {isThisConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    <>
                      {option.buttonLabel}
                      {!option.disabled && <ArrowRight className="h-4 w-4" />}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust footer — security-only message. The top pill already
            establishes the Meta partnership, so we don't repeat the brand
            here; this band is purely about HOW the connection works
            (OAuth, no password handover). */}
        <div className="mx-auto mt-12 flex max-w-2xl items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-neutral-900">Secure by design</p>
            <p className="text-xs text-neutral-500">
              Connect via official OAuth. Your password is never shared with us.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Need help connecting?{' '}
          <Link href="mailto:support@autodm.pro" className="font-medium text-neutral-700 hover:text-neutral-900 transition-colors">
            support@autodm.pro
          </Link>
        </p>
      </div>
    </div>
  );
}
