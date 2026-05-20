import Link from 'next/link';
import { ArrowRight, ShieldCheck, CircleCheck } from 'lucide-react';

const HERO_PHOTO = '/hero-creator.png';

export default function Hero() {
  return (
    /* Navbar is now a floating fixed-position pill (no flow space), so the
       hero starts at viewport-top naturally — no negative-margin trick. */
    <section className="relative isolate overflow-hidden bg-[#8E1B26] text-white">
      {/* Two-layer vignette only.
          Dropped the warm "spotlight" overlay — at certain viewport sizes the
          ellipse boundary was rendering as a hard diagonal streak across the
          band, fighting the subject. A quiet corner vignette + a bottom fade
          frames the photo without adding visual noise. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'radial-gradient(ellipse 110% 100% at 50% 50%, transparent 35%, rgba(0,0,0,0.6) 100%), linear-gradient(to bottom, transparent 75%, rgba(0,0,0,0.45) 100%)',
        }}
      />

      {/* Horizontal text+photo layout at every breakpoint. On mobile this
          renders as text on the left + a compact portrait on the right;
          on lg+ the inline portrait is hidden and the absolute full-height
          portrait takes over the right side for the dramatic edge-to-edge
          desktop look. */}
      <div className="relative z-[3] mx-auto flex max-w-7xl items-center gap-4 px-4 pb-10 pt-20 sm:gap-6 sm:px-6 sm:pt-24 lg:gap-12 lg:min-h-screen lg:pb-0 lg:pl-12 lg:py-24 xl:pl-16 2xl:pl-24">
        <div className="min-w-0 flex-1 max-w-xl text-left">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm ring-1 ring-white/20 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs">
            <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Official Meta Business Partner
          </span>

          <h1 className="mt-4 text-lg font-bold leading-[1.15] tracking-tight sm:mt-7 sm:text-3xl md:text-4xl lg:text-5xl">
            Reply to Instagram comments with a DM,{' '}
            <span className="italic font-semibold">instantly.</span>
          </h1>

          <p className="mt-3 max-w-md text-xs leading-relaxed text-white/80 sm:mt-5 sm:text-sm md:text-base">
            AutoDM automatically DMs people as soon as they comment on your Reels, Posts, or Stories.
          </p>

          <div className="mt-4 sm:mt-9">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white shadow-xl shadow-black/30 ring-1 ring-white/15 transition-colors hover:bg-[#1D4ED8] sm:gap-2 sm:px-6 sm:py-3 sm:text-sm md:px-8 md:py-4 md:text-base"
            >
              Get Started Free
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Link>
          </div>

          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-white/85 sm:mt-5 sm:gap-2 sm:text-sm">
            <CircleCheck className="h-4 w-4 text-teal-400 sm:h-5 sm:w-5" strokeWidth={2} />
            No credit card required
          </p>
        </div>

        {/* INLINE portrait — sits to the right of the text at sub-lg sizes
            so the hero stays horizontal on mobile. Hidden at lg+ because
            the absolute full-height portrait below takes over. */}
        <div className="flex-shrink-0 w-[38%] max-w-[140px] sm:max-w-[200px] md:max-w-[280px] lg:hidden">
          <div className="relative aspect-[1973/2189] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_PHOTO}
              alt="AutoDM creator"
              className="absolute inset-0 h-full w-full object-cover object-bottom"
              style={{
                maskImage:
                  'linear-gradient(to bottom, black 90%, transparent 100%)',
                WebkitMaskImage:
                  'linear-gradient(to bottom, black 90%, transparent 100%)',
              }}
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </div>
      </div>

      {/* DESKTOP photo — container width MATCHES the PNG's native aspect
          (1973/2189 ≈ 0.901). With h-screen, width = 90vh, so the image
          fills the column edge-to-edge with no empty crimson on either
          side and no cropping. max-w-[55vw] caps it on portrait/square
          viewports so the column never overflows the viewport width. */}
      <div className="hidden lg:absolute lg:right-0 lg:bottom-0 lg:z-[2] lg:block lg:h-screen lg:w-[90vh] lg:max-w-[55vw]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_PHOTO}
          alt="AutoDM creator"
          className="absolute inset-0 h-full w-full object-cover object-bottom"
          style={{
            maskImage:
              'linear-gradient(to bottom, black 92%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 92%, transparent 100%)',
          }}
        />
      </div>
    </section>
  );
}
