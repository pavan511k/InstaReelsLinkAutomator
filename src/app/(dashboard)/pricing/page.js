'use client';

import { useState } from 'react';
import { Check, X, Zap, ArrowRight, Loader2, Crown } from 'lucide-react';
import Link from 'next/link';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './pricing.module.css';
import lightStyles from './pricing.light.module.css';

// ─── Feature table ────────────────────────────────────────────────────────────
// Each category has a label and a list of features.
// free: true  = available on free plan
// free: false = Pro-only (shows ✗ on free card, ✓ on pro card)
const FEATURE_CATEGORIES = [
    {
        label: 'DM Types',
        features: [
            { name: 'Button Template (image card + CTA button)',      free: true  },
            { name: 'Message Template (plain text DM)',               free: true  },
            { name: 'Quick Reply (tappable reply chips)',             free: true  },
            { name: 'Multi-CTA (text + up to 3 URL buttons)',        free: true  },
            { name: 'Follow Gate (send link after follow verified)',  free: false },
            { name: 'Email Collector (capture leads via DM reply)',   free: false },
        ],
    },
    {
        label: 'DM Limits & Delivery',
        features: [
            { name: '3,000 DMs per month',                           free: true  },
            { name: 'Unlimited DMs per month',                       free: false },
            { name: 'Per-account rate limiting',                     free: true  },
            { name: 'Excess DM Queue (handles viral spikes)',        free: true  },
            { name: 'SendBack — auto-retry failed DMs',              free: true  },
        ],
    },
    {
        label: 'Trigger System',
        features: [
            { name: 'Keyword triggers',                              free: true  },
            { name: 'All comments trigger',                          free: true  },
            { name: 'Emojis-only trigger',                           free: true  },
            { name: '@Mentions-only trigger',                        free: true  },
            { name: 'Auto-reply to triggering comment',             free: true  },
            { name: 'Send delay (humanised random timing)',          free: true  },
            { name: 'Global Triggers (account-wide keywords)',       free: true  },
        ],
    },
    {
        label: 'Automation Controls',
        features: [
            { name: 'Schedule automation start time',                free: true  },
            { name: 'Set automation expiry date',                    free: true  },
            { name: 'Carousel slides (up to 3)',                     free: true  },
            { name: 'Unlimited carousel slides',                     free: false },
            { name: 'Save & load DM templates',                      free: false },
            { name: 'A/B message testing with winner detection',     free: false },
            { name: 'Send DMs to previous comments (backfill)',      free: false },
            { name: 'Multi-step Flow Automation (sequential DMs)',   free: false },
            { name: 'Upsell follow-up DMs for non-clickers',        free: false },
        ],
    },
    {
        label: 'Inbox & Engagement',
        features: [
            { name: 'Welcome Openers (inbox quick-reply buttons)',   free: true  },
            { name: 'Story Mention Auto-DM',                         free: true  },
        ],
    },
    {
        label: 'Analytics & Insights',
        features: [
            { name: 'Real-time analytics dashboard',                 free: true  },
            { name: 'DM sent log with comment history',             free: true  },
            { name: 'Usage limit alerts (email + webhook)',          free: true  },
            { name: 'Link click count (tracked short URLs)',          free: true  },
            { name: 'CTR % in posts table',                          free: true  },
            { name: 'Full click analytics dashboard (charts, per-link, A/B)', free: false },
            { name: 'Email Leads list + CSV export',                free: false },
        ],
    },
    {
        label: 'Platforms & Support',
        features: [
            { name: 'Instagram Posts & Reels',                       free: true  },
            { name: 'Instagram Stories',                             free: true  },
            { name: 'Facebook Pages',                                free: true  },
            { name: 'Email support',                                 free: true  },
            { name: 'Priority support',                              free: false },
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
        a: "Yes. Cancel before your next billing date and you won't be charged again. You keep Pro access until the end of the period you paid for.",
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

// ─── Feature row ─────────────────────────────────────────────────────────────
function FeatureRow({ name, available, styles }) {
    return (
        <li className={`${styles.featureItem} ${!available ? styles.featureLocked : ''}`}>
            {available ? (
                <span className={styles.featureCheck}>
                    <Check size={11} strokeWidth={3} />
                </span>
            ) : (
                <span className={styles.featureCross}>
                    <X size={11} strokeWidth={3} />
                </span>
            )}
            <span>{name}</span>
        </li>
    );
}

// ─── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({ plan, styles, loadingPlan, onUpgrade }) {
    const isPro = plan.id === 'pro';

    return (
        <div className={`${styles.planCard} ${plan.highlight ? styles.planHighlight : ''}`}>
            {plan.badge && <span className={styles.badge}>{plan.badge}</span>}

            <div className={styles.planHeader}>
                <h2 className={styles.planName}>{plan.name}</h2>
                <div className={styles.planPrice}>
                    <span className={styles.priceAmount}>{plan.price}</span>
                    <span className={styles.pricePeriod}>/{plan.period}</span>
                </div>
                <p className={styles.planDesc}>{plan.desc}</p>
            </div>

            {/* CTA */}
            {plan.id ? (
                <button
                    className={`${styles.ctaBtn} ${styles.ctaBtnPrimary}`}
                    onClick={() => onUpgrade(plan.id)}
                    disabled={loadingPlan === plan.id}
                >
                    {loadingPlan === plan.id ? (
                        <><Loader2 size={14} className={styles.spin} /> Processing…</>
                    ) : (
                        <><Crown size={14} strokeWidth={2.5} /> Upgrade to Pro <ArrowRight size={14} /></>
                    )}
                </button>
            ) : (
                <Link href={plan.ctaHref} className={`${styles.ctaBtn} ${styles.ctaBtnSecondary}`}>
                    {plan.cta}
                </Link>
            )}

            <div className={styles.divider} />

            {/* Feature list with categories */}
            <div className={styles.featureCategories}>
                {FEATURE_CATEGORIES.map((cat) => (
                    <div key={cat.label} className={styles.featureCategory}>
                        <span className={styles.categoryLabel}>{cat.label}</span>
                        <ul className={styles.featureList}>
                            {cat.features.map((f) => (
                                <FeatureRow
                                    key={f.name}
                                    name={f.name}
                                    available={isPro ? true : f.free}
                                    styles={styles}
                                />
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PricingPage() {
    const styles = useStyles(darkStyles, lightStyles);
    const [loadingPlan, setLoadingPlan] = useState(null);
    const [error, setError] = useState('');

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

            const { paymentSessionId } = data;
            const mode = process.env.NEXT_PUBLIC_CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
            await loadCashfreeSDK();
            const cashfree = window.Cashfree({ mode });
            cashfree.checkout({ paymentSessionId, redirectTarget: '_modal' }).then((result) => {
                if (result.error) {
                    setError(result.error.message || 'Payment failed. Please try again.');
                    setLoadingPlan(null);
                }
            });
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
            setLoadingPlan(null);
        }
    };

    const PLANS = [
        {
            id: null,
            name: 'Free',
            price: '₹0',
            period: 'forever',
            desc: 'Everything you need to start automating Instagram DMs. Forever free for up to 3,000 DMs/month.',
            cta: 'Go to Dashboard',
            ctaHref: '/dashboard',
            highlight: false,
        },
        {
            id: 'pro',
            name: 'Pro',
            price: '₹299',
            period: 'per month',
            desc: 'Unlimited DMs, advanced automation, and full analytics. Cancel anytime.',
            highlight: true,
            badge: 'Most Popular',
        },
    ];

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.eyebrow}>Pricing</div>
                <h1 className={styles.title}>Simple, transparent pricing</h1>
                <p className={styles.subtitle}>
                    Start free. Upgrade when you need more. No hidden fees.
                </p>
                <div className={styles.trialCallout}>
                    <Zap size={15} strokeWidth={2.5} />
                    <span>
                        <strong>New users get 30 days of Pro free</strong> — no credit card required.
                        Connect your Instagram account to start your trial automatically.
                    </span>
                </div>
            </div>

            {error && (
                <div className={styles.errorBanner}>⚠️ {error}</div>
            )}

            {/* Plan cards */}
            <div className={styles.plans}>
                {PLANS.map((plan) => (
                    <PlanCard
                        key={plan.name}
                        plan={plan}
                        styles={styles}
                        loadingPlan={loadingPlan}
                        onUpgrade={handleUpgrade}
                    />
                ))}
            </div>

            {/* Trust badges */}
            <div className={styles.trustRow}>
                <span className={styles.trustBadge}>🔒 Secured by Cashfree</span>
                <span className={styles.trustBadge}>💳 UPI · Cards · Net Banking</span>
                <span className={styles.trustBadge}>🇮🇳 100% Indian payment gateway</span>
            </div>

            {/* Note */}
            <div className={styles.note}>
                <Zap size={14} />
                All plans include the full AutoDM dashboard, webhook integration, and official Meta Business Partner certification.
            </div>

            {/* FAQ */}
            <div className={styles.faqSection}>
                <h2 className={styles.faqTitle}>Frequently asked questions</h2>
                <div className={styles.faqList}>
                    {FAQ.map((item) => (
                        <div key={item.q} className={styles.faqItem}>
                            <h3 className={styles.faqQ}>{item.q}</h3>
                            <p className={styles.faqA}>{item.a}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
