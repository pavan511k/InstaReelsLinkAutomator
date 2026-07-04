'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MailCheck, ArrowRight, ArrowLeft, RotateCw, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './verify.module.css';
import lightStyles from './verify.light.module.css';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyPage() {
    const styles = useStyles(darkStyles, lightStyles);
    const supabase = useMemo(() => createClient(), []);

    const [email, setEmail]             = useState('');
    const [resending, setResending]     = useState(false);
    const [resent, setResent]           = useState(false);
    const [resendError, setResendError] = useState('');
    const [cooldown, setCooldown]       = useState(0);

    // The signup page forwards the address as ?email= so we can offer a resend.
    // Read it from window.location (not useSearchParams — avoids the App Router
    // Suspense requirement / client-render bailout).
    useEffect(() => {
        setEmail(new URLSearchParams(window.location.search).get('email') || '');
    }, []);

    // Cooldown ticker between resends (also respects Supabase's send rate limit).
    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const handleResend = async () => {
        if (!email || resending || cooldown > 0) return;
        setResending(true);
        setResent(false);
        setResendError('');
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email,
                options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
            });
            if (error) setResendError(error.message);
            else       setResent(true);
            // Back off either way so we never hammer Supabase's send endpoint.
            setCooldown(RESEND_COOLDOWN_SECONDS);
        } catch {
            setResendError('Could not resend right now. Please try again shortly.');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className={styles.page}>

            {/* ── LEFT PANEL ────────────────────────────────── */}
            <div className={styles.leftPanel}>
                <div className={styles.leftGrid} />
                <div className={styles.leftGlow1} />
                <div className={styles.leftGlow2} />

                <Link href="/" className={styles.leftLogo}>
                    <div className={styles.leftLogoMark}>
                        <Image src="/logo.png" alt="AutoDM" width={20} height={20} />
                    </div>
                    <span className={styles.leftLogoText}>
                        auto<span className={styles.leftLogoDM}>dm</span>
                    </span>
                </Link>

                <div className={styles.leftHero}>
                    <h2 className={styles.leftTitle}>
                        Almost there!
                    </h2>
                    <p className={styles.leftSubtitle}>
                        Verify your email to unlock your AutoDM workspace and start automating your Instagram DMs today.
                    </p>
                </div>

                {/* What happens next */}
                <div className={styles.nextSteps}>
                    <p className={styles.nextTitle}>What happens next</p>
                    <div className={styles.nextList}>
                        <div className={styles.nextItem}>
                            <div className={styles.nextNum}>1</div>
                            <span>Click the verification link in your email</span>
                        </div>
                        <div className={styles.nextItem}>
                            <div className={styles.nextNum}>2</div>
                            <span>You&apos;re taken directly to your dashboard</span>
                        </div>
                        <div className={styles.nextItem}>
                            <div className={styles.nextNum}>3</div>
                            <span>Set your first DM automation in minutes</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── RIGHT PANEL ───────────────────────────────── */}
            <div className={styles.rightPanel}>
                <div className={styles.contentWrap}>

                    <div className={styles.iconWrap}>
                        <MailCheck size={40} strokeWidth={1.5} />
                    </div>

                    <h1 className={styles.title}>Check your email</h1>
                    <p className={styles.subtitle}>
                        We&apos;ve sent a verification link to your inbox. Click it to activate your account — it expires in 24 hours.
                    </p>

                    <div className={styles.tipBox}>
                        <p className={styles.tipTitle}>Can&apos;t find the email?</p>
                        <p className={styles.tipText}>
                            Check your <strong>spam or junk folder</strong>. The email comes from <strong>support@autodm.pro</strong>.
                        </p>
                        {email && (
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={resending || cooldown > 0}
                                className={styles.ghostBtn}
                                style={{
                                    marginTop: 12,
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    fontFamily: 'inherit',
                                    color: '#92400E',
                                    cursor: resending || cooldown > 0 ? 'not-allowed' : 'pointer',
                                    opacity: resending || cooldown > 0 ? 0.6 : 1,
                                }}
                            >
                                <RotateCw size={14} strokeWidth={2.5} />
                                {resending
                                    ? 'Resending…'
                                    : cooldown > 0
                                        ? `Resend in ${cooldown}s`
                                        : 'Resend verification email'}
                            </button>
                        )}
                        {resent && !resendError && (
                            <p className={styles.tipText} style={{ marginTop: 10, color: '#15803D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Check size={14} strokeWidth={2.5} /> Sent! Check your inbox again.
                            </p>
                        )}
                        {resendError && (
                            <p className={styles.tipText} style={{ marginTop: 10, color: '#B91C1C', fontWeight: 600 }}>
                                {resendError}
                            </p>
                        )}
                    </div>

                    <div className={styles.actions}>
                        <Link href="/login" className={styles.primaryBtn}>
                            Go to sign in
                            <ArrowRight size={15} strokeWidth={2.5} />
                        </Link>
                        <Link href="/" className={styles.ghostBtn}>
                            <ArrowLeft size={14} strokeWidth={2.5} />
                            Back to home
                        </Link>
                    </div>

                </div>
            </div>

        </div>
    );
}
