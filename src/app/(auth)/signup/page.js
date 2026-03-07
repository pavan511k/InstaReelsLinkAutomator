'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import styles from '../auth.module.css';

const PASSWORD_MIN_LENGTH = 6;

function getPasswordStrength(password) {
    if (!password) return { level: 0, label: '' };
    if (password.length < PASSWORD_MIN_LENGTH) return { level: 1, label: 'Too short' };

    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 1, label: 'Weak' };
    if (score === 2) return { level: 2, label: 'Fair' };
    if (score === 3) return { level: 3, label: 'Good' };
    return { level: 4, label: 'Strong' };
}

const STRENGTH_CLASSES = ['', 'weak', 'fair', 'good', 'strong'];

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please fill in all fields.');
            return;
        }
        if (password.length < PASSWORD_MIN_LENGTH) {
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
            {/* Left: Branded Panel */}
            <div className={styles.brandPanel}>
                <div className={styles.brandContent}>
                    <h1 className={styles.brandTagline}>
                        Start growing with <span className={styles.brandTaglineAccent}>AutoDM</span>
                    </h1>
                    <p className={styles.brandSubtext}>
                        Set up in 2 minutes. No credit card required.
                    </p>

                    <ul className={styles.brandFeatures}>
                        <li className={styles.brandFeatureItem}>
                            <div className={styles.brandFeatureIcon}><CheckCircle2 size={16} /></div>
                            Auto-reply to comments with DMs
                        </li>
                        <li className={styles.brandFeatureItem}>
                            <div className={styles.brandFeatureIcon}><CheckCircle2 size={16} /></div>
                            Works with posts, reels & stories
                        </li>
                        <li className={styles.brandFeatureItem}>
                            <div className={styles.brandFeatureIcon}><CheckCircle2 size={16} /></div>
                            Free plan with 1,000 DMs/month
                        </li>
                        <li className={styles.brandFeatureItem}>
                            <div className={styles.brandFeatureIcon}><CheckCircle2 size={16} /></div>
                            Instagram & Facebook support
                        </li>
                    </ul>

                    <div className={styles.brandProof}>
                        <p className={styles.brandProofText}>
                            Trusted by <span className={styles.brandProofHighlight}>creators and businesses</span> worldwide
                        </p>
                    </div>
                </div>
            </div>

            {/* Right: Form Panel */}
            <div className={styles.formPanel}>
                <div className={styles.formContainer}>
                    <Link href="/" className={styles.logo}>
                        <Image src="/logo.png" alt="autodm" width={28} height={28} />
                        <span className={styles.logoText}>auto<span className={styles.logoDM}>dm</span></span>
                    </Link>

                    <h1 className={styles.title}>Create your account</h1>
                    <p className={styles.subtitle}>
                        Get started for free — no credit card needed
                    </p>

                    {error && <div className={styles.error}>{error}</div>}

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className="form-group">
                            <label htmlFor="email" className="form-label">Email</label>
                            <div className={styles.inputWrapper}>
                                <Mail size={18} className={styles.inputIcon} />
                                <input
                                    id="email"
                                    type="email"
                                    className={`form-input ${styles.iconInput}`}
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="password" className="form-label">Password</label>
                            <div className={styles.inputWrapper}>
                                <Lock size={18} className={styles.inputIcon} />
                                <input
                                    id="password"
                                    type="password"
                                    className={`form-input ${styles.iconInput}`}
                                    placeholder="Min 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                            {password && (
                                <>
                                    <div className={styles.passwordStrength}>
                                        {[1, 2, 3, 4].map((bar) => (
                                            <div
                                                key={bar}
                                                className={`${styles.strengthBar} ${bar <= passwordStrength.level
                                                    ? styles[STRENGTH_CLASSES[passwordStrength.level]]
                                                    : ''
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <span className={styles.strengthText}>{passwordStrength.label}</span>
                                </>
                            )}
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
                            {isLoading ? <Loader2 size={18} className={styles.spinner} /> : null}
                            {isLoading ? 'Creating Account...' : 'Get Started'}
                        </button>
                    </form>

                    <p className={styles.switchAuth}>
                        Already have an account? <Link href="/login" className={styles.switchLink}>Log In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
