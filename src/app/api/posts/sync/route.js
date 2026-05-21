import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { GRAPH_API_VERSION, GRAPH_FB_BASE } from '@/lib/meta-graph';
import { bindPendingNextPostAutomations } from '@/lib/next-post-binding';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * POST /api/posts/sync
 * Fetches posts from all connected Instagram/Facebook accounts and upserts to DB.
 *
 * Two auth paths:
 *   - Web: session cookie via supabase-server createClient().
 *   - Mobile: Authorization: Bearer <JWT> header + ?workspace_id=<uuid>
 *     query param (mobile doesn't have the active_workspace_id cookie).
 *     Validated against the admin client and scoped to a workspace the
 *     user owns or is a member of.
 *
 * IMPORTANT: allPosts is deduplicated by ig_post_id before the upsert.
 * A user can have both a 'both' account and a 'facebook' account active at the
 * same time (different platform values, so the unique constraint allows it).
 * If they share the same Facebook Page, the sync loop produces two entries with
 * the same ig_post_id ('fb_<postId>'), which causes Postgres to throw:
 *   "ON CONFLICT DO UPDATE command cannot affect row a second time"
 * Deduplication prevents this.
 */
export async function POST(request) {
    let user = null;
    let workspaceId = null;
    let supabase = null;

    // Mobile path: Bearer token. The cookie client wouldn't see it, so
    // we resolve the user via the service-role admin client.
    const authHeader = request?.headers?.get?.('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const authPath = bearer ? 'mobile-bearer' : 'web-cookie';
    console.log('[PostsSync] Inbound:', { authPath });

    if (bearer) {
        const admin = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
        );
        const { data, error } = await admin.auth.getUser(bearer);
        if (error || !data?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        user = data.user;
        supabase = admin;
        const { searchParams } = new URL(request.url);
        const requestedWs = searchParams.get('workspace_id');
        console.log('[PostsSync] Bearer auth resolved user', user.id, 'requestedWs=', requestedWs);
        if (requestedWs) {
            const { data: owned } = await admin
                .from('workspaces')
                .select('id')
                .eq('owner_id', user.id)
                .eq('id', requestedWs)
                .maybeSingle();
            if (owned?.id) workspaceId = owned.id;
            if (!workspaceId) {
                const { data: member } = await admin
                    .from('workspace_members')
                    .select('workspace_id')
                    .eq('user_id', user.id)
                    .eq('workspace_id', requestedWs)
                    .in('role', ['owner', 'admin'])
                    .maybeSingle();
                if (member?.workspace_id) workspaceId = member.workspace_id;
            }
            if (!workspaceId) {
                console.warn('[PostsSync] requestedWs', requestedWs, 'not accessible — falling back to oldest workspace');
            }
        }
        if (!workspaceId) {
            const { data: oldest } = await admin
                .from('workspaces')
                .select('id')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
            workspaceId = oldest?.id ?? null;
            console.log('[PostsSync] Fallback workspace =', workspaceId);
        }
    } else {
        // Web path: cookie session.
        supabase = await createClient();
        ({ data: { user } } = await supabase.auth.getUser());
        if (user) workspaceId = await getActiveWorkspaceId(supabase);
    }

    if (!user) {
        console.warn('[PostsSync] No user resolved');
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!workspaceId) {
        console.warn('[PostsSync] No workspace resolved for user', user.id);
        return NextResponse.json({ error: 'No active workspace' }, { status: 400 });
    }
    console.log('[PostsSync] Resolved:', { user_id: user.id, workspace_id: workspaceId });

    // Get all active connected accounts in this workspace
    const { data: accounts, error: accountError } = await supabase
        .from('connected_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true);

    if (accountError) {
        console.error('[PostsSync] Account lookup error:', accountError);
        return NextResponse.json({ error: 'No connected account found' }, { status: 400 });
    }
    if (!accounts || accounts.length === 0) {
        console.warn('[PostsSync] No active accounts in workspace', workspaceId);
        return NextResponse.json({ error: 'No connected account found' }, { status: 400 });
    }
    console.log('[PostsSync] Accounts to sync:', accounts.length, accounts.map((a) => ({ id: a.id, platform: a.platform, ig_user_id: a.ig_user_id, fb_page_id: a.fb_page_id })));

    const allPosts = [];
    const syncedPlatforms = [];
    const accountReports = []; // per-account post/story counts + errors for diagnostic response
    // Per-account list of currently-live story IDs from Graph. Anything in
    // our DB tagged is_story=true for the account but missing from this set
    // was either deleted by the user or naturally expired — we mark those
    // expired immediately so the UI stops offering "Configure" on dead stories.
    const liveStoryIdsByAccount = {};

    try {
        for (const account of accounts) {
            liveStoryIdsByAccount[account.id] = [];
            const report = { account_id: account.id, platform: account.platform, ig_posts: 0, ig_stories: 0, fb_posts: 0, errors: [] };

            // Fetch Instagram posts if Instagram is connected
            if (account.ig_user_id && (account.platform === 'instagram' || account.platform === 'both')) {
                // Instagram Business Login tokens (platform=instagram, no fb_page_access_token)
                // must use graph.instagram.com — NOT graph.facebook.com.
                // Facebook Login tokens (platform=both/facebook, has fb_page_access_token)
                // must use graph.facebook.com.
                const igToken = account.fb_page_access_token || account.access_token;
                const useIgApi = !account.fb_page_access_token && account.platform === 'instagram';

                // Fetch Posts — wrapped so one failing account doesn't abort the whole sync.
                let igPosts = [];
                try {
                    igPosts = await fetchInstagramPosts(account.ig_user_id, igToken, useIgApi);
                    report.ig_posts = igPosts.length;
                    console.log(`[PostsSync] IG posts for ${account.ig_user_id}:`, igPosts.length, useIgApi ? '(IG API)' : '(FB API)');
                } catch (igErr) {
                    report.errors.push({ kind: 'ig_posts', message: igErr.message });
                    console.error(`[PostsSync] IG posts fetch failed for ${account.ig_user_id}:`, igErr.message);
                }
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
                    // Engagement counts may be undefined on the API response
                    // (older accounts, certain media types). Coerce to null
                    // so the column accepts the value.
                    like_count:     typeof p.like_count     === 'number' ? p.like_count     : null,
                    comments_count: typeof p.comments_count === 'number' ? p.comments_count : null,
                    synced_at: new Date().toISOString(),
                })));

                // Fetch Stories (Active items within 24h limit).
                // null = fetch failed → skip the expired-sweep for this account.
                let igStories = null;
                try {
                    igStories = await fetchInstagramStories(account.ig_user_id, igToken, useIgApi);
                    report.ig_stories = igStories?.length ?? 0;
                    console.log(`[PostsSync] IG stories for ${account.ig_user_id}:`, igStories?.length ?? 'null (fetch error)');
                } catch (storyErr) {
                    report.errors.push({ kind: 'ig_stories', message: storyErr.message });
                    console.error(`[PostsSync] IG stories fetch failed for ${account.ig_user_id}:`, storyErr.message);
                }
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
                let fbPosts = [];
                try {
                    fbPosts = await fetchFacebookPosts(account.fb_page_id, account.fb_page_access_token || account.access_token);
                    report.fb_posts = fbPosts.length;
                    console.log(`[PostsSync] FB posts for page ${account.fb_page_id}:`, fbPosts.length);
                } catch (fbErr) {
                    report.errors.push({ kind: 'fb_posts', message: fbErr.message });
                    console.error(`[PostsSync] FB posts fetch failed for page ${account.fb_page_id}:`, fbErr.message);
                }
                allPosts.push(...fbPosts.map((p) => {
                    const attachment = p.attachments?.data?.[0];
                    // media{image{src}} is explicitly requested in fetchFacebookPosts so this path works.
                    // attachment.url is the linked page URL (not a media URL) — only used as a last resort.
                    const mediaUrl = attachment?.media?.image?.src || attachment?.url || null;
                    const mediaType = attachment?.media_type === 'video' ? 'VIDEO' : 'IMAGE';
                    // FB engagement comes back via summary objects; total_count
                    // is the only field we need. .limit(0) suppresses the
                    // actual comment/reaction list so payloads stay small.
                    const commentsTotal  = p.comments?.summary?.total_count;
                    const reactionsTotal = p.reactions?.summary?.total_count;

                    return {
                        account_id:     account.id,
                        ig_post_id:     `fb_${p.id}`,
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
                }));
                syncedPlatforms.push('facebook');
            }

            accountReports.push(report);
        }

        console.log('[PostsSync] Fetch complete:', { totalRawItems: allPosts.length, accountReports });

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

        // Upsert posts (insert or update on conflict). If the engagement
        // columns (`like_count`/`comments_count`) don't exist yet (the
        // migration `add-post-engagement.sql` hasn't run on this DB),
        // Postgres rejects the whole batch — strip those fields and
        // retry once so sync still works on a pre-migration DB.
        if (deduped.length > 0) {
            let { error: upsertError } = await supabase
                .from('instagram_posts')
                .upsert(deduped, { onConflict: 'ig_post_id' });

            if (upsertError) {
                const msg = upsertError.message || '';
                const isMissingEngagement =
                    /like_count|comments_count/i.test(msg) || /column .* does not exist/i.test(msg);
                if (isMissingEngagement) {
                    const stripped = deduped.map(({ like_count, comments_count, ...rest }) => rest);
                    ({ error: upsertError } = await supabase
                        .from('instagram_posts')
                        .upsert(stripped, { onConflict: 'ig_post_id' }));
                }
            }

            if (upsertError) {
                console.error('Failed to save posts:', upsertError);
                return NextResponse.json({ error: 'Failed to save posts' }, { status: 500 });
            }
        }

        await bindPendingNextPostAutomations(supabase, workspaceId, accounts.map((a) => a.id));

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

        const responsePayload = {
            success: true,
            authPath,
            workspaceId,
            synced: deduped.length,
            platforms: syncedPlatforms,
            accountCount: accounts.length,
            accountReports,
        };
        console.log('[PostsSync] ✅ Done:', responsePayload);
        return NextResponse.json(responsePayload);
    } catch (err) {
        console.error('[PostsSync] Sync error:', err);
        return NextResponse.json({
            error: `Sync failed: ${err.message}`,
            authPath,
            workspaceId,
            accountReports,
        }, { status: 500 });
    }
}

/**
 * Fetch posts from Instagram Graph API
 * useIgApi=true  → Instagram Business Login token → graph.instagram.com
 * useIgApi=false → Facebook Page Access Token    → graph.facebook.com
 */
async function fetchInstagramPosts(igUserId, accessToken, useIgApi = false) {
    // like_count + comments_count are surfaced on /media for IG Business
    // accounts (both via FB Graph and IG Graph). Reels and posts both
    // populate these; Stories don't, which is why fetchInstagramStories
    // intentionally omits them.
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
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
    const fields = 'id,message,permalink_url,created_time,attachments{media_type,media{image{src}},url},comments.summary(true).limit(0),reactions.summary(true).limit(0)';
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
