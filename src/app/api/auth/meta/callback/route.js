import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
    exchangeCodeForInstagramToken,
    getInstagramLongLivedToken,
    getInstagramUserProfile,
    exchangeCodeForFacebookToken,
    getFacebookLongLivedToken,
    getUserPages,
    getInstagramAccount,
    getMetaUser,
} from '@/lib/meta-oauth';
import { GRAPH_API_VERSION, GRAPH_FB_BASE, GRAPH_IG_BASE } from '@/lib/meta-graph';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * Sync all posts for a user using a service-role client.
 * Called from the OAuth callback so it doesn't rely on session cookies.
 */
async function syncPostsForUser(userId, workspaceId) {
    const db = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    // Scope to the workspace just connected to so we sync exactly that
    // account, not other workspaces' accounts the user already owns.
    let q = db.from('connected_accounts').select('*').eq('is_active', true);
    q = workspaceId ? q.eq('workspace_id', workspaceId) : q.eq('user_id', userId);
    const { data: accounts } = await q;

    if (!accounts || accounts.length === 0) return;

    const allPosts = [];

    for (const account of accounts) {
        if (account.ig_user_id && (account.platform === 'instagram' || account.platform === 'both')) {
            try {
                const token = account.fb_page_access_token || account.access_token;
                // Instagram Business Login tokens must use graph.instagram.com
                // Facebook Page Access Tokens must use graph.facebook.com
                const useIgApi = !account.fb_page_access_token && account.platform === 'instagram';
                const igBase = useIgApi ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
                const igRes = await fetch(
                    `${igBase}/${GRAPH_API_VERSION}/${account.ig_user_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=100&access_token=${token}`
                );
                if (igRes.ok) {
                    const igData = await igRes.json();
                    for (const p of igData.data || []) {
                        allPosts.push({
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
                        });
                    }
                }
            } catch { /* non-fatal */ }
        }

        if (account.fb_page_id && (account.platform === 'facebook' || account.platform === 'both')) {
            try {
                const token = account.fb_page_access_token || account.access_token;
                const fbRes = await fetch(
                    `${GRAPH_FB_BASE}/${account.fb_page_id}/posts?fields=id,message,permalink_url,created_time,attachments{media_type,media{image{src}},url},comments.summary(true).limit(0),reactions.summary(true).limit(0)&limit=100&access_token=${token}`
                );
                if (fbRes.ok) {
                    const fbData = await fbRes.json();
                    for (const p of fbData.data || []) {
                        const att = p.attachments?.data?.[0];
                        const mediaUrl = att?.media?.image?.src || att?.url || null;
                        const commentsTotal  = p.comments?.summary?.total_count;
                        const reactionsTotal = p.reactions?.summary?.total_count;
                        allPosts.push({
                            account_id:     account.id,
                            ig_post_id:     `fb_${p.id}`,
                            media_type:     att?.media_type === 'video' ? 'VIDEO' : 'IMAGE',
                            media_url:      mediaUrl,
                            thumbnail_url:  mediaUrl,
                            caption:        p.message || '',
                            permalink:      p.permalink_url || '',
                            timestamp:      p.created_time,
                            is_story:       false,
                            like_count:     typeof reactionsTotal === 'number' ? reactionsTotal : null,
                            comments_count: typeof commentsTotal  === 'number' ? commentsTotal  : null,
                            synced_at:      new Date().toISOString(),
                        });
                    }
                }
            } catch { /* non-fatal */ }
        }
    }

    if (allPosts.length === 0) return;

    // Deduplicate by ig_post_id (same fix as in /api/posts/sync)
    const deduped = Object.values(
        allPosts.reduce((map, post) => { map[post.ig_post_id] = post; return map; }, {}),
    );

    await db.from('instagram_posts').upsert(deduped, { onConflict: 'ig_post_id' });
}

