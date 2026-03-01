import { createClient } from '@/lib/supabase-server';
import StoriesContent from '@/components/dashboard/StoriesContent';

export default async function StoriesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let connectedAccount = null;
    let stories = [];

    try {
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('id, platform, ig_username')
            .eq('user_id', user.id)
            .single();

        connectedAccount = account;

        if (account) {
            const { data: dbStories } = await supabase
                .from('instagram_posts')
                .select('*')
                .eq('account_id', account.id)
                .eq('is_story', true)
                .order('timestamp', { ascending: false });

            stories = dbStories || [];
        }
    } catch {
        // Table may not exist yet
    }

    return (
        <StoriesContent
            stories={stories}
            isConnected={!!connectedAccount}
            platform={connectedAccount?.platform}
        />
    );
}
