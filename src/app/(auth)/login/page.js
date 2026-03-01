'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, Mail, Lock, Loader2 } from 'lucide-react';
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
            <div className={styles.authCard}>
                <Link href="/" className={styles.logo}>
                    <MessageSquare size={32} strokeWidth={2.5} />
                    <span className={styles.logoText}>Auto<span className={styles.logoDM}>DM</span></span>
                </Link>

                <h1 className={styles.title}>Welcome Back</h1>
                <p className={styles.subtitle}>Log in to your AutoDM account</p>

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
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className={`btn btn-primary btn-lg ${styles.submitBtn}`}
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 size={18} className={styles.spinner} /> : null}
                        {isLoading ? 'Logging In...' : 'Log In'}
                    </button>
                </form>

                <p className={styles.switchAuth}>
                    Don&apos;t have an account? <Link href="/signup" className={styles.switchLink}>Sign Up</Link>
                </p>
            </div>
        </div>
    );
}
