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

    // Mobile source detection: when state ends with ":mobile", the OAuth
    // flow was initiated from the mobile app. We need this BEFORE the
    // error/missing-params guards so even pre-flight failures route back
    // to the mobile deep link (otherwise the mobile app sees Safari hang
    // on /dashboard?error=...).
    const isMobileSource = typeof state === 'string' && state.endsWith(':mobile');

    function finishRedirect({ webPath, mobileStatus, mobileMessage, mobileType }) {
        if (isMobileSource) {
            const p = new URLSearchParams();
            if (mobileStatus)  p.set('status',  mobileStatus);
            if (mobileMessage) p.set('message', mobileMessage);
            if (mobileType)    p.set('type',    mobileType);
            return new NextResponse(null, {
                status: 303,
                headers: { Location: `autodm://oauth-complete?${p.toString()}` },
            });
        }
        return NextResponse.redirect(`${appUrl}${webPath}`);
    }

    // User denied permissions
    if (error) {
        console.error('[OAuth] Provider returned error:', error, searchParams.get('error_description'));
        return finishRedirect({ webPath: '/dashboard?error=oauth_denied', mobileStatus: 'err', mobileMessage: 'oauth_denied' });
    }

    if (!code || !state) {
        return finishRedirect({ webPath: '/dashboard?error=missing_params', mobileStatus: 'err', mobileMessage: 'missing_params' });
    }

    // Parse state: "connectionType:userId" — plus optional ":mobile" suffix
    // when the OAuth flow was initiated from the mobile app. We strip the
    // suffix off the userId before passing it downstream so all existing
    // logic (token exchange, account upsert) stays identical.
    const colonIndex = state.indexOf(':');
    const connectionType = state.substring(0, colonIndex);
    const stateTail      = state.substring(colonIndex + 1);
    const userId         = isMobileSource ? stateTail.slice(0, -':mobile'.length) : stateTail;

    if (!connectionType || !userId) {
        return finishRedirect({ webPath: '/dashboard?error=invalid_state', mobileStatus: 'err', mobileMessage: 'invalid_state' });
    }

    try {
        const accountData = connectionType === 'instagram'
            ? await handleInstagramCallback(code, userId)
            : await handleFacebookCallback(code, userId, connectionType);

        // Save to Supabase — connected to the user's active workspace.
        // Web flow has a session cookie; getActiveWorkspaceId reads it
        // and RLS-scoped client writes are fine.
        // Mobile flow has no cookie (request originated from WebBrowser
        // outside the app's cookie jar), so we use the service-role
        // client for both the workspace lookup and the upsert. The
        // workspace fallback ("user's oldest") matches the mobile app's
        // own bootstrap, so the row lands where the user expects.
        const userSupabase = await createClient();
        const platform = accountData.platform;
        let workspaceId = null;

        // For mobile we use the service-role client for all DB writes
        // since there's no auth.uid() to satisfy RLS. The user_id we
        // insert is already validated (came from the bearer-token check
        // in /api/auth/meta/connect).
        const supabase = isMobileSource
            ? createServiceClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY,
            )
            : userSupabase;

        if (isMobileSource) {
            const { data: ws } = await supabase
                .from('workspaces')
                .select('id')
                .eq('owner_id', userId)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
            workspaceId = ws?.id ?? null;

            // First-time mobile users may not have a workspace yet — the
            // schema's bootstrap INSERT only ran for users who existed at
            // migration time. Auto-create a Default workspace so the
            // connect flow doesn't dead-end with `no_workspace`. Uses the
            // service-role client (already in `supabase` here for mobile
            // source), so RLS is bypassed.
            if (!workspaceId) {
                const { data: created, error: createErr } = await supabase
                    .from('workspaces')
                    .insert({ owner_id: userId, name: 'Default', slug: 'default' })
                    .select('id')
                    .single();
                if (createErr) {
                    console.warn('[OAuth/Callback] Default workspace create failed:', createErr.message);
                } else if (created?.id) {
                    workspaceId = created.id;
                    // Mirror the schema bootstrap: every owner is also a
                    // workspace_member with role=owner. Some downstream
                    // policies key off membership rather than ownership.
                    await supabase
                        .from('workspace_members')
                        .insert({ workspace_id: workspaceId, user_id: userId, role: 'owner' })
                        .then(() => null, () => null);
                }
            }
        } else {
            workspaceId = await getActiveWorkspaceId(userSupabase);
        }

        if (!workspaceId) {
            return finishRedirect({ webPath: '/dashboard?error=no_workspace', mobileStatus: 'err', mobileMessage: 'no_workspace' });
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
                return finishRedirect({
                    webPath: '/settings?error=account_in_use_elsewhere',
                    mobileStatus: 'err',
                    mobileMessage: 'account_in_use_elsewhere',
                });
            }

            if (existingAnywhere && existingAnywhere.workspace_id !== workspaceId) {
                // Same user, just in another workspace.
                const webPath =
                    `/settings?error=account_in_other_workspace&target_ws=${encodeURIComponent(existingAnywhere.workspace_id)}`;
                return finishRedirect({
                    webPath,
                    mobileStatus: 'err',
                    mobileMessage: 'account_in_other_workspace',
                });
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
                return finishRedirect({ webPath: '/dashboard?error=save_failed', mobileStatus: 'err', mobileMessage: 'save_failed' });
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
                return finishRedirect({ webPath: '/dashboard?error=save_failed', mobileStatus: 'err', mobileMessage: 'save_failed' });
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
        // first automation immediately. Mobile flows route back to the deep
        // link (autodm://oauth-complete) — the mobile app's oauth-complete
        // screen then takes the user to (tabs).
        return finishRedirect({
            webPath: `/automations?connected=${connectionType}`,
            mobileStatus: 'ok',
            mobileType:   connectionType,
        });
    } catch (err) {
        console.error('[OAuth] Callback failed:', err.message);
        // Pass the thrown error message as the 'error' query param so ConnectAccount.js
        // can look it up in ERROR_MESSAGES (e.g. 'no_facebook_page', 'no_instagram_account').
        // Fall back to 'oauth_failed' for generic/unexpected errors.
        const knownErrors = ['no_facebook_page', 'no_instagram_account', 'save_failed'];
        const errorKey = knownErrors.includes(err.message) ? err.message : 'oauth_failed';
        return finishRedirect({ webPath: `/dashboard?error=${errorKey}`, mobileStatus: 'err', mobileMessage: errorKey });
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
 * Handle Instagram Login callback.
 *
 * Meta's documented 3-step flow for Instagram API with Instagram Login:
 *   1. Exchange the OAuth code for a short-lived access token (1 hour).
 *   2. Exchange the short-lived token for a long-lived one (60 days).
 *   3. Fetch the user's IG profile so we can store username + avatar.
 */
async function handleInstagramCallback(code, userId) {
    const shortToken = await exchangeCodeForInstagramToken(code);
    const longToken  = await getInstagramLongLivedToken(shortToken.access_token);
    const profile    = await getInstagramUserProfile(longToken.access_token);

    return {
        user_id:                userId,
        platform:               'instagram',
        meta_user_id:           profile.user_id || shortToken.user_id,
        access_token:           longToken.access_token,
        token_expires_at:       new Date(Date.now() + longToken.expires_in * 1000).toISOString(),
        ig_user_id:             profile.user_id || shortToken.user_id,
        ig_username:            profile.username,
        ig_profile_picture_url: profile.profile_picture_url || null,
        // Use the actual permissions Meta granted (returned on Step 1) rather
        // than a hardcoded list that can drift when scopes are added/removed.
        scopes:                 shortToken.permissions || [],
    };
}

/**
 * Handle Facebook Login callback. Only fires for connectionType='facebook';
 * the 'both' (FB + linked IG) type was removed from /api/auth/meta/connect,
 * so new connections always land here as pure-FB. Existing 'both' rows in
 * the DB are read elsewhere but never re-enter this function.
 */
async function handleFacebookCallback(code, userId, connectionType) {
    const shortToken  = await exchangeCodeForFacebookToken(code);
    const longToken   = await getFacebookLongLivedToken(shortToken.access_token);
    const accessToken = longToken.access_token;
    const expiresIn   = longToken.expires_in || 5184000;

    const metaUser = await getMetaUser(accessToken);
    const pages    = await getUserPages(accessToken);

    const accountData = {
        user_id:          userId,
        platform:         connectionType,
        meta_user_id:     metaUser.id,
        access_token:     accessToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        scopes:           shortToken.scope ? shortToken.scope.split(',') : [],
    };

    if (pages.length === 0) {
        throw new Error('no_facebook_page');
    }

    const page = pages[0];
    accountData.fb_page_id           = page.id;
    accountData.fb_page_name         = page.name;
    accountData.fb_page_access_token = page.access_token;
    accountData.fb_page_picture_url  = page.picture?.data?.url || null;

    return accountData;
}
