import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/posts/sync
 * Fetches posts from all connected Instagram/Facebook accounts and upserts to DB.
 *
 * IMPORTANT: allPosts is deduplicated by ig_post_id before the upsert.
 * A user can have both a 'both' account and a 'facebook' account active at the
 * same time (different platform values, so the unique constraint allows it).
 * If they share the same Facebook Page, the sync loop produces two entries with
 * the same ig_post_id ('fb_<postId>'), which causes Postgres to throw:
 *   "ON CONFLICT DO UPDATE command cannot affect row a second time"
 * Deduplication prevents this.
 */
export async function POST() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get all active connected accounts
    const { data: accounts, error: accountError } = await supabase
        .from('connected_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

    if (accountError || !accounts || accounts.length === 0) {
        return NextResponse.json({ error: 'No connected account found' }, { status: 400 });
    }

    const allPosts = [];
    const syncedPlatforms = [];

    try {
        for (const account of accounts) {
            // Fetch Instagram posts if Instagram is connected
            if (account.ig_user_id && (account.platform === 'instagram' || account.platform === 'both')) {
                // Fetch Posts
                const igPosts = await fetchInstagramPosts(account.ig_user_id, account.fb_page_access_token || account.access_token);
                allPosts.push(...igPosts.map((p) => ({
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

                // Fetch Stories (Active items within 24h limit)
                const igStories = await fetchInstagramStories(account.ig_user_id, account.fb_page_access_token || account.access_token);
                allPosts.push(...igStories.map((s) => ({
                    account_id: account.id,
                    ig_post_id: s.id,
                    media_type: s.media_type,
                    media_url: s.media_url || null,
                    thumbnail_url: s.thumbnail_url || s.media_url || null,
                    caption: s.caption || '',
                    permalink: s.permalink || '',
                    timestamp: s.timestamp,
                    is_story: true,
                    synced_at: new Date().toISOString(),
                })));

                syncedPlatforms.push('instagram');
            }

            // Fetch Facebook Page posts if Facebook is connected
            if (account.fb_page_id && (account.platform === 'facebook' || account.platform === 'both')) {
                const fbPosts = await fetchFacebookPosts(account.fb_page_id, account.fb_page_access_token || account.access_token);
                allPosts.push(...fbPosts.map((p) => {
                    const attachment = p.attachments?.data?.[0];
                    // media{image{src}} is explicitly requested in fetchFacebookPosts so this path works.
                    // attachment.url is the linked page URL (not a media URL) — only used as a last resort.
                    const mediaUrl = attachment?.media?.image?.src || attachment?.url || null;
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
                syncedPlatforms.push('facebook');
            }
        }

        // ── Deduplicate by ig_post_id ───────────────────────────────────────
        // Multiple active accounts can share the same Facebook Page, producing two
        // entries for every FB post (same ig_post_id, different account_id).
        // Postgres upsert ON CONFLICT DO UPDATE fails when the same conflict key
        // appears more than once in a single INSERT statement.
        // Last-write-wins: the final entry per ig_post_id is kept.
        const deduped = Object.values(
            allPosts.reduce((map, post) => {
                map[post.ig_post_id] = post;
                return map;
            }, {}),
        );

        // Upsert posts (insert or update on conflict)
        if (deduped.length > 0) {
            const { error: upsertError } = await supabase
                .from('instagram_posts')
                .upsert(deduped, { onConflict: 'ig_post_id' });

            if (upsertError) {
                console.error('Failed to save posts:', upsertError);
                return NextResponse.json({ error: 'Failed to save posts' }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            synced: deduped.length,
            platforms: syncedPlatforms,
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
 * Fetch stories from Instagram Graph API
 */
async function fetchInstagramStories(igUserId, accessToken) {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
    const response = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/stories?fields=${fields}&limit=100&access_token=${accessToken}`
    );

    if (!response.ok) {
        console.warn('Failed to fetch Instagram stories, they might not be available or expired.');
        return [];
    }

    const data = await response.json();
    return data.data || [];
}

/**
 * Fetch posts from Facebook Page Graph API.
 * Uses explicit sub-field expansion so attachment.media.image.src is populated.
 * Without media{image{src}}, the Graph API returns an opaque media object that
 * does not include the image src, causing all thumbnails to be null.
 */
async function fetchFacebookPosts(pageId, pageAccessToken) {
    const fields = 'id,message,permalink_url,created_time,attachments{media_type,media{image{src}},url}';
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
