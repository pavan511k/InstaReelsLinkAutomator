import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import styles from './legal.module.css';

export const metadata = {
    title: 'Privacy Policy — AutoDM',
    description: 'AutoDM Privacy Policy — how we collect, use, and protect your personal information.',
};

export default function PrivacyPolicy() {
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
                        <Link href="/terms">Terms of Service</Link>
                        <Link href="/login">Log In</Link>
                        <Link href="/signup">Sign Up</Link>
                    </div>
                </div>
            </header>

            <div className={styles.container}>
                <h1>Privacy Policy</h1>
                <span className={styles.updated}>Last updated: March 1, 2026</span>

                <p className={styles.intro}>
                    This Privacy Notice for AutoDM (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), describes how
                    and why we might access, collect, store, use, and/or share (&quot;process&quot;) your personal
                    information when you use our services (&quot;Services&quot;), including when you visit our website
                    or any application of ours that links to this Privacy Notice. If you do not agree with our policies
                    and practices, please do not use our Services.
                </p>

                {/* Summary Box */}
                <div className={styles.summaryBox}>
                    <h2>Summary of Key Points</h2>
                    <p><strong>What personal information do we process?</strong> We collect email addresses, usernames, and social media account data when you connect your Instagram or Facebook accounts.</p>
                    <p><strong>Do we process any sensitive personal information?</strong> We do not process sensitive personal information.</p>
                    <p><strong>Do we collect any information from third parties?</strong> We collect data from Meta (Instagram/Facebook) APIs only when you explicitly authorize us.</p>
                    <p><strong>How do we keep your information safe?</strong> We use encrypted storage, HTTPS, and Row Level Security to protect your data.</p>
                    <p><strong>What are your rights?</strong> You can access, correct, or delete your personal data at any time by disconnecting your accounts or contacting us.</p>
                </div>

                {/* Table of Contents */}
                <nav className={styles.toc}>
                    <h2>Table of Contents</h2>
                    <ol>
                        <li><a href="#section-1">What Information Do We Collect?</a></li>
                        <li><a href="#section-2">How Do We Process Your Information?</a></li>
                        <li><a href="#section-3">What Legal Bases Do We Rely On?</a></li>
                        <li><a href="#section-4">When and With Whom Do We Share Your Information?</a></li>
                        <li><a href="#section-5">How Do We Handle Your Social Logins?</a></li>
                        <li><a href="#section-6">How Long Do We Keep Your Information?</a></li>
                        <li><a href="#section-7">How Do We Keep Your Information Safe?</a></li>
                        <li><a href="#section-8">Do We Collect Information From Minors?</a></li>
                        <li><a href="#section-9">What Are Your Privacy Rights?</a></li>
                        <li><a href="#section-10">Do We Make Updates To This Notice?</a></li>
                        <li><a href="#section-11">How Can You Contact Us?</a></li>
                        <li><a href="#section-12">How Can You Review, Update, or Delete Your Data?</a></li>
                    </ol>
                </nav>

                {/* Section 1 */}
                <section id="section-1" className={styles.section}>
                    <h2>1. What Information Do We Collect?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We collect personal information that you provide to us and information received from your social media accounts when you connect them.</p>

                    <h3>Personal Information You Provide</h3>
                    <p>We collect personal information that you voluntarily provide when you register on the Services. This may include:</p>
                    <ul>
                        <li>Email addresses</li>
                        <li>Passwords (stored encrypted, never in plain text)</li>
                        <li>Usernames and account preferences</li>
                    </ul>

                    <h3>Social Media Account Data</h3>
                    <p>When you connect your Instagram or Facebook account to AutoDM, we receive and store:</p>
                    <ul>
                        <li>Your Instagram username and profile picture URL</li>
                        <li>Your Instagram Business Account ID</li>
                        <li>Your Facebook Page name, ID, and access token</li>
                        <li>Your posts, reels, and stories metadata (captions, timestamps, media URLs, permalinks)</li>
                        <li>OAuth access tokens (used to interact with Meta APIs on your behalf)</li>
                    </ul>

                    <h3>Information Automatically Collected</h3>
                    <p>When you visit our Services, we may automatically collect certain information such as your IP address, browser type, operating system, and usage patterns. This information is used to maintain the security and performance of our Services.</p>
                </section>

                {/* Section 2 */}
                <section id="section-2" className={styles.section}>
                    <h2>2. How Do We Process Your Information?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.</p>
                    <p>We process your personal information for the following purposes:</p>
                    <ul>
                        <li><strong>Account management:</strong> To create and manage your AutoDM account</li>
                        <li><strong>Service delivery:</strong> To fetch your posts from Instagram/Facebook and set up DM automations</li>
                        <li><strong>DM automation:</strong> To send automated Direct Messages on your behalf when users comment on your content</li>
                        <li><strong>Analytics:</strong> To provide you with performance metrics (messages sent, link clicks, open rates)</li>
                        <li><strong>Communication:</strong> To send you account verification emails and service updates</li>
                        <li><strong>Security:</strong> To protect our Services and prevent fraud</li>
                    </ul>
                </section>

                {/* Section 3 */}
                <section id="section-3" className={styles.section}>
                    <h2>3. What Legal Bases Do We Rely On?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We only process your personal information when we have a valid legal reason to do so.</p>
                    <p>We may rely on the following legal bases:</p>
                    <ul>
                        <li><strong>Consent:</strong> You have given us explicit permission to connect your social media accounts and process your data</li>
                        <li><strong>Contractual Obligation:</strong> Processing is necessary to fulfill our service agreement with you</li>
                        <li><strong>Legitimate Interests:</strong> Processing is necessary for our legitimate business interests (e.g., improving our Services, preventing fraud)</li>
                        <li><strong>Legal Obligations:</strong> Processing is necessary for compliance with applicable laws</li>
                    </ul>
                    <p>You can withdraw your consent at any time by disconnecting your social accounts from the dashboard or by contacting us.</p>
                </section>

                {/* Section 4 */}
                <section id="section-4" className={styles.section}>
                    <h2>4. When and With Whom Do We Share Your Information?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
                    <p>We may share your information only in the following situations:</p>
                    <ul>
                        <li><strong>Meta APIs:</strong> We send data to Instagram/Facebook APIs to deliver DMs and fetch your content on your behalf</li>
                        <li><strong>Service Providers:</strong> We use Supabase for database hosting and Vercel for application hosting</li>
                        <li><strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or governmental authority</li>
                        <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets</li>
                    </ul>
                </section>

                {/* Section 5 */}
                <section id="section-5" className={styles.section}>
                    <h2>5. How Do We Handle Your Social Logins?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> When you connect your Instagram or Facebook account, we receive certain profile information through Meta&apos;s OAuth APIs.</p>
                    <p>
                        AutoDM allows you to connect your Instagram Business Account and/or Facebook Page using Meta&apos;s
                        official OAuth flow. When you authorize the connection, we receive an access token and basic profile
                        information (username, profile picture, page name).
                    </p>
                    <p>
                        We use this information only to provide the DM automation service as described in this Privacy Notice.
                        We do not control, and are not responsible for, other uses of your personal information by Meta.
                        We recommend reviewing Meta&apos;s <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                    </p>
                </section>

                {/* Section 6 */}
                <section id="section-6" className={styles.section}>
                    <h2>6. How Long Do We Keep Your Information?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We keep your information only as long as necessary to fulfill the purposes outlined in this Privacy Notice.</p>
                    <p>
                        We retain your personal information for as long as you maintain an active account with us.
                        When you disconnect your social accounts, we delete the associated tokens and synced post data.
                        When you delete your account entirely, we remove all your personal information from our active databases.
                    </p>
                    <p>
                        Access tokens are stored securely and automatically expire after 60 days, at which point
                        you&apos;ll need to reconnect your accounts.
                    </p>
                </section>

                {/* Section 7 */}
                <section id="section-7" className={styles.section}>
                    <h2>7. How Do We Keep Your Information Safe?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We implement appropriate security measures to protect your personal information.</p>
                    <p>We have implemented the following security measures:</p>
                    <ul>
                        <li>All data transmission uses HTTPS encryption</li>
                        <li>Passwords are hashed using industry-standard algorithms (never stored in plain text)</li>
                        <li>Access tokens are stored securely in our database</li>
                        <li>Row Level Security (RLS) ensures users can only access their own data</li>
                        <li>Our database is hosted on Supabase (powered by AWS) in a secure region</li>
                    </ul>
                    <p>
                        However, no electronic transmission over the Internet can be guaranteed to be 100% secure.
                        While we strive to protect your personal information, we cannot guarantee absolute security.
                    </p>
                </section>

                {/* Section 8 */}
                <section id="section-8" className={styles.section}>
                    <h2>8. Do We Collect Information From Minors?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We do not knowingly collect data from or market to children under 18.</p>
                    <p>
                        We do not knowingly collect, solicit data from, or market to children under 18 years of age.
                        By using the Services, you represent that you are at least 18 years of age. If we learn that
                        personal information from users less than 18 years of age has been collected, we will deactivate
                        the account and take reasonable measures to delete such data.
                    </p>
                </section>

                {/* Section 9 */}
                <section id="section-9" className={styles.section}>
                    <h2>9. What Are Your Privacy Rights?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> You have rights to access, correct, and delete your personal information at any time.</p>
                    <p>Depending on your location, you may have the following rights:</p>
                    <ul>
                        <li><strong>Right to access:</strong> Request a copy of the personal information we hold about you</li>
                        <li><strong>Right to rectification:</strong> Request correction of inaccurate personal data</li>
                        <li><strong>Right to erasure:</strong> Request deletion of your personal data</li>
                        <li><strong>Right to withdraw consent:</strong> Disconnect your social accounts at any time</li>
                        <li><strong>Right to data portability:</strong> Request your data in a portable format</li>
                        <li><strong>Right to object:</strong> Object to the processing of your personal data</li>
                    </ul>
                    <p>
                        To exercise these rights, disconnect your accounts from the AutoDM dashboard or contact us
                        at <a href="mailto:support@autodm.app">support@autodm.app</a>.
                    </p>
                </section>

                {/* Section 10 */}
                <section id="section-10" className={styles.section}>
                    <h2>10. Do We Make Updates To This Notice?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> Yes, we will update this notice as necessary to stay compliant with relevant laws.</p>
                    <p>
                        We may update this Privacy Notice from time to time. The updated version will be indicated
                        by an updated &quot;Last updated&quot; date. If we make material changes, we may notify you by
                        prominently posting a notice or by directly sending you a notification.
                    </p>
                </section>

                {/* Section 11 */}
                <section id="section-11" className={styles.section}>
                    <h2>11. How Can You Contact Us?</h2>
                    <p>If you have questions or comments about this Privacy Notice, you may contact us at:</p>
                    <p>
                        <strong>AutoDM</strong><br />
                        Email: <a href="mailto:support@autodm.app">support@autodm.app</a>
                    </p>
                </section>

                {/* Section 12 */}
                <section id="section-12" className={styles.section}>
                    <h2>12. How Can You Review, Update, or Delete Your Data?</h2>
                    <p>
                        You can review, update, or delete your personal information at any time by:
                    </p>
                    <ul>
                        <li>Disconnecting your Instagram/Facebook account from the AutoDM dashboard</li>
                        <li>Contacting us at <a href="mailto:support@autodm.app">support@autodm.app</a> to request account deletion</li>
                    </ul>
                    <p>
                        Upon account deletion, we will remove all your personal information from our active databases.
                        Some information may be retained in backup archives for a limited period as required by law.
                    </p>
                </section>
            </div>

            {/* Footer */}
            <footer className={styles.legalFooter}>
                <p>© 2026 AutoDM. All rights reserved. | <Link href="/terms">Terms of Service</Link></p>
            </footer>
        </div>
    );
}
