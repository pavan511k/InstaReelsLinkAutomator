import Link from 'next/link';
import Image from 'next/image';
import { Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import SignOutButton from './SignOutButton';

export const metadata = {
  title: 'Coming Soon',
  description:
    'Something exciting is on the way. We\'ll email you the moment AutoDM goes live.',
  robots: { index: false, follow: false },
};

export default async function ComingSoonPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email;

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* Multi-stop gradient background — crimson at top, warm orange
          bottom-left, soft violet bottom-right. Gives the page a launch /
          dawn-sky feel without competing with the rocket. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 55% at 50% 18%, rgba(230,57,70,0.12) 0%, transparent 65%), radial-gradient(ellipse 55% 45% at 18% 88%, rgba(251,146,60,0.10) 0%, transparent 65%), radial-gradient(ellipse 55% 45% at 82% 88%, rgba(168,85,247,0.07) 0%, transparent 65%)',
        }}
      />

      {/* Floating decorative sparkles — light pulse to keep the page alive
          even when the user is sitting still. Hidden on small screens to
          avoid clutter on a phone. */}
      <Sparkle className="absolute left-[14%] top-[22%] h-3 w-3 text-[#E63946]/40" />
      <Sparkle
        className="absolute right-[16%] top-[28%] h-2.5 w-2.5 text-amber-400/50"
        delay="0.8s"
      />
      <Sparkle
        className="absolute left-[10%] top-[48%] h-2 w-2 text-purple-400/40"
        delay="1.6s"
      />
      <Sparkle
        className="absolute right-[12%] top-[55%] h-3.5 w-3.5 text-[#E63946]/30"
        delay="0.4s"
      />
      <Sparkle
        className="absolute left-[20%] bottom-[18%] h-2.5 w-2.5 text-amber-400/40"
        delay="2.2s"
      />
      <Sparkle
        className="absolute right-[22%] bottom-[22%] h-3 w-3 text-purple-400/35"
        delay="1.2s"
      />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6">
        {/* Logo — top-left corner so it anchors the brand without competing
            with the rocket nose cone for the center axis. */}
        <Link
          href="/"
          className="absolute left-5 top-5 flex items-center gap-2 sm:left-7 sm:top-6"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-neutral-200 shadow-sm">
            <Image
              src="/logo.png"
              alt="AutoDM"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
          </span>
          <span className="text-[13px] font-semibold tracking-tight">
            <span className="text-neutral-900">Auto</span>
            <span className="text-[#E63946]">DM</span>
          </span>
        </Link>

        <div className="flex w-full max-w-2xl flex-col items-center text-center">
          {/* Rocket illustration */}
          <Rocket />

          {/* Eyebrow tag */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#E63946]/25 bg-[#E63946]/5 px-3.5 py-1.5">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E63946] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E63946]" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E63946]">
              Launching soon
            </span>
          </div>

          {/* Hero — gradient text, intentionally big */}
          <h1 className="mt-5 text-5xl font-extrabold tracking-tight text-neutral-900 sm:text-6xl md:text-7xl">
            <span className="bg-gradient-to-br from-neutral-900 via-[#E63946] to-[#F97316] bg-clip-text text-transparent">
              Coming Soon
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mt-6 max-w-lg text-base leading-relaxed text-neutral-600 sm:text-lg">
            We&apos;re putting the finishing touches on AutoDM. Get ready to put
            your Instagram on autopilot — you&apos;ll be among the first to
            know when we go live.
          </p>

          {/* Email-confirmation pill — reassures the signed-up user that
              their account is locked in for launch. */}
          {email && (
            <div className="mt-8 inline-flex max-w-full items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 shadow-sm">
              <Mail className="h-4 w-4 flex-shrink-0 text-[#E63946]" />
              <span className="truncate text-sm text-neutral-700">
                We&apos;ll email{' '}
                <span className="font-semibold text-neutral-900">{email}</span> at
                launch
              </span>
            </div>
          )}

          <div className="mt-10">
            <SignOutButton />
          </div>
        </div>

        {/* Support footer — bottom of viewport */}
        <p className="absolute bottom-7 text-xs text-neutral-500">
          Questions?{' '}
          <a
            href="mailto:support@autodm.pro"
            className="font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
          >
            support@autodm.pro
          </a>
        </p>
      </div>
    </div>
  );
}

/**
 * Inline rocket illustration. The whole rocket gently floats up/down via
 * SMIL transform; the flame animates independently so it looks like real
 * thrust. The ground shadow stays anchored so the float reads visually.
 */
