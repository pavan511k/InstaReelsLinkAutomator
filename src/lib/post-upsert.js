import { graphBase, GRAPH_FB_BASE } from '@/lib/meta-graph';

/**
 * Fetch a single Instagram/Facebook post by media ID via Graph API and upsert
 * into instagram_posts. Used by the webhook lazy-sync path: when a comment
 * arrives on a media row we haven't synced yet, this fetches just that one
 * media so processAutomationForComment can match account-wide automations
 * ('any' or 'next' postTargetMode) without waiting for the user to manually
 * sync.
 *
 * Returns the resulting { id, account_id } row, or null on failure.
 */
export async function fetchAndUpsertPost(supabase, account, mediaId, platform) {
    try {
        let postData;
        const dbPostId = platform === 'facebook' ? `fb_${mediaId}` : mediaId;

        if (platform === 'instagram') {
            const token = account.fb_page_access_token || account.access_token;
            const useIgApi = !account.fb_page_access_token;
            const base = graphBase(useIgApi);
            const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
            const url = `${base}/${mediaId}?fields=${fields}&access_token=${encodeURIComponent(token)}`;
            const res = await fetch(url);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn('[LazySync] IG media fetch failed:', err.error?.message || res.status, mediaId);
                return null;
            }
            const p = await res.json();
            postData = {
                account_id:     account.id,
                ig_post_id:     p.id,
                media_type:     p.media_type,
                media_url:      p.media_url || null,
                thumbnail_url:  p.thumbnail_url || p.media_url || null,
                caption:        p.caption || '',
                permalink:      p.permalink || '',
                timestamp:      p.timestamp,
                is_story:       false,
                like_count:     typeof p.like_count     === 'number' ? p.like_count     : null,
                comments_count: typeof p.comments_count === 'number' ? p.comments_count : null,
                synced_at:      new Date().toISOString(),
            };
        } else {
            const token = account.fb_page_access_token || account.access_token;
            const fields = 'id,message,permalink_url,created_time,attachments{media_type,media{image{src}},url},comments.summary(true).limit(0),reactions.summary(true).limit(0)';
            const url = `${GRAPH_FB_BASE}/${mediaId}?fields=${fields}&access_token=${encodeURIComponent(token)}`;
            const res = await fetch(url);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn('[LazySync] FB post fetch failed:', err.error?.message || res.status, mediaId);
                return null;
            }
            const p = await res.json();
            const attachment = p.attachments?.data?.[0];
            const mediaUrl = attachment?.media?.image?.src || attachment?.url || null;
            const mediaType = attachment?.media_type === 'video' ? 'VIDEO' : 'IMAGE';
            const commentsTotal  = p.comments?.summary?.total_count;
            const reactionsTotal = p.reactions?.summary?.total_count;
            postData = {
                account_id:     account.id,
                ig_post_id:     dbPostId,
                media_type:     mediaType,
                media_url:      mediaUrl,
                thumbnail_url:  mediaUrl,
                caption:        p.message || '',
                permalink:      p.permalink_url || '',
                timestamp:      p.created_time,
                is_story:       false,
                like_count:     typeof reactionsTotal === 'number' ? reactionsTotal : null,
                comments_count: typeof commentsTotal  === 'number' ? commentsTotal  : null,
                synced_at:      new Date().toISOString(),
            };
        }

        // Mirrors /api/posts/sync error handling: if engagement columns don't
        // exist yet (pre-migration DB), strip them and retry once.
        let { error: upsertErr } = await supabase
            .from('instagram_posts')
            .upsert(postData, { onConflict: 'ig_post_id' });

        if (upsertErr) {
            const msg = upsertErr.message || '';
            const isMissingEngagement =
                /like_count|comments_count/i.test(msg) || /column .* does not exist/i.test(msg);
            if (isMissingEngagement) {
                const { like_count, comments_count, ...stripped } = postData;
                ({ error: upsertErr } = await supabase
                    .from('instagram_posts')
                    .upsert(stripped, { onConflict: 'ig_post_id' }));
            }
        }

        if (upsertErr) {
            console.error('[LazySync] Upsert failed:', upsertErr.message);
            return null;
        }

        const { data: row } = await supabase
            .from('instagram_posts')
            .select('id, account_id')
            .eq('ig_post_id', dbPostId)
            .maybeSingle();

        if (row) console.log(`[LazySync] Upserted post ${dbPostId} → row ${row.id}`);
        return row || null;
    } catch (err) {
        console.error('[LazySync] fetchAndUpsertPost threw:', err.message);
        return null;
    }
}
