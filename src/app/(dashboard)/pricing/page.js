'use client';

import { useState } from 'react';
import { Check, Zap, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import styles from './pricing.module.css';

const PLANS = [
    {
        id: null,
        name: 'Free',
        price: '₹0',
        period: 'forever',
        desc: 'Perfect for creators just getting started with DM automation.',
        cta: 'Current plan',
        ctaHref: '/dashboard',
        highlight: false,
        features: [
            '1,000 DMs per month',
            'Button Template, Message, Quick Reply, Multi-CTA',
            'All trigger types (keywords, all comments, emojis)',
            'Carousel slides (up to 3)',
            'Real-time analytics dashboard',
            'Instagram & Facebook support',
        ],
        missing: [
            'Save & load templates',
            'Follow Gate',
            'Send DMs to previous comments',
            'Priority support',
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '₹30',
        period: 'per month',
        desc: 'For serious creators who want maximum reach and advanced automation.',
        highlight: true,
        badge: 'Most Popular',
        features: [
            'Everything in Free',
            '10,000 DMs per month',
            'Save & load templates',
            'Follow Gate automation',
            'Send DMs to previous comments',
            'Unlimited carousel slides',
            'Advanced analytics (CTR, click tracking)',
            'Priority support',
        ],
        missing: [],
    },
    {
        id: null,
        name: 'Business',
        price: '₹2,999',
        period: 'per month',
        desc: 'For agencies and high-volume brands managing multiple accounts.',
        cta: 'Coming Soon',
        ctaHref: '#',
        highlight: false,
        comingSoon: true,
        features: [
            'Everything in Pro',
            'Unlimited DMs per month',
            'Multiple Instagram accounts',
            'Team members & collaboration',
            'White-label dashboard',
            'API access',
            'Dedicated account manager',
        ],
        missing: [],
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

export default function PricingPage() {
    const [loadingPlan, setLoadingPlan] = useState(null);
    const [error, setError] = useState('');

    const handleUpgrade = async (planId) => {
        if (!planId) return;
        setLoadingPlan(planId);
        setError('');

        try {
            // 1. Create order on our server
            const res  = await fetch('/api/payments/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create order');
            }

            const { paymentSessionId } = data;

            // 2. Load the Cashfree JS SDK dynamically
            const { load } = await import('@cashfreepayments/cashfree-js');
            const cashfree  = await load({
                mode: process.env.NEXT_PUBLIC_CASHFREE_ENV === 'production' ? 'production' : 'sandbox',
            });

            // 3. Open the Cashfree checkout modal
            const checkoutOptions = {
                paymentSessionId,
                redirectTarget: '_modal',
            };

            cashfree.checkout(checkoutOptions).then((result) => {
                if (result.error) {
                    setError(result.error.message || 'Payment failed. Please try again.');
                    setLoadingPlan(null);
                }
                if (result.redirect) {
                    // Payment opened in redirect mode — handled by return_url
                }
            });

        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
            setLoadingPlan(null);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.eyebrow}>Pricing</div>
                <h1 className={styles.title}>Simple, transparent pricing</h1>
                <p className={styles.subtitle}>
                    Start free. Upgrade when you need more. No hidden fees.
                </p>
            </div>

            {error && (
                <div className={styles.errorBanner}>
                    ⚠️ {error}
                </div>
            )}

            {/* Plan cards */}
            <div className={styles.plans}>
                {PLANS.map((plan) => (
                    <div
                        key={plan.name}
                        className={`${styles.planCard} ${plan.highlight ? styles.planHighlight : ''}`}
                    >
                        {plan.badge && (
                            <span className={styles.badge}>{plan.badge}</span>
                        )}

                        <div className={styles.planHeader}>
                            <h2 className={styles.planName}>{plan.name}</h2>
                            <div className={styles.planPrice}>
                                <span className={styles.priceAmount}>{plan.price}</span>
                                <span className={styles.pricePeriod}>/{plan.period}</span>
                            </div>
                            <p className={styles.planDesc}>{plan.desc}</p>
                        </div>

                        {/* CTA */}
                        {plan.comingSoon ? (
                            <button disabled className={`${styles.ctaBtn} ${styles.ctaBtnDisabled}`}>
                                Coming Soon
                            </button>
                        ) : plan.id ? (
                            // Paid plan — trigger Cashfree checkout
                            <button
                                className={`${styles.ctaBtn} ${styles.ctaBtnPrimary}`}
                                onClick={() => handleUpgrade(plan.id)}
                                disabled={loadingPlan === plan.id}
                            >
                                {loadingPlan === plan.id ? (
                                    <><Loader2 size={14} className={styles.spin} /> Processing…</>
                                ) : (
                                    <><Zap size={14} strokeWidth={2.5} /> Upgrade to Pro <ArrowRight size={14} /></>
                                )}
                            </button>
                        ) : (
                            // Free plan
                            <Link href={plan.ctaHref} className={`${styles.ctaBtn} ${styles.ctaBtnSecondary}`}>
                                {plan.cta}
                            </Link>
                        )}

                        <div className={styles.divider} />

                        <ul className={styles.featureList}>
                            {plan.features.map((f) => (
                                <li key={f} className={styles.featureItem}>
                                    <span className={styles.featureCheck}><Check size={13} strokeWidth={2.5} /></span>
                                    {f}
                                </li>
                            ))}
                            {plan.missing.map((f) => (
                                <li key={f} className={`${styles.featureItem} ${styles.featureMissing}`}>
                                    <span className={styles.featureDash}>—</span>
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {/* Payment trust badges */}
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
