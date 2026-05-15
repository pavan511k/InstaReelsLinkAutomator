'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Check, ArrowRight, Loader2, Crown, ShieldCheck, Clock, Sparkles,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';

/**
 * PricingModal — modal version of /pricing for upgrade flows triggered
 * from inside the dashboard (Settings → Billing & Plan, etc.). Mirrors
 * the standalone /pricing route's plan structure (which mirrors the
 * landing page Pricing section), so users see the same plans + prices
 * everywhere.
 *
 * Differences vs. /pricing route:
 *   - No FAQ or trust badges — keeps the modal compact
 *   - "See full plan comparison" link points back to /pricing for users
 *     who want more depth
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
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-100 px-3 py-2.5 text-xs font-semibold text-neutral-500 cursor-not-allowed"
        >
          <Clock className="h-3 w-3" strokeWidth={2.5} />
          Coming Soon
        </button>
      );
    }
    if (!plan.id) {
      return (
        <button
          type="button"
          disabled
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-xs font-semibold text-neutral-500 cursor-default"
        >
          Current plan
        </button>
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
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 cursor-not-allowed"
        >
          <ShieldCheck className="h-3 w-3" strokeWidth={2.5} />
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
          'mt-5 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-xs font-semibold shadow-sm transition-colors',
          plan.highlight
            ? 'bg-[#E63946] text-white hover:bg-[#CC2E3B]'
            : 'bg-neutral-900 text-white hover:bg-black',
          loadingPlan === purchaseSku ? 'cursor-not-allowed opacity-60' : '',
        ].join(' ')}
      >
        {loadingPlan === purchaseSku ? (
          <><Loader2 className="h-3 w-3 animate-spin" /> Processing…</>
        ) : (
          <>
            <Crown className="h-3 w-3" strokeWidth={2.5} />
            Upgrade
            <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
          </>
        )}
      </button>
    );
  };

  return (
    <div className={[
      'relative rounded-xl border bg-white p-5',
      plan.highlight
        ? 'border-[#E63946] ring-2 ring-[#E63946]/10'
        : 'border-neutral-200',
    ].join(' ')}>
      {plan.badge && !isComingSoon && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-[#E63946] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
          <Sparkles className="h-2 w-2" strokeWidth={3} />
          {plan.badge}
        </span>
      )}
      {isComingSoon && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
          <Clock className="h-2 w-2" strokeWidth={3} />
          Coming Soon
        </span>
      )}

      <h3 className="text-sm font-bold text-neutral-900">{plan.name}</h3>
      <p className="mt-0.5 text-[11px] text-neutral-600">{plan.tagline}</p>

      <div className={[
        'mt-3 flex items-baseline gap-1 select-none',
        isComingSoon ? 'blur-sm' : '',
      ].join(' ')}>
        <span className="text-2xl font-bold tracking-tight text-neutral-900">{priceLabel}</span>
        <span className="text-xs text-neutral-500">/{periodLabel}</span>
      </div>
      {isProTier && (
        <p className="mt-0.5 h-3 text-[10px] font-medium text-emerald-700">
          {priceSubtitle || ' '}
        </p>
      )}

      {renderCta()}

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        Included features
      </p>
      <ul className={[
        'mt-2 space-y-1.5',
        isComingSoon ? 'blur-sm select-none pointer-events-none' : '',
      ].join(' ')}>
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-[#E63946]" strokeWidth={3} />
            <span className="text-[12px] leading-snug text-neutral-700">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PricingModal({ open, onClose }) {
  const [loadingPlan, setLoadingPlan]   = useState(null);
  const [error, setError]               = useState('');
  const [billingCycle, setBillingCycle] = useState('yearly');
  const [planState, setPlanState] = useState({ loaded: false, plan: 'free', planExpiresAt: null });

  // Fetch plan state when the modal opens — keeps the data fresh
  // without doing it on every dashboard render.
  useEffect(() => {
    if (!open) return undefined;
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
  }, [open]);

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
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      ariaLabel="Pricing plans"
    >
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
          Flexible pricing plans
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Upgrade anytime for more automation power.
        </p>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="flex-shrink-0">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Billing-cycle toggle */}
      {!isCurrentlyPaidPro && (
        <div className="mt-5 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 p-1 text-xs font-semibold" role="tablist" aria-label="Billing cycle">
            <button
              type="button"
              role="tab"
              aria-selected={billingCycle === 'monthly'}
              onClick={() => setBillingCycle('monthly')}
              className={[
                'whitespace-nowrap rounded-md px-3 py-1.5 transition-colors',
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
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 transition-colors',
                billingCycle === 'yearly' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900',
              ].join(' ')}
            >
              Yearly
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700">
                Save 16%
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
        <ShieldCheck className="h-3 w-3" strokeWidth={2.5} />
        Secured by Cashfree · UPI · Cards · Net Banking
      </p>

      <p className="mt-2 text-center text-[11px] text-neutral-500">
        Need more details?{' '}
        <Link href="/pricing" onClick={onClose} className="font-semibold text-[#E63946] hover:underline">
          See full plan comparison
        </Link>
      </p>
    </Modal>
  );
}
