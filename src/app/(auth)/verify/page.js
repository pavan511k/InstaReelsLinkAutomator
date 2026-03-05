import Link from 'next/link';
import Image from 'next/image';
import { MailCheck, ArrowRight } from 'lucide-react';
import styles from '../auth.module.css';

export default function VerifyPage() {
    return (
        <div className={styles.authPage}>
            {/* Left: Branded Panel */}
            <div className={styles.brandPanel}>
                <div className={styles.brandContent}>
                    <h1 className={styles.brandTagline}>
                        Almost there!
                    </h1>
                    <p className={styles.brandSubtext}>
                        Just one more step to unlock the full power of AutoDM for your Instagram growth.
                    </p>

                    <div className={styles.brandProof}>
                        <p className={styles.brandProofText}>
                            You&apos;re joining <span className={styles.brandProofHighlight}>thousands of creators</span> who automate their DMs
                        </p>
                    </div>
                </div>
            </div>

            {/* Right: Verify Panel */}
            <div className={styles.formPanel}>
                <div className={styles.formContainer}>
                    <Link href="/" className={styles.logo}>
                        <Image src="/logo.png" alt="autodm" width={28} height={28} />
                        <span className={styles.logoText}>auto<span className={styles.logoDM}>dm</span></span>
                    </Link>

                    <div className={styles.verifyIcon}>
                        <MailCheck size={56} strokeWidth={1.5} />
                    </div>

                    <h1 className={styles.title} style={{ textAlign: 'center' }}>Check your email</h1>

                    <p className={styles.verifyText}>
                        We&apos;ve sent a verification link to your email address.
                        Click the link to verify your account and get started.
                    </p>

                    <div className={styles.verifyActions}>
                        <Link href="/login" className={styles.submitBtn} style={{ textDecoration: 'none', textAlign: 'center' }}>
                            Go to Login
                            <ArrowRight size={16} />
                        </Link>
                        <Link href="/" className={styles.switchLink} style={{ fontSize: 'var(--font-size-sm)' }}>
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
