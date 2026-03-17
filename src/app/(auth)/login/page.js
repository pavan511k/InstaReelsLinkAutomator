'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Mail, Lock, Loader2, ArrowRight, Zap, Users, TrendingUp, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import styles from './login.module.css';

const STATS = [
    { icon: Zap,         value: '12K+',  label: 'DMs sent daily'      },
    { icon: Users,       value: '2,100+',label: 'Active creators'      },
    { icon: TrendingUp,  value: '98.4%', label: 'Delivery rate'        },
    { icon: CheckCircle, value: 'Meta',  label: 'Verified partner'     },
];

export default function LoginPage() {
    const [email, setEmail]         = useState('');
    const [password, setPassword]   = useState('');
    const [error, setError]         = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router   = useRouter();
    const supabase = createClient();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!email || !password) { setError('Please fill in all fields.'); return; }

        setIsLoading(true);
        try {
            const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
            if (authError) {
                setError(authError.message.includes('Email not confirmed')
                    ? 'Please verify your email first. Check your inbox.'
                    : authError.message);
            } else {
                router.push('/dashboard');
                router.refresh();
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
                {/* BG decorations */}
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

                {/* Hero copy */}
                <div className={styles.leftHero}>
                    <div className={styles.leftBadge}>
                        <span className={styles.leftBadgeDot} />
                        Instagram Automation Platform
                    </div>
                    <h2 className={styles.leftTitle}>
                        Turn followers into customers — on autopilot
                    </h2>
                    <p className={styles.leftSubtitle}>
                        AutoDM sends personalised DMs the moment someone engages with your Reels. No manual work. No missed leads.
                    </p>
                </div>

                {/* Stats grid */}
                <div className={styles.statsGrid}>
                    {STATS.map(({ icon: Icon, value, label }) => (
                        <div key={label} className={styles.statCard}>
                            <div className={styles.statIcon}>
                                <Icon size={14} strokeWidth={2.5} />
                            </div>
                            <span className={styles.statValue}>{value}</span>
                            <span className={styles.statLabel}>{label}</span>
                        </div>
                    ))}
                </div>

                {/* Bottom trust line */}
                <div className={styles.leftTrust}>
                    <div className={styles.leftAvatars}>
                        {[1,2,3,4].map(i => (
                            <div key={i} className={styles.leftAvatar} style={{ zIndex: 5 - i }} />
                        ))}
                    </div>
                    <span className={styles.leftTrustText}>
                        Trusted by <strong>2,100+</strong> creators worldwide
                    </span>
                </div>
            </div>

            {/* ── RIGHT PANEL ───────────────────────────────── */}
            <div className={styles.rightPanel}>
                <div className={styles.formWrap}>

                    {/* Header */}
                    <div className={styles.formHeader}>
                        <h1 className={styles.formTitle}>Welcome back</h1>
                        <p className={styles.formSubtitle}>
                            Sign in to your AutoDM workspace
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className={styles.error} role="alert">
                            <span className={styles.errorDot} />
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className={styles.form}>
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
                            <div className={styles.labelRow}>
                                <label htmlFor="password" className={styles.label}>Password</label>
                                <Link href="/forgot-password" className={styles.forgotLink}>
                                    Forgot password?
                                </Link>
                            </div>
                            <div className={styles.inputWrap}>
                                <Lock size={15} className={styles.inputIcon} strokeWidth={2} />
                                <input
                                    id="password"
                                    type="password"
                                    className={styles.input}
                                    placeholder="••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                            {isLoading ? (
                                <><Loader2 size={16} className={styles.spinner} /> Signing in…</>
                            ) : (
                                <>Sign in <ArrowRight size={15} strokeWidth={2.5} /></>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className={styles.divider}>
                        <span className={styles.dividerLine} />
                        <span className={styles.dividerText}>or</span>
                        <span className={styles.dividerLine} />
                    </div>

                    {/* Footer */}
                    <p className={styles.switchAuth}>
                        Don&apos;t have an account?{' '}
                        <Link href="/signup" className={styles.switchLink}>
                            Create one free
                        </Link>
                    </p>

                </div>
            </div>

        </div>
    );
}
