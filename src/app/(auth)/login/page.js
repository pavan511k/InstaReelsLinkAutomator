'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Mail, Lock, Loader2, Zap, Shield, BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import styles from '../auth.module.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
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
            {/* Left: Branded Panel */}
            <div className={styles.brandPanel}>
                <div className={styles.brandContent}>
                    <h1 className={styles.brandTagline}>
                        Automate your <span className={styles.brandTaglineAccent}>Instagram engagement</span>
                    </h1>
                    <p className={styles.brandSubtext}>
                        Send DMs automatically when followers comment on your posts, reels, and stories.
                    </p>

                    <ul className={styles.brandFeatures}>
                        <li className={styles.brandFeatureItem}>
                            <div className={styles.brandFeatureIcon}><Zap size={16} /></div>
                            Instant auto-replies to comments
                        </li>
                        <li className={styles.brandFeatureItem}>
                            <div className={styles.brandFeatureIcon}><Shield size={16} /></div>
                            Official Meta Business Partner
                        </li>
                        <li className={styles.brandFeatureItem}>
                            <div className={styles.brandFeatureIcon}><BarChart3 size={16} /></div>
                            Track every DM and conversion
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

                    <h1 className={styles.title}>Welcome back</h1>
                    <p className={styles.subtitle}>Log in to your account to continue</p>

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
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 size={18} className={styles.spinner} /> : null}
                            {isLoading ? 'Logging in...' : 'Log In'}
                        </button>
                    </form>

                    <p className={styles.switchAuth}>
                        Don&apos;t have an account? <Link href="/signup" className={styles.switchLink}>Sign Up</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
