'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Mail, Lock, Loader2, ArrowRight, Check, User, Zap, Shield, TrendingUp, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import styles from './signup.module.css';

const PASSWORD_MIN_LENGTH = 6;

function getPasswordStrength(pw) {
    if (!pw) return { level: 0, label: '', color: '' };
    if (pw.length < PASSWORD_MIN_LENGTH) return { level: 1, label: 'Too short', color: '#F87171' };
    let score = 0;
    if (pw.length >= 8)          score++;
    if (/[A-Z]/.test(pw))        score++;
    if (/[0-9]/.test(pw))        score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { level: 1, label: 'Weak',   color: '#F87171' };
    if (score === 2) return { level: 2, label: 'Fair',   color: '#FBBF24' };
    if (score === 3) return { level: 3, label: 'Good',   color: '#34D399' };
    return              { level: 4, label: 'Strong', color: '#10B981' };
}

const FEATURES = [
    { icon: Zap,         text: 'Auto-DM when someone comments on your Reels' },
    { icon: Shield,      text: 'Official Meta Business Partner — 100% safe'  },
    { icon: TrendingUp,  text: '1,000 free DMs every month, no card needed'  },
    { icon: Star,        text: 'Works with stories, posts, and live replies'  },
];

const STATS = [
    { value: '12K+',  label: 'DMs sent daily'   },
    { value: '2.1K+', label: 'Active creators'   },
    { value: '98.4%', label: 'Delivery rate'     },
    { value: 'Free',  label: 'To get started'    },
];

export default function SignupPage() {
    const [email, setEmail]                 = useState('');
    const [password, setPassword]           = useState('');
    const [fullName, setFullName]           = useState('');
    const [error, setError]                 = useState('');
    const [isLoading, setIsLoading]         = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const router   = useRouter();
    const supabase = createClient();

    const strength = useMemo(() => getPasswordStrength(password), [password]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!fullName || !email || !password)      { setError('Please fill in all fields.');                         return; }
        if (password.length < PASSWORD_MIN_LENGTH) { setError('Password must be at least 6 characters.');           return; }
        if (!termsAccepted)                        { setError('Please accept the Terms & Privacy Policy.');          return; }

        setIsLoading(true);
        try {
            const { error: authError } = await supabase.auth.signUp({
                email, password,
                options: {
                    data: { full_name: fullName },
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            });
            if (authError) setError(authError.message);
            else           router.push('/verify');
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

                {/* Logo */}
                <Link href="/" className={styles.leftLogo}>
                    <div className={styles.leftLogoMark}>
                        <Image src="/logo.png" alt="AutoDM" width={20} height={20} />
                    </div>
                    <span className={styles.leftLogoText}>
                        auto<span className={styles.leftLogoDM}>dm</span>
                    </span>
                </Link>

                {/* Hero */}
                <div className={styles.leftHero}>
                    <div className={styles.leftBadge}>
                        <span className={styles.leftBadgeDot} />
                        Free forever — no credit card
                    </div>
                    <h2 className={styles.leftTitle}>
                        Grow your Instagram<br />
                        <span className={styles.leftTitleGrad}>on autopilot</span>
                    </h2>
                    <p className={styles.leftSubtitle}>
                        Set a keyword trigger once. AutoDM handles every DM reply, every time — while you focus on creating.
                    </p>
                </div>

                {/* Feature list */}
                <ul className={styles.featureList}>
                    {FEATURES.map(({ icon: Icon, text }) => (
                        <li key={text} className={styles.featureItem}>
                            <div className={styles.featureIcon}>
                                <Icon size={13} strokeWidth={2.5} />
                            </div>
                            {text}
                        </li>
                    ))}
                </ul>

                {/* Stats grid */}
                <div className={styles.statsGrid}>
                    {STATS.map(({ value, label }) => (
                        <div key={label} className={styles.statCard}>
                            <span className={styles.statValue}>{value}</span>
                            <span className={styles.statLabel}>{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── RIGHT PANEL ───────────────────────────────── */}
            <div className={styles.rightPanel}>
                <div className={styles.formWrap}>

                    <div className={styles.formHeader}>
                        <h1 className={styles.formTitle}>Create your account</h1>
                        <p className={styles.formSubtitle}>
                            Already have one?{' '}
                            <Link href="/login" className={styles.inlineLink}>Sign in</Link>
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
                            <label htmlFor="fullName" className={styles.label}>Full name</label>
                            <div className={styles.inputWrap}>
                                <User size={15} className={styles.inputIcon} strokeWidth={2} />
                                <input
                                    id="fullName"
                                    type="text"
                                    className={styles.input}
                                    placeholder="Jane Smith"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    autoComplete="name"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="email" className={styles.label}>Work email</label>
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

                        <div className={styles.field}>
                            <label htmlFor="password" className={styles.label}>Password</label>
                            <div className={styles.inputWrap}>
                                <Lock size={15} className={styles.inputIcon} strokeWidth={2} />
                                <input
                                    id="password"
                                    type="password"
                                    className={styles.input}
                                    placeholder="Min. 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="new-password"
                                    disabled={isLoading}
                                />
                            </div>
                            {password && (
                                <div className={styles.strengthRow}>
                                    <div className={styles.strengthBars}>
                                        {[1, 2, 3, 4].map((i) => (
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

                        {/* Terms */}
                        <label className={styles.termsRow}>
                            <div
                                className={`${styles.checkbox} ${termsAccepted ? styles.checked : ''}`}
                                onClick={() => setTermsAccepted(!termsAccepted)}
                            >
                                {termsAccepted && <Check size={10} strokeWidth={3.5} color="#fff" />}
                            </div>
                            <span className={styles.termsText}>
                                I agree to the{' '}
                                <Link href="/terms" target="_blank" className={styles.termsLink}>Terms of Service</Link>
                                {' '}and{' '}
                                <Link href="/privacy" target="_blank" className={styles.termsLink}>Privacy Policy</Link>
                            </span>
                        </label>

                        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                            {isLoading ? (
                                <><Loader2 size={16} className={styles.spinner} /> Creating account…</>
                            ) : (
                                <>Get started free <ArrowRight size={15} strokeWidth={2.5} /></>
                            )}
                        </button>
                    </form>

                </div>
            </div>

        </div>
    );
}
