import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import styles from '../privacy/legal.module.css';

export const metadata = {
    title: 'Terms of Service — AutoDM',
    description: 'AutoDM Terms of Service — rules and guidelines for using our DM automation platform.',
};

export default function TermsOfService() {
    return (
        <div className={styles.legalPage}>
            {/* Header */}
            <header className={styles.legalHeader}>
                <div className={styles.headerInner}>
                    <Link href="/" className={styles.logo}>
                        <MessageSquare size={24} strokeWidth={2.5} />
                        <span className={styles.logoText}>Auto<span className={styles.logoDM}>DM</span></span>
                    </Link>
                    <div className={styles.headerLinks}>
                        <Link href="/privacy">Privacy Policy</Link>
                        <Link href="/login">Log In</Link>
                        <Link href="/signup">Sign Up</Link>
                    </div>
                </div>
            </header>

            <div className={styles.container}>
                <h1>Terms of Service</h1>
                <span className={styles.updated}>Last updated: March 1, 2026</span>

                <p className={styles.intro}>
                    These Terms of Service (&quot;Terms&quot;) govern your access to and use of AutoDM (&quot;we,&quot;
                    &quot;us,&quot; or &quot;our&quot;) services, website, and applications (the &quot;Services&quot;).
                    By creating an account or using the Services, you agree to be bound by these Terms. If you do not
                    agree, do not use the Services.
                </p>

                <section className={styles.section}>
                    <h2>1. Description of Service</h2>
                    <p>
                        AutoDM is an automation tool that allows you to set up automatic Direct Message (DM) responses
                        on Instagram and Facebook. When users comment on your posts, reels, or stories, AutoDM can
                        automatically send them a DM with a link or message that you configure.
                    </p>
                    <p>The Services include:</p>
                    <ul>
                        <li>Connecting your Instagram Business Account and/or Facebook Page</li>
                        <li>Syncing and displaying your posts, reels, and stories</li>
                        <li>Setting up automated DM responses with custom links</li>
                        <li>Tracking automation performance and analytics</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>2. Account Registration</h2>
                    <p>To use the Services, you must:</p>
                    <ul>
                        <li>Create an account with a valid email address and password</li>
                        <li>Verify your email address</li>
                        <li>Provide accurate and complete account information</li>
                        <li>Be at least 18 years of age</li>
                        <li>Maintain the security of your account credentials</li>
                    </ul>
                    <p>
                        You are responsible for all activity that occurs under your account. Notify us immediately if
                        you suspect unauthorized access.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>3. Permitted Use</h2>
                    <p><strong>You may use AutoDM to:</strong></p>
                    <ul>
                        <li>Send automated DMs with links to users who comment on your content</li>
                        <li>Track performance metrics of your DM automations</li>
                        <li>Manage your Instagram and Facebook content through our dashboard</li>
                    </ul>
                    <p><strong>You may NOT use AutoDM to:</strong></p>
                    <ul>
                        <li>Send unsolicited spam, bulk messages, or phishing content</li>
                        <li>Violate Meta&apos;s messaging policies, rate limits, or community guidelines</li>
                        <li>Harass, impersonate, threaten, or deceive other users</li>
                        <li>Distribute malicious content, malware, or harmful links</li>
                        <li>Scrape, extract, or harvest data from Instagram or Facebook beyond authorized use</li>
                        <li>Use bots or scripts to artificially generate comments or engagement</li>
                        <li>Violate any applicable laws or regulations</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>4. Meta Platform Compliance</h2>
                    <p>
                        AutoDM integrates with Instagram and Facebook through Meta&apos;s official APIs. By using the
                        Services, you agree to comply with:
                    </p>
                    <ul>
                        <li><a href="https://www.facebook.com/legal/terms" target="_blank" rel="noopener noreferrer">Meta Terms of Service</a></li>
                        <li><a href="https://help.instagram.com/581066165581870" target="_blank" rel="noopener noreferrer">Instagram Terms of Use</a></li>
                        <li><a href="https://help.instagram.com/477434105621119" target="_blank" rel="noopener noreferrer">Instagram Community Guidelines</a></li>
                        <li><a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer">Meta Platform Terms</a></li>
                    </ul>
                    <p>
                        We are not responsible for any actions taken by Meta on your account as a result of using
                        automation tools. Use the Services responsibly and within Meta&apos;s guidelines.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>5. Free Tier &amp; Limitations</h2>
                    <p>The free tier of AutoDM includes:</p>
                    <ul>
                        <li>Up to 1,000 automated DMs per month</li>
                        <li>Connect 1 Instagram account and/or 1 Facebook Page</li>
                        <li>Basic analytics and performance tracking</li>
                    </ul>
                    <p>We reserve the right to modify these limits with prior notice.</p>
                </section>

                <section className={styles.section}>
                    <h2>6. Intellectual Property</h2>
                    <p>
                        The Services, including all content, features, and functionality, are owned by AutoDM and
                        are protected by intellectual property laws. You may not copy, modify, distribute, sell, or
                        lease any part of the Services without our written consent.
                    </p>
                    <p>
                        You retain ownership of your content (posts, messages, links) that you create using the Services.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>7. Suspension &amp; Termination</h2>
                    <p>We may suspend or terminate your account if:</p>
                    <ul>
                        <li>You violate these Terms or Meta&apos;s Platform Policies</li>
                        <li>You engage in spam, harassment, or other prohibited activities</li>
                        <li>Your API access is revoked by Meta</li>
                        <li>We are required by law to do so</li>
                    </ul>
                    <p>
                        You may delete your account at any time through the dashboard by disconnecting your accounts, or by
                        contacting us at <a href="mailto:support@autodm.app">support@autodm.app</a>.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>8. Disclaimers</h2>
                    <p>
                        The Services are provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without warranties
                        of any kind, either express or implied. We do not guarantee that the Services will be
                        uninterrupted, error-free, or secure.
                    </p>
                    <p>
                        We are not responsible for any losses or damages resulting from your use of automation
                        tools, including but not limited to account restrictions, suspensions, or bans by Meta.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>9. Limitation of Liability</h2>
                    <p>
                        To the maximum extent permitted by law, AutoDM shall not be liable for any indirect,
                        incidental, special, consequential, or punitive damages, or any loss of profits or revenues,
                        whether incurred directly or indirectly, arising from your use of the Services.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>10. Changes to Terms</h2>
                    <p>
                        We reserve the right to modify these Terms at any time. If we make material changes, we
                        will notify you by posting the updated Terms on our website with a new &quot;Last updated&quot;
                        date. Your continued use of the Services after changes constitutes acceptance of the new Terms.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>11. Contact Us</h2>
                    <p>If you have questions about these Terms, contact us at:</p>
                    <p>
                        <strong>AutoDM</strong><br />
                        Email: <a href="mailto:support@autodm.app">support@autodm.app</a>
                    </p>
                </section>
            </div>

            {/* Footer */}
            <footer className={styles.legalFooter}>
                <p>© 2026 AutoDM. All rights reserved. | <Link href="/privacy">Privacy Policy</Link></p>
            </footer>
        </div>
    );
}
