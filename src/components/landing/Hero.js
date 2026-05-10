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

      {/* Text container — left-anchored, vertically centered on lg+. */}
      <div className="relative z-[3] max-w-7xl px-6 pt-20 sm:pt-24 lg:flex lg:min-h-screen lg:items-center lg:pl-12 lg:py-24 xl:pl-16 2xl:pl-24">
        <div className="max-w-xl text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm ring-1 ring-white/20">
            <ShieldCheck className="h-3.5 w-3.5" />
            Official Meta Business Partner
          </span>

          <h1 className="mt-7 text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
            Reply to Instagram comments with a DM,{' '}
            <span className="italic font-semibold">instantly.</span>
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">
            AutoDM automatically DMs people as soon as they comment on your Reels, Posts, or Stories.
          </p>

          <div className="mt-9">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-[#2563EB] px-8 py-4 text-base font-semibold text-white shadow-xl shadow-black/30 ring-1 ring-white/15 hover:bg-[#1D4ED8] transition-colors"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-5 inline-flex items-center gap-2 text-sm text-white/85">
            <CircleCheck className="h-5 w-5 text-teal-400" strokeWidth={2} />
            No credit card required
          </p>
        </div>
      </div>

      {/* MOBILE photo — in flow, capped, aspect-ratio container so it stacks
          naturally below the text. Bottom mask fades into the band. */}
      <div className="relative z-[2] block px-6 pb-12 lg:hidden">
        <div className="relative mx-auto aspect-[1973/2189] w-full max-w-[560px] overflow-hidden">
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
