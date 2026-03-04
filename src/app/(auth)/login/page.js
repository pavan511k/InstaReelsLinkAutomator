'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, Mail, Lock, Loader2, Eye, EyeOff, Users, Zap, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import styles from '../auth.module.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please fill in all fields.');
            return;
        }

        setIsLoading(true);
        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                if (signInError.message.includes('Email not confirmed')) {
                    setError('Please verify your email before logging in. Check your inbox.');
                } else {
                    setError(signInError.message);
                }
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
        <div className={styles.authPage}>
            {/* ── Branding Panel (Left) ── */}
            <div className={styles.brandingPanel}>
                {/* Floating orbs for depth */}
                <div className={styles.brandingOrb} />
                <div className={styles.brandingOrb} />
                <div className={styles.brandingOrb} />

                <div className={styles.brandingContent}>
                    <Link href="/" className={styles.brandingLogo}>
                        <div className={styles.brandingLogoIcon}>
                            <MessageSquare size={22} color="white" strokeWidth={2.5} />
                        </div>
                        <span className={styles.brandingLogoText}>
                            Auto<span className={styles.brandingLogoDM}>DM</span>
                        </span>
                    </Link>

                    <h1 className={styles.brandingHeadline}>
                        Automate Your{' '}
                        <span className={styles.brandingHeadlineAccent}>Instagram DMs</span>
                        {' '}in Minutes
                    </h1>

                    <p className={styles.brandingSubtitle}>
                        Turn every comment into a conversation. Set up keyword triggers and let AutoDM handle the rest.
                    </p>

                    <div className={styles.trustIndicators}>
                        <div className={styles.trustItem}>
                            <div className={styles.trustIcon}>
                                <Users size={16} />
                            </div>
                            <span>Trusted by 10,000+ creators</span>
                        </div>
                        <div className={styles.trustItem}>
                            <div className={styles.trustIcon}>
                                <Zap size={16} />
                            </div>
                            <span>Set up in under 2 minutes</span>
                        </div>
                        <div className={styles.trustItem}>
                            <div className={styles.trustIcon}>
                                <Shield size={16} />
                            </div>
                            <span>Free forever — no credit card needed</span>
                        </div>
                    </div>

                    <div className={styles.brandingStats}>
                        <div className={styles.brandingStat}>
                            <span className={styles.brandingStatValue}>2M+</span>
                            <span className={styles.brandingStatLabel}>DMs Sent</span>
                        </div>
                        <div className={styles.brandingStat}>
                            <span className={styles.brandingStatValue}>10K+</span>
                            <span className={styles.brandingStatLabel}>Creators</span>
                        </div>
                        <div className={styles.brandingStat}>
                            <span className={styles.brandingStatValue}>99.9%</span>
                            <span className={styles.brandingStatLabel}>Uptime</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Form Panel (Right) ── */}
            <div className={styles.formPanel}>
                <div className={styles.formContainer}>
                    {/* Mobile-only logo */}
                    <Link href="/" className={styles.logo}>
                        <MessageSquare size={32} strokeWidth={2.5} />
                        <span className={styles.logoText}>Auto<span className={styles.logoDM}>DM</span></span>
                    </Link>

                    <h2 className={styles.title}>Welcome back</h2>
                    <p className={styles.subtitle}>Log in to your AutoDM account to manage your automations.</p>

                    {error && <div className={styles.error}>{error}</div>}

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="email" className={styles.inputLabel}>Email address</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    id="email"
                                    type="email"
                                    className={styles.inputField}
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                />
                                <Mail size={18} className={styles.inputIcon} />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="password" className={styles.inputLabel}>Password</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className={styles.inputField}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                />
                                <Lock size={18} className={styles.inputIcon} />
                                <button
                                    type="button"
                                    className={styles.passwordToggle}
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={isLoading}
                        >
                            <span className={styles.submitBtnText}>
                                {isLoading ? <Loader2 size={18} className={styles.spinner} /> : null}
                                {isLoading ? 'Logging in...' : 'Log In'}
                            </span>
                        </button>
                    </form>

                    <p className={styles.switchAuth}>
                        Don&apos;t have an account?{' '}
                        <Link href="/signup" className={styles.switchLink}>Create one free</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