/**
 * GET /api/auth/meta/callback?code=xxx&state=type:userId
 * Handles OAuth callback for both Instagram Login and Facebook Login
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    console.log('[OAUTH_DEBUG] CALLBACK ENTER', JSON.stringify({
        url:          request.url,
        code,
        state,
        error,
        error_reason: searchParams.get('error_reason'),
        error_desc:   searchParams.get('error_description'),
    }));

    // User denied permissions
    if (error) {
        console.error('[OAUTH_DEBUG] OAuth provider returned error:', error, searchParams.get('error_description'));
        return NextResponse.redirect(`${appUrl}/dashboard?error=oauth_denied`);
    }

    if (!code || !state) {
        console.error('[OAUTH_DEBUG] Missing code or state', { code, state });
        return NextResponse.redirect(`${appUrl}/dashboard?error=missing_params`);
    }

    // Parse state: "connectionType:userId"
    const colonIndex = state.indexOf(':');
    const connectionType = state.substring(0, colonIndex);
    const userId = state.substring(colonIndex + 1);

    if (!connectionType || !userId) {
        console.error('[OAUTH_DEBUG] Invalid state shape', { state, connectionType, userId });
        return NextResponse.redirect(`${appUrl}/dashboard?error=invalid_state`);
    }

    console.log('[OAUTH_DEBUG] PARSED', JSON.stringify({ connectionType, userId }));

    try {
        let accountData;

        // When USE_INSTAGRAM_LOGIN is enabled in meta-oauth.js and connectionType is
        // 'instagram', the Instagram Login flow is used. Otherwise, all types use
        // Facebook OAuth, so we go through handleFacebookCallback.
        const USE_INSTAGRAM_LOGIN = true; // Must match the flag in meta-oauth.js
        if (connectionType === 'instagram' && USE_INSTAGRAM_LOGIN) {
            accountData = await handleInstagramCallback(code, userId);
        } else {
            accountData = await handleFacebookCallback(code, userId, connectionType);
        }

        // Save to Supabase — connected to the user's active workspace.
        const supabase = await createClient();
        const platform = accountData.platform;
        const workspaceId = await getActiveWorkspaceId(supabase);

        if (!workspaceId) {
            return NextResponse.redirect(`${appUrl}/dashboard?error=no_workspace`);
        }

        // Block if the same IG/FB account is already connected anywhere.
        // The unique partial index on connected_accounts(ig_user_id) /
        // (fb_page_id) enforces this at the DB level — we just need to
        // surface a friendly error before the insert fails.
        //
        // The lookup uses the SERVICE-ROLE client so it sees rows owned
        // by other users too. RLS would otherwise hide them, and a
        // cross-user collision would slip through to a generic
        // "save_failed" redirect when the unique index ultimately rejects
        // the insert.
        //
        // Two cases:
        //   1. Same user, different workspace → redirect with
        //      `account_in_other_workspace` + `target_ws` so /settings
        //      offers a "Switch to {workspace}" action.
        //   2. Different user owns it → redirect with
        //      `account_in_use_elsewhere`. We don't expose which user
        //      owns it; that's a privacy / security boundary.
        if (accountData.ig_user_id || accountData.fb_page_id) {
            const idColumn = accountData.ig_user_id ? 'ig_user_id' : 'fb_page_id';
            const idValue  = accountData.ig_user_id || accountData.fb_page_id;
            const serviceDb = createServiceClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY,
            );
            const { data: existingAnywhere } = await serviceDb
                .from('connected_accounts')
                .select('id, user_id, workspace_id')
                .eq(idColumn, idValue)
                .maybeSingle();

            if (existingAnywhere && existingAnywhere.user_id !== userId) {
                // Owned by a different user account entirely.
                const redirectUrl = new URL('/settings', appUrl);
                redirectUrl.searchParams.set('error', 'account_in_use_elsewhere');
                return NextResponse.redirect(redirectUrl.toString());
            }

            if (existingAnywhere && existingAnywhere.workspace_id !== workspaceId) {
                // Same user, just in another workspace.
                const redirectUrl = new URL('/settings', appUrl);
                redirectUrl.searchParams.set('error', 'account_in_other_workspace');
                redirectUrl.searchParams.set('target_ws', existingAnywhere.workspace_id);
                return NextResponse.redirect(redirectUrl.toString());
            }
        }

        // Check for existing account (active or inactive) for this workspace + platform
        const { data: existingAccount } = await supabase
            .from('connected_accounts')
            .select('id, is_active')
            .eq('workspace_id', workspaceId)
            .eq('platform', platform)
            .maybeSingle();

        if (existingAccount) {
            // Reactivate / refresh credentials on existing account.
            // No plan columns — plan lives in user_plans.
            const { error: updateError } = await supabase
                .from('connected_accounts')
                .update({
                    ...accountData,
                    is_active:  true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existingAccount.id);

            if (updateError) {
                console.error('Failed to update account:', updateError);
                return NextResponse.redirect(`${appUrl}/dashboard?error=save_failed`);
            }
        } else {
            // ── Brand-new connection ──────────────────────────────────────────
            // Seed default trigger keywords.
            const DEFAULT_KEYWORDS = [
                'link', 'links', 'price', 'details', 'dm', 'pp',
                'interested', 'info', 'how', 'where', 'send', 'share',
            ];
            const defaultConfig = {
                keywords:          DEFAULT_KEYWORDS,
                excludeKeywords:   [],
                triggerType:       'keywords',
                defaultMessage:    '',
                // Seed a friendly default for new accounts. The user can
                // change it (including clearing to empty) in Settings;
                // their saved value is then respected everywhere.
                defaultButtonName: 'Shop now',
                utmTag:            '',
            };

            // Insert account — credentials + config only, no plan columns.
            // workspace_id binds this account to the active workspace.
            const { error: insertError } = await supabase
                .from('connected_accounts')
                .insert({
                    ...accountData,
                    workspace_id:   workspaceId,
                    is_active:      true,
                    default_config: defaultConfig,
                });

            if (insertError) {
                console.error('Failed to save account:', insertError);
                return NextResponse.redirect(`${appUrl}/dashboard?error=save_failed`);
            }

            // Trial provisioning + trial-started email moved to the
            // email-verification callback (/auth/callback). By the time
            // the user reaches this OAuth flow, they've already verified
            // their email, so the trial row exists. Nothing to do here.
        }
        // Auto-sync posts after successful connection.
        // Uses a service-role client so this works regardless of whether the
        // session cookie survives the server-to-server fetch boundary.
        try {
            await syncPostsForUser(userId, workspaceId);
            console.log('[OAuth Callback] Auto-sync completed after connection');
        } catch (syncErr) {
            // Non-critical — user can manually re-sync later from the automation builder.
            console.warn('[OAuth Callback] Auto-sync failed (non-critical):', syncErr.message);
        }

        // Subscribe the connected account to Meta webhook events so comment/DM
        // payloads are actually delivered to our webhook URL.
        try {
            await subscribeToWebhookEvents(accountData);
        } catch (subErr) {
            console.warn('[OAuth Callback] Webhook subscription failed (non-critical):', subErr.message);
        }

        // Send new users straight to /automations so they can configure their
        // first automation immediately. (Legacy /posts page was removed in the
        // builder refactor — the same use case is now covered there.)
        return NextResponse.redirect(`${appUrl}/automations?connected=${connectionType}`);
    } catch (err) {
        console.error('[OAUTH_DEBUG] CALLBACK CAUGHT', JSON.stringify({
            message: err?.message,
            name:    err?.name,
            stack:   err?.stack,
        }));
        // Pass the thrown error message as the 'error' query param so ConnectAccount.js
        // can look it up in ERROR_MESSAGES (e.g. 'no_facebook_page', 'no_instagram_account').
        // Fall back to 'oauth_failed' for generic/unexpected errors.
        const knownErrors = ['no_facebook_page', 'no_instagram_account', 'save_failed'];
        const errorKey = knownErrors.includes(err.message) ? err.message : 'oauth_failed';
        return NextResponse.redirect(
            `${appUrl}/dashboard?error=${errorKey}`
        );
    }
}

/**
 * Subscribe the connected account to Meta webhook events.
 *
 * Instagram Business Login  → subscribes the IG user via graph.instagram.com
 *   fields: comments, messages
 * Facebook Login (both/facebook) → subscribes the FB Page via graph.facebook.com
 *   fields: instagram_comments, messages, feed
 *
 * Without this call Meta will NOT deliver any webhook payloads for the account
 * even if the webhook URL is correctly configured in the Developer Console.
 */
