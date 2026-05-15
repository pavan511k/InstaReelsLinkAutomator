'use client';

import { useEffect, useState } from 'react';
import {
  Check, Zap, ArrowRight, Loader2, Crown, ShieldCheck, Lock, CreditCard, Clock, Sparkles,
} from 'lucide-react';
import Link from 'next/link';

/**
 * /pricing — same plan card layout as the landing page Pricing section.
 * Simple feature lists per plan (no over-engineered category breakdowns).
 * Mirrors src/components/landing/Pricing.js so logged-in users see the
 * same plans they saw before signing up. PricingModal (in-dashboard
 * upgrade flow) wraps the same plan structure.
 */

const PLANS = [
  {
    id: null,
    name: 'Free plan',
    tagline: 'For individuals & new creators',
    price: '₹0',
    period: 'forever',
    highlight: false,
    features: [
      '1 Workspace',
      '5 Automation Flows',
      'Comment-trigger automations',
      'Story-reply automations',
      'Basic Analytics',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro plan',
    tagline: 'Best for creators',
    highlight: true,
    badge: 'Most Popular',
    features: [
      '5 Workspaces — manage multiple accounts',
      'Unlimited Automation Flows',
      'Email Collector — capture leads via DM',
      'Story Mention Auto-DM',
      'Ask to Follow before DM',
      'Multi-step Flow Automation',
      'Priority support',
    ],
  },
  {
    id: null,
    name: 'Elite plan',
    tagline: 'For agencies & businesses',
    price: '₹799',
    period: 'month',
    highlight: false,
    comingSoon: true,
    features: [
      'Everything in Pro',
      '10 Workspaces — for agencies & teams',
      'Dedicated Account Manager',
      'Custom Branding',
      'Advanced Lead Capture',
      'Story-mention auto replies',
      'White-glove onboarding',
    ],
  },
];

const FAQ = [
  {
    q: 'What counts as a DM?',
    a: 'Every DM sent to a unique commenter counts as one DM — including the initial gate message in Follow Gate and each follow-up nudge.',
  },
  {
    q: 'Does the limit reset every month?',
    a: 'Yes. The DM count resets on the 1st of every calendar month at midnight UTC.',
  },
  {
    q: 'Do new users get a free trial?',
    a: 'Yes — every new user gets 30 days of Pro access for free, automatically, the moment they connect their Instagram account. No credit card required.',
  },
  {
    q: 'Is Follow Gate really checking if they follow?',
    a: 'Yes. When a user taps ✅ Yes, AutoDM calls the Instagram Graph API to verify they are in your recent followers list before sending the reward link.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'We accept all major UPI apps (GPay, PhonePe, Paytm), debit/credit cards (Visa, Mastercard, RuPay), and net banking via Cashfree.',
  },
  {
    q: 'Can I cancel anytime?',
    a: "There's nothing to cancel — Pro is one payment per billing period (₹299 for a month, ₹2,999 for a year), and your subscription doesn't auto-renew. If you decide not to continue, just don't renew when the period ends. We'll email you 7 days before expiry as a reminder.",
  },
  {
    q: 'Do you offer refunds?',
    a: 'All payments are final. Your Pro access remains active until the end of the period you paid for. If you have a billing issue, email support@autodm.pro and we will look into it on a case-by-case basis.',
  },
];

function loadCashfreeSDK() {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
    document.head.appendChild(script);
  });
}

function PlanCard({ plan, loadingPlan, onUpgrade, isCurrentlyPaidPro, paidProExpiresAt, billingCycle }) {
  const isProTier   = plan.id === 'pro';
  const isComingSoon = plan.comingSoon;

  let purchaseSku   = null;
  let priceLabel    = plan.price;
  let periodLabel   = plan.period;
  let priceSubtitle = null;

  if (isProTier) {
    if (billingCycle === 'yearly') {
      purchaseSku   = 'pro_yearly';
      priceLabel    = '₹2,999';
      periodLabel   = 'per year';
      priceSubtitle = '≈ ₹250/month · Save ₹589 vs monthly';
    } else {
      purchaseSku   = 'pro';
      priceLabel    = '₹299';
      periodLabel   = 'per month';
      priceSubtitle = null;
    }
  }

  const blockUpgrade = isProTier && isCurrentlyPaidPro;

  const renderCta = () => {
    if (isComingSoon) {
      return (
        <button
          type="button"
          disabled
          className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-500 cursor-not-allowed"
        >
          <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
          Coming Soon
        </button>
      );
    }
    if (!plan.id) {
      return (
        <Link
          href="/dashboard"
          className="mt-6 flex w-full items-center justify-center rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Go to Dashboard
        </Link>
      );
    }
    if (blockUpgrade) {
      const expiryStr = paidProExpiresAt
        ? new Date(paidProExpiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
        : null;
      return (
        <button
          type="button"
          disabled
          title="You're already on Pro."
          className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 cursor-not-allowed"
        >
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
          {expiryStr ? `Active until ${expiryStr}` : 'Pro is active'}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onUpgrade(purchaseSku)}
        disabled={loadingPlan === purchaseSku}
        className={[
          'mt-6 flex w-full items-center justify-center gap-1.5 rounded-md px-4 py-3 text-sm font-semibold shadow-sm transition-colors',
          plan.highlight
            ? 'bg-[#E63946] text-white hover:bg-[#CC2E3B]'
            : 'bg-neutral-900 text-white hover:bg-black',
          loadingPlan === purchaseSku ? 'cursor-not-allowed opacity-60' : '',
        ].join(' ')}
      >
        {loadingPlan === purchaseSku ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</>
        ) : (
          <>
            <Crown className="h-3.5 w-3.5" strokeWidth={2.5} />
            Upgrade to Pro
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </>
        )}
      </button>
    );
  };

  return (
    <div className={[
      'relative rounded-2xl border bg-white p-6 transition-shadow sm:p-8',
      plan.highlight
        ? 'border-[#E63946] shadow-lg ring-2 ring-[#E63946]/10'
        : 'border-neutral-200 hover:shadow-md',
    ].join(' ')}>
      {plan.badge && !isComingSoon && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-[#E63946] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
          <Sparkles className="h-2.5 w-2.5" strokeWidth={3} />
          {plan.badge}
        </span>
      )}
      {isComingSoon && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
          <Clock className="h-2.5 w-2.5" strokeWidth={3} />
          Coming Soon
        </span>
      )}

      <h3 className="text-lg font-semibold text-neutral-900">{plan.name}</h3>
      <p className="mt-1 text-sm text-neutral-600">{plan.tagline}</p>

      <div className={[
        'mt-5 flex items-baseline gap-1 select-none',
        isComingSoon ? 'blur-sm' : '',
      ].join(' ')}>
        <span className="text-4xl font-bold tracking-tight text-neutral-900">{priceLabel}</span>
        <span className="text-sm text-neutral-500">/{periodLabel}</span>
      </div>
      {/* Reserve subtitle slot for Pro tiers so Monthly + Yearly cards
          stay vertically aligned. */}
      {isProTier && (
        <p className="mt-1 h-3 text-xs font-medium text-emerald-700">
          {priceSubtitle || ' '}
        </p>
      )}

      {renderCta()}

      <p className="mt-7 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Included features
      </p>
      <ul className={[
        'mt-3 space-y-2.5',
        isComingSoon ? 'blur-sm select-none pointer-events-none' : '',
      ].join(' ')}>
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E63946]" strokeWidth={3} />
            <span className="text-sm text-neutral-700">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────
