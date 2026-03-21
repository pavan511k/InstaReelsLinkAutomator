'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './success.module.css';
import lightStyles from './success.light.module.css';

// Inner component that uses useSearchParams — must be inside <Suspense>
function PaymentResult() {
    const styles = useStyles(darkStyles, lightStyles);
    const searchParams = useSearchParams();
    const orderId      = searchParams.get('order_id');
    const planId       = searchParams.get('plan') || 'pro';

    const [status, setStatus] = useState('verifying'); // verifying | paid | failed | error

    useEffect(() => {
        if (!orderId) { setStatus('error'); return; }

        const verify = async () => {
            try {
                const res  = await fetch(`/api/payments/verify?order_id=${encodeURIComponent(orderId)}&plan=${encodeURIComponent(planId)}`);
                const data = await res.json();
                setStatus(data.status === 'paid' ? 'paid' : 'failed');
            } catch {
                setStatus('error');
            }
        };

        verify();
    }, [orderId, planId]);

    return (
        <div className={styles.card}>
            {status === 'verifying' && (
                <>
                    <div className={styles.iconWrap} style={{ background: 'rgba(124,58,237,0.12)', borderColor: 'rgba(167,139,250,0.25)' }}>
                        <Loader2 size={32} className={styles.spin} style={{ color: '#A78BFA' }} />
                    </div>
                    <h1 className={styles.title}>Verifying payment…</h1>
                    <p className={styles.sub}>Please wait a moment while we confirm your payment with Cashfree.</p>
                </>
            )}

            {status === 'paid' && (
                <>
                    <div className={styles.iconWrap} style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }}>
                        <CheckCircle size={36} style={{ color: '#10B981' }} />
                    </div>
                    <h1 className={styles.title}>You&apos;re on Pro! 🎉</h1>
                    <p className={styles.sub}>
                        Your AutoDM Pro subscription is now active. Follow Gate, save &amp; load templates, unlimited carousel slides, and priority support are all unlocked.
                    </p>
                    <div className={styles.actions}>
                        <Link href="/posts" className={styles.btnPrimary}>
                            Go to Posts &amp; Reels <ArrowRight size={16} />
                        </Link>
                        <Link href="/dashboard" className={styles.btnSecondary}>
                            View dashboard
                        </Link>
                    </div>
                </>
            )}

            {(status === 'failed' || status === 'error') && (
                <>
                    <div className={styles.iconWrap} style={{ background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' }}>
                        <XCircle size={36} style={{ color: '#EF4444' }} />
                    </div>
                    <h1 className={styles.title}>
                        {status === 'failed' ? 'Payment unsuccessful' : 'Verification failed'}
                    </h1>
                    <p className={styles.sub}>
                        {status === 'failed'
                            ? 'Your payment was not completed. You have not been charged. Please try again.'
                            : 'We could not verify your payment. If you were charged, please contact support with your order ID.'}
                    </p>
                    {orderId && (
                        <p className={styles.orderIdNote}>Order ID: <code>{orderId}</code></p>
                    )}
                    <div className={styles.actions}>
                        <Link href="/pricing" className={styles.btnPrimary}>
                            Try again
                        </Link>
                        <a href="mailto:support@autodm.pro" className={styles.btnSecondary}>
                            Contact support
                        </a>
                    </div>
                </>
            )}
        </div>
    );
}

// Loading skeleton shown while the inner component suspends
function VerifyingFallback() {
    return (
        <div className={styles.card}>
            <div className={styles.iconWrap} style={{ background: 'rgba(124,58,237,0.12)', borderColor: 'rgba(167,139,250,0.25)' }}>
                <Loader2 size={32} className={styles.spin} style={{ color: '#A78BFA' }} />
            </div>
            <h1 className={styles.title}>Loading…</h1>
            <p className={styles.sub}>One moment please.</p>
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <div className={styles.page}>
            <Suspense fallback={<VerifyingFallback />}>
                <PaymentResult />
            </Suspense>
        </div>
    );
}
