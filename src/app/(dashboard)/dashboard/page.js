export const runtime = 'edge';

import { createClient } from '@/lib/supabase-server';
import ConnectAccount from '@/components/dashboard/ConnectAccount';
import ConnectedAccountBanner from '@/components/dashboard/ConnectedAccountBanner';
import PostCardsGrid from '@/components/dashboard/PostCardsGrid';
import DailyDMChart from '@/components/dashboard/DailyDMChart';
import { Send, MousePointerClick, MessageCircle, TrendingUp } from 'lucide-react';
import styles from './dashboard.module.css';

const MONTHLY_DM_LIMIT = 1000;

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

    // ─── Analytics: Query dm_sent_log for real metrics ──────────────
    let totalSent = 0;
    let monthlySent = 0;
    let totalActivePosts = 0;
    let dailyDMData = [];

    try {
        // Get user's automation IDs first (reuse for all queries)
        const { data: userAutomations } = await supabase
            .from('dm_automations')
            .select('id')
            .eq('user_id', user.id);

        const automationIds = (userAutomations || []).map((a) => a.id);

        if (automationIds.length > 0) {
            // Total DMs sent (all time)
            const { count: sentCount } = await supabase
                .from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'sent')
                .in('automation_id', automationIds);

            totalSent = sentCount || 0;

            // DMs sent this month
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const { count: monthlyCount } = await supabase
                .from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'sent')
                .gte('sent_at', startOfMonth.toISOString())
                .in('automation_id', automationIds);

            monthlySent = monthlyCount || 0;

            // Daily DMs sent (last 14 days) — fetch rows and aggregate client-side
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

            const { data: dmRows } = await supabase
                .from('dm_sent_log')
                .select('sent_at')
                .eq('status', 'sent')
                .gte('sent_at', fourteenDaysAgo.toISOString())
                .in('automation_id', automationIds)
                .order('sent_at', { ascending: true });

            dailyDMData = aggregateDailyDMs(dmRows || [], fourteenDaysAgo);
        }

        // Active automations count
        const { count: activeCount } = await supabase
            .from('dm_automations')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_active', true);

        totalActivePosts = activeCount || 0;
    } catch {
        // dm_sent_log or dm_automations table may not exist yet
    }

    const dmUsagePercent = Math.min(100, Math.round((monthlySent / MONTHLY_DM_LIMIT) * 100));
    const displayName = user?.email?.split('@')[0] || 'User';

    // If no connected accounts, show Connect Account page
    if (connectedAccounts.length === 0) {
        return <ConnectAccount />;
    }

    const setupPosts = allPosts.filter((p) => p.status === 'setup');
    const setupCount = setupPosts.length;
    const connectedPlatforms = connectedAccounts.map((a) => a.platform);

    return (
        <div className={styles.dashboardPage}>
            {/* Welcome Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.welcome}>
                        Welcome back, <span className={styles.welcomeName}>{displayName}</span>
                    </h1>
                    <p className={styles.welcomeSub}>Here is what is happening with your automations today.</p>
                </div>
                <div className={styles.headerRight}>
                    <span className={styles.usageBadge}>
                        MONTHLY DM USAGE <strong>{monthlySent.toLocaleString()}/{MONTHLY_DM_LIMIT.toLocaleString()}</strong>
                    </span>
                </div>
            </div>

            {/* Two-column layout */}
            <div className={styles.dashboardGrid}>
                {/* ── Left Sidebar ── */}
                <aside className={styles.sidebar}>
                    {/* Active Connections Card */}
                    <div className={styles.sidebarCard}>
                        <h3 className={styles.sidebarCardTitle}>Active Connections</h3>
                        <ConnectedAccountBanner
                            accounts={connectedAccounts}
                            connectedPlatforms={connectedPlatforms}
                        />
                    </div>

                    {/* Performance Overview — Colorful KPIs */}
                    <div className={styles.sidebarCard}>
                        <h3 className={styles.sidebarCardTitle}>Performance Overview</h3>
                        <div className={styles.kpiList}>
                            <div className={styles.kpiItem}>
                                <div className={`${styles.kpiIcon} ${styles.kpiIconGreen}`}>
                                    <Send size={18} />
                                </div>
                                <div className={styles.kpiContent}>
                                    <span className={styles.kpiValue}>{totalSent.toLocaleString()}</span>
                                    <span className={styles.kpiLabel}>TOTAL MESSAGES</span>
                                </div>
                            </div>
                            <div className={styles.kpiItem}>
                                <div className={`${styles.kpiIcon} ${styles.kpiIconBlue}`}>
                                    <MousePointerClick size={18} />
                                </div>
                                <div className={styles.kpiContent}>
                                    <span className={styles.kpiValue}>{totalActivePosts}</span>
                                    <span className={styles.kpiLabel}>ACTIVE TRIGGERS</span>
                                </div>
                            </div>
                            <div className={styles.kpiItem}>
                                <div className={`${styles.kpiIcon} ${styles.kpiIconPurple}`}>
                                    <MessageCircle size={18} />
                                </div>
                                <div className={styles.kpiContent}>
                                    <span className={styles.kpiValue}>{monthlySent.toLocaleString()}</span>
                                    <span className={styles.kpiLabel}>THIS MONTH</span>
                                </div>
                            </div>
                            <div className={styles.kpiItem}>
                                <div className={`${styles.kpiIcon} ${styles.kpiIconAmber}`}>
                                    <TrendingUp size={18} />
                                </div>
                                <div className={styles.kpiContent}>
                                    <span className={styles.kpiValue}>{dmUsagePercent}%</span>
                                    <span className={styles.kpiLabel}>USAGE LIMIT</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Daily DMs Chart */}
                    <DailyDMChart data={dailyDMData} />
                </aside>

                {/* ── Right Content ── */}
                <main className={styles.mainContent}>
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>
                                Posts Ready for Automation {setupCount > 0 && <span className={styles.badge}>{setupCount}</span>}
                            </h2>
                            <p className={styles.sectionSub}>Select a recent post to configure an AutoDM reply triggered by comments.</p>
                        </div>
                        <PostCardsGrid posts={setupPosts} totalCount={setupPosts.length} />
                    </div>
                </main>
            </div>
        </div>
    );
}

/** Aggregate dm_sent_log rows into daily counts, filling in zero-days */
function aggregateDailyDMs(rows, startDate) {
    const countsByDay = {};

    for (const row of rows) {
        const day = new Date(row.sent_at).toISOString().split('T')[0];
        countsByDay[day] = (countsByDay[day] || 0) + 1;
    }

    const result = [];
    const current = new Date(startDate);
    const today = new Date();

    while (current <= today) {
        const key = current.toISOString().split('T')[0];
        const label = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        result.push({ date: label, count: countsByDay[key] || 0 });
        current.setDate(current.getDate() + 1);
    }

    return result;
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