export default function PricingPage() {
  const [loadingPlan, setLoadingPlan]   = useState(null);
  const [error, setError]               = useState('');
  const [billingCycle, setBillingCycle] = useState('yearly');
  const [planState, setPlanState] = useState({ loaded: false, plan: 'free', planExpiresAt: null });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/usage')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setPlanState({
          loaded:        true,
          plan:          d.plan || 'free',
          planExpiresAt: d.planExpiresAt || null,
        });
      })
      .catch(() => { if (!cancelled) setPlanState((s) => ({ ...s, loaded: true })); });
    return () => { cancelled = true; };
  }, []);

  const isCurrentlyPaidPro =
    planState.loaded &&
    planState.plan === 'pro' &&
    planState.planExpiresAt &&
    new Date(planState.planExpiresAt) > new Date();

  const handleUpgrade = async (planId) => {
    if (!planId) return;
    setLoadingPlan(planId);
    setError('');
    try {
      const res  = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');

      const { paymentSessionId, orderId } = data;
      const mode = process.env.NEXT_PUBLIC_CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
      await loadCashfreeSDK();
      const cashfree = window.Cashfree({ mode });

      cashfree.checkout({ paymentSessionId, redirectTarget: '_modal' }).then((result) => {
        if (result?.error) {
          setError(result.error.message || 'Payment failed. Please try again.');
          setLoadingPlan(null);
          return;
        }
        if (result?.paymentDetails || result?.redirect) {
          window.location.href = `/pricing/success?order_id=${encodeURIComponent(orderId)}&plan=${encodeURIComponent(planId)}`;
          return;
        }
        setLoadingPlan(null);
      }).catch((err) => {
        setError(err?.message || 'Payment was interrupted. Please try again.');
        setLoadingPlan(null);
      });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center rounded-full bg-[#FFF1F2] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#E63946]">
          Pricing
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-600 sm:text-base">
          Start free. Upgrade when you need more. No hidden fees.
        </p>

        <div className="mx-auto mt-5 inline-flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
          <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" strokeWidth={2.5} />
          <p className="text-xs leading-relaxed text-emerald-900 sm:text-sm">
            <strong>New users get 30 days of Pro free</strong> — no credit card required. Connect your Instagram account to start your trial automatically.
          </p>
        </div>
      </div>

      {error && (
        <div className="mx-auto flex max-w-xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="flex-shrink-0">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Billing-cycle toggle */}
      {!isCurrentlyPaidPro && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 p-1 text-xs font-semibold" role="tablist" aria-label="Billing cycle">
            <button
              type="button"
              role="tab"
              aria-selected={billingCycle === 'monthly'}
              onClick={() => setBillingCycle('monthly')}
              className={[
                'whitespace-nowrap rounded-md px-4 py-1.5 transition-colors',
                billingCycle === 'monthly' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900',
              ].join(' ')}
            >
              Monthly
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={billingCycle === 'yearly'}
              onClick={() => setBillingCycle('yearly')}
              className={[
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-4 py-1.5 transition-colors',
                billingCycle === 'yearly' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900',
              ].join(' ')}
            >
              Yearly
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                Save 16%
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.name}
            plan={plan}
            loadingPlan={loadingPlan}
            onUpgrade={handleUpgrade}
            isCurrentlyPaidPro={isCurrentlyPaidPro}
            paidProExpiresAt={planState.planExpiresAt}
            billingCycle={billingCycle}
          />
        ))}
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">
          <Lock className="h-3 w-3 text-neutral-500" strokeWidth={2.5} />
          Secured by Cashfree
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">
          <CreditCard className="h-3 w-3 text-neutral-500" strokeWidth={2.5} />
          UPI · Cards · Net Banking
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">
          🇮🇳 100% Indian payment gateway
        </span>
      </div>

      {/* FAQ */}
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-neutral-900">
          Frequently asked questions
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {FAQ.map((item) => (
            <div
              key={item.q}
              className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-sm font-bold text-neutral-900">{item.q}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
