import { createClient } from '@/lib/supabase-server';
import ConnectAccount from '@/components/dashboard/ConnectAccount';
import DashboardView from './DashboardView';
import { getEffectivePlan, getDmLimit, isUnlimited, trialDaysRemaining, getAutomationLimit } from '@/lib/plans';

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

    try {
        // All count queries below filter by user_id directly. This is the
        // single source of truth that matches the sidebar's cached counter
        // and survives automation deletions (which used to undercount the
        // dashboard but not the sidebar — see add-user-id-to-dm-sent-log).
        {
            // All-time total
            const { count: sentCount } = await supabase
                .from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'sent')
                .eq('user_id', user.id);
            totalSent = sentCount || 0;

            // This month
            const startOfMonth = new Date();
            startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
            const { count: monthlyCount } = await supabase
                .from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'sent')
                .gte('sent_at', startOfMonth.toISOString())
                .eq('user_id', user.id);
            monthlySent = monthlyCount || 0;

            // This week vs last week
            const sevenDaysAgo    = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

            const { count: weekCount } = await supabase
                .from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'sent')
                .gte('sent_at', sevenDaysAgo.toISOString())
                .eq('user_id', user.id);
            weekSent = weekCount || 0;

            const { count: prevWeekCount } = await supabase
                .from('dm_sent_log')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'sent')
                .gte('sent_at', fourteenDaysAgo.toISOString())
                .lt('sent_at', sevenDaysAgo.toISOString())
                .eq('user_id', user.id);
            prevWeekSent = prevWeekCount || 0;

            // 30-day daily breakdown for chart
            const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const { data: dmRows } = await supabase
                .from('dm_sent_log')
                .select('sent_at')
                .eq('status', 'sent')
                .gte('sent_at', thirtyDaysAgo.toISOString())
                .eq('user_id', user.id)
                .order('sent_at', { ascending: true });
            dailyDMData = aggregateDailyDMs(dmRows || [], thirtyDaysAgo);
        }

        // Active automations count
        const { count: activeCount } = await supabase
            .from('dm_automations')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_active', true);
        totalActivePosts = activeCount || 0;

    } catch { /* tables may not exist */ }

    // ── Plan — read from user_plans, not connected_accounts ────────────
    // plan columns were dropped from connected_accounts in drop-plan-from-accounts.sql
    let planRow = null;
    try {
        const { data } = await supabase
            .from('user_plans')
            .select('plan, plan_expires_at, trial_ends_at')
            .eq('user_id', user.id)
            .maybeSingle();
        planRow = data;
    } catch { /* user_plans may not exist in fresh deploys */ }

    // ── Derived values ───────────────────────────────────────────
    const effectivePlan   = getEffectivePlan(planRow);     // 'free' | 'trial' | 'pro' | 'business'
    const monthlyDmLimit  = getDmLimit(effectivePlan);     // null = unlimited
    const automationLimit = getAutomationLimit(effectivePlan); // null = unlimited
    const unlimited       = isUnlimited(effectivePlan);
    const trialDaysLeft   = trialDaysRemaining(planRow);   // 0 if not on trial

    // Total automations count (active + paused) — drives the free-tier
    // automation cap UI on the dashboard + automations list.
    let totalAutomations = 0;
    try {
        const { count } = await supabase
            .from('dm_automations')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);
        totalAutomations = count || 0;
    } catch { /* table may not exist */ }

    // Distinct contacts (people who triggered at least one DM). Counted
    // off dm_sent_log because it's the canonical record of every DM the
    // user has actually sent — automations can be deleted without us
    // losing the contact history.
    let totalContacts = 0;
    try {
        // Postgrest doesn't expose DISTINCT directly through the count
        // syntax, so we read recipient ids and dedupe client-side.
        // Capped at 5000 rows for the dashboard count; if you have more
        // than that you're definitely on Pro and the cap doesn't matter.
        const { data: recipients } = await supabase
            .from('dm_sent_log')
            .select('recipient_ig_id')
            .eq('user_id', user.id)
            .eq('status', 'sent')
            .not('recipient_ig_id', 'is', null)
            .limit(5000);
        const seen = new Set();
        for (const r of (recipients || [])) seen.add(r.recipient_ig_id);
        totalContacts = seen.size;
    } catch { /* fail-soft — card just shows 0 */ }
    const dmUsagePercent  = unlimited || !monthlyDmLimit
        ? 0
        : Math.min(100, Math.round((monthlySent / monthlyDmLimit) * 100));
    const weekChange     = prevWeekSent === 0
        ? null
        : Math.round(((weekSent - prevWeekSent) / prevWeekSent) * 100);
    const displayName    = user?.email?.split('@')[0] || 'User';
    const hour           = new Date().getHours();
    const greeting       = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    if (connectedAccounts.length === 0) {
        // FB closed-beta gate: tell the connect UI whether this user is
        // allowed to initiate a Facebook OAuth right now. Non-allowlisted
        // users see the FB tile as "Coming soon" while FB_BETA_MODE is on.
        // Mirrors the server gate in /api/auth/meta/connect.
        const FB_BETA_MODE = process.env.FB_BETA_MODE === 'true';
        const allowedEmails = (process.env.ALLOWED_EMAILS || '')
            .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
        const userEmail = (user?.email || '').toLowerCase();
        const fbAllowed = !FB_BETA_MODE || allowedEmails.includes(userEmail);
        return <ConnectAccount fbAllowed={fbAllowed} />;
    }

    const setupPosts  = allPosts.filter((p) => p.status === 'setup');
    const activePosts = allPosts.filter((p) => p.status === 'active');

    // iconKey strings are used instead of React components so this
    // server component can safely pass data to the client DashboardView.
    const STATS = [
        {
            label:   'Total DMs sent',
            value:   totalSent.toLocaleString(),
            iconKey: 'send',
            color:  '#7C3AED',
            bg:     'rgba(124,58,237,0.12)',
            border: 'rgba(124,58,237,0.22)',
            trend:  null,
            sub:    'All time',
        },
        {
            label:   'Active automations',
            value:   totalActivePosts.toString(),
            iconKey: 'zap',
            color:  '#10B981',
            bg:     'rgba(16,185,129,0.12)',
            border: 'rgba(16,185,129,0.22)',
            trend:  null,
            sub:    automationLimit != null
                ? `${totalAutomations} / ${automationLimit} on free plan`
                : `${totalAutomations} total · ${activePosts.length} posts live`,
        },
        {
            label:   'This month',
            value:   monthlySent.toLocaleString(),
            iconKey: 'messageCircle',
            color:  '#3B82F6',
            bg:     'rgba(59,130,246,0.12)',
            border: 'rgba(59,130,246,0.22)',
            trend:  null,
            sub:    unlimited
                ? effectivePlan === 'trial' ? `🎁 Trial — ${trialDaysLeft}d left` : '✨ Unlimited plan'
                : `${dmUsagePercent}% of ${monthlyDmLimit.toLocaleString()} limit`,
        },
        {
            label:   'This week',
            value:   weekSent.toLocaleString(),
            iconKey: 'trendingUp',
            color:  weekChange === null ? '#F59E0B' : weekChange >= 0 ? '#10B981' : '#EF4444',
            bg:     weekChange === null ? 'rgba(245,158,11,0.12)' : weekChange >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            border: weekChange === null ? 'rgba(245,158,11,0.22)' : weekChange >= 0 ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)',
            trend:  weekChange,
            sub:    `vs ${prevWeekSent.toLocaleString()} last week`,
        },
    ];

    return (
        <DashboardView
            greeting={greeting}
            displayName={displayName}
            motivationalQuote={getMotivationalQuote(totalSent)}
            stats={STATS}
            dailyDMData={dailyDMData}
            monthlySent={monthlySent}
            monthlyDmLimit={monthlyDmLimit}
            setupPosts={setupPosts}
            effectivePlan={effectivePlan}
            trialDaysLeft={trialDaysLeft}
            totalAutomations={totalAutomations}
            automationLimit={automationLimit}
            totalContacts={totalContacts}
        />
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
