import Link from 'next/link';
import Image from 'next/image';
import styles from '../privacy/legal.module.css';

export const metadata = {
    title: 'Contact Us — AutoDM',
    description: 'Get in touch with the AutoDM team — support, billing, and general enquiries.',
};

export default function ContactUs() {
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
                <h1>Contact Us</h1>
                <span className={styles.updated}>Last updated: July 4, 2026</span>

                <p className={styles.intro}>
                    We&apos;re here to help. Whether you have a question about your account, need help with an
                    automation, or have a billing enquiry, the AutoDM team is happy to assist. The fastest way to
                    reach us is by email, and we aim to respond to all enquiries within 5 business days.
                </p>

                <section className={styles.section}>
                    <h2>1. How to reach us</h2>
                    <ul>
                        <li><strong>Email:</strong> <a href="mailto:support@autodm.pro">support@autodm.pro</a> — for support, billing, and general enquiries</li>
                        <li><strong>Phone:</strong> <a href="tel:+918008413194">+91 8008413194</a> (Monday–Friday, 10:00–18:00 IST)</li>
                        <li><strong>Website:</strong> <a href="https://autodm.pro" target="_blank" rel="noopener noreferrer">autodm.pro</a></li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>2. Registered address</h2>
                    <p>
                        <strong>AutoDM</strong><br />
                        H.No. 806, ITI Layout, 12th Main Road,<br />
                        Sector 7, Bengaluru, Karnataka 560068<br />
                        India
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>3. What to contact us about</h2>
                    <ul>
                        <li><strong>Product support</strong> — help setting up automations, connecting your Instagram or Facebook account, or troubleshooting DM delivery</li>
                        <li><strong>Billing &amp; payments</strong> — questions about your Pro subscription, invoices, or a payment issue (see our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>)</li>
                        <li><strong>Privacy &amp; data</strong> — data access, correction, or deletion requests (see our <Link href="/privacy">Privacy Policy</Link>)</li>
                        <li><strong>Partnerships &amp; feedback</strong> — collaboration ideas, feature requests, or general feedback</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>4. Response times</h2>
                    <p>
                        We aim to respond to all enquiries within 5 business days. Pro subscribers receive priority
                        support and typically hear back sooner. For account security issues, please email us
                        immediately at <a href="mailto:support@autodm.pro">support@autodm.pro</a> so we can act quickly.
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
                        <Link href="/refund-policy">Refunds &amp; Cancellations</Link>
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
