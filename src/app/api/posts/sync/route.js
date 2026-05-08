import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { GRAPH_API_VERSION, GRAPH_FB_BASE } from '@/lib/meta-graph';

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
    // Per-account list of currently-live story IDs from Graph. Anything in
    // our DB tagged is_story=true for the account but missing from this set
    // was either deleted by the user or naturally expired — we mark those
    // expired immediately so the UI stops offering "Configure" on dead stories.
    const liveStoryIdsByAccount = {};

    try {
        for (const account of accounts) {
            liveStoryIdsByAccount[account.id] = [];
            // Fetch Instagram posts if Instagram is connected
            if (account.ig_user_id && (account.platform === 'instagram' || account.platform === 'both')) {
                // Instagram Business Login tokens (platform=instagram, no fb_page_access_token)
                // must use graph.instagram.com — NOT graph.facebook.com.
                // Facebook Login tokens (platform=both/facebook, has fb_page_access_token)
                // must use graph.facebook.com.
                const igToken = account.fb_page_access_token || account.access_token;
                const useIgApi = !account.fb_page_access_token && account.platform === 'instagram';

                // Fetch Posts
                const igPosts = await fetchInstagramPosts(account.ig_user_id, igToken, useIgApi);
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

                // Fetch Stories (Active items within 24h limit).
                // null = fetch failed → skip the expired-sweep for this account.
                const igStories = await fetchInstagramStories(account.ig_user_id, igToken, useIgApi);
                if (igStories === null) {
                    liveStoryIdsByAccount[account.id] = null;
                } else {
                    liveStoryIdsByAccount[account.id].push(...igStories.map((s) => s.id));
                }
                allPosts.push(...(igStories || []).map((s) => ({
                    account_id: account.id,
                    ig_post_id: s.id,
                    media_type: s.media_type,
                    media_url: s.media_url || null,
                    thumbnail_url: s.thumbnail_url || s.media_url || null,
                    caption: s.caption || '',
                    permalink: s.permalink || '',
                    timestamp: s.timestamp,
                    is_story: true,
                    // IG stories are alive for exactly 24h from their timestamp.
                    // Persist the computed expiry so the UI can filter expired
                    // stories without depending on wall-clock-vs-sync drift.
                    story_expires_at: s.timestamp
                        ? new Date(new Date(s.timestamp).getTime() + 24 * 60 * 60 * 1000).toISOString()
                        : null,
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

        // Reconcile expired/deleted stories per account.
        // Any DB row marked is_story=true for an account whose ig_post_id
        // didn't come back from Graph is dead — either it expired naturally
        // or the user deleted it from Instagram. Force its story_expires_at
        // to now() so the UI shows "Expired" and stops offering Configure
        // on a story that no longer exists.
        // Note: we do NOT filter on the current story_expires_at value —
        // pre-fix rows have NULL there and the older `.gt()` filter would
        // have skipped them, leaving deleted stories permanently in
        // "Configure" state.
        const nowIso = new Date().toISOString();
        for (const account of accounts) {
            if (!account.ig_user_id) continue;
            const liveIds = liveStoryIdsByAccount[account.id];
            // Skip when null — Graph fetch failed for this account, so we
            // can't safely declare anything dead.
            if (liveIds === null) {
                console.log(`[Sync] Skipping expire-sweep for account ${account.id} — Graph fetch failed`);
                continue;
            }
            // Only touch rows that are NULL (pre-fix legacy) or still-future
            // — already-expired rows stay frozen at their original expiry time
            // so we don't churn the DB on every sync.
            let q = supabase
                .from('instagram_posts')
                .update({ story_expires_at: nowIso })
                .eq('account_id', account.id)
                .eq('is_story', true)
                .or(`story_expires_at.is.null,story_expires_at.gt.${nowIso}`);
            if (liveIds.length > 0) q = q.not('ig_post_id', 'in', `(${liveIds.map((id) => `"${id}"`).join(',')})`);
            const { error: expireError, count } = await q;
            if (expireError) console.error('[Sync] Failed to mark stories expired:', expireError);
            else console.log(`[Sync] Account ${account.id}: live=${liveIds.length}, marked expired=${count ?? '?'}`);
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
 * useIgApi=true  → Instagram Business Login token → graph.instagram.com
 * useIgApi=false → Facebook Page Access Token    → graph.facebook.com
 */
async function fetchInstagramPosts(igUserId, accessToken, useIgApi = false) {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
    const base = useIgApi ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
    const response = await fetch(
        `${base}/${GRAPH_API_VERSION}/${igUserId}/media?fields=${fields}&limit=100&access_token=${accessToken}`
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
 * useIgApi=true  → Instagram Business Login token → graph.instagram.com
 * useIgApi=false → Facebook Page Access Token    → graph.facebook.com
 */
async function fetchInstagramStories(igUserId, accessToken, useIgApi = false) {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
    const base = useIgApi ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
    const response = await fetch(
        `${base}/${GRAPH_API_VERSION}/${igUserId}/stories?fields=${fields}&limit=100&access_token=${accessToken}`
    );

    // Returns null on fetch error so the caller can distinguish "no stories"
    // from "Graph hiccup" — the expired-sweep must skip on hiccups, otherwise
    // a transient failure would falsely expire every live story in the DB.
    if (!response.ok) {
        console.warn('Failed to fetch Instagram stories, they might not be available or expired.');
        return null;
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
        `${GRAPH_FB_BASE}/${pageId}/posts?fields=${fields}&limit=100&access_token=${pageAccessToken}`
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch Facebook posts');
    }

    const data = await response.json();
    return data.data || [];
}
