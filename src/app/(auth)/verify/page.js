import Link from 'next/link';
import Image from 'next/image';
import { MailCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import styles from './verify.module.css';

export default function VerifyPage() {
    return (
        <div className={styles.page}>

            {/* ── LEFT PANEL ────────────────────────────────── */}
            <div className={styles.leftPanel}>
                <div className={styles.leftGrid} />
                <div className={styles.leftGlow1} />
                <div className={styles.leftGlow2} />

                <Link href="/" className={styles.leftLogo}>
                    <div className={styles.leftLogoMark}>
                        <Image src="/logo.png" alt="AutoDM" width={20} height={20} />
                    </div>
                    <span className={styles.leftLogoText}>
                        auto<span className={styles.leftLogoDM}>dm</span>
                    </span>
                </Link>

                <div className={styles.leftHero}>
                    <h2 className={styles.leftTitle}>
                        Almost there!
                    </h2>
                    <p className={styles.leftSubtitle}>
                        Verify your email to unlock your AutoDM workspace and start automating your Instagram DMs today.
                    </p>
                </div>

                {/* What happens next */}
                <div className={styles.nextSteps}>
                    <p className={styles.nextTitle}>What happens next</p>
                    <div className={styles.nextList}>
                        <div className={styles.nextItem}>
                            <div className={styles.nextNum}>1</div>
                            <span>Click the verification link in your email</span>
                        </div>
                        <div className={styles.nextItem}>
                            <div className={styles.nextNum}>2</div>
                            <span>You&apos;re taken directly to your dashboard</span>
                        </div>
                        <div className={styles.nextItem}>
                            <div className={styles.nextNum}>3</div>
                            <span>Set your first DM automation in minutes</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── RIGHT PANEL ───────────────────────────────── */}
            <div className={styles.rightPanel}>
                <div className={styles.contentWrap}>

                    <div className={styles.iconWrap}>
                        <MailCheck size={40} strokeWidth={1.5} />
                    </div>

                    <h1 className={styles.title}>Check your email</h1>
                    <p className={styles.subtitle}>
                        We&apos;ve sent a verification link to your inbox. Click it to activate your account — it expires in 24 hours.
                    </p>

                    <div className={styles.tipBox}>
                        <p className={styles.tipTitle}>Can&apos;t find the email?</p>
                        <p className={styles.tipText}>
                            Check your <strong>spam or junk folder</strong>. The email comes from <strong>noreply@autodm.app</strong>.
                        </p>
                    </div>

                    <div className={styles.actions}>
                        <Link href="/login" className={styles.primaryBtn}>
                            Go to sign in
                            <ArrowRight size={15} strokeWidth={2.5} />
                        </Link>
                        <Link href="/" className={styles.ghostBtn}>
                            <ArrowLeft size={14} strokeWidth={2.5} />
                            Back to home
                        </Link>
                    </div>

                </div>
            </div>

        </div>
    );
}
