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
                    at <a href="https://insta-reels-link-automator.vercel.app" target="_blank" rel="noopener noreferrer">insta-reels-link-automator.vercel.app</a> or
                    any application of ours that links to this Privacy Notice. If you do not agree with our policies
                    and practices, please do not use our Services.
                </p>

                {/* Summary Box */}
                <div className={styles.summaryBox}>
                    <h2>Summary of Key Points</h2>
                    <p><strong>What personal information do we process?</strong> We collect email addresses, usernames, and social media account data when you connect your Instagram or Facebook accounts.</p>
                    <p><strong>Do we process any sensitive personal information?</strong> We do not process sensitive personal information.</p>
                    <p><strong>Do we collect any information from third parties?</strong> We collect data from Meta (Instagram/Facebook) APIs only when you explicitly authorize us via OAuth.</p>
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
                        <li><a href="#section-10">Meta Platform Data Use</a></li>
                        <li><a href="#section-11">Data Deletion Requests</a></li>
                        <li><a href="#section-12">Do We Make Updates To This Notice?</a></li>
                        <li><a href="#section-13">How Can You Contact Us?</a></li>
                        <li><a href="#section-14">How Can You Review, Update, or Delete Your Data?</a></li>
                    </ol>
                </nav>

                {/* Section 1 */}
                <section id="section-1" className={styles.section}>
                    <h2>1. What Information Do We Collect?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We collect personal information that you provide to us and information received from your social media accounts when you connect them.</p>

                    <h3>Personal Information You Provide</h3>
                    <p>We collect personal information that you voluntarily provide when you register on the Services. This includes:</p>
                    <ul>
                        <li>Email address (used for account creation and login)</li>
                        <li>Password (stored encrypted using Supabase Auth, never in plain text)</li>
                    </ul>

                    <h3>Social Media Account Data</h3>
                    <p>When you connect your Instagram or Facebook account to AutoDM via Meta&apos;s OAuth flow, we receive and store:</p>
                    <ul>
                        <li>Your Instagram username and profile picture URL</li>
                        <li>Your Instagram Business Account ID</li>
                        <li>Your Facebook Page name, ID, and Page access token</li>
                        <li>Your Meta user ID</li>
                        <li>Your posts, reels, and stories metadata (captions, timestamps, media URLs, thumbnails, permalinks)</li>
                        <li>OAuth access tokens (used to interact with Meta APIs on your behalf)</li>
                        <li>Granted permission scopes</li>
                    </ul>

                    <h3>Information We Do NOT Collect</h3>
                    <ul>
                        <li>We do not read or store the content of your private Direct Messages</li>
                        <li>We do not collect your followers or following lists</li>
                        <li>We do not collect payment or financial information (the service is currently free)</li>
                        <li>We use essential cookies only for authentication and session management (via Supabase Auth). We do not use third-party analytics trackers or advertising cookies</li>
                    </ul>
                </section>

                {/* Section 2 */}
                <section id="section-2" className={styles.section}>
                    <h2>2. How Do We Process Your Information?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security, and to comply with law.</p>
                    <p>We process your personal information for the following purposes:</p>
                    <ul>
                        <li><strong>Account management:</strong> To create and manage your AutoDM account via email/password authentication</li>
                        <li><strong>Social account connection:</strong> To connect your Instagram Business Account and/or Facebook Page using Meta&apos;s official OAuth</li>
                        <li><strong>Post synchronization:</strong> To fetch and display your posts, reels, and stories from Instagram and Facebook</li>
                        <li><strong>DM automation:</strong> To send automated Direct Messages on your behalf when users comment on your content with specific trigger keywords</li>
                        <li><strong>Analytics:</strong> To provide you with performance metrics (messages sent, link clicks, open rates, CTR)</li>
                        <li><strong>Communication:</strong> To send you account verification emails via Supabase Auth</li>
                        <li><strong>Security:</strong> To protect our Services using Row Level Security and encrypted connections</li>
                    </ul>
                </section>

                {/* Section 3 */}
                <section id="section-3" className={styles.section}>
                    <h2>3. What Legal Bases Do We Rely On?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We only process your personal information when we have a valid legal reason to do so.</p>
                    <p>We may rely on the following legal bases:</p>
                    <ul>
                        <li><strong>Consent:</strong> You have given us explicit permission to connect your social media accounts and process your data through Meta&apos;s OAuth consent screen</li>
                        <li><strong>Contractual Obligation:</strong> Processing is necessary to fulfill our service agreement with you</li>
                        <li><strong>Legitimate Interests:</strong> Processing is necessary for our legitimate business interests (e.g., improving our Services, preventing fraud)</li>
                        <li><strong>Legal Obligations:</strong> Processing is necessary for compliance with applicable laws</li>
                    </ul>
                    <p>You can withdraw your consent at any time by disconnecting your social accounts from the dashboard. Disconnecting preserves your automation settings but revokes our API access to your social accounts.</p>
                </section>

                {/* Section 4 */}
                <section id="section-4" className={styles.section}>
                    <h2>4. When and With Whom Do We Share Your Information?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
                    <p>We may share your information only in the following situations:</p>
                    <ul>
                        <li><strong>Meta APIs:</strong> We send data to Instagram/Facebook APIs to deliver DMs and fetch your content on your behalf. This is core to the service functionality.</li>
                        <li><strong>Supabase (Database):</strong> Your data is stored in Supabase (powered by AWS) which provides database hosting with Row Level Security</li>
                        <li><strong>Vercel (Hosting):</strong> Our application is hosted on Vercel which processes web requests</li>
                        <li><strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or governmental authority</li>
                        <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets</li>
                    </ul>
                    <p>We do not share your data with any advertising networks, data brokers, or other third-party services.</p>
                </section>

                {/* Section 5 */}
                <section id="section-5" className={styles.section}>
                    <h2>5. How Do We Handle Your Social Logins?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> When you connect your Instagram or Facebook account, we receive certain profile information through Meta&apos;s OAuth APIs.</p>
                    <p>
                        AutoDM allows you to connect your Instagram Business Account and/or Facebook Page using Meta&apos;s
                        official OAuth flow (Facebook Login). When you authorize the connection, you are redirected to
                        Facebook&apos;s login screen where you grant specific permissions. We then receive an access token
                        and basic profile information (username, profile picture, page name).
                    </p>
                    <p>
                        We request the following permission scopes depending on your connection type:
                    </p>
                    <ul>
                        <li><code>instagram_basic</code> — Read your Instagram profile and media</li>
                        <li><code>instagram_manage_comments</code> — Monitor comments on your posts</li>
                        <li><code>instagram_manage_messages</code> — Send DMs on your behalf</li>
                        <li><code>pages_show_list</code> — List your Facebook Pages</li>
                        <li><code>pages_read_engagement</code> — Read your Page posts</li>
                        <li><code>pages_manage_metadata</code> — Manage Page settings</li>
                        <li><code>pages_messaging</code> — Send messages via your Page</li>
                    </ul>
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
                    </p>
                    <ul>
                        <li><strong>When you disconnect a social account:</strong> Your OAuth access token is revoked, but your synced posts and automation settings are preserved so you can reconnect later without losing your setup.</li>
                        <li><strong>When you request full account deletion:</strong> We remove all your personal information, connected accounts, synced posts, automations, and analytics data from our databases.</li>
                        <li><strong>Access tokens:</strong> Stored securely and automatically expire after 60 days, at which point you will need to reconnect your accounts.</li>
                    </ul>
                </section>

                {/* Section 7 */}
                <section id="section-7" className={styles.section}>
                    <h2>7. How Do We Keep Your Information Safe?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We implement appropriate security measures to protect your personal information.</p>
                    <p>We have implemented the following security measures:</p>
                    <ul>
                        <li>All data transmission uses HTTPS encryption</li>
                        <li>Passwords are hashed using Supabase Auth (bcrypt, never stored in plain text)</li>
                        <li>OAuth access tokens are stored in a secured database</li>
                        <li>Row Level Security (RLS) policies ensure users can only access their own data</li>
                        <li>Our database is hosted on Supabase (powered by AWS)</li>
                        <li>Our application is hosted on Vercel with automatic HTTPS</li>
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
                        <li><strong>Right to withdraw consent:</strong> Disconnect your social accounts at any time from the dashboard</li>
                        <li><strong>Right to data portability:</strong> Request your data in a portable format</li>
                        <li><strong>Right to object:</strong> Object to the processing of your personal data</li>
                    </ul>
                    <p>
                        To exercise these rights, disconnect your accounts from the AutoDM dashboard or contact us
                        at <a href="mailto:support@autodm.com">support@autodm.com</a>.
                    </p>
                </section>

                {/* Section 10 — NEW: Meta Platform Data Use */}
                <section id="section-10" className={styles.section}>
                    <h2>10. Meta Platform Data Use</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We comply with Meta&apos;s Platform Terms and use your data only as permitted.</p>
                    <p>AutoDM accesses Meta (Instagram and Facebook) data through official Graph APIs. We commit to the following:</p>
                    <ul>
                        <li>We only access data that you have explicitly authorized through the OAuth consent flow</li>
                        <li>We do not sell, license, or purchase any data obtained from Meta APIs</li>
                        <li>We do not transfer Meta data to any data broker, advertising network, or third-party monetization service</li>
                        <li>We do not use Meta data for surveillance, discriminatory profiling, or any purpose unrelated to providing the AutoDM service</li>
                        <li>We will delete all data received from Meta APIs when requested by the user or when instructed by Meta</li>
                        <li>We keep Meta data secure using encryption and access controls as described in Section 7</li>
                    </ul>
                    <p>
                        For more information about how Meta handles your data, please review the{' '}
                        <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer">Meta Platform Terms</a> and{' '}
                        <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Meta Privacy Policy</a>.
                    </p>
                </section>

                {/* Section 11 — NEW: Data Deletion Requests */}
                <section id="section-11" className={styles.section}>
                    <h2>11. Data Deletion Requests</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> You can request complete deletion of your data at any time.</p>
                    <p>
                        In compliance with Meta&apos;s requirements, we provide a data deletion mechanism. You can request
                        deletion of all your data through:
                    </p>
                    <ul>
                        <li><strong>Dashboard:</strong> Disconnect your accounts and contact us to request full account deletion</li>
                        <li><strong>Email:</strong> Send a deletion request to <a href="mailto:support@autodm.com">support@autodm.com</a></li>
                        <li><strong>Meta callback:</strong> We provide a data deletion callback URL to Meta that automatically processes deletion requests initiated from Facebook/Instagram settings</li>
                    </ul>
                    <p>
                        Upon receiving a data deletion request, we will delete all associated data within 30 days, including:
                        connected account records, synced posts, automation settings, analytics data, and access tokens.
                        We will confirm deletion via email.
                    </p>
                </section>

                {/* Section 12 */}
                <section id="section-12" className={styles.section}>
                    <h2>12. Do We Make Updates To This Notice?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> Yes, we will update this notice as necessary to stay compliant with relevant laws.</p>
                    <p>
                        We may update this Privacy Notice from time to time. The updated version will be indicated
                        by an updated &quot;Last updated&quot; date. If we make material changes, we may notify you by
                        prominently posting a notice or by directly sending you a notification.
                    </p>
                </section>

                {/* Section 13 */}
                <section id="section-13" className={styles.section}>
                    <h2>13. How Can You Contact Us?</h2>
                    <p>If you have questions or comments about this Privacy Notice, you may contact us at:</p>
                    <p>
                        <strong>AutoDM</strong><br />
                        Email: <a href="mailto:support@autodm.com">support@autodm.com</a>
                    </p>
                </section>

                {/* Section 14 */}
                <section id="section-14" className={styles.section}>
                    <h2>14. How Can You Review, Update, or Delete Your Data?</h2>
                    <p>
                        You can review, update, or delete your personal information at any time by:
                    </p>
                    <ul>
                        <li>Disconnecting your Instagram/Facebook account from the AutoDM dashboard (preserves your automation settings)</li>
                        <li>Contacting us at <a href="mailto:vangala.hanusree@gmail.com">vangala.hanusree@gmail.com</a> to request full account and data deletion</li>
                        <li>Revoking access from Facebook/Instagram settings directly (triggers our data deletion callback)</li>
                    </ul>
                    <p>
                        Upon full account deletion, we will remove all your personal information from our databases.
                        Some information may be retained in encrypted backup archives for a limited period as required by law.
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
