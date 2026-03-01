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
                .select('*')
                .in('account_id', accountIds)
                .eq('is_story', true)
                .order('timestamp', { ascending: false });

            stories = dbStories || [];
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
