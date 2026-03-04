import { createClient } from '@/lib/supabase-server';
import StoriesContent from '@/components/dashboard/StoriesContent';

export default async function StoriesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let connectedAccounts = [];
    let stories = [];

    try {
        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('id, platform, ig_username')
            .eq('user_id', user.id)
            .eq('is_active', true);

        connectedAccounts = accounts || [];

        if (connectedAccounts.length > 0) {
            const accountIds = connectedAccounts.map((a) => a.id);
            const { data: dbStories } = await supabase
                .from('instagram_posts')
                .select('*, connected_accounts!inner(platform), dm_automations(id, is_active)')
                .in('account_id', accountIds)
                .eq('is_story', true)
                .order('timestamp', { ascending: false });

            // Fetch sent counts per automation from dm_sent_log
            const { data: userAutomations } = await supabase
                .from('dm_automations')
                .select('id, post_id')
                .eq('user_id', user.id);

            const automationMap = {};
            for (const a of (userAutomations || [])) {
                automationMap[a.post_id] = a.id;
            }

            const automationIds = Object.values(automationMap);
            let sentCountMap = {};

            if (automationIds.length > 0) {
                try {
                    const { data: sentLogs } = await supabase
                        .from('dm_sent_log')
                        .select('automation_id, status')
                        .in('automation_id', automationIds)
                        .eq('status', 'sent');

                    for (const log of (sentLogs || [])) {
                        sentCountMap[log.automation_id] = (sentCountMap[log.automation_id] || 0) + 1;
                    }
                } catch {
                    // dm_sent_log may not exist
                }
            }

            stories = (dbStories || []).map((s) => {
                let currentStatus = 'setup';
                if (s.dm_automations) {
                    const isArray = Array.isArray(s.dm_automations);
                    const hasData = isArray ? s.dm_automations.length > 0 : Object.keys(s.dm_automations).length > 0;

                    if (hasData) {
                        const isActive = isArray ? s.dm_automations[0].is_active : s.dm_automations.is_active;
                        currentStatus = isActive ? 'active' : 'paused';
                    }
                }

                const automationId = automationMap[s.id];
                const sentCount = automationId ? (sentCountMap[automationId] || 0) : 0;

                return {
                    id: s.id,
                    media_url: s.media_url,
                    thumbnail_url: s.thumbnail_url || s.media_url,
                    media_type: s.media_type,
                    caption: s.caption,
                    platform: s.connected_accounts?.platform || 'instagram',
                    status: currentStatus,
                    sent: sentCount,
                    story_expires_at: s.story_expires_at,
                    timestamp: s.timestamp,
                };
            });
        }
    } catch {
        // Table may not exist yet
    }

    const isConnected = connectedAccounts.length > 0;
    const platform = connectedAccounts[0]?.platform;

    return (
        <StoriesContent
            stories={stories}
            isConnected={isConnected}
            platform={platform}
        />
    );
}
