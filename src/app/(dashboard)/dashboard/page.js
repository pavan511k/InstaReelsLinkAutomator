import { createClient } from '@/lib/supabase-server';
import ConnectAccount from '@/components/dashboard/ConnectAccount';
import PostCardsGrid from '@/components/dashboard/PostCardsGrid';
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';
import TopPosts from '@/components/dashboard/TopPosts';
import UsageProgress from '@/components/dashboard/UsageProgress';
import { Send, Zap, MessageCircle, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Minus } from 'lucide-react';
import styles from './dashboard.module.css';

const MONTHLY_DM_LIMIT = 1000;

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let connectedAccounts = [];
    let allPosts = [];

    try {
        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('id, platform, ig_username, ig_profile_picture_url, fb_page_name, is_active')
            .eq('user_id', user.id)
            .eq('is_active', true);

        connectedAccounts = accounts || [];

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
    } catch { /* table may not exist */ }

    // ── Analytics ────────────────────────────────────────────────
    let totalSent        = 0;
    let monthlySent      = 0;
    let weekSent         = 0;
    let prevWeekSent     = 0;
    let totalActivePosts = 0;
    let dailyDMData      = [];
    let topPosts         = [];

    try {
        const { data: userAutomations } = await supabase
            .from('dm_automations')
            .select('id, post_id')
            .eq('user_id', user.id);

        const allAutomationIds  = (userAutomations || []).map((a) => a.id);
        const automationPostMap = {};
        for (const a of (userAutomations || [])) {
            automationPostMap[a.id] = a.post_id;
        }

        if (allAutomationIds.length > 0) {
            // All-time total
            const { count: sentCount } = await supabase
                .from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'sent')
                .in('automation_id', allAutomationIds);
            totalSent = sentCount || 0;

            // This month
            const startOfMonth = new Date();
            startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
            const { count: monthlyCount } = await supabase
                .from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'sent')
                .gte('sent_at', startOfMonth.toISOString())
                .in('automation_id', allAutomationIds);
            monthlySent = monthlyCount || 0;

            // This week vs last week
            const sevenDaysAgo    = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

            const { count: weekCount } = await supabase
                .from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'sent')
                .gte('sent_at', sevenDaysAgo.toISOString())
                .in('automation_id', allAutomationIds);
            weekSent = weekCount || 0;

            const { count: prevWeekCount } = await supabase
                .from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'sent')
                .gte('sent_at', fourteenDaysAgo.toISOString())
                .lt('sent_at', sevenDaysAgo.toISOString())
                .in('automation_id', allAutomationIds);
            prevWeekSent = prevWeekCount || 0;

            // 30-day daily breakdown for chart
            const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const { data: dmRows } = await supabase
                .from('dm_sent_log')
                .select('sent_at')
                .eq('status', 'sent')
                .gte('sent_at', thirtyDaysAgo.toISOString())
                .in('automation_id', allAutomationIds)
                .order('sent_at', { ascending: true });
            dailyDMData = aggregateDailyDMs(dmRows || [], thirtyDaysAgo);

            // Top posts by DMs sent
            const { data: sentLogs } = await supabase
                .from('dm_sent_log')
                .select('automation_id')
                .eq('status', 'sent')
                .in('automation_id', allAutomationIds);

            const countByAutomation = {};
            for (const log of (sentLogs || [])) {
                countByAutomation[log.automation_id] = (countByAutomation[log.automation_id] || 0) + 1;
            }

            const postSentCounts = Object.entries(countByAutomation)
                .map(([automationId, count]) => ({ postId: automationPostMap[automationId], count }))
                .filter((item) => item.postId)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            if (postSentCounts.length > 0) {
                const topPostIds = postSentCounts.map((p) => p.postId);
                const { data: postData } = await supabase
                    .from('instagram_posts')
                    .select('id, caption, thumbnail_url, media_url, media_type, timestamp')
                    .in('id', topPostIds);

                const postMap = {};
                for (const p of (postData || [])) postMap[p.id] = p;

                topPosts = postSentCounts
                    .filter((item) => postMap[item.postId])
                    .map((item) => ({
                        id:           item.postId,
                        count:        item.count,
                        caption:      postMap[item.postId]?.caption || '',
                        thumbnailUrl: postMap[item.postId]?.thumbnail_url || postMap[item.postId]?.media_url,
                        mediaType:    postMap[item.postId]?.media_type,
                        timestamp:    formatRelativeTime(postMap[item.postId]?.timestamp),
                    }));
            }
        }

        // Active automations count
        const { count: activeCount } = await supabase
            .from('dm_automations')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_active', true);
        totalActivePosts = activeCount || 0;

    } catch { /* tables may not exist */ }

    // ── Derived values ───────────────────────────────────────────
    const dmUsagePercent = Math.min(100, Math.round((monthlySent / MONTHLY_DM_LIMIT) * 100));
    const weekChange     = prevWeekSent === 0
        ? null
        : Math.round(((weekSent - prevWeekSent) / prevWeekSent) * 100);
    const displayName    = user?.email?.split('@')[0] || 'User';
    const hour           = new Date().getHours();
    const greeting       = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    if (connectedAccounts.length === 0) {
        return <ConnectAccount />;
    }

    const setupPosts  = allPosts.filter((p) => p.status === 'setup');
    const activePosts = allPosts.filter((p) => p.status === 'active');

    const STATS = [
        {
            label:  'Total DMs sent',
            value:  totalSent.toLocaleString(),
            icon:   Send,
            color:  '#7C3AED',
            bg:     'rgba(124,58,237,0.12)',
            border: 'rgba(124,58,237,0.22)',
            trend:  null,
            sub:    'All time',
        },
        {
            label:  'Active automations',
            value:  totalActivePosts.toString(),
            icon:   Zap,
            color:  '#10B981',
            bg:     'rgba(16,185,129,0.12)',
            border: 'rgba(16,185,129,0.22)',
            trend:  null,
            sub:    `${activePosts.length} posts live`,
        },
        {
            label:  'This month',
            value:  monthlySent.toLocaleString(),
            icon:   MessageCircle,
            color:  '#3B82F6',
            bg:     'rgba(59,130,246,0.12)',
            border: 'rgba(59,130,246,0.22)',
            trend:  null,
            sub:    `${dmUsagePercent}% of ${MONTHLY_DM_LIMIT.toLocaleString()} limit`,
        },
        {
            label:  'This week',
            value:  weekSent.toLocaleString(),
            icon:   TrendingUp,
            color:  weekChange === null ? '#F59E0B' : weekChange >= 0 ? '#10B981' : '#EF4444',
            bg:     weekChange === null ? 'rgba(245,158,11,0.12)' : weekChange >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            border: weekChange === null ? 'rgba(245,158,11,0.22)' : weekChange >= 0 ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)',
            trend:  weekChange,
            sub:    `vs ${prevWeekSent.toLocaleString()} last week`,
        },
    ];

    return (
        <div className={styles.page}>

            {/* ── Header ───────────────────────────────────── */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.greeting}>
                        {greeting}, <span className={styles.name}>{displayName}</span> 👋
                    </h1>
                    <p className={styles.subGreeting}>
                        {getMotivationalQuote(totalSent)}
                    </p>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.datePill}>
                        <Clock size={13} />
                        {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                </div>
            </div>

            {/* ── KPI row ──────────────────────────────────── */}
            <div className={styles.statsRow}>
                {STATS.map(({ label, value, icon: Icon, color, bg, border, trend, sub }) => (
                    <div
                        key={label}
                        className={styles.statCard}
                        style={{ '--accent': color, '--accent-bg': bg, '--accent-border': border }}
                    >
                        <div className={styles.statTop}>
                            <div className={styles.statIconWrap}>
                                <Icon size={15} strokeWidth={2} />
                            </div>
                            {trend !== null && (
                                <span
                                    className={styles.statTrend}
                                    style={{
                                        color:      trend >= 0 ? '#10B981' : '#EF4444',
                                        background: trend >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                    }}
                                >
                                    {trend > 0  ? <ArrowUpRight size={11} />   :
                                     trend < 0  ? <ArrowDownRight size={11} /> :
                                                  <Minus size={11} />}
                                    {Math.abs(trend)}%
                                </span>
                            )}
                        </div>
                        <div className={styles.statValue}>{value}</div>
                        <div className={styles.statLabel}>{label}</div>
                        {sub && <div className={styles.statSub}>{sub}</div>}
                    </div>
                ))}
            </div>

            {/* ── Analytics row: Chart + Right panel ───────── */}
            <div className={styles.analyticsRow}>

                {/* Chart — left, wider */}
                <div className={styles.chartCard}>
                    <AnalyticsChart data={dailyDMData} />
                </div>

                {/* Right column — usage ring + top posts */}
                <div className={styles.rightCol}>

                    {/* Monthly usage ring */}
                    <div className={styles.innerCard}>
                        <div className={styles.innerCardHeader}>
                            <h3 className={styles.innerCardTitle}>Monthly usage</h3>
                            <span className={styles.innerCardSub}>
                                Resets in {daysUntilMonthEnd()} days
                            </span>
                        </div>
                        <UsageProgress used={monthlySent} limit={MONTHLY_DM_LIMIT} />
                    </div>

                    {/* Top performing posts — always visible, grows to fill remaining height */}
                    <div className={`${styles.innerCard} ${styles.innerCardGrow}`}>
                        <div className={styles.innerCardHeader}>
                            <h3 className={styles.innerCardTitle}>Top performing posts</h3>
                            <span className={styles.innerCardSub}>By DMs sent</span>
                        </div>
                        <TopPosts posts={topPosts} />
                    </div>

                </div>
            </div>

            {/* ── Posts ready to automate ───────────────────── */}
            <div className={styles.sectionCard}>
                <div className={styles.sectionCardHeader}>
                    <div>
                        <h2 className={styles.sectionCardTitle}>
                            Posts ready to automate
                            {setupPosts.length > 0 && (
                                <span className={styles.countBadge}>{setupPosts.length}</span>
                            )}
                        </h2>
                        <p className={styles.sectionCardSub}>
                            Select a post to configure an AutoDM reply triggered by comments.
                        </p>
                    </div>
                </div>
                <PostCardsGrid posts={setupPosts} totalCount={setupPosts.length} />
            </div>

        </div>
    );
}

