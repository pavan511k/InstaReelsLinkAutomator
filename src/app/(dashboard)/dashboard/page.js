import { createClient } from '@/lib/supabase-server';
import ConnectAccount from '@/components/dashboard/ConnectAccount';
import ConnectedAccountBanner from '@/components/dashboard/ConnectedAccountBanner';
import PostCardsGrid from '@/components/dashboard/PostCardsGrid';
import styles from './dashboard.module.css';

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Check if user has connected accounts
    let connectedAccount = null;
    let posts = [];

    try {
        const { data } = await supabase
            .from('connected_accounts')
            .select('id, platform, ig_username, ig_profile_picture_url, fb_page_name')
            .eq('user_id', user.id)
            .single();
        connectedAccount = data;

        // Fetch posts if account is connected
        if (data) {
            const { data: dbPosts } = await supabase
                .from('instagram_posts')
                .select('*')
                .eq('account_id', data.id)
                .eq('is_story', false)
                .order('timestamp', { ascending: false });

            posts = (dbPosts || []).map((p) => ({
                id: p.id,
                caption: p.caption || '',
                thumbnailUrl: p.thumbnail_url || p.media_url,
                mediaType: p.media_type,
                status: 'setup',
                timestamp: formatRelativeTime(p.timestamp),
            }));
        }
    } catch {
        // Table may not exist yet
    }

    const displayName = user?.email?.split('@')[0] || 'User';

    // If not connected, show Connect Account page
    if (!connectedAccount) {
        return <ConnectAccount />;
    }

    const setupCount = posts.filter((p) => p.status === 'setup').length;

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
                        Ready to Setup {setupCount > 0 && <span className="badge-count">{setupCount}</span>}
                    </h2>
                    <p className={styles.sectionSub}>AutoDM isn&apos;t active on these posts yet</p>
                </div>
                <PostCardsGrid posts={posts} totalCount={posts.length} />
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

function formatRelativeTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
