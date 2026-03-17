'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import styles from './forgot-password.module.css';

export default function ForgotPasswordPage() {
    const [email, setEmail]       = useState('');
    const [error, setError]       = useState('');
    const [sent, setSent]         = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!email) { setError('Please enter your email address.'); return; }

        setIsLoading(true);
        try {
            const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
            });
            if (authError) setError(authError.message);
            else           setSent(true);
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
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
                        Account recovery
                    </h2>
                    <p className={styles.leftSubtitle}>
                        We&apos;ll send a secure link to your email. Click it and you&apos;ll be able to set a new password instantly.
                    </p>
                </div>

                {/* Steps */}
                <div className={styles.steps}>
                    <div className={styles.step}>
                        <div className={`${styles.stepNum} ${styles.stepActive}`}>1</div>
                        <div className={styles.stepContent}>
                            <span className={styles.stepTitle}>Enter your email</span>
                            <span className={styles.stepDesc}>The one you signed up with</span>
                        </div>
                    </div>
                    <div className={styles.stepLine} />
                    <div className={styles.step}>
                        <div className={`${styles.stepNum} ${sent ? styles.stepActive : styles.stepPending}`}>2</div>
                        <div className={styles.stepContent}>
                            <span className={styles.stepTitle}>Check your inbox</span>
                            <span className={styles.stepDesc}>A reset link will arrive shortly</span>
                        </div>
                    </div>
                    <div className={styles.stepLine} />
                    <div className={styles.step}>
                        <div className={styles.stepNum}>3</div>
                        <div className={styles.stepContent}>
                            <span className={styles.stepTitle}>Set new password</span>
                            <span className={styles.stepDesc}>Secure your account</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── RIGHT PANEL ───────────────────────────────── */}
            <div className={styles.rightPanel}>
                <div className={styles.formWrap}>

                    {!sent ? (
                        /* ── Request form ── */
                        <>
                            <div className={styles.formHeader}>
                                <h1 className={styles.formTitle}>Forgot password?</h1>
                                <p className={styles.formSubtitle}>
                                    Enter the email you registered with and we&apos;ll send you a reset link.
                                </p>
                            </div>

                            {error && (
                                <div className={styles.error} role="alert">
                                    <span className={styles.errorDot} />
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className={styles.form}>
                                <div className={styles.field}>
                                    <label htmlFor="email" className={styles.label}>Email address</label>
                                    <div className={styles.inputWrap}>
                                        <Mail size={15} className={styles.inputIcon} strokeWidth={2} />
                                        <input
                                            id="email"
                                            type="email"
                                            className={styles.input}
                                            placeholder="you@company.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            autoComplete="email"
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                                    {isLoading ? (
                                        <><Loader2 size={16} className={styles.spinner} /> Sending link…</>
                                    ) : (
                                        'Send reset link'
                                    )}
                                </button>
                            </form>

                            <div className={styles.backRow}>
                                <Link href="/login" className={styles.backLink}>
                                    <ArrowLeft size={14} strokeWidth={2.5} />
                                    Back to sign in
                                </Link>
                            </div>
                        </>
                    ) : (
                        /* ── Success state ── */
                        <div className={styles.successWrap}>
                            <div className={styles.successIcon}>
                                <CheckCircle size={44} strokeWidth={1.5} />
                            </div>
                            <h1 className={styles.successTitle}>Check your inbox</h1>
                            <p className={styles.successText}>
                                We sent a password reset link to
                                <strong className={styles.successEmail}> {email}</strong>.
                                It expires in 1 hour.
                            </p>

                            <div className={styles.successTips}>
                                <p className={styles.tipTitle}>Didn&apos;t receive it?</p>
                                <ul className={styles.tipList}>
                                    <li>Check your spam or junk folder</li>
                                    <li>Make sure you entered the correct email</li>
                                    <li>
                                        <button
                                            className={styles.resendBtn}
                                            onClick={() => { setSent(false); setEmail(''); }}
                                        >
                                            Try a different email
                                        </button>
                                    </li>
                                </ul>
                            </div>

                            <Link href="/login" className={styles.backLink} style={{ marginTop: '28px', display: 'inline-flex' }}>
                                <ArrowLeft size={14} strokeWidth={2.5} />
                                Back to sign in
                            </Link>
                        </div>
                    )}

                </div>
            </div>

        </div>
    );
}
