import Link from 'next/link';
import { MessageSquare, MailCheck } from 'lucide-react';
import styles from '../auth.module.css';

export default function VerifyPage() {
    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <Link href="/" className={styles.logo}>
                    <MessageSquare size={32} strokeWidth={2.5} />
                    <span className={styles.logoText}>Auto<span className={styles.logoDM}>DM</span></span>
                </Link>

                <div className={styles.verifyIcon}>
                    <MailCheck size={56} strokeWidth={1.5} />
                </div>

                <h1 className={styles.title}>Check Your Email</h1>

                <p className={styles.verifyText}>
                    We&apos;ve sent a verification link to your email address.
                    Please click the link to verify your account and get started.
                </p>

                <div className={styles.verifyActions}>
                    <Link href="/login" className="btn btn-primary">
                        Go to Login
                    </Link>
                    <Link href="/" className={styles.switchLink} style={{ fontSize: 'var(--font-size-sm)' }}>
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
