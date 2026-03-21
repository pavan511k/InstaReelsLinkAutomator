'use client';

import Link from 'next/link';
import { Send, Zap, MessageCircle, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Minus, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react';
import PostCardsGrid from '@/components/dashboard/PostCardsGrid';
import AnalyticsChart from '@/components/dashboard/AnalyticsChart';
import TopPosts from '@/components/dashboard/TopPosts';
import UsageProgress from '@/components/dashboard/UsageProgress';
import darkStyles from './dashboard.module.css';
import lightStyles from './dashboard.light.module.css';
import { useStyles } from '@/lib/useStyles';

const ICON_MAP = {
    send:           Send,
    zap:            Zap,
    messageCircle:  MessageCircle,
    trendingUp:     TrendingUp,
};

function daysUntilMonthEnd() {
    const now     = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate() - now.getDate();
}

/**
 * DashboardView — client component that renders the full dashboard UI.
 * All data is pre-fetched by the server component (page.js) and passed
 * as serializable props.
 */
export default function DashboardView({
    greeting,
    displayName,
    motivationalQuote,
    stats,
    dailyDMData,
    monthlySent,
    monthlyDmLimit,
    topPosts,
    setupPosts,
    effectivePlan = 'free',
    trialDaysLeft = 0,
}) {
    const styles = useStyles(darkStyles, lightStyles);
    const MONTHLY_DM_LIMIT = monthlyDmLimit ?? 3000;

    const isOnTrial       = effectivePlan === 'trial';
    const isTrialExpiring = isOnTrial && trialDaysLeft <= 5;
    const isPaidPro       = effectivePlan === 'pro' || effectivePlan === 'business';

    return (
        <div className={styles.page}>

            {/* ── Trial / Upgrade Banner ──────────────────────────── */}
            {isOnTrial && (
                <div className={`${styles.trialBanner} ${isTrialExpiring ? styles.trialBannerUrgent : ''}`}>
                    <div className={styles.trialBannerLeft}>
                        {isTrialExpiring
                            ? <AlertTriangle size={16} strokeWidth={2.5} className={styles.trialBannerIcon} />
                            : <Sparkles size={16} strokeWidth={2.5} className={styles.trialBannerIcon} />}
                        <div>
                            <span className={styles.trialBannerTitle}>
                                {isTrialExpiring
                                    ? `Trial expires in ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} — don't lose Pro access!`
                                    : `🎉 You're on a 30-day free Pro trial — ${trialDaysLeft} days remaining`}
                            </span>
                            <span className={styles.trialBannerSub}>
                                Follow Gate, templates, unlimited DMs &amp; more. Subscribe at ₹299/month to keep access after the trial.
                            </span>
                        </div>
                    </div>
                    <Link href="/pricing" className={styles.trialBannerCta}>
                        Upgrade to Pro <ArrowRight size={13} strokeWidth={2.5} />
                    </Link>
                </div>
            )}

            {/* ── Header ───────────────────────────────────── */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.greeting}>
                        {greeting}, <span className={styles.name}>{displayName}</span> 👋
                    </h1>
                    {motivationalQuote && (
                        <p className={styles.subGreeting}>{motivationalQuote}</p>
                    )}
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.datePill}>
                        <Clock size={13} />
                        {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    {isPaidPro && (
                        <div className={styles.proBadge}>
                            <Sparkles size={11} strokeWidth={2.5} /> Pro
                        </div>
                    )}
                </div>
            </div>

            {/* ── KPI row ──────────────────────────────────── */}
            <div className={styles.statsRow}>
                {stats.map(({ label, value, iconKey, color, bg, border, trend, sub }) => {
                    const Icon = ICON_MAP[iconKey];
                    return (
                        <div
                            key={label}
                            className={styles.statCard}
                            style={{ '--accent': color, '--accent-bg': bg, '--accent-border': border }}
                        >
                            <div className={styles.statTop}>
                                <div className={styles.statIconWrap}>
                                    {Icon && <Icon size={15} strokeWidth={2} />}
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
                    );
                })}
            </div>

            {/* ── Analytics row: Chart + Right panel ───────── */}
            <div className={styles.analyticsRow}>
                <div className={styles.chartCard}>
                    <AnalyticsChart data={dailyDMData} />
                </div>
                <div className={styles.rightCol}>
                    <div className={styles.innerCard}>
                        <div className={styles.innerCardHeader}>
                            <h3 className={styles.innerCardTitle}>Monthly usage</h3>
                            <span className={styles.innerCardSub}>
                                Resets in {daysUntilMonthEnd()} days
                            </span>
                        </div>
                        <UsageProgress used={monthlySent} limit={MONTHLY_DM_LIMIT} />
                    </div>
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
