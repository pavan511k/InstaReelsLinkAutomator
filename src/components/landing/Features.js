import { Users, Sparkles, MessageCircle, Send, MousePointerClick, Mail, BarChart3 } from 'lucide-react';

const ENGAGEMENT_PHOTO = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1400&q=90';

/**
 * iOS-style glassmorphism notification chip used 3× on the wallpaper.
 * Translucent white + heavy backdrop-blur, fine white ring, light shadow.
 * App name in caps on top row, title bold, body subtle — same anatomy as
 * an iOS lock-screen card.
 */
function NotifCard({ Icon, iconBg, app, title, body, time, animationClass }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-white/30 bg-white/15 p-3 shadow-lg shadow-black/20 backdrop-blur-xl ${animationClass}`}
      style={{ opacity: 0 }}
    >
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className="h-4 w-4 text-white" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-white/85">
            {app}
          </p>
          <span className="flex-shrink-0 text-[10px] text-white/70">{time}</span>
        </div>
        <p className="mt-0.5 text-xs font-semibold text-white">{title}</p>
        <p className="truncate text-[11px] text-white/80">{body}</p>
      </div>
    </div>
  );
}

export default function Features() {
  return (
    <section className="bg-neutral-50">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-24 lg:grid-cols-3">
        {/* Headline + sub-cards (2/3) */}
        <div className="lg:col-span-2">
          {/* Headline card — red left accent bar establishes hierarchy:
              this is the lead, the two below are supporting. */}
          <div className="relative rounded-3xl bg-white p-8 ring-1 ring-neutral-200/70 before:absolute before:left-0 before:top-8 before:h-12 before:w-1 before:rounded-r-full before:bg-[#E63946] before:content-['']">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#E63946]">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#E63946]" />
              Live Automation
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Increase Engagement <span className="text-[#E63946]">by 10×</span>
            </h2>
            <p className="mt-3 max-w-md text-neutral-600">
              Automatically reply to every comment and turn engagement into meaningful conversations that drive real growth.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-3xl bg-[#F7F1ED] p-7">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <Users className="h-5 w-5 text-neutral-700" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-neutral-900">Grow your Community</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Build lasting relationships by engaging followers with perfectly timed, personalized responses every time.
              </p>
            </div>

            <div className="rounded-3xl bg-[#EEF1F4] p-7">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <Sparkles className="h-5 w-5 text-neutral-700" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-neutral-900">AI-Powered Conversations</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Let AI handle FAQs and repetitive queries instantly so you can focus on scaling your business.
              </p>
            </div>

            <div className="rounded-3xl bg-[#EEF4ED] p-7">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <Mail className="h-5 w-5 text-neutral-700" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-neutral-900">Capture Leads on Autopilot</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Auto-collect emails from interested followers straight into your CRM — every reply becomes a qualified lead.
              </p>
            </div>

            <div className="rounded-3xl bg-[#F1EEF4] p-7">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <BarChart3 className="h-5 w-5 text-neutral-700" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-neutral-900">Click Tracking &amp; Analytics</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                See who clicked your link, when, and from which post — measure what&apos;s actually converting.
              </p>
            </div>
          </div>
        </div>

        {/* Wallpaper — 9:16 portrait, photo only, with 3 glass notifications
            sequencing in at top + 100% headline overlaid on the bottom of
            the image (over a darkening gradient for legibility).
            On mobile / tablet the column spans full width, so the 9:16
            aspect would render as a ~600px+ tall card. Constrain max-width
            with mx-auto to render it as a centered phone-mockup style card
            instead. lg+ removes the cap so it fills the grid column. */}
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 shadow-xl sm:max-w-[300px] lg:max-w-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ENGAGEMENT_PHOTO}
            alt="Creator working on content"
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Top dark wash so glass notifications stay legible */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/35 to-transparent" />

          {/* Bottom dark wash for the 100% headline */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

          {/* Notification stack at top */}
          <div className="absolute inset-x-3 top-4 z-10 flex flex-col gap-2.5">
            <NotifCard
              Icon={MessageCircle}
              iconBg="bg-[#E63946]"
              app="AutoDM"
              title="New comment"
              body="@sarah.k commented LINK"
              time="now"
              animationClass="animate-engagement-notif-1"
            />
            <NotifCard
              Icon={Send}
              iconBg="bg-[#2563EB]"
              app="AutoDM"
              title="DM sent"
              body="Link delivered to @sarah.k"
              time="2s ago"
              animationClass="animate-engagement-notif-2"
            />
            <NotifCard
              Icon={MousePointerClick}
              iconBg="bg-emerald-500"
              app="AutoDM"
              title="Link clicked"
              body="@sarah.k just clicked"
              time="4s ago"
              animationClass="animate-engagement-notif-3"
            />
          </div>

          {/* 100% headline overlaid on the wallpaper itself */}
          <div className="absolute inset-x-6 bottom-6 z-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/85">
              Automation rate
            </p>
            <p className="mt-2 text-6xl font-bold leading-none text-white">100%</p>
            <p className="mt-1 text-sm font-semibold text-white">Automated Replies</p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/80">
              Every comment and DM handled instantly, without missing a single opportunity.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
