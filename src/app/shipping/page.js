import Link from 'next/link';
import Image from 'next/image';
import styles from '../privacy/legal.module.css';

export const metadata = {
    title: 'Shipping & Delivery Policy — AutoDM',
    description: 'How AutoDM delivers its digital service after purchase.',
};

export default function ShippingPolicy() {
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
                <h1>Shipping &amp; Delivery Policy</h1>
                <span className={styles.updated}>Last updated: July 4, 2026</span>

                <p className={styles.intro}>
                    AutoDM is a software-as-a-service (SaaS) product. It is delivered entirely online — there are{' '}
                    <strong>no physical goods shipped</strong> and therefore no shipping charges or delivery
                    addresses involved.
                </p>

                <section className={styles.section}>
                    <h2>1. Digital delivery</h2>
                    <p>
                        Access to AutoDM and its Pro features is delivered digitally through your account at{' '}
                        <a href="https://autodm.pro" target="_blank" rel="noopener noreferrer">autodm.pro</a>. Nothing
                        is physically shipped or mailed to you.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>2. Delivery timeline</h2>
                    <ul>
                        <li><strong>Free plan &amp; trial:</strong> access is available immediately after you sign up and connect your Instagram account. New users receive a 30-day free Pro trial automatically.</li>
                        <li><strong>Pro subscription:</strong> your Pro plan is activated <strong>automatically and immediately</strong> after your payment is confirmed by Cashfree. In rare cases a payment confirmation can take a few minutes to reach us.</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>3. How you access your purchase</h2>
                    <p>
                        Once your payment is confirmed, your Pro features unlock the moment you refresh or reopen your
                        AutoDM dashboard — no download or installation is required. You can verify your active plan
                        under <strong>Settings → Billing &amp; Plan</strong>.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>4. If your access hasn&apos;t activated</h2>
                    <p>
                        If your payment was successful but your Pro plan is not active after a few minutes, please
                        contact us at <a href="mailto:support@autodm.pro">support@autodm.pro</a> with your Cashfree
                        order ID and registered email, and we will activate it manually. See our{' '}
                        <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link> for how failed activations
                        are handled.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>5. Contact</h2>
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
                        <Link href="/refund-policy">Refunds &amp; Cancellations</Link>
                        <Link href="/contact">Contact Us</Link>
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
