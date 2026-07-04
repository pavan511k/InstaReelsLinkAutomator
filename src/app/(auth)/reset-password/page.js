'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Lock, Loader2, Check, CheckCircle, Eye, EyeOff, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './reset-password.module.css';
import lightStyles from './reset-password.light.module.css';

const PASSWORD_MIN_LENGTH = 8;

function getPasswordStrength(pw) {
    if (!pw) return { level: 0, label: '', color: '' };
    if (pw.length < PASSWORD_MIN_LENGTH) return { level: 1, label: 'Too short', color: '#F87171' };
    let score = 0;
    if (pw.length >= 10)         score++;
    if (/[A-Z]/.test(pw))        score++;
    if (/[0-9]/.test(pw))        score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { level: 1, label: 'Weak',   color: '#F87171' };
    if (score === 2) return { level: 2, label: 'Fair',   color: '#FBBF24' };
    if (score === 3) return { level: 3, label: 'Good',   color: '#34D399' };
    return              { level: 4, label: 'Strong', color: '#10B981' };
}

const REQUIREMENTS = [
    { test: (p) => p.length >= 8,          label: 'At least 8 characters'       },
    { test: (p) => /[A-Z]/.test(p),        label: 'One uppercase letter'         },
    { test: (p) => /[0-9]/.test(p),        label: 'One number'                   },
    { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'One special character'        },
];

