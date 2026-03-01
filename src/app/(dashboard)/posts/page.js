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
                mediaType: p.media_type,
                status: 'setup',
                sent: 0,
                open: 0,
                clicks: 0,
                ctr: '0%',
                timestamp: formatRelativeTime(p.timestamp),
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
