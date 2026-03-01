'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, Mail, Lock, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import styles from '../auth.module.css';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
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
            <div className={styles.authCard}>
                <Link href="/" className={styles.logo}>
                    <MessageSquare size={32} strokeWidth={2.5} />
                    <span className={styles.logoText}>Auto<span className={styles.logoDM}>DM</span></span>
                </Link>

                <h1 className={styles.title}>Create A Free AutoDM Account</h1>
                <p className={styles.subtitle}>
                    Join AutoDM, the fastest growing Instagram DM Automation platform loved by thousands of creators!
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
                                placeholder="Enter your email address"
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
                                placeholder="Enter password (min 6 characters)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                            />
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
                        className={`btn btn-primary btn-lg ${styles.submitBtn}`}
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
    );
}
