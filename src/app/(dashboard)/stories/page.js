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
                .select('*, connected_accounts!inner(platform), dm_automations(is_active)')
                .in('account_id', accountIds)
                .eq('is_story', true)
                .order('timestamp', { ascending: false });

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

                return {
                    id: s.id,
                    mediaUrl: s.media_url,
                    thumbnailUrl: s.thumbnail_url || s.media_url,
                    mediaType: s.media_type,
                    platform: s.connected_accounts?.platform || 'instagram',
                    status: currentStatus,
                    replies: 0,
                    timestamp: s.timestamp, // Keep original timestamp for now, format in component
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
