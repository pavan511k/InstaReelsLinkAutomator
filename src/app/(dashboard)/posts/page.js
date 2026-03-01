import { createClient } from '@/lib/supabase-server';
import PostsTable from '@/components/dashboard/PostsTable';
import styles from './posts.module.css';

export default async function PostsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Check connection & fetch posts from DB
    let connectedAccount = null;
    let posts = [];

    try {
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('id, platform, ig_username, fb_page_name')
            .eq('user_id', user.id)
            .single();

        connectedAccount = account;

        if (account) {
            const { data: dbPosts } = await supabase
                .from('instagram_posts')
                .select('*')
                .eq('account_id', account.id)
                .eq('is_story', false)
                .order('timestamp', { ascending: false });

            posts = (dbPosts || []).map((p) => ({
                id: p.id,
                caption: p.caption || 'No caption',
                thumbnailUrl: p.thumbnail_url || p.media_url,
                status: 'setup', // Default to setup until automation is configured
                sent: 0,
                open: 0,
                clicks: 0,
                ctr: '0%',
                timestamp: new Date(p.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                }),
            }));
        }
    } catch {
        // Table may not exist yet
    }

    const isConnected = !!connectedAccount;

    return (
        <div className={styles.postsPage}>
            <PostsTable
                posts={posts}
                isConnected={isConnected}
                platform={connectedAccount?.platform}
            />
        </div>
    );
}