function Rocket() {
  return (
    <svg
      viewBox="0 0 200 280"
      className="h-48 w-auto drop-shadow-xl sm:h-56 md:h-64"
      aria-hidden
    >
      <defs>
        <linearGradient id="flame-outer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#F97316" />
          <stop offset="60%"  stopColor="#DC2626" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="flame-inner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#FEF3C7" />
          <stop offset="35%"  stopColor="#FDE047" />
          <stop offset="100%" stopColor="#F97316" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="body-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#D4D4D4" />
          <stop offset="20%"  stopColor="#FAFAFA" />
          <stop offset="50%"  stopColor="#FFFFFF" />
          <stop offset="80%"  stopColor="#F5F5F5" />
          <stop offset="100%" stopColor="#BFBFBF" />
        </linearGradient>
        <linearGradient id="nose-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#FF6B6B" />
          <stop offset="100%" stopColor="#C92A36" />
        </linearGradient>
        <linearGradient id="fin-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#E63946" />
          <stop offset="100%" stopColor="#A11D27" />
        </linearGradient>
        <radialGradient id="window-glass" cx="0.32" cy="0.30" r="0.85">
          <stop offset="0%"   stopColor="#BFDBFE" />
          <stop offset="45%"  stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </radialGradient>
      </defs>

      {/* Ground shadow — stays put while the rocket floats */}
      <ellipse cx="100" cy="270" rx="52" ry="5" fill="rgba(15,23,42,0.12)">
        <animate
          attributeName="rx"
          values="52;46;52"
          dur="3.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="1;0.7;1"
          dur="3.5s"
          repeatCount="indefinite"
        />
      </ellipse>

      {/* Floating rocket assembly */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 0 -6; 0 0"
          dur="3.5s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
          keyTimes="0;0.5;1"
        />

        {/* Outer flame */}
        <path d="M76 205 Q58 240 100 268 Q142 240 124 205 Z" fill="url(#flame-outer)">
          <animate
            attributeName="d"
            values="
              M76 205 Q58 240 100 268 Q142 240 124 205 Z;
              M74 205 Q50 250 100 278 Q150 250 126 205 Z;
              M76 205 Q58 240 100 268 Q142 240 124 205 Z
            "
            dur="0.9s"
            repeatCount="indefinite"
          />
        </path>

        {/* Inner flame */}
        <path d="M84 205 Q74 224 100 250 Q126 224 116 205 Z" fill="url(#flame-inner)">
          <animate
            attributeName="d"
            values="
              M84 205 Q74 224 100 250 Q126 224 116 205 Z;
              M85 205 Q72 232 100 258 Q128 232 115 205 Z;
              M84 205 Q74 224 100 250 Q126 224 116 205 Z
            "
            dur="0.7s"
            repeatCount="indefinite"
          />
        </path>

        {/* Fins — drawn behind the body so they tuck in cleanly */}
        <path d="M68 168 L40 210 L68 206 Z" fill="url(#fin-grad)" />
        <path d="M132 168 L160 210 L132 206 Z" fill="url(#fin-grad)" />
        {/* Fin highlights — thin lighter stripe along the leading edge */}
        <line x1="68" y1="168" x2="44" y2="208" stroke="#FCA5A5" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
        <line x1="132" y1="168" x2="156" y2="208" stroke="#FCA5A5" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />

        {/* Body — flat top so the nose cone seats cleanly, rounded bottom */}
        <path
          d="M64 88 L64 200 Q64 210 74 210 L126 210 Q136 210 136 200 L136 88 Z"
          fill="url(#body-grad)"
          stroke="#C4C4C4"
          strokeWidth="1.5"
        />

        {/* Vertical body highlight — thin glossy strip */}
        <line x1="74" y1="92" x2="74" y2="204" stroke="#fff" strokeWidth="2.5" opacity="0.7" strokeLinecap="round" />

        {/* Nose cone — meets body exactly at y=88 */}
        <path d="M64 88 Q100 16 136 88 Z" fill="url(#nose-grad)" />
        {/* Nose-cone bottom rim (small bevel between cone and body) */}
        <line x1="64" y1="88" x2="136" y2="88" stroke="#A11D27" strokeWidth="1.5" opacity="0.5" />
        {/* Nose-cone highlight */}
        <path
          d="M80 70 Q92 36 100 22"
          stroke="#FECACA"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />

        {/* Window — crimson ring + glass + reflections */}
        <circle cx="100" cy="124" r="20" fill="#E63946" />
        <circle cx="100" cy="124" r="20" fill="none" stroke="#A11D27" strokeWidth="1.5" opacity="0.6" />
        <circle cx="100" cy="124" r="15" fill="url(#window-glass)" />
        <circle cx="94"  cy="118" r="5" fill="#fff" opacity="0.65" />
        <circle cx="105" cy="130" r="2" fill="#fff" opacity="0.45" />

        {/* Panel lines + rivets — gives the body a sense of construction */}
        <line x1="72" y1="160" x2="128" y2="160" stroke="#C4C4C4" strokeWidth="1.25" />
        <circle cx="78"  cy="160" r="1.1" fill="#A3A3A3" />
        <circle cx="100" cy="160" r="1.1" fill="#A3A3A3" />
        <circle cx="122" cy="160" r="1.1" fill="#A3A3A3" />

        <line x1="72" y1="186" x2="128" y2="186" stroke="#C4C4C4" strokeWidth="1.25" />
        <circle cx="78"  cy="186" r="1.1" fill="#A3A3A3" />
        <circle cx="100" cy="186" r="1.1" fill="#A3A3A3" />
        <circle cx="122" cy="186" r="1.1" fill="#A3A3A3" />
      </g>
    </svg>
  );
}

/**
 * Tiny 4-point sparkle. Pulses opacity via SMIL so individual sparkles
 * can be offset with a `delay` prop — gives a starfield twinkle rather
 * than the whole field pulsing in unison.
 */
function Sparkle({ className, delay = '0s' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={['hidden sm:block', className].filter(Boolean).join(' ')}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 1.5l1.8 7.2L21 10.5l-7.2 1.8L12 19.5l-1.8-7.2L3 10.5l7.2-1.8L12 1.5z">
        <animate
          attributeName="opacity"
          values="0.3;1;0.3"
          dur="2.4s"
          begin={delay}
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}
