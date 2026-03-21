import Link from 'next/link';
import Image from 'next/image';
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
                        <div className={styles.logoMark}>
                            <Image src="/logo.png" alt="AutoDM" width={18} height={18} />
                        </div>
                        <span className={styles.logoText}>auto<span className={styles.logoDM}>dm</span></span>
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
                <span className={styles.updated}>Last updated: March 21, 2026</span>

                <p className={styles.intro}>
                    This Privacy Notice for AutoDM (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) describes how
                    and why we might access, collect, store, use, and/or share (&quot;process&quot;) your personal
                    information when you use our services (&quot;Services&quot;), including when you visit our website
                    at <a href="https://autodm.pro" target="_blank" rel="noopener noreferrer">autodm.pro</a> or
                    any application of ours that links to this Privacy Notice. If you do not agree with our policies
                    and practices, please do not use our Services.
                </p>

                {/* Summary Box */}
                <div className={styles.summaryBox}>
                    <h2>Summary of Key Points</h2>
                    <p><strong>What personal information do we process?</strong> We collect your email address, Instagram/Facebook profile information, and social media account data when you connect your accounts via Meta's official OAuth.</p>
                    <p><strong>Do we process any sensitive personal information?</strong> No. We do not process sensitive personal information such as health data, financial records, or government IDs.</p>
                    <p><strong>Do we collect any information from third parties?</strong> We receive data from Meta (Instagram/Facebook) APIs only when you explicitly authorize us via the OAuth consent flow.</p>
                    <p><strong>How do we keep your information safe?</strong> We use HTTPS, encrypted storage, Row Level Security (RLS), and Supabase Auth to protect your data.</p>
                    <p><strong>What are your rights?</strong> You can access, correct, or delete your personal data at any time by disconnecting your accounts from the dashboard or contacting us at <a href="mailto:support@autodm.pro">support@autodm.pro</a>.</p>
                </div>

                {/* Table of Contents */}
                <nav className={styles.toc}>
                    <h2>Table of Contents</h2>
                    <ol>
                        <li><a href="#section-1">What Information Do We Collect?</a></li>
                        <li><a href="#section-2">How Do We Process Your Information?</a></li>
                        <li><a href="#section-3">What Legal Bases Do We Rely On?</a></li>
                        <li><a href="#section-4">When and With Whom Do We Share Your Information?</a></li>
                        <li><a href="#section-5">Meta Platform Permissions We Request</a></li>
                        <li><a href="#section-6">How Long Do We Keep Your Information?</a></li>
                        <li><a href="#section-7">How Do We Keep Your Information Safe?</a></li>
                        <li><a href="#section-8">Do We Collect Information From Minors?</a></li>
                        <li><a href="#section-9">What Are Your Privacy Rights?</a></li>
                        <li><a href="#section-10">Meta Platform Data Use Policy</a></li>
                        <li><a href="#section-11">Data Deletion Requests</a></li>
                        <li><a href="#section-12">Do We Make Updates To This Notice?</a></li>
                        <li><a href="#section-13">How Can You Contact Us?</a></li>
                        <li><a href="#section-14">How Can You Review, Update, or Delete Your Data?</a></li>
                    </ol>
                </nav>

                {/* Section 1 */}
                <section id="section-1" className={styles.section}>
                    <h2>1. What Information Do We Collect?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We collect information you provide directly and information received from your Instagram and Facebook accounts when you connect them.</p>

                    <h3>Personal Information You Provide Directly</h3>
                    <p>When you register for AutoDM, we collect:</p>
                    <ul>
                        <li><strong>Email address</strong> — used for account creation, login, and service communications</li>
                        <li><strong>Password</strong> — stored encrypted using Supabase Auth (bcrypt hashing); never stored or transmitted in plain text</li>
                        <li><strong>Full name</strong> — optionally provided during signup for personalised communications</li>
                    </ul>

                    <h3>Social Media Account Data (via Meta OAuth)</h3>
                    <p>When you connect your Instagram Business Account and/or Facebook Page via Meta's official OAuth consent flow, we receive and store the following data — but only after you explicitly grant permission on Meta's consent screen:</p>
                    <ul>
                        <li>Instagram username and profile picture URL</li>
                        <li>Instagram Business Account ID (used to identify your account in API calls)</li>
                        <li>Facebook Page name, Page ID, and Page access token</li>
                        <li>Meta user ID</li>
                        <li>Posts, Reels, and Stories metadata: captions, timestamps, media URLs, thumbnails, permalink URLs, media type</li>
                        <li>OAuth access tokens (long-lived tokens, valid for 60 days, stored encrypted, used to interact with Meta APIs on your behalf)</li>
                        <li>Granted permission scopes</li>
                        <li>Comment IDs and comment text from users who comment on your posts (used only to match trigger keywords and send the configured automated DM)</li>
                        <li>Instagram user IDs of commenters (used only to send the DM; we do not store commenter profile information)</li>
                    </ul>

                    <h3>Information We Do NOT Collect</h3>
                    <ul>
                        <li>We do not read or store the content of your existing private Direct Message inbox</li>
                        <li>We do not collect or store your followers list or following list</li>
                        <li>We do not collect payment card numbers, bank details, or UPI PINs — payments are processed entirely by Cashfree and are never transmitted to or stored on our servers</li>
                        <li>We do not use advertising cookies, third-party trackers, or analytics SDKs (e.g. Google Analytics, Facebook Pixel). We use essential session cookies only, managed by Supabase Auth</li>
                        <li>We do not collect sensitive personal information such as health data, biometric data, racial or ethnic origin, or government identification numbers</li>
                    </ul>
                </section>

                {/* Section 2 */}
                <section id="section-2" className={styles.section}>
                    <h2>2. How Do We Process Your Information?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We process your information to provide and improve the AutoDM service, communicate with you, and comply with legal obligations.</p>
                    <p>We process your personal information for the following specific purposes:</p>
                    <ul>
                        <li><strong>Account management:</strong> To create and manage your AutoDM account using email/password authentication via Supabase Auth</li>
                        <li><strong>Social account connection:</strong> To connect your Instagram Business Account and/or Facebook Page using Meta's official OAuth 2.0 consent flow</li>
                        <li><strong>Post synchronisation:</strong> To fetch and display your posts, reels, and stories from Instagram and Facebook so you can configure automations per post</li>
                        <li><strong>Comment monitoring:</strong> To receive real-time comment events from your posts via Meta webhooks and match them against your configured trigger keywords</li>
                        <li><strong>DM automation:</strong> To send automated Direct Messages on your behalf when a commenter's post matches your configured trigger (keywords, all comments, emojis, mentions)</li>
                        <li><strong>Follow Gate:</strong> To verify that a commenter has followed your account before sending a reward link, using Meta's follower verification API (Pro feature)</li>
                        <li><strong>Email lead capture:</strong> To collect and store email addresses that commenters voluntarily share in reply to your automated DM prompt (Pro feature)</li>
                        <li><strong>Click tracking:</strong> To generate short redirect URLs and count clicks on links sent in automated DMs so you can measure engagement</li>
                        <li><strong>Analytics:</strong> To provide performance metrics including DMs sent, link clicks, click-through rate (CTR), and A/B test results</li>
                        <li><strong>Email communications:</strong> To send account verification emails, trial notifications, and service updates via Supabase Auth and Resend</li>
                        <li><strong>Security and compliance:</strong> To detect and prevent abuse, enforce our Terms of Service, and comply with applicable laws</li>
                    </ul>
                </section>

                {/* Section 3 */}
                <section id="section-3" className={styles.section}>
                    <h2>3. What Legal Bases Do We Rely On?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We process your personal information only when we have a valid legal basis to do so.</p>
                    <ul>
                        <li><strong>Consent:</strong> You explicitly authorise us to access your social media accounts through Meta's OAuth consent screen. You can withdraw consent at any time by disconnecting your accounts from the AutoDM dashboard</li>
                        <li><strong>Contractual Obligation:</strong> Processing is necessary to fulfil the service agreement between you and AutoDM (i.e., to deliver the DM automation service you signed up for)</li>
                        <li><strong>Legitimate Interests:</strong> We process certain data for our legitimate business interests, such as improving our service, preventing fraud, and maintaining service security — provided these interests are not overridden by your rights</li>
                        <li><strong>Legal Obligations:</strong> We may process data to comply with applicable laws, court orders, or regulatory requirements</li>
                    </ul>
                    <p>
                        Withdrawing consent does not affect the lawfulness of processing that occurred before withdrawal.
                        To withdraw consent, disconnect your social accounts from the Settings page in the dashboard.
                    </p>
                </section>

                {/* Section 4 */}
                <section id="section-4" className={styles.section}>
                    <h2>4. When and With Whom Do We Share Your Information?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We do not sell or share your personal information with third parties for marketing purposes. We share data only with the service providers necessary to operate AutoDM.</p>
                    <ul>
                        <li><strong>Meta Platforms (Instagram / Facebook):</strong> We send API requests to Meta's Graph API to deliver DMs, fetch your posts, receive webhook comment events, and verify follows. This is the core function of the service</li>
                        <li><strong>Supabase (Database &amp; Authentication):</strong> Your account data, automation settings, and social account tokens are stored in a Supabase-managed PostgreSQL database hosted on AWS. Supabase provides Row Level Security ensuring only you can access your data</li>
                        <li><strong>Vercel (Application Hosting):</strong> Our Next.js application is deployed on Vercel. Web requests pass through Vercel's infrastructure. Vercel does not store your personal data beyond transient request logs</li>
                        <li><strong>Resend (Email Delivery):</strong> We use Resend to deliver account verification emails and service notifications. Resend receives your email address to deliver these emails</li>
                        <li><strong>Cashfree (Payment Processing):</strong> Cashfree processes subscription payments. We share only the information required to create a payment order (your email address and a generated order ID). We never receive or store your payment card or banking details</li>
                        <li><strong>Legal Requirements:</strong> We may disclose your information if required by law, court order, or government authority, or to protect the rights, property, or safety of AutoDM, our users, or others</li>
                        <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of all or part of our business, user data may be transferred as part of that transaction, subject to the same privacy protections</li>
                    </ul>
                    <p>We do not share your data with advertising networks, data brokers, or any third-party monetisation services.</p>
                </section>

                {/* Section 5 — Meta Permissions */}
                <section id="section-5" className={styles.section}>
                    <h2>5. Meta Platform Permissions We Request</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We request only the minimum permissions necessary to deliver the AutoDM service. Each permission is explained below along with exactly how it is used.</p>
                    <p>
                        AutoDM supports two connection types: <strong>Instagram Login</strong> (for connecting an Instagram Business or Creator account directly)
                        and <strong>Facebook Login</strong> (for connecting a Facebook Page with an associated Instagram Business account).
                    </p>

                    <h3>Instagram Login Permissions</h3>
                    <p>Requested when you connect via Instagram Login:</p>
                    <ul>
                        <li>
                            <code>instagram_business_basic</code><br />
                            <strong>Why we need it:</strong> To read your Instagram Business Account profile information (username, profile picture) and fetch your posts, Reels, and Stories so you can select them for automation configuration. Also used to verify follower status for the Follow Gate feature.
                        </li>
                        <li>
                            <code>instagram_business_manage_messages</code><br />
                            <strong>Why we need it:</strong> To send automated Direct Messages to users who comment on your posts with your configured trigger keywords. This is the core function of AutoDM. We only send DMs to users who have actively engaged with your content.
                        </li>
                        <li>
                            <code>instagram_business_manage_comments</code><br />
                            <strong>Why we need it:</strong> To receive real-time notifications of new comments on your posts via Meta webhooks, and to post automatic reply messages to the triggering comment (e.g., "Check your DMs!"). We read comment text only to match it against your configured trigger keywords.
                        </li>
                    </ul>

                    <h3>Facebook Login Permissions</h3>
                    <p>Requested when you connect via Facebook Login (for Facebook Pages or Instagram via Facebook):</p>
                    <ul>
                        <li>
                            <code>public_profile</code><br />
                            <strong>Why we need it:</strong> Basic Meta user identification required by Facebook Login to authenticate your session.
                        </li>
                        <li>
                            <code>pages_show_list</code><br />
                            <strong>Why we need it:</strong> To retrieve the list of Facebook Pages you manage so you can select which Page to connect to AutoDM and link it to your Instagram Business Account.
                        </li>
                        <li>
                            <code>pages_read_engagement</code><br />
                            <strong>Why we need it:</strong> To fetch posts and comments from your Facebook Page so you can configure automations for Facebook Page content.
                        </li>
                        <li>
                            <code>pages_manage_metadata</code><br />
                            <strong>Why we need it:</strong> To subscribe your Page to Meta webhook events so we can receive real-time notifications when someone comments on your Page posts. Without this, we cannot monitor comments in real time.
                        </li>
                        <li>
                            <code>pages_messaging</code><br />
                            <strong>Why we need it:</strong> To send automated Direct Messages through your Facebook Page inbox to users who comment on your Page posts with trigger keywords.
                        </li>
                    </ul>

                    <h3>Meta Webhook Subscriptions</h3>
                    <p>In addition to the OAuth permissions above, we subscribe to the following Meta webhook event types on your behalf. These deliver real-time event notifications to our servers:</p>
                    <ul>
                        <li><code>comments</code> — New comments on your posts and Reels (used to detect trigger keywords)</li>
                        <li><code>messages</code> — Incoming DM replies to your automated messages (used to process Follow Gate confirmations and email collection responses)</li>
                        <li><code>mentions</code> — When your Instagram account is mentioned in another user's Story (used for the Story Mention Auto-DM feature)</li>
                    </ul>

                    <p>
                        We use the data received through these permissions and webhooks exclusively to deliver the AutoDM
                        service as described in this Privacy Notice. We do not use this data for advertising, profiling,
                        selling to third parties, or any purpose unrelated to the features you have explicitly configured.
                    </p>
                    <p>
                        For more information about how Meta handles your data, please review the{' '}
                        <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer">Meta Platform Terms</a> and the{' '}
                        <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Meta Privacy Policy</a>.
                    </p>
                </section>

                {/* Section 6 */}
                <section id="section-6" className={styles.section}>
                    <h2>6. How Long Do We Keep Your Information?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We retain your information only as long as your account is active or as needed to provide the Services.</p>
                    <ul>
                        <li><strong>While your account is active:</strong> We retain all account data, automation settings, DM logs, and analytics for as long as you maintain an active AutoDM account</li>
                        <li><strong>When you disconnect a social account:</strong> Your OAuth access token is revoked and scrubbed. Your automation settings are preserved so you can reconnect later without losing your configuration. Your synced posts are deleted from our database per Meta Platform Terms</li>
                        <li><strong>Access tokens:</strong> Instagram and Facebook access tokens are valid for 60 days. We automatically refresh long-lived tokens before they expire. Tokens are scrubbed immediately upon account disconnection or deletion</li>
                        <li><strong>When you request full account deletion:</strong> We delete all your personal information, connected accounts, synced posts, automations, DM logs, analytics data, and access tokens within 30 days of your request</li>
                        <li><strong>Payment records:</strong> Transaction records (order IDs, amounts, dates) may be retained for up to 7 years to comply with financial recordkeeping requirements. No payment card details are stored</li>
                    </ul>
                </section>

                {/* Section 7 */}
                <section id="section-7" className={styles.section}>
                    <h2>7. How Do We Keep Your Information Safe?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We implement industry-standard security measures to protect your personal information.</p>
                    <ul>
                        <li>All data is transmitted over HTTPS (TLS encryption)</li>
                        <li>Passwords are hashed using bcrypt via Supabase Auth and are never stored or transmitted in plain text</li>
                        <li>OAuth access tokens are stored in an encrypted database column accessible only by the service role</li>
                        <li>Row Level Security (RLS) policies on all database tables ensure each user can access only their own data</li>
                        <li>Our database is hosted on Supabase (powered by AWS) with automatic backups and encryption at rest</li>
                        <li>Our application is deployed on Vercel with automatic HTTPS and DDoS protection</li>
                        <li>API keys and secrets are stored as environment variables and never committed to source control</li>
                        <li>Webhook payloads from Meta are verified using HMAC-SHA256 signature validation before processing</li>
                    </ul>
                    <p>
                        However, no method of electronic transmission or storage is 100% secure. While we implement
                        commercially reasonable measures to protect your information, we cannot guarantee absolute security.
                    </p>
                </section>

                {/* Section 8 */}
                <section id="section-8" className={styles.section}>
                    <h2>8. Do We Collect Information From Minors?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We do not knowingly collect data from or market to children under 18 years of age.</p>
                    <p>
                        Our Services are intended for users who are at least 18 years of age. We do not knowingly
                        collect, solicit, or market to children under 18. By using the Services, you represent that
                        you are at least 18 years old. If we learn that we have collected personal information from
                        a user under 18, we will promptly deactivate the account and delete the associated data.
                        If you believe we have inadvertently collected information from a minor, please contact us
                        at <a href="mailto:support@autodm.pro">support@autodm.pro</a>.
                    </p>
                </section>

                {/* Section 9 */}
                <section id="section-9" className={styles.section}>
                    <h2>9. What Are Your Privacy Rights?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> You have rights to access, correct, and delete your personal information at any time.</p>
                    <p>Depending on your location, you may have the following rights regarding your personal data:</p>
                    <ul>
                        <li><strong>Right to access:</strong> Request a copy of the personal information we hold about you</li>
                        <li><strong>Right to rectification:</strong> Request correction of inaccurate or incomplete personal data</li>
                        <li><strong>Right to erasure (&quot;right to be forgotten&quot;):</strong> Request deletion of your personal data from our systems</li>
                        <li><strong>Right to withdraw consent:</strong> Disconnect your Instagram or Facebook accounts at any time from the Settings page, revoking our API access</li>
                        <li><strong>Right to data portability:</strong> Request your data in a machine-readable portable format</li>
                        <li><strong>Right to object:</strong> Object to certain types of processing of your personal data</li>
                        <li><strong>Right to restrict processing:</strong> Request that we restrict the processing of your data in certain circumstances</li>
                    </ul>
                    <p>
                        To exercise any of these rights, contact us at{' '}
                        <a href="mailto:support@autodm.pro">support@autodm.pro</a> or use the account management
                        options in the AutoDM dashboard. We will respond to your request within 30 days.
                    </p>
                </section>

                {/* Section 10 */}
                <section id="section-10" className={styles.section}>
                    <h2>10. Meta Platform Data Use Policy</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> We comply fully with Meta's Platform Terms and use data obtained from Meta APIs only as permitted and only to deliver the AutoDM service.</p>
                    <p>AutoDM accesses Instagram and Facebook data through Meta's official Graph APIs and webhooks. We make the following commitments regarding the use of Meta Platform Data:</p>
                    <ul>
                        <li>We only access data that you have explicitly authorised through Meta's OAuth consent flow</li>
                        <li>We use Meta Platform Data solely to provide and improve the AutoDM service that you have subscribed to</li>
                        <li>We do not sell, license, transfer, or otherwise monetise data obtained from Meta APIs to any third party</li>
                        <li>We do not transfer Meta Platform Data to any data broker, advertising network, or analytics platform</li>
                        <li>We do not use Meta Platform Data for targeted advertising, re-targeting, or to build advertising profiles</li>
                        <li>We do not use Meta Platform Data for surveillance, discriminatory profiling, or any purpose not disclosed in this Privacy Notice</li>
                        <li>We store Meta Platform Data only as long as necessary to deliver the service (see Section 6)</li>
                        <li>We delete all Meta Platform Data upon account disconnection or when instructed by the user or by Meta</li>
                        <li>We keep Meta Platform Data secure using encryption and access controls as described in Section 7</li>
                        <li>We comply with all applicable provisions of the <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer">Meta Platform Terms</a>, including restrictions on data use, storage, and transfer</li>
                    </ul>
                    <p>
                        AutoDM is a Meta Business Partner. Our application has been reviewed and approved by Meta
                        for use of the Instagram Graph API and Facebook Graph API for the permissions listed in Section 5.
                    </p>
                </section>

                {/* Section 11 */}
                <section id="section-11" className={styles.section}>
                    <h2>11. Data Deletion Requests</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> You can request complete deletion of all your data at any time. We also handle data deletion requests from Meta automatically.</p>
                    <p>In compliance with Meta Platform Terms Section 3(d)(i), we provide multiple data deletion mechanisms:</p>

                    <h3>User-Initiated Deletion</h3>
                    <ul>
                        <li><strong>Disconnect account (partial):</strong> From Settings → Permissions, disconnect your Instagram or Facebook account. This immediately revokes our API access and scrubs your OAuth tokens and synced posts. Your automation configurations are preserved for potential reconnection</li>
                        <li><strong>Delete AutoDM account (full):</strong> From Settings → Account → Delete Account. This permanently deletes all your data including automations, DM logs, analytics, connected accounts, and your login credentials. This action is irreversible</li>
                        <li><strong>Email request:</strong> Send a deletion request to <a href="mailto:support@autodm.pro">support@autodm.pro</a>. We will process it within 30 days and confirm via email</li>
                    </ul>

                    <h3>Meta-Initiated Deletion (Deauthorisation Callback)</h3>
                    <p>
                        When you remove AutoDM from your Facebook/Instagram app permissions (via Meta's app settings),
                        Meta sends a signed data deletion request to our callback endpoint at{' '}
                        <code>https://autodm.pro/api/webhooks/data-deletion</code>.
                        We automatically process this request, delete all associated platform data,
                        and log a confirmation code. You can check the status of a Meta-initiated deletion at{' '}
                        <code>https://autodm.pro/deletion-status?code=&#123;confirmation_code&#125;</code>.
                    </p>

                    <p>
                        Upon any deletion request, the following data is permanently removed within 30 days:
                        connected account records, OAuth tokens, synced posts and media, DM automation configurations,
                        DM sent logs, click tracking data, email leads, payment order references, and your login account.
                    </p>
                </section>

                {/* Section 12 */}
                <section id="section-12" className={styles.section}>
                    <h2>12. Do We Make Updates To This Notice?</h2>
                    <p className={styles.inShort}><strong>In Short:</strong> Yes, we will update this Privacy Notice as necessary to stay compliant with relevant laws and to reflect changes in our Services.</p>
                    <p>
                        We may update this Privacy Notice from time to time. The updated version will be indicated
                        by an updated &quot;Last updated&quot; date at the top of this page. If we make material changes —
                        such as changes to how we use Meta Platform Data, the permissions we request, or how long we
                        retain data — we will notify you by email and by posting a prominent notice on our website.
                        We encourage you to review this Privacy Notice periodically.
                    </p>
                </section>

                {/* Section 13 */}
                <section id="section-13" className={styles.section}>
                    <h2>13. How Can You Contact Us?</h2>
                    <p>If you have questions, concerns, or complaints about this Privacy Notice or our data practices, please contact us:</p>
                    <p>
                        <strong>AutoDM</strong><br />
                        Email: <a href="mailto:support@autodm.pro">support@autodm.pro</a><br />
                        Website: <a href="https://autodm.pro" target="_blank" rel="noopener noreferrer">autodm.pro</a><br />
                        Data Deletion Callback: <code>https://autodm.pro/api/webhooks/data-deletion</code>
                    </p>
                    <p>We aim to respond to all privacy-related inquiries within 5 business days.</p>
                </section>

                {/* Section 14 */}
                <section id="section-14" className={styles.section}>
                    <h2>14. How Can You Review, Update, or Delete Your Data?</h2>
                    <p>You can manage your personal data at any time through the following options:</p>
                    <ul>
                        <li><strong>Disconnect a social account:</strong> Settings → Permissions → Disconnect. Revokes API access and deletes synced posts while preserving your automation configuration</li>
                        <li><strong>Update account email:</strong> Contact <a href="mailto:support@autodm.pro">support@autodm.pro</a></li>
                        <li><strong>Download your data:</strong> Contact <a href="mailto:support@autodm.pro">support@autodm.pro</a> to request a copy of your data in JSON format</li>
                        <li><strong>Delete your account (full):</strong> Settings → Account → Delete Account. Permanently removes all associated data. Alternatively, email us at <a href="mailto:support@autodm.pro">support@autodm.pro</a></li>
                        <li><strong>Revoke access from Meta's side:</strong> Go to your Facebook Settings → Apps and Websites → find AutoDM → Remove. Meta will send a data deletion signal to our servers automatically</li>
                    </ul>
                </section>
            </div>

            {/* Footer */}
            <footer className={styles.legalFooter}>
                <p>© 2026 AutoDM. All rights reserved. | <Link href="/terms">Terms of Service</Link> | <Link href="/">Home</Link></p>
            </footer>
        </div>
    );
}
