import Link from 'next/link';
import Image from 'next/image';
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
                        <div className={styles.logoMark}>
                            <Image src="/logo.png" alt="AutoDM" width={18} height={18} />
                        </div>
                        <span className={styles.logoText}>auto<span className={styles.logoDM}>dm</span></span>
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
                <span className={styles.updated}>Last updated: March 21, 2026</span>

                <p className={styles.intro}>
                    These Terms of Service (&quot;Terms&quot;) govern your access to and use of AutoDM (&quot;we,&quot;
                    &quot;us,&quot; or &quot;our&quot;) services, website, and applications (collectively, the &quot;Services&quot;).
                    By creating an account or using the Services, you agree to be bound by these Terms and our{' '}
                    <Link href="/privacy">Privacy Policy</Link>. If you do not agree to these Terms, do not use the Services.
                </p>

                <section className={styles.section}>
                    <h2>1. Description of Service</h2>
                    <p>
                        AutoDM is a Direct Message automation platform for Instagram and Facebook. It enables you to
                        automatically send DM responses to users who comment on your posts, Reels, and Stories using
                        trigger keywords or other conditions you configure. AutoDM operates through Meta's official
                        Graph APIs and is a registered Meta Business Partner.
                    </p>
                    <p>The Services include:</p>
                    <ul>
                        <li>Connecting your Instagram Business/Creator Account and/or Facebook Page via Meta's official OAuth 2.0 consent flow</li>
                        <li>Syncing and displaying your posts, Reels, and Stories from connected accounts</li>
                        <li>Setting up automated DM responses with configurable trigger conditions (keywords, all comments, emojis only, mentions)</li>
                        <li>DM types including Button Templates, plain text messages, Quick Reply chips, Multi-CTA buttons, Follow Gate, and Email Collector</li>
                        <li>Global Triggers — account-wide keyword automations that fire across all your content without per-post setup</li>
                        <li>Multi-step Flow Automations and Upsell Follow-ups (Pro)</li>
                        <li>Link click tracking with short redirect URLs and CTR analytics</li>
                        <li>Performance analytics including DMs sent, link clicks, click-through rate, and A/B test results</li>
                        <li>Subscription billing managed through Cashfree</li>
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
                        <li>Maintain the security and confidentiality of your login credentials</li>
                        <li>Accept these Terms and our Privacy Policy during signup</li>
                    </ul>
                    <p>
                        You are solely responsible for all activity that occurs under your account. You must notify
                        us immediately at <a href="mailto:support@autodm.pro">support@autodm.pro</a> if you suspect
                        any unauthorised access to your account.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>3. Social Account Connection</h2>
                    <p>
                        To use AutoDM&apos;s core automation features, you must connect at least one Instagram Business
                        Account or Facebook Page. This connection is made through Meta&apos;s official OAuth 2.0 flow.
                    </p>
                    <ul>
                        <li>You may connect an Instagram account directly using Instagram Login, or connect via Facebook Login to link a Facebook Page and its associated Instagram Business Account</li>
                        <li>Instagram connections require a Professional (Business or Creator) Instagram account</li>
                        <li>Disconnecting an account revokes our API access, scrubs your OAuth tokens, and deletes synced posts from our database, but preserves your automation configurations</li>
                        <li>Reconnecting the same platform reactivates your existing automation configurations</li>
                    </ul>
                    <p>
                        By connecting your accounts, you grant AutoDM permission to access your profile information,
                        your posts, comments on your posts, and to send Direct Messages on your behalf, as described in detail in our{' '}
                        <Link href="/privacy">Privacy Policy</Link> (Section 5).
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>4. Permitted Use</h2>
                    <p><strong>You may use AutoDM to:</strong></p>
                    <ul>
                        <li>Send automated DMs with links or messages to users who comment on your content with trigger keywords or conditions you have configured</li>
                        <li>Automate follow-gate flows that send a reward link to users who verify they have followed your account</li>
                        <li>Collect email addresses voluntarily provided by users in response to your automated prompts</li>
                        <li>Track click performance of links sent in your automated DMs</li>
                        <li>Manage and view your Instagram and Facebook content through the AutoDM dashboard</li>
                    </ul>
                    <p><strong>You may NOT use AutoDM to:</strong></p>
                    <ul>
                        <li>Send unsolicited spam, bulk promotional messages, or phishing content</li>
                        <li>Violate Meta&apos;s messaging policies, rate limits, Messaging Policy, or Community Standards</li>
                        <li>Harass, threaten, impersonate, or deceive other users</li>
                        <li>Distribute malicious links, malware, or fraudulent content</li>
                        <li>Scrape, harvest, or extract data from Instagram or Facebook beyond the scope of Meta&apos;s authorised API access</li>
                        <li>Use bots, scripts, or automated means to artificially inflate comments, engagement, or follower counts</li>
                        <li>Send messages containing illegal, adult, gambling, or otherwise prohibited content</li>
                        <li>Attempt to circumvent Meta&apos;s messaging rate limits or API usage policies</li>
                        <li>Use the Services for any purpose that violates applicable laws or regulations</li>
                        <li>Resell, sublicense, or commercially exploit the Services without our written permission</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>5. Meta Platform Compliance</h2>
                    <p>
                        AutoDM integrates with Instagram and Facebook through Meta&apos;s official Graph APIs. By using
                        the Services, you independently agree to comply with all applicable Meta policies, including:
                    </p>
                    <ul>
                        <li><a href="https://www.facebook.com/legal/terms" target="_blank" rel="noopener noreferrer">Meta Terms of Service</a></li>
                        <li><a href="https://help.instagram.com/581066165581870" target="_blank" rel="noopener noreferrer">Instagram Terms of Use</a></li>
                        <li><a href="https://help.instagram.com/477434105621119" target="_blank" rel="noopener noreferrer">Instagram Community Guidelines</a></li>
                        <li><a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer">Meta Platform Terms</a></li>
                        <li><a href="https://developers.facebook.com/devpolicy/" target="_blank" rel="noopener noreferrer">Meta Developer Policies</a></li>
                        <li><a href="https://www.facebook.com/policies/other-policies/messaging" target="_blank" rel="noopener noreferrer">Meta Messaging Policy</a></li>
                    </ul>
                    <p>
                        AutoDM uses the following Meta API permissions and webhook subscriptions to deliver the service.
                        You authorise us to request these permissions on your behalf during the OAuth flow:
                    </p>
                    <ul>
                        <li><strong>Instagram Login:</strong> <code>instagram_business_basic</code>, <code>instagram_business_manage_messages</code>, <code>instagram_business_manage_comments</code></li>
                        <li><strong>Facebook Login:</strong> <code>public_profile</code>, <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_manage_metadata</code>, <code>pages_messaging</code></li>
                        <li><strong>Webhook subscriptions:</strong> <code>comments</code>, <code>messages</code>, <code>mentions</code></li>
                    </ul>
                    <p>
                        A detailed explanation of why each permission is needed is provided in our{' '}
                        <Link href="/privacy#section-5">Privacy Policy, Section 5</Link>.
                    </p>
                    <p>
                        We are not responsible for any actions taken by Meta on your account as a result of your use
                        of automation tools, including but not limited to rate limiting, temporary restrictions, reduced
                        reach, or account suspension by Meta. You are solely responsible for ensuring your use of
                        AutoDM complies with Meta&apos;s current policies, which may change without notice.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>6. Plans &amp; Usage Limits</h2>

                    <p><strong>Free Plan</strong> — included at no cost with every account:</p>
                    <ul>
                        <li>Up to 3,000 automated DMs per calendar month (resets on the 1st of each month)</li>
                        <li>All four DM types: Button Template (image card + CTA), Message Template, Quick Reply chips, Multi-CTA</li>
                        <li>All trigger types: keywords, all comments, emojis only, @mentions</li>
                        <li>Carousel slides (up to 3 slides per automation)</li>
                        <li>Global Triggers — account-wide keyword automations</li>
                        <li>Automation scheduling (start time and expiry date)</li>
                        <li>Auto-reply to triggering comment</li>
                        <li>Send delay (randomised humanisation)</li>
                        <li>Excess DM Queue (handles viral spikes beyond rate limits)</li>
                        <li>SendBack — automatic retry of failed DMs</li>
                        <li>Welcome Openers (inbox quick-reply buttons)</li>
                        <li>Story Mention Auto-DM</li>
                        <li>Real-time analytics dashboard and DM sent log</li>
                        <li>Link click count and CTR % in the posts table</li>
                        <li>Usage limit alerts (email + webhook)</li>
                        <li>Instagram Posts &amp; Reels, Stories, and Facebook Page support</li>
                        <li>Email support</li>
                    </ul>

                    <p><strong>Pro Plan</strong> (paid monthly subscription, ₹299/month) — everything in Free, plus:</p>
                    <ul>
                        <li>Unlimited DMs per month</li>
                        <li>Follow Gate — send a link only after the user verifies they have followed your account</li>
                        <li>Email Collector — capture leads by asking commenters for their email in a DM reply</li>
                        <li>Save &amp; load reusable DM templates</li>
                        <li>Unlimited carousel slides</li>
                        <li>A/B message testing with automatic winner detection</li>
                        <li>Send DMs to previous comments (backfill existing commenters)</li>
                        <li>Multi-step Flow Automation — send sequential follow-up DMs at configurable delays</li>
                        <li>Upsell follow-up DMs — automatically re-message users who received but did not click your link</li>
                        <li>Full click analytics dashboard — charts, per-link breakdown, and A/B performance</li>
                        <li>Email Leads list with CSV export</li>
                        <li>Priority support</li>
                    </ul>

                    <p>
                        New users receive a <strong>30-day free Pro trial</strong> automatically upon connecting their
                        first Instagram account. No credit card is required to start the trial.
                    </p>
                    <p>
                        We reserve the right to modify plan limits and features with 30 days&apos; prior notice to active
                        subscribers. Current pricing and features are listed on our{' '}
                        <Link href="/pricing">Pricing page</Link>.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>7. Payments &amp; Subscriptions</h2>
                    <p>
                        Paid plans are billed monthly. Payments are processed securely by <strong>Cashfree</strong>.
                        We accept UPI (GPay, PhonePe, Paytm), debit/credit cards (Visa, Mastercard, RuPay), and
                        net banking. We never store your payment card details.
                    </p>
                    <ul>
                        <li>Subscriptions renew automatically each month unless cancelled before the renewal date</li>
                        <li>You may cancel at any time from your account settings. You retain Pro access until the end of the current billing period</li>
                        <li>We do not issue refunds for partially used billing periods, except where required by applicable law</li>
                        <li>Failed payments may result in downgrade to the Free plan</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2>8. Data Ownership &amp; Intellectual Property</h2>
                    <p>
                        The Services, including all software, design, branding, features, and functionality, are owned
                        by AutoDM and are protected by applicable intellectual property laws. You may not copy, modify,
                        distribute, sell, sublicense, or create derivative works from any part of the Services without
                        our prior written consent.
                    </p>
                    <p>
                        You retain full ownership of all content you create — including your posts, DM messages, links,
                        and captions — that you configure or manage using the Services. We claim no ownership over
                        your social media content or intellectual property.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>9. Account Disconnection &amp; Deletion</h2>
                    <p><strong>Disconnecting a social account (partial):</strong></p>
                    <ul>
                        <li>Immediately revokes AutoDM&apos;s OAuth access to that platform</li>
                        <li>Scrubs your OAuth access tokens from our database</li>
                        <li>Deletes your synced posts from our database (required by Meta Platform Terms)</li>
                        <li>Pauses all active automations for that account</li>
                        <li>Preserves your automation configurations so you can reconnect without losing your setup</li>
                    </ul>
                    <p><strong>Full account deletion (irreversible):</strong></p>
                    <ul>
                        <li>Permanently removes all your personal information from our databases</li>
                        <li>Deletes all connected accounts, synced posts, automations, DM logs, analytics, click tracking data, email leads, and payment records</li>
                        <li>Revokes all social account API access</li>
                        <li>Cannot be undone — you would need to create a new account to use AutoDM again</li>
                    </ul>
                    <p>
                        You can delete your account from Settings → Account → Delete Account in the dashboard.
                        Alternatively, contact us at <a href="mailto:support@autodm.pro">support@autodm.pro</a>.
                        We will process deletion requests within 30 days.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>10. Suspension &amp; Termination</h2>
                    <p>We reserve the right to suspend or terminate your account, with or without notice, if:</p>
                    <ul>
                        <li>You violate these Terms or Meta&apos;s Platform Policies</li>
                        <li>You engage in spam, harassment, phishing, or other prohibited activities</li>
                        <li>Your Meta API access is revoked or restricted by Meta</li>
                        <li>We detect abuse of the service, excessive resource consumption, or attempts to circumvent rate limits</li>
                        <li>We are required to do so by law, court order, or regulatory authority</li>
                    </ul>
                    <p>
                        Where possible, we will provide advance notice and a reason for suspension via email.
                        Upon termination, your right to use the Services ceases immediately.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>11. Disclaimers</h2>
                    <p>
                        The Services are provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without warranties
                        of any kind, either express or implied, including but not limited to warranties of
                        merchantability, fitness for a particular purpose, or non-infringement.
                    </p>
                    <p>
                        We do not warrant that the Services will be uninterrupted, error-free, completely secure,
                        or that all DMs will be successfully delivered. DM delivery depends on Meta&apos;s API
                        availability, rate limits, and the recipient account&apos;s messaging settings.
                    </p>
                    <p>
                        We are not responsible for any actions taken by Meta on your account as a result of using
                        automation tools. This includes but is not limited to rate limiting, temporary restrictions,
                        reduced content reach, or account suspension imposed by Meta.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>12. Limitation of Liability</h2>
                    <p>
                        To the maximum extent permitted by applicable law, AutoDM and its officers, directors,
                        employees, and agents shall not be liable for any indirect, incidental, special, consequential,
                        punitive, or exemplary damages, including but not limited to loss of profits, revenue, data,
                        goodwill, or business opportunities, arising from your use of or inability to use the Services.
                    </p>
                    <p>
                        Our total cumulative liability for any claims arising out of or relating to the Services shall
                        not exceed the total amount you paid us in the 12 calendar months preceding the claim, or
                        ₹0 for users on the Free plan.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>13. Changes to Terms</h2>
                    <p>
                        We reserve the right to modify these Terms at any time. If we make material changes, we will
                        notify you by posting the updated Terms on our website with a new &quot;Last updated&quot; date and,
                        where possible, by sending a notification to your registered email address. Your continued use
                        of the Services after any such changes constitutes your acceptance of the revised Terms. If you
                        do not agree to the revised Terms, you must stop using the Services.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>14. Governing Law</h2>
                    <p>
                        These Terms shall be governed by and construed in accordance with the laws of India,
                        without regard to its conflict of law principles. Any disputes arising from or relating
                        to these Terms or the Services shall be subject to the exclusive jurisdiction of the
                        courts of India.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2>15. Contact Us</h2>
                    <p>If you have questions, concerns, or feedback about these Terms, please contact us:</p>
                    <p>
                        <strong>AutoDM</strong><br />
                        Email: <a href="mailto:support@autodm.pro">support@autodm.pro</a><br />
                        Website: <a href="https://autodm.pro" target="_blank" rel="noopener noreferrer">autodm.pro</a>
                    </p>
                    <p>We aim to respond to all inquiries within 5 business days.</p>
                </section>
            </div>

            {/* Footer */}
            <footer className={styles.legalFooter}>
                <p>© 2026 AutoDM. All rights reserved. | <Link href="/privacy">Privacy Policy</Link> | <Link href="/">Home</Link></p>
            </footer>
        </div>
    );
}
