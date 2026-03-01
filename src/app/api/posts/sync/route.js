import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/posts/sync
 * Fetches posts from connected Instagram/Facebook account and saves to DB
 */
export async function POST() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's connected account
    const { data: account, error: accountError } = await supabase
        .from('connected_accounts')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (accountError || !account) {
        return NextResponse.json({ error: 'No connected account found' }, { status: 400 });
    }

    const posts = [];

    try {
        // Fetch Instagram posts if Instagram is connected
        if (account.ig_user_id && (account.platform === 'instagram' || account.platform === 'both')) {
            const igPosts = await fetchInstagramPosts(account.ig_user_id, account.fb_page_access_token || account.access_token);
            posts.push(...igPosts.map((p) => ({
                account_id: account.id,
                ig_post_id: p.id,
                media_type: p.media_type,
                media_url: p.media_url || null,
                thumbnail_url: p.thumbnail_url || p.media_url || null,
                caption: p.caption || '',
                permalink: p.permalink || '',
                timestamp: p.timestamp,
                is_story: false,
                synced_at: new Date().toISOString(),
            })));
        }

        // Fetch Facebook Page posts if Facebook is connected
        if (account.fb_page_id && (account.platform === 'facebook' || account.platform === 'both')) {
            const fbPosts = await fetchFacebookPosts(account.fb_page_id, account.fb_page_access_token || account.access_token);
            posts.push(...fbPosts.map((p) => {
                // Extract media from attachments (replaces deprecated full_picture/type)
                const attachment = p.attachments?.data?.[0];
                const mediaUrl = attachment?.media?.image?.src || null;
                const mediaType = attachment?.media_type === 'video' ? 'VIDEO' : 'IMAGE';

                return {
                    account_id: account.id,
                    ig_post_id: `fb_${p.id}`,
                    media_type: mediaType,
                    media_url: mediaUrl,
                    thumbnail_url: mediaUrl,
                    caption: p.message || '',
                    permalink: p.permalink_url || '',
                    timestamp: p.created_time,
                    is_story: false,
                    synced_at: new Date().toISOString(),
                };
            }));
        }

        // Upsert posts (insert or update on conflict)
        if (posts.length > 0) {
            const { error: upsertError } = await supabase
                .from('instagram_posts')
                .upsert(posts, { onConflict: 'ig_post_id' });

            if (upsertError) {
                console.error('Failed to save posts:', upsertError);
                return NextResponse.json({ error: 'Failed to save posts' }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            synced: posts.length,
            platform: account.platform,
        });
    } catch (err) {
        console.error('Post sync error:', err);
        return NextResponse.json({
            error: `Sync failed: ${err.message}`,
        }, { status: 500 });
    }
}

/**
 * Fetch posts from Instagram Graph API
 */
async function fetchInstagramPosts(igUserId, accessToken) {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
    const response = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/media?fields=${fields}&limit=100&access_token=${accessToken}`
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch Instagram posts');
    }

    const data = await response.json();
    return data.data || [];
}

/**
 * Fetch posts from Facebook Page Graph API
 * Uses 'attachments' edge instead of deprecated 'full_picture' and 'type' fields
 */
async function fetchFacebookPosts(pageId, pageAccessToken) {
    const fields = 'id,message,permalink_url,created_time,attachments{media,media_type,url}';
    const response = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/posts?fields=${fields}&limit=100&access_token=${pageAccessToken}`
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch Facebook posts');
    }

    const data = await response.json();
    return data.data || [];
}