async function subscribeToWebhookEvents(accountData) {
    if (accountData.platform === 'instagram') {
        // messaging_postbacks: required to receive button-template postback
        // events (follow-gate, opening-message, ice-breaker taps). Without
        // this, ice-breaker taps never reach our webhook handler.
        const url =
            `${GRAPH_IG_BASE}/${accountData.ig_user_id}/subscribed_apps` +
            `?subscribed_fields=comments%2Cmessages%2Cmessaging_postbacks%2Cmentions` +
            `&access_token=${encodeURIComponent(accountData.access_token)}`;
        const res  = await fetch(url, { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.success) {
            console.warn('[OAuth] IG webhook subscription response:', JSON.stringify(data));
        } else {
            console.log('[OAuth] ✅ Instagram webhook subscribed (comments + messages + messaging_postbacks + mentions)');
        }
    } else if (accountData.fb_page_id && accountData.fb_page_access_token) {
        // FB Page object subscription. Meta's Page-object subscribed_fields
        // does NOT include `instagram_comments` — listing it makes Meta reject
        // the entire request with error 100, dropping `messages` and
        // `messaging_postbacks` too. IG events from a linked IG Business
        // account come via the Instagram-object subscription, not here.
        //
        //   feed                  → FB Page post comments
        //   messages              → DMs to the Page (inbound)
        //   messaging_postbacks   → button-template tap events from Page DMs
        const url =
            `${GRAPH_FB_BASE}/${accountData.fb_page_id}/subscribed_apps` +
            `?subscribed_fields=feed%2Cmessages%2Cmessaging_postbacks` +
            `&access_token=${encodeURIComponent(accountData.fb_page_access_token)}`;
        const res  = await fetch(url, { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.success) {
            console.warn('[OAuth] FB page webhook subscription response:', JSON.stringify(data));
        } else {
            console.log('[OAuth] ✅ Facebook page webhook subscribed (feed + messages + messaging_postbacks)');
        }
    }
}

/**
 * Handle Instagram Login callback
 * Uses Instagram's own token endpoints
 */
async function handleInstagramCallback(code, userId) {
    // Each Meta call is labeled so the OAuth catch block can tell us
    // exactly which step Meta rejected. The minified production stack
    // trace hides this otherwise — debugging "Unsupported request"
    // becomes a guessing game.
    let shortToken;
    try {
        shortToken = await exchangeCodeForInstagramToken(code);
    } catch (err) {
        console.error('[OAuth/IG] Step 1 (exchangeCodeForInstagramToken) failed:', err.message);
        throw err;
    }

    let longToken;
    try {
        longToken = await getInstagramLongLivedToken(shortToken.access_token);
    } catch (err) {
        console.error('[OAuth/IG] Step 2 (getInstagramLongLivedToken) failed:', err.message);
        throw err;
    }
    const expiresIn = longToken.expires_in || 5184000;

    let profile;
    try {
        profile = await getInstagramUserProfile(longToken.access_token);
    } catch (err) {
        console.error('[OAuth/IG] Step 3 (getInstagramUserProfile) failed:', err.message);
        throw err;
    }

    return {
        user_id: userId,
        platform: 'instagram',
        meta_user_id: profile.user_id || shortToken.user_id,
        access_token: longToken.access_token,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        ig_user_id: profile.user_id || shortToken.user_id,
        ig_username: profile.username,
        ig_profile_picture_url: profile.profile_picture_url || null,
        scopes: ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments'],
    };
}

/**
 * Handle Facebook Login callback (for Facebook and Both connection types)
 * Uses Facebook's token endpoints + Graph API to find IG Business Account
 */
async function handleFacebookCallback(code, userId, connectionType) {
    // 1. Exchange code for short-lived Facebook token
    const shortToken = await exchangeCodeForFacebookToken(code);

    // 2. Exchange for long-lived token
    const longToken = await getFacebookLongLivedToken(shortToken.access_token);
    const accessToken = longToken.access_token;
    const expiresIn = longToken.expires_in || 5184000;

    // 3. Get Meta user info
    const metaUser = await getMetaUser(accessToken);

    // 4. Get user's Facebook Pages
    const pages = await getUserPages(accessToken);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const accountData = {
        user_id: userId,
        platform: connectionType,
        meta_user_id: metaUser.id,
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        scopes: shortToken.scope ? shortToken.scope.split(',') : [],
    };

    // Find Instagram Business Account if needed
    if (connectionType === 'both') {
        for (const page of pages) {
            const igAccount = await getInstagramAccount(page.id, page.access_token);
            if (igAccount) {
                accountData.ig_user_id = igAccount.id;
                accountData.ig_username = igAccount.username;
                accountData.ig_profile_picture_url = igAccount.profile_picture_url;
                accountData.fb_page_id = page.id;
                accountData.fb_page_name = page.name;
                accountData.fb_page_access_token = page.access_token;
                break;
            }
        }
        if (!accountData.ig_user_id) {
            throw new Error('no_instagram_account');
        }
    }

    // Store Facebook Page info
    if (connectionType === 'facebook' || connectionType === 'both') {
        if (pages.length > 0 && !accountData.fb_page_id) {
            const page = pages[0];
            accountData.fb_page_id = page.id;
            accountData.fb_page_name = page.name;
            accountData.fb_page_access_token = page.access_token;
        }
        if (!accountData.fb_page_id) {
            throw new Error('no_facebook_page');
        }
    }

    return accountData;
}
