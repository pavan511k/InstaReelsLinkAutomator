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
                .select('*, connected_accounts!inner(platform), dm_automations(is_active)')
                .in('account_id', accountIds)
                .eq('is_story', false)
                .order('timestamp', { ascending: false });

            posts = (dbPosts || []).map((p) => {
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
                    caption: p.caption || 'No caption',
                    thumbnailUrl: p.thumbnail_url || p.media_url,
                    mediaType: p.media_type,
                    platform: p.connected_accounts?.platform || 'instagram',
                    status: currentStatus,
                    sent: 0,
                    open: 0,
                    clicks: 0,
                    ctr: '0%',
                    timestamp: formatRelativeTime(p.timestamp),
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
