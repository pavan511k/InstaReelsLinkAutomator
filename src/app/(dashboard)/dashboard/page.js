import { createClient } from '@/lib/supabase-server';
import ConnectAccount from '@/components/dashboard/ConnectAccount';
import ConnectedAccountBanner from '@/components/dashboard/ConnectedAccountBanner';
import styles from './dashboard.module.css';

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Check if user has connected accounts
    let connectedAccount = null;
    try {
        const { data } = await supabase
            .from('connected_accounts')
            .select('id, platform, ig_username, ig_profile_picture_url, fb_page_name')
            .eq('user_id', user.id)
            .single();
        connectedAccount = data;
    } catch {
        // Table may not exist yet
    }

    const displayName = user?.email?.split('@')[0] || 'User';

    // If not connected, show Connect Account page
    if (!connectedAccount) {
        return <ConnectAccount />;
    }

    // Connected state — show dashboard with account banner
    return (
        <div className={styles.dashboardPage}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.welcome}>Hi {displayName}, Welcome back!</h1>
                </div>
                <div className={styles.dmUsage}>
                    <span className={styles.usageLabel}>MONTHLY DM USAGE</span>
                    <div className="progress-bar" style={{ width: '150px' }}>
                        <div className="progress-fill" style={{ width: '5%' }}></div>
                    </div>
                    <span className={styles.usageCount}>0/1,000</span>
                </div>
            </div>

            {/* Connected Account Banner */}
            <ConnectedAccountBanner account={connectedAccount} />

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>MESSAGES SENT</span>
                    <span className={styles.statValue}>0</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>LINK CLICKS</span>
                    <span className={styles.statValue}>0</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>COMMENTS SENT</span>
                    <span className={styles.statValue}>0</span>
                </div>
            </div>

            {/* Ready to Setup Section */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                        Ready to Setup <span className="badge-count">0</span>
                    </h2>
                    <p className={styles.sectionSub}>AutoDM isn&apos;t active on these posts yet</p>
                </div>
                <div className={styles.emptyState}>
                    <p>No posts to set up. Click &quot;Sync Posts&quot; above to fetch your latest posts.</p>
                </div>
            </div>

            {/* Analytics Placeholder */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Analytics</h2>
                </div>
                <div className={styles.chartPlaceholder}>
                    <p>Analytics chart will appear here once you start sending DMs.</p>
                </div>
            </div>
        </div>
    );
}
