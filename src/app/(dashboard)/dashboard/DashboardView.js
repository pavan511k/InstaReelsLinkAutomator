'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Zap, Clock, Sparkles, ArrowRight, AlertTriangle, Instagram, BarChart3,
  ChevronRight, Plus, CheckCircle, Lock, Crown, MessageCircle, Users,
} from 'lucide-react';
// PostCardsGrid removed — the old "Posts ready to automate" grid was
// retired in favor of the Popular Automations CTAs (the new builder
// handles post selection inline via the Specific Post picker).
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';
import PricingModal from '@/components/dashboard/PricingModal';

/**
 * One usage row inside PlanUsageCard. `value`/`max` drive the bar; if
 * `max` is null the usage is unlimited and we show a thin neutral bar
 * with no fill.
 */
function UsageRow({ icon: Icon, iconClass, label, value, max, valueLabel, accent = 'from-blue-500 to-cyan-400' }) {
  const pct = max == null
    ? 0
    : max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const isAtCap = max != null && value >= max;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <span className={['inline-flex h-6 w-6 items-center justify-center rounded-md', iconClass].join(' ')}>
            <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          {label}
        </span>
        <span className="text-sm font-semibold text-neutral-900">
          {valueLabel ?? value.toLocaleString()}
          <span className="text-neutral-400"> / {max == null ? 'Unlimited' : max.toLocaleString()}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        {max != null && (
          <div
            className={[
              'h-full rounded-full bg-gradient-to-r transition-all',
              isAtCap ? 'from-amber-500 to-amber-400' : accent,
            ].join(' ')}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * PlanUsageCard — the left half of the dashboard's analytics row.
 * Shows current plan + three usage bars (Automations / Messages /
 * Contacts) with an Upgrade CTA. Mirrors the chatautodm design.
 */
function PlanUsageCard({
  effectivePlan,
  trialDaysLeft,
  totalAutomations,
  automationLimit,
  monthlySent,
  monthlyDmLimit,
  totalContacts,
  atLimit,
  onUpgrade,
}) {
  const isPaidPro = effectivePlan === 'pro' || effectivePlan === 'business';
  const isTrial   = effectivePlan === 'trial';
  const planLabel = isPaidPro ? 'Pro Plan' : isTrial ? 'Trial' : 'Free Plan';
  const statusBadge = isPaidPro
    ? { label: 'Active',    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
    : isTrial
      ? { label: `${trialDaysLeft}d left`, tone: 'border-amber-200 bg-amber-50 text-amber-700' }
      : { label: 'Active',  tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-neutral-900">{planLabel}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">Usage &amp; limits</p>
        </div>
        <span className={['inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', statusBadge.tone].join(' ')}>
          {statusBadge.label}
        </span>
      </div>

      {/* Usage rows take all the leftover vertical space — `flex-1` +
          `justify-around` distributes the rows evenly so the bars
          breathe instead of clumping near the top of a tall card. */}
      <div className="mt-6 flex flex-1 flex-col justify-around gap-5">
        <UsageRow
          icon={Zap}
          iconClass="bg-blue-50 text-blue-600"
          label="Automations"
          value={totalAutomations}
          max={automationLimit}
          accent="from-blue-500 to-cyan-400"
        />
        <UsageRow
          icon={MessageCircle}
          iconClass="bg-violet-50 text-violet-600"
          label="Messages Sent"
          value={monthlySent}
          max={monthlyDmLimit}
          accent="from-violet-500 to-fuchsia-400"
        />
        <UsageRow
          icon={Users}
          iconClass="bg-emerald-50 text-emerald-600"
          label="Contacts"
          value={totalContacts}
          max={null}
          accent="from-emerald-500 to-teal-400"
        />
      </div>

      {/* Upgrade button sticks to the bottom edge of the card via the
          flex-1 spacer above. Keeps the CTA where the eye expects it
          even when the chart card next door is taller. */}
      <div className="mt-6 flex items-center gap-3 border-t border-neutral-100 pt-4">
        <button
          type="button"
          onClick={onUpgrade}
          className={[
            'inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors',
            isPaidPro
              ? 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              : 'bg-neutral-900 text-white hover:bg-black',
          ].join(' ')}
        >
          {isPaidPro ? 'Manage Plan' : <>
            <Crown className="h-3.5 w-3.5" strokeWidth={2.5} />
            Upgrade
          </>}
        </button>
        {atLimit && (
          <span className="text-[11px] font-medium text-amber-700">
            Automation cap reached — upgrade to add more.
          </span>
        )}
      </div>
    </div>
  );
}

function daysUntilMonthEnd() {
  const now     = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

/**
 * DashboardView — connected-state dashboard. Single layout serving both
 * new users (action cards lead the way, KPIs gracefully show zeros with
 * helpful sub-copy) and returning users (action cards stay visible as
 * "do something now" CTAs while KPIs + charts surface real data).
 */
export default function DashboardView({
  greeting,
  displayName,
  /* `motivationalQuote` and `stats` are still passed by page.js but no
     longer rendered — header copy is a fixed welcome line, KPI tiles were
     removed in favour of action cards + chart + usage ring. Both should
     be cleaned up in page.js in a follow-up tidy pass. */
  // motivationalQuote,
  // stats,
  dailyDMData,
  monthlySent,
  monthlyDmLimit,
  setupPosts,
  effectivePlan = 'free',
  trialDaysLeft = 0,
  totalAutomations = 0,
  automationLimit = null,
  totalContacts = 0,
}) {
  const MONTHLY_DM_LIMIT = monthlyDmLimit;

  const isOnTrial       = effectivePlan === 'trial';
  const isTrialExpiring = isOnTrial && trialDaysLeft <= 5;
  const isPaidPro       = effectivePlan === 'pro' || effectivePlan === 'business';

  // Free-tier automation cap. atLimit gates the "New automation" CTA
  // and the Popular Automations cards — clicking opens the PricingModal
  // instead of routing into the builder.
  const atLimit = automationLimit != null && totalAutomations >= automationLimit;
  const [showPricingModal, setShowPricingModal] = useState(false);
  const onCreateClick = (e) => {
    if (atLimit) {
      e.preventDefault();
      setShowPricingModal(true);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            {greeting},{' '}
            <span className="text-[#E63946]">{displayName}</span> 👋
          </h1>
          <p className="mt-1 text-sm text-neutral-600">Welcome to your dashboard.</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm">
            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          {isPaidPro && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <Sparkles className="h-3 w-3" strokeWidth={2.5} /> Pro
            </span>
          )}
          {automationLimit != null && (
            <span className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
              atLimit
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-neutral-200 bg-white text-neutral-700 shadow-sm',
            ].join(' ')}>
              {atLimit && <Lock className="h-3 w-3" strokeWidth={2.5} />}
              {totalAutomations} / {automationLimit} automations
            </span>
          )}
        </div>
      </div>

      {/* ── Trial / upgrade banner ───────────────────────────────── */}
      {isOnTrial && (
        <div className={[
          'flex flex-col items-start justify-between gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center',
          isTrialExpiring
            ? 'border-amber-300 bg-amber-50'
            : 'border-[#E63946]/20 bg-[#FFF1F2]',
        ].join(' ')}>
          <div className="flex items-start gap-3">
            <span className={[
              'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
              isTrialExpiring ? 'bg-amber-500 text-white' : 'bg-[#E63946] text-white',
            ].join(' ')}>
              {isTrialExpiring
                ? <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />
                : <Sparkles className="h-4 w-4" strokeWidth={2.5} />}
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-neutral-900">
                {isTrialExpiring
                  ? `Trial expires in ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} — don't lose Pro access`
                  : `🎉 You're on a 30-day free Pro trial — ${trialDaysLeft} days remaining`}
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">
                {isTrialExpiring
                  ? 'Email Collector, Story Mention Auto-DM and Ask-to-Follow stop firing the moment your trial ends.'
                  : 'Email Collector, Story Mention Auto-DM, Ask-to-Follow & more. Subscribe at ₹299/month to keep access.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPricingModal(true)}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[#E63946] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#CC2E3B] transition-colors"
          >
            Upgrade to Pro <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* ── Action cards row — chatautodm pattern, always visible.
            Mid card (Create automation) is the prominent coral CTA. The
            other two are status / discovery cards that stay useful even
            for power users. */}
      {/* pb-4 adds visible padding-bottom so this row reads as a distinct
          "onboarding section" before the analytics row that follows
          (sibling margin would collapse with parent's space-y; padding
          doesn't, so we get real separation). */}
      <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-3">
        {/* All three cards share the EXACT same anatomy:
              EYEBROW (uppercase tracking-widest 10px)
              TITLE (xl bold)
              CTA BUTTON (mt-auto pinned to bottom)
            Mid card differentiates ONLY via tinted bg + filled CTA — no
            extra elements, no icons, no description paragraph. Heights
            stay equal because content has equal density. */}

        {/* 1. Instagram connection */}
        <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            Instagram Connection
          </p>
          <h3 className="mt-2 text-xl font-bold text-neutral-900">Connected</h3>
          <div className="mt-auto pt-10">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
            >
              Manage <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* 2. Create automation — only differentiator: coral tint + filled CTA */}
        <div className="flex flex-col rounded-2xl border border-[#E63946]/20 bg-[#FFF1F2] p-8 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#E63946]">
            Create automation
          </p>
          <h3 className="mt-2 text-xl font-bold text-neutral-900">
            {atLimit ? 'Free plan limit reached' : 'Launch flows fast'}
          </h3>
          {atLimit && (
            <p className="mt-1 text-xs text-neutral-700">
              You&apos;ve hit the {automationLimit}-automation cap. Upgrade to Pro for unlimited automations.
            </p>
          )}
          <div className="mt-auto pt-10">
            {/* Coral CTA — this is the dashboard's brand-color highlight
                moment. Everywhere else uses black for utility, but THIS
                one stays coral because it's the central onboarding push.
                Navigates to /automations?modal=picker so the template
                picker pops open immediately on landing. */}
            <Link
              href="/automations?modal=picker"
              onClick={onCreateClick}
              className="inline-flex items-center gap-2 rounded-lg bg-[#E63946] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#CC2E3B] transition-colors"
            >
              {atLimit ? <Crown className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
              {atLimit ? 'Upgrade to Pro' : 'New automation'}
            </Link>
          </div>
        </div>

        {/* 3. Track growth */}
        <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            Activity Overview
          </p>
          <h3 className="mt-2 text-xl font-bold text-neutral-900">Track growth</h3>
          <div className="mt-auto pt-10">
            <Link
              href="/logs"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
            >
              View logs <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Plan & Activity row: 50/50, equal heights via grid ─────
          Both cards use `flex h-full flex-col` so they stretch to the
          row's tallest height. The chart container has `flex-1` so it
          absorbs whatever space the Plan card needs, keeping both
          card outlines visually equal. */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <PlanUsageCard
          effectivePlan={effectivePlan}
          trialDaysLeft={trialDaysLeft}
          totalAutomations={totalAutomations}
          automationLimit={automationLimit}
          monthlySent={monthlySent}
          monthlyDmLimit={MONTHLY_DM_LIMIT}
          totalContacts={totalContacts}
          atLimit={atLimit}
          onUpgrade={() => setShowPricingModal(true)}
        />
        <div className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex-1">
            <AnalyticsChart data={dailyDMData} />
          </div>
        </div>
      </div>

      {/* ── Popular Automations ──────────────────────────────────── */}
      {/* Replaces the old "Posts ready to automate" grid — now that
          the new builder's Specific Post picker handles post-binding
          inline, the dashboard's job is to nudge users toward the
          two highest-conversion templates rather than browse posts. */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-neutral-900">Popular Automations</h2>
          <p className="mt-1 text-xs text-neutral-600">
            Get started with the templates creators use most.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Link
            href="/automations/builder?type=comment-to-dm&name=Comment%20Trigger%20DMs"
            onClick={onCreateClick}
            className="group flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-5 transition-all hover:border-neutral-300 hover:shadow-md"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF1F2] text-[#E63946]">
              <Zap className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <h3 className="text-sm font-bold text-neutral-900">Comment Trigger DMs</h3>
            <p className="text-xs leading-relaxed text-neutral-600">
              Automatically reply to comments and send personalized DMs with
              interactive buttons.
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-900 group-hover:gap-1.5 transition-all">
              {atLimit ? <><Lock className="h-3 w-3" strokeWidth={2.5} /> Upgrade to use</> : <>Set it up <ArrowRight className="h-3 w-3" strokeWidth={2.5} /></>}
            </span>
          </Link>

          <Link
            href="/automations/builder?type=story-reply&name=Story%20DM%20Auto-Replies"
            onClick={onCreateClick}
            className="group flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-5 transition-all hover:border-neutral-300 hover:shadow-md"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <h3 className="text-sm font-bold text-neutral-900">Story DM Auto-Replies</h3>
            <p className="text-xs leading-relaxed text-neutral-600">
              Respond to story replies instantly and convert viewers into
              customers with automated DMs.
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-900 group-hover:gap-1.5 transition-all">
              {atLimit ? <><Lock className="h-3 w-3" strokeWidth={2.5} /> Upgrade to use</> : <>Set it up <ArrowRight className="h-3 w-3" strokeWidth={2.5} /></>}
            </span>
          </Link>
        </div>
      </div>

      <PricingModal
        open={showPricingModal}
        onClose={() => setShowPricingModal(false)}
      />
    </div>
  );
}
