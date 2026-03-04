import Link from 'next/link';
import { MessageSquare, MailCheck, Shield, Zap, CheckCircle } from 'lucide-react';
import styles from '../auth.module.css';

export default function VerifyPage() {
    return (
        <div className={styles.authPage}>
            {/* ── Branding Panel (Left) ── */}
            <div className={styles.brandingPanel}>
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
                        You&apos;re Almost{' '}
                        <span className={styles.brandingHeadlineAccent}>There!</span>
                    </h1>

                    <p className={styles.brandingSubtitle}>
                        Just one more step to unlock the power of automated Instagram DMs.
                    </p>

                    <div className={styles.trustIndicators}>
                        <div className={styles.trustItem}>
                            <div className={styles.trustIcon}>
                                <CheckCircle size={16} />
                            </div>
                            <span>Account created successfully</span>
                        </div>
                        <div className={styles.trustItem}>
                            <div className={styles.trustIcon}>
                                <Shield size={16} />
                            </div>
                            <span>Your data is encrypted & secure</span>
                        </div>
                        <div className={styles.trustItem}>
                            <div className={styles.trustIcon}>
                                <Zap size={16} />
                            </div>
                            <span>Ready to automate in 2 minutes</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Form Panel (Right) ── */}
            <div className={styles.formPanel}>
                <div className={styles.formContainer}>
                    <div className={styles.verifyIcon}>
                        <div className={styles.verifyIconCircle}>
                            <MailCheck size={40} strokeWidth={1.5} />
                        </div>
                    </div>

                    <h2 className={styles.title} style={{ textAlign: 'center' }}>Check Your Email</h2>

                    <p className={styles.verifyText}>
                        We&apos;ve sent a verification link to your email address.
                        Please click the link to verify your account and get started.
                    </p>

                    <div className={styles.verifyActions}>
                        <Link href="/login" className={styles.submitBtn} style={{ textDecoration: 'none', textAlign: 'center' }}>
                            <span className={styles.submitBtnText}>Go to Login</span>
                        </Link>
                        <Link href="/" className={styles.switchLink} style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-4)' }}>
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
