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
                    By creating an account or using the Services, you agree to be bound by these Terms and our{' '}
                    <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do not use the Services.
                </p>

                <section className={styles.section}>
                    <h2>1. Description of Service</h2>
                    <p>
                        AutoDM is an automation tool that allows you to set up automatic Direct Message (DM) responses
                        on Instagram and Facebook. When users comment specific trigger keywords on your posts, reels, or stories,
                        AutoDM can automatically send them a DM with a link or message that you configure.
                    </p>
                    <p>The Services include:</p>
                    <ul>
                        <li>Connecting your Instagram Business Account and/or Facebook Page via Meta&apos;s OAuth</li>
                        <li>Syncing and displaying your posts, reels, and stories from connected accounts</li>
                        <li>Setting up automated DM responses with custom links and trigger keywords</li>
                        <li>Tracking automation performance and analytics (messages sent, clicks, open rates, CTR)</li>
                        <li>Supporting simultaneous Facebook and Instagram account connections</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>2. Account Registration</h2>
                    <p>To use the Services, you must:</p>
                    <ul>
                        <li>Create an account with a valid email address and password</li>
                        <li>Verify your email address via the confirmation link we send</li>
                        <li>Provide accurate and complete account information</li>
                        <li>Be at least 18 years of age</li>
                        <li>Maintain the security of your account credentials</li>
                        <li>Accept these Terms and our Privacy Policy during signup</li>
                    </ul>
                    <p>
                        You are responsible for all activity that occurs under your account. Notify us immediately at{' '}
                        <a href="mailto:support@autodm.com">support@autodm.com</a> if you suspect unauthorized access.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>3. Social Account Connection</h2>
                    <p>
                        To use AutoDM&apos;s core features, you must connect at least one Instagram Business Account
                        or Facebook Page. This connection is made through Meta&apos;s official OAuth flow (Facebook Login).
                    </p>
                    <ul>
                        <li>You may connect both an Instagram account and a Facebook Page simultaneously</li>
                        <li>Instagram connections require a Professional (Business or Creator) Instagram account linked to a Facebook Page</li>
                        <li>Disconnecting an account revokes our API access but preserves your automation settings</li>
                        <li>Reconnecting the same platform reactivates your existing configuration</li>
                    </ul>
                    <p>
                        By connecting your accounts, you grant AutoDM permission to access your profile information,
                        posts, and send messages on your behalf as described in our <Link href="/privacy">Privacy Policy</Link>.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>4. Permitted Use</h2>
                    <p><strong>You may use AutoDM to:</strong></p>
                    <ul>
                        <li>Send automated DMs with links to users who comment trigger keywords on your content</li>
                        <li>Track performance metrics of your DM automations</li>
                        <li>Manage your Instagram and Facebook content through our dashboard</li>
                        <li>Sync and view your posts, reels, and stories</li>
                    </ul>
                    <p><strong>You may NOT use AutoDM to:</strong></p>
                    <ul>
                        <li>Send unsolicited spam, bulk messages, or phishing content</li>
                        <li>Violate Meta&apos;s messaging policies, rate limits, or community guidelines</li>
                        <li>Harass, impersonate, threaten, or deceive other users</li>
                        <li>Distribute malicious content, malware, or harmful links</li>
                        <li>Scrape, extract, or harvest data from Instagram or Facebook beyond authorized use</li>
                        <li>Use bots or scripts to artificially generate comments or engagement</li>
                        <li>Send messages containing illegal, adult, or prohibited content</li>
                        <li>Attempt to circumvent Meta&apos;s messaging rate limits</li>
                        <li>Violate any applicable laws or regulations</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>5. Meta Platform Compliance</h2>
                    <p>
                        AutoDM integrates with Instagram and Facebook through Meta&apos;s official Graph APIs. By using the
                        Services, you agree to comply with:
                    </p>
                    <ul>
                        <li><a href="https://www.facebook.com/legal/terms" target="_blank" rel="noopener noreferrer">Meta Terms of Service</a></li>
                        <li><a href="https://help.instagram.com/581066165581870" target="_blank" rel="noopener noreferrer">Instagram Terms of Use</a></li>
                        <li><a href="https://help.instagram.com/477434105621119" target="_blank" rel="noopener noreferrer">Instagram Community Guidelines</a></li>
                        <li><a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer">Meta Platform Terms</a></li>
                        <li><a href="https://developers.facebook.com/devpolicy/" target="_blank" rel="noopener noreferrer">Meta Developer Policies</a></li>
                    </ul>
                    <p>
                        We are not responsible for any actions taken by Meta on your account as a result of using
                        automation tools. This includes but is not limited to rate limiting, temporary restrictions,
                        or account suspension by Meta. Use the Services responsibly and within Meta&apos;s guidelines.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>6. Free Tier &amp; Limitations</h2>
                    <p>The current free tier of AutoDM includes:</p>
                    <ul>
                        <li>Up to 1,000 automated DMs per month</li>
                        <li>Connect 1 Instagram account and 1 Facebook Page simultaneously</li>
                        <li>Basic analytics and performance tracking</li>
                        <li>Unlimited automation rules per post</li>
                    </ul>
                    <p>We reserve the right to modify these limits with 30 days&apos; prior notice. Paid plans may be introduced in the future.</p>
                </section>

                <section className={styles.section}>
                    <h2>7. Data Ownership &amp; Intellectual Property</h2>
                    <p>
                        The Services, including all code, design, features, and functionality, are owned by AutoDM and
                        are protected by intellectual property laws. You may not copy, modify, distribute, sell, or
                        lease any part of the Services without our written consent.
                    </p>
                    <p>
                        You retain full ownership of your content (posts, messages, links, captions) that you create or manage using the Services.
                        We do not claim any ownership over your social media content.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>8. Account Disconnection &amp; Deletion</h2>
                    <p><strong>Disconnecting a social account:</strong></p>
                    <ul>
                        <li>Revokes our API access to that platform</li>
                        <li>Preserves your synced posts and automation settings</li>
                        <li>Allows you to reconnect later without losing your configuration</li>
                    </ul>
                    <p><strong>Full account deletion:</strong></p>
                    <ul>
                        <li>Removes all your personal information from our databases</li>
                        <li>Deletes all connected accounts, synced posts, automations, and analytics</li>
                        <li>Is irreversible — you would need to create a new account and set up everything again</li>
                    </ul>
                    <p>
                        To request full account deletion, contact us at{' '}
                        <a href="mailto:support@autodm.com">support@autodm.com</a>. We will process
                        deletion requests within 30 days.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>9. Suspension &amp; Termination</h2>
                    <p>We may suspend or terminate your account if:</p>
                    <ul>
                        <li>You violate these Terms or Meta&apos;s Platform Policies</li>
                        <li>You engage in spam, harassment, or other prohibited activities</li>
                        <li>Your API access is revoked by Meta</li>
                        <li>We detect abuse of the service or excessive resource usage</li>
                        <li>We are required by law to do so</li>
                    </ul>
                    <p>
                        If we suspend your account, we will notify you by email and provide a reason unless prohibited by law.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>10. Disclaimers</h2>
                    <p>
                        The Services are provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without warranties
                        of any kind, either express or implied. We do not guarantee that the Services will be
                        uninterrupted, error-free, or secure.
                    </p>
                    <p>
                        We are not responsible for any losses or damages resulting from your use of automation
                        tools, including but not limited to account restrictions, suspensions, or bans by Meta.
                    </p>
                    <p>
                        We do not guarantee the delivery of any automated DMs. Message delivery depends on Meta&apos;s
                        API availability, rate limits, and the recipient&apos;s account settings.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>11. Limitation of Liability</h2>
                    <p>
                        To the maximum extent permitted by law, AutoDM shall not be liable for any indirect,
                        incidental, special, consequential, or punitive damages, or any loss of profits or revenues,
                        whether incurred directly or indirectly, arising from your use of the Services.
                    </p>
                    <p>
                        Our total liability for any claims arising from the Services shall not exceed the amount
                        you paid us in the 12 months preceding the claim (or $0 for free tier users).
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>12. Changes to Terms</h2>
                    <p>
                        We reserve the right to modify these Terms at any time. If we make material changes, we
                        will notify you by posting the updated Terms on our website with a new &quot;Last updated&quot;
                        date and, where possible, by sending an email notification. Your continued use of the Services
                        after changes constitutes acceptance of the new Terms.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>13. Governing Law</h2>
                    <p>
                        These Terms shall be governed by and construed in accordance with the laws of India,
                        without regard to its conflict of law principles. Any disputes arising from these Terms
                        shall be resolved in the courts of India.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>14. Contact Us</h2>
                    <p>If you have questions about these Terms, contact us at:</p>
                    <p>
                        <strong>AutoDM</strong><br />
                        Email: <a href="mailto:support@autodm.com">support@autodm.com</a>
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
