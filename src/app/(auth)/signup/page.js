'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, Mail, Lock, Loader2, Eye, EyeOff, Instagram, Sparkles, Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import styles from '../auth.module.css';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
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
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (!termsAccepted) {
            setError('You must accept the Terms & Conditions and Privacy Policy to continue.');
            return;
        }

        setIsLoading(true);
        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (signUpError) {
                setError(signUpError.message);
            } else {
                router.push('/verify');
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
                        Start Growing with{' '}
                        <span className={styles.brandingHeadlineAccent}>Instagram Automation</span>
                    </h1>

                    <p className={styles.brandingSubtitle}>
                        Join thousands of creators who save hours every week with automated DM responses.
                    </p>

                    <div className={styles.trustIndicators}>
                        <div className={styles.trustItem}>
                            <div className={styles.trustIcon}>
                                <Instagram size={16} />
                            </div>
                            <span>Works with Reels, Posts & Stories</span>
                        </div>
                        <div className={styles.trustItem}>
                            <div className={styles.trustIcon}>
                                <Sparkles size={16} />
                            </div>
                            <span>Smart keyword-based triggers</span>
                        </div>
                        <div className={styles.trustItem}>
                            <div className={styles.trustIcon}>
                                <Heart size={16} />
                            </div>
                            <span>Loved by creators & brands</span>
                        </div>
                    </div>

                    <div className={styles.testimonialCard}>
                        <p className={styles.testimonialText}>
                            &ldquo;AutoDM helped me 3x my engagement rate. I set it up once and it just works — every comment gets a personalized DM automatically.&rdquo;
                        </p>
                        <div className={styles.testimonialAuthor}>
                            <div className={styles.testimonialAvatar}>SK</div>
                            <div>
                                <div className={styles.testimonialName}>Sarah K.</div>
                                <div className={styles.testimonialRole}>Content Creator · 50K followers</div>
                            </div>
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

                    <h2 className={styles.title}>Create your free account</h2>
                    <p className={styles.subtitle}>
                        Get started in seconds. No credit card required.
                    </p>

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
                                    placeholder="Min. 6 characters"
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

                        <div className={styles.termsCheckbox}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={termsAccepted}
                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                    className={styles.checkbox}
                                    disabled={isLoading}
                                />
                                <span>
                                    I accept the{' '}
                                    <Link href="/terms" target="_blank" className={styles.termsLink}>Terms &amp; Conditions</Link>
                                    {' '}and{' '}
                                    <Link href="/privacy" target="_blank" className={styles.termsLink}>Privacy Policy</Link>
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={isLoading}
                        >
                            <span className={styles.submitBtnText}>
                                {isLoading ? <Loader2 size={18} className={styles.spinner} /> : null}
                                {isLoading ? 'Creating Account...' : 'Get Started Free'}
                            </span>
                        </button>
                    </form>

                    <p className={styles.switchAuth}>
                        Already have an account?{' '}
                        <Link href="/login" className={styles.switchLink}>Log In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