// ── Helpers ──────────────────────────────────────────────────────

function getMotivationalQuote(totalSent) {
    if (totalSent === 0)  return "You haven\'t sent any DMs yet \u2014 set up your first automation on Posts & Reels! 🚀";
    if (totalSent < 10)   return `${totalSent} DMs sent so far \u2014 great start, keep the momentum going! 🌱`;
    if (totalSent < 50)   return `${totalSent} DMs sent! You\'re building something real here. 💪`;
    if (totalSent < 100)  return `${totalSent} DMs and counting \u2014 your automations are starting to fly! \u2728`;
    if (totalSent < 250)  return `${totalSent.toLocaleString()} DMs sent! Hurray, your automations are going strong! 🎉`;
    if (totalSent < 500)  return `${totalSent.toLocaleString()} DMs! You\'re seriously crushing it. 🔥`;
    if (totalSent < 1000) return `${totalSent.toLocaleString()} DMs sent \u2014 almost four figures, legend! 🌟`;
    if (totalSent < 5000) return `${totalSent.toLocaleString()} DMs sent \u2014 wow, it\'s absolutely rocking! 🤘`;
    return `${totalSent.toLocaleString()} DMs sent. You\'re an AutoDM powerhouse \u2014 absolutely legendary! 🏆`;
}

function daysUntilMonthEnd() {
    const now     = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate() - now.getDate();
}

function aggregateDailyDMs(rows, startDate) {
    const countsByDay = {};
    for (const row of rows) {
        const day = new Date(row.sent_at).toISOString().split('T')[0];
        countsByDay[day] = (countsByDay[day] || 0) + 1;
    }
    const result  = [];
    const current = new Date(startDate);
    const today   = new Date();
    while (current <= today) {
        const key = current.toISOString().split('T')[0];
        result.push({
            date:  current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            count: countsByDay[key] || 0,
        });
        current.setDate(current.getDate() + 1);
    }
    return result;
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const now   = new Date();
    const date  = new Date(timestamp);
    const diffMs = now - date;
    const diffH  = Math.floor(diffMs / 3_600_000);
    const diffD  = Math.floor(diffMs / 86_400_000);
    if (diffH < 1)   return 'Just now';
    if (diffH < 24)  return `${diffH}h ago`;
    if (diffD === 1) return '1 day ago';
    if (diffD < 7)   return `${diffD} days ago`;
    if (diffD < 30)  return `${Math.floor(diffD / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
