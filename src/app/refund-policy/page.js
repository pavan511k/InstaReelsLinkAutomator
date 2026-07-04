import Link from 'next/link';
import Image from 'next/image';
import styles from '../privacy/legal.module.css';

export const metadata = {
    title: 'Refund & Cancellation Policy — AutoDM',
    description: 'How subscriptions, cancellations, and refunds work on AutoDM.',
};

export default function RefundPolicy() {
    return (
        <div id="top" className={styles.legalPage}>
            {/* Header */}
            <header className={styles.legalHeader}>
                <div className={styles.headerInner}>
                    <Link href="/" className={styles.logo}>
                        <div className={styles.logoMark}>
                            <Image src="/logo.png" alt="AutoDM" width={18} height={18} />
                        </div>
                        <span className={styles.logoText}>auto<span className={styles.logoDM}>dm</span></span>
                    </Link>
                    <div className={styles.headerLinks}>
                        <Link href="/privacy">Privacy</Link>
                        <Link href="/login">Log In</Link>
                        <Link href="/signup" className={styles.ctaButton}>Sign Up</Link>
                    </div>
                </div>
            </header>

            <div className={styles.container}>
                <h1>Refund &amp; Cancellation Policy</h1>
                <span className={styles.updated}>Last updated: July 4, 2026</span>

                <p className={styles.intro}>
                    This Refund &amp; Cancellation Policy explains how billing, cancellations, and refunds work for
                    AutoDM Pro subscriptions. It forms part of, and should be read together with, our{' '}
                    <Link href="/terms">Terms of Service</Link> (Section 7, Payments &amp; Subscriptions). Payments are
                    processed securely by <strong>Cashfree</strong>; we never store your payment card details.
                </p>

                <section className={styles.section}>
                    <h2>1. Our subscription model</h2>
                    <ul>
                        <li>AutoDM Pro is billed as a <strong>single payment per period</strong> — monthly (₹299) or yearly (₹2,999).</li>
                        <li><strong>There is no auto-renewal.</strong> We never charge your payment method again automatically. When your period ends, your account simply moves back to the Free plan.</li>
                        <li>We email you 7 days before your Pro period ends as a renewal reminder.</li>
                        <li>New users receive a <strong>30-day free Pro trial</strong> on connecting their first Instagram account — no card required and no charge.</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>2. Cancellation</h2>
                    <p>
                        Because Pro is a one-payment-per-period subscription with no auto-renewal,{' '}
                        <strong>there is nothing to cancel</strong> to avoid future charges — if you choose not to
                        continue, simply do not renew when your period ends.
                    </p>
                    <ul>
                        <li>You keep full Pro access until the end of the period you have already paid for.</li>
                        <li>You may stop using the Services at any time without penalty.</li>
                        <li>You can delete your account entirely at any time from <strong>Settings → Account → Delete Account</strong>, or by emailing <a href="mailto:support@autodm.pro">support@autodm.pro</a>.</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>3. Refunds</h2>
                    <p>
                        All payments are final. As AutoDM is a digital service delivered instantly, we do not issue
                        refunds for partially used billing periods, except where required by applicable law. Your Pro
                        access remains active until the end of the period you paid for.
                    </p>
                    <p>We will, however, review and process refunds in the following cases:</p>
                    <ul>
                        <li><strong>Duplicate charge</strong> — you were billed more than once for the same subscription period.</li>
                        <li><strong>Failed activation</strong> — your payment was debited but your Pro plan was not activated and the issue cannot be resolved by re-syncing your account.</li>
                        <li><strong>Erroneous or unauthorised charge</strong> — a charge you did not authorise or that resulted from a technical error on our side.</li>
                    </ul>
                    <p>
                        Other billing-related disputes are reviewed on a case-by-case basis. Please write to us and we
                        will work with you in good faith to reach a fair resolution.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>4. How to request a refund</h2>
                    <p>
                        Email <a href="mailto:support@autodm.pro">support@autodm.pro</a> from your registered account
                        email within <strong>7 days</strong> of the charge, and include:
                    </p>
                    <ul>
                        <li>Your registered account email</li>
                        <li>The Cashfree order ID or payment reference (from your payment confirmation)</li>
                        <li>The date and amount of the charge</li>
                        <li>A brief description of the issue</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>5. Refund processing time</h2>
                    <p>
                        Once a refund is approved, it is processed through Cashfree to your original payment method.
                        Refunds typically reflect within <strong>5–7 business days</strong>, though the exact timing
                        depends on your bank or payment provider. We will confirm by email once the refund has been
                        initiated.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>6. Contact</h2>
                    <p>For any billing, cancellation, or refund query, please reach out:</p>
                    <p>
                        <strong>AutoDM</strong><br />
                        Email: <a href="mailto:support@autodm.pro">support@autodm.pro</a><br />
                        Phone: <a href="tel:+918008413194">+91 8008413194</a><br />
                        H.No. 806, ITI Layout, 12th Main Road, Sector 7, Bengaluru, Karnataka 560068, India
                    </p>
                </section>
            </div>

            {/* Back to top */}
            <a href="#top" className={styles.backToTop} aria-label="Back to top">↑</a>

            {/* Footer */}
            <footer className={styles.legalFooter}>
                <div className={styles.footerInner}>
                    <nav className={styles.footerNav} aria-label="Footer">
                        <Link href="/">Home</Link>
                        <Link href="/terms">Terms</Link>
                        <Link href="/privacy">Privacy Policy</Link>
                        <Link href="/contact">Contact Us</Link>
                        <Link href="/shipping">Shipping &amp; Delivery</Link>
                        <Link href="/signup" className={styles.primaryCta}>Get Started</Link>
                    </nav>
                    <div className={styles.footerCopyright}>
                        © 2026 AutoDM. All rights reserved. Built for Instagram &amp; Facebook automation. We are a registered Meta Business Partner.
                    </div>
                </div>
            </footer>
        </div>
    );
}
