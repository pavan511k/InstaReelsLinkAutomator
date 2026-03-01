import { createClient } from '@/lib/supabase-server';
import ConnectAccount from '@/components/dashboard/ConnectAccount';
import ConnectedAccountBanner from '@/components/dashboard/ConnectedAccountBanner';
import PostCardsGrid from '@/components/dashboard/PostCardsGrid';
import { Send, MousePointerClick, MessageCircle, TrendingUp } from 'lucide-react';
import styles from './dashboard.module.css';

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch all active connected accounts
    let connectedAccounts = [];
    let allPosts = [];

    try {
        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('id, platform, ig_username, ig_profile_picture_url, fb_page_name, is_active')
            .eq('user_id', user.id)
            .eq('is_active', true);

        connectedAccounts = accounts || [];

        // Fetch posts from all connected accounts
        if (connectedAccounts.length > 0) {
            const accountIds = connectedAccounts.map((a) => a.id);
            const { data: dbPosts } = await supabase
                .from('instagram_posts')
                .select('*, connected_accounts!inner(platform), dm_automations(is_active)')
                .in('account_id', accountIds)
                .eq('is_story', false)
                .order('timestamp', { ascending: false });

            allPosts = (dbPosts || []).map((p) => {
                let currentStatus = 'setup';
                if (p.dm_automations) {
                    const isArray = Array.isArray(p.dm_automations);
                    const hasData = isArray ? p.dm_automations.length > 0 : Object.keys(p.dm_automations).length > 0;

                    if (hasData) {
                        const isActive = isArray ? p.dm_automations[0].is_active : p.dm_automations.is_active;
                        currentStatus = isActive ? 'active' : 'paused';
                    }
                }

                return {
                    id: p.id,
                    caption: p.caption || '',
                    thumbnailUrl: p.thumbnail_url || p.media_url,
                    mediaType: p.media_type,
                    platform: p.connected_accounts?.platform || 'instagram',
                    status: currentStatus,
                    timestamp: formatRelativeTime(p.timestamp),
                };
            });
        }
    } catch {
        // Table may not exist yet
    }

    const displayName = user?.email?.split('@')[0] || 'User';

    // If no connected accounts, show Connect Account page
    if (connectedAccounts.length === 0) {
        return <ConnectAccount />;
    }

    const setupPosts = allPosts.filter((p) => p.status === 'setup');
    const setupCount = setupPosts.length;

    // Determine which platforms are connected
    const connectedPlatforms = connectedAccounts.map((a) => a.platform);

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

            {/* Connected Account Banners — one per account */}
            <ConnectedAccountBanner
                accounts={connectedAccounts}
                connectedPlatforms={connectedPlatforms}
            />

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>MESSAGES SENT</span>
                        <div className={styles.statIconWrapper}><Send size={18} /></div>
                    </div>
                    <div className={styles.statBody}>
                        <span className={styles.statValue}>0</span>
                        <div className={styles.statTrend}><TrendingUp size={14} /> +0%</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>LINK CLICKS</span>
                        <div className={styles.statIconWrapper}><MousePointerClick size={18} /></div>
                    </div>
                    <div className={styles.statBody}>
                        <span className={styles.statValue}>0</span>
                        <div className={styles.statTrend}><TrendingUp size={14} /> +0%</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>COMMENTS SENT</span>
                        <div className={styles.statIconWrapper}><MessageCircle size={18} /></div>
                    </div>
                    <div className={styles.statBody}>
                        <span className={styles.statValue}>0</span>
                        <div className={styles.statTrend}><TrendingUp size={14} /> +0%</div>
                    </div>
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
                <PostCardsGrid posts={setupPosts} totalCount={setupPosts.length} />
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
