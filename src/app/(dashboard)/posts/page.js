import { createClient } from '@/lib/supabase-server';
import PostsTable from '@/components/dashboard/PostsTable';
import styles from './posts.module.css';

export default async function PostsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Check connection & fetch posts from all active accounts
    let connectedAccounts = [];
    let posts = [];

    try {
        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('id, platform, ig_username, fb_page_name, is_active')
            .eq('user_id', user.id)
            .eq('is_active', true);

        connectedAccounts = accounts || [];

        if (connectedAccounts.length > 0) {
            const accountIds = connectedAccounts.map((a) => a.id);
            const { data: dbPosts } = await supabase
                .from('instagram_posts')
                .select('*, connected_accounts!inner(platform), dm_automations(id, is_active, expires_at, scheduled_start_at)')
                .in('account_id', accountIds)
                .eq('is_story', false)
                .order('timestamp', { ascending: false });

            // Fetch all automation IDs for this user to get sent counts
            const { data: userAutomations } = await supabase
                .from('dm_automations')
                .select('id, post_id')
                .eq('user_id', user.id);

            const automationMap = {};
            for (const a of (userAutomations || [])) {
                automationMap[a.post_id] = a.id;
            }

            // Fetch sent counts and click counts per automation
            const automationIds = Object.values(automationMap);
            let sentCountMap  = {};
            let clickCountMap = {};

            if (automationIds.length > 0) {
                // Sent counts
                try {
                    const { data: sentLogs } = await supabase
                        .from('dm_sent_log')
                        .select('automation_id')
                        .in('automation_id', automationIds)
                        .eq('status', 'sent');

                    for (const log of (sentLogs || [])) {
                        sentCountMap[log.automation_id] = (sentCountMap[log.automation_id] || 0) + 1;
                    }
                } catch { /* dm_sent_log may not exist */ }

                // Click counts — via click_events joined to dm_link_codes
                try {
                    const { data: clickRows } = await supabase
                        .from('click_events')
                        .select('automation_id')
                        .in('automation_id', automationIds);

                    for (const row of (clickRows || [])) {
                        clickCountMap[row.automation_id] = (clickCountMap[row.automation_id] || 0) + 1;
                    }
                } catch { /* click_events may not exist yet */ }
            }

            posts = (dbPosts || []).map((p) => {
                let currentStatus = 'setup';
                if (p.dm_automations) {
                    const isArray = Array.isArray(p.dm_automations);
                    const hasData = isArray ? p.dm_automations.length > 0 : Object.keys(p.dm_automations).length > 0;

                    if (hasData) {
                        const auto = isArray ? p.dm_automations[0] : p.dm_automations;
                        if (auto.is_active) {
                            currentStatus = 'active';
                        } else if (auto.scheduled_start_at && new Date(auto.scheduled_start_at) > new Date()) {
                            currentStatus = 'scheduled';
                        } else {
                            currentStatus = 'paused';
                        }
                    }
                }

                const automationId = automationMap[p.id];
                const sentCount   = automationId ? (sentCountMap[automationId]  || 0) : 0;
                const clickCount  = automationId ? (clickCountMap[automationId] || 0) : 0;

                // Get expiry and scheduled start from the automation
                let expiresAt = null;
                let scheduledStartAt = null;
                if (p.dm_automations) {
                    const isArray = Array.isArray(p.dm_automations);
                    const auto   = isArray ? p.dm_automations[0] : p.dm_automations;
                    if (auto) {
                        expiresAt       = auto.expires_at        || null;
                        scheduledStartAt = auto.scheduled_start_at || null;
                    }
                }

                const ctr = sentCount > 0
                    ? `${Math.round((clickCount / sentCount) * 100)}%`
                    : '-';

                return {
                    id: p.id,
                    caption: p.caption || 'No caption',
                    thumbnailUrl: p.thumbnail_url || p.media_url,
                    mediaType: p.media_type,
                    platform: p.connected_accounts?.platform || 'instagram',
                    status: currentStatus,
                    sent: sentCount,
                    open: 0,
                    clicks: clickCount,
                    ctr,
                    automationId: automationId || null,
                    timestamp: formatRelativeTime(p.timestamp),
                    expiresAt,
                    scheduledStartAt,
                };
            });
        }
    } catch {
        // Table may not exist yet
    }

    const isConnected = connectedAccounts.length > 0;

    return (
        <div className={styles.postsPage}>
            <PostsTable
                posts={posts}
                isConnected={isConnected}
                connectedAccounts={connectedAccounts}
            />
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