export default function ResetPasswordPage() {
    const styles = useStyles(darkStyles, lightStyles);
    const [password, setPassword]       = useState('');
    const [confirm, setConfirm]         = useState('');
    const [showPw, setShowPw]           = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError]             = useState('');
    const [done, setDone]               = useState(false);
    const [isLoading, setIsLoading]     = useState(false);
    const [checking, setChecking]       = useState(true);
    const [linkInvalid, setLinkInvalid] = useState(false);
    const supabase = useMemo(() => createClient(), []);

    const strength = useMemo(() => getPasswordStrength(password), [password]);

    // Reaching this page requires a valid recovery session — /auth/callback
    // exchanges the email link's code and sets the session before redirecting
    // here. If there's none (link invalid/expired/already used, or the recovery
    // session lapsed), show a "request a new link" state instead of a form that
    // can only fail on submit.
    useEffect(() => {
        let active = true;
        supabase.auth.getSession().then(({ data }) => {
            if (!active) return;
            if (!data?.session) setLinkInvalid(true);
            setChecking(false);
        });
        return () => { active = false; };
    }, [supabase]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!password || !confirm)               { setError('Please fill in both fields.');               return; }
        if (password.length < PASSWORD_MIN_LENGTH) { setError('Password must be at least 8 characters.'); return; }
        if (password !== confirm)                { setError('Passwords do not match.');                   return; }

        setIsLoading(true);
        try {
            const { error: authError } = await supabase.auth.updateUser({ password });
            if (authError) {
                // A session/token failure means the recovery link is no longer
                // usable — surface the "request a new link" state.
                if (/session|auth|expired|token/i.test(authError.message)) setLinkInvalid(true);
                else                                                       setError(authError.message);
            } else {
                setDone(true);
            }
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
                        Set a strong<br />password
                    </h2>
                    <p className={styles.leftSubtitle}>
                        Choose something you haven&apos;t used before. A strong password protects your automations and account data.
                    </p>
                </div>

                {/* Requirements checklist */}
                <div className={styles.reqList}>
                    <p className={styles.reqTitle}>Password requirements</p>
                    {REQUIREMENTS.map(({ test, label }) => (
                        <div key={label} className={`${styles.reqItem} ${test(password) ? styles.reqMet : ''}`}>
                            <div className={styles.reqIcon}>
                                {test(password) ? <Check size={10} strokeWidth={3} /> : null}
                            </div>
                            <span>{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── RIGHT PANEL ───────────────────────────────── */}
            <div className={styles.rightPanel}>
                <div className={styles.formWrap}>

                    {checking ? (
                        /* ── Verifying the recovery session ── */
                        <div className={styles.doneWrap} style={{ alignItems: 'center', width: '100%' }}>
                            <Loader2 size={30} className={styles.spinner} style={{ color: '#7C3AED' }} />
                        </div>
                    ) : linkInvalid ? (
                        /* ── Invalid / expired link ── */
                        <div className={styles.doneWrap}>
                            <div className={styles.doneIcon}>
                                <Clock size={40} strokeWidth={1.5} />
                            </div>
                            <h1 className={styles.doneTitle}>This link has expired</h1>
                            <p className={styles.doneText}>
                                Your password reset link is invalid or has expired. Reset links are
                                valid for 1 hour and can be used only once — request a new one to continue.
                            </p>
                            <Link
                                href="/forgot-password"
                                className={styles.submitBtn}
                                style={{ textDecoration: 'none', display: 'flex', marginTop: '20px' }}
                            >
                                Request a new link
                            </Link>
                        </div>
                    ) : !done ? (
                        /* ── Reset form ── */
                        <>
                            <div className={styles.formHeader}>
                                <h1 className={styles.formTitle}>Create new password</h1>
                                <p className={styles.formSubtitle}>
                                    Your new password must be different from your previous one.
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
                                    <label htmlFor="password" className={styles.label}>New password</label>
                                    <div className={styles.inputWrap}>
                                        <Lock size={15} className={styles.inputIcon} strokeWidth={2} />
                                        <input
                                            id="password"
                                            type={showPw ? 'text' : 'password'}
                                            className={styles.input}
                                            placeholder="Min. 8 characters"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            autoComplete="new-password"
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            className={styles.eyeBtn}
                                            onClick={() => setShowPw(!showPw)}
                                            tabIndex={-1}
                                        >
                                            {showPw
                                                ? <EyeOff size={15} strokeWidth={2} />
                                                : <Eye    size={15} strokeWidth={2} />
                                            }
                                        </button>
                                    </div>
                                    {password && (
                                        <div className={styles.strengthRow}>
                                            <div className={styles.strengthBars}>
                                                {[1,2,3,4].map((i) => (
                                                    <div
                                                        key={i}
                                                        className={styles.strengthBar}
                                                        style={{ background: i <= strength.level ? strength.color : '#E5E7EB' }}
                                                    />
                                                ))}
                                            </div>
                                            <span className={styles.strengthLabel} style={{ color: strength.color }}>
                                                {strength.label}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className={styles.field}>
                                    <label htmlFor="confirm" className={styles.label}>Confirm password</label>
                                    <div className={styles.inputWrap}>
                                        <Lock size={15} className={styles.inputIcon} strokeWidth={2} />
                                        <input
                                            id="confirm"
                                            type={showConfirm ? 'text' : 'password'}
                                            className={`${styles.input} ${confirm && confirm !== password ? styles.inputError : ''} ${confirm && confirm === password && password ? styles.inputOk : ''}`}
                                            placeholder="Repeat password"
                                            value={confirm}
                                            onChange={(e) => setConfirm(e.target.value)}
                                            autoComplete="new-password"
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            className={styles.eyeBtn}
                                            onClick={() => setShowConfirm(!showConfirm)}
                                            tabIndex={-1}
                                        >
                                            {showConfirm
                                                ? <EyeOff size={15} strokeWidth={2} />
                                                : <Eye    size={15} strokeWidth={2} />
                                            }
                                        </button>
                                    </div>
                                    {confirm && confirm === password && (
                                        <p className={styles.matchOk}>
                                            <Check size={12} strokeWidth={3} /> Passwords match
                                        </p>
                                    )}
                                </div>

                                <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                                    {isLoading ? (
                                        <><Loader2 size={16} className={styles.spinner} /> Updating password…</>
                                    ) : (
                                        'Update password'
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        /* ── Done state ── */
                        <div className={styles.doneWrap}>
                            <div className={styles.doneIcon}>
                                <CheckCircle size={44} strokeWidth={1.5} />
                            </div>
                            <h1 className={styles.doneTitle}>Password updated!</h1>
                            <p className={styles.doneText}>
                                Your password has been changed successfully. You can now sign in with your new password.
                            </p>
                            <Link href="/login" className={styles.submitBtn} style={{ textDecoration: 'none', display: 'flex', marginTop: '8px' }}>
                                Sign in to your account
                            </Link>
                        </div>
                    )}

                </div>
            </div>

        </div>
    );
}
