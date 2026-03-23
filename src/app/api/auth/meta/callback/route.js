import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendTrialStartedEmail } from '@/lib/email';
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

/**
 * Sync all posts for a user using a service-role client.
 * Called from the OAuth callback so it doesn't rely on session cookies.
 */
async function syncPostsForUser(userId) {
    const db = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data: accounts } = await db
        .from('connected_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

    if (!accounts || accounts.length === 0) return;

    const allPosts = [];

    for (const account of accounts) {
        if (account.ig_user_id && (account.platform === 'instagram' || account.platform === 'both')) {
            try {
                const token = account.fb_page_access_token || account.access_token;
                const igRes = await fetch(
                    `https://graph.facebook.com/v21.0/${account.ig_user_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=100&access_token=${token}`
                );
                if (igRes.ok) {
                    const igData = await igRes.json();
                    for (const p of igData.data || []) {
                        allPosts.push({
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
                        });
                    }
                }
            } catch { /* non-fatal */ }
        }

        if (account.fb_page_id && (account.platform === 'facebook' || account.platform === 'both')) {
            try {
                const token = account.fb_page_access_token || account.access_token;
                const fbRes = await fetch(
                    `https://graph.facebook.com/v21.0/${account.fb_page_id}/posts?fields=id,message,permalink_url,created_time,attachments{media_type,media{image{src}},url}&limit=100&access_token=${token}`
                );
                if (fbRes.ok) {
                    const fbData = await fbRes.json();
                    for (const p of fbData.data || []) {
                        const att = p.attachments?.data?.[0];
                        const mediaUrl = att?.media?.image?.src || att?.url || null;
                        allPosts.push({
                            account_id: account.id,
                            ig_post_id: `fb_${p.id}`,
                            media_type: att?.media_type === 'video' ? 'VIDEO' : 'IMAGE',
                            media_url: mediaUrl,
                            thumbnail_url: mediaUrl,
                            caption: p.message || '',
                            permalink: p.permalink_url || '',
                            timestamp: p.created_time,
                            is_story: false,
                            synced_at: new Date().toISOString(),
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

    // User denied permissions
    if (error) {
        console.error('OAuth error:', error, searchParams.get('error_description'));
        return NextResponse.redirect(`${appUrl}/dashboard?error=oauth_denied`);
    }

    if (!code || !state) {
        return NextResponse.redirect(`${appUrl}/dashboard?error=missing_params`);
    }

    // Parse state: "connectionType:userId"
    const colonIndex = state.indexOf(':');
    const connectionType = state.substring(0, colonIndex);
    const userId = state.substring(colonIndex + 1);

    if (!connectionType || !userId) {
        return NextResponse.redirect(`${appUrl}/dashboard?error=invalid_state`);
    }

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

        // Save to Supabase — multi-account: one row per user per platform
        const supabase = await createClient();
        const platform = accountData.platform;

        // Check for existing account (active or inactive) for this user + platform
        const { data: existingAccount } = await supabase
            .from('connected_accounts')
            .select('id, is_active')
            .eq('user_id', userId)
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
                defaultButtonName: '',
                utmTag:            '',
            };

            // Insert account — credentials + config only, no plan columns.
            const { error: insertError } = await supabase
                .from('connected_accounts')
                .insert({ ...accountData, is_active: true, default_config: defaultConfig });

            if (insertError) {
                console.error('Failed to save account:', insertError);
                return NextResponse.redirect(`${appUrl}/dashboard?error=save_failed`);
            }

            // ── Upsert trial into user_plans (only if no plan row exists yet) ──
            // If the user already paid before connecting, their user_plans row is
            // already set to 'pro' by the payment webhook — don't overwrite it.
            const trialEndsAt = new Date();
            trialEndsAt.setDate(trialEndsAt.getDate() + 30);

            try {
                // ignoreDuplicates: true means: insert if no row exists, skip if one already does.
                // This preserves a pre-existing paid plan row.
                await supabase.from('user_plans').upsert(
                    { user_id: userId, plan: 'free', trial_ends_at: trialEndsAt.toISOString() },
                    { onConflict: 'user_id', ignoreDuplicates: true },
                );
            } catch { /* non-fatal — layout falls back to 'free' */ }

            // Send trial-started email to the new user (non-critical)
            try {
                const supabaseForEmail = await createClient();
                const { data: { user: newUser } } = await supabaseForEmail.auth.getUser();
                const userEmail = newUser?.email;
                const userName  = newUser?.user_metadata?.full_name || '';
                if (userEmail) {
                    sendTrialStartedEmail({
                        to:          userEmail,
                        name:        userName,
                        igUsername:  accountData.ig_username || '',
                        trialEndsAt: trialEndsAt.toISOString(),
                    }).catch((e) => console.warn('[Email] Trial started email failed:', e.message));
                }
            } catch (emailErr) {
                console.warn('[Email] Could not send trial email:', emailErr.message);
            }
        }
        // Auto-sync posts after successful connection.
        // Uses a service-role client so this works regardless of whether the
        // session cookie survives the server-to-server fetch boundary.
        try {
            await syncPostsForUser(userId);
            console.log('[OAuth Callback] Auto-sync completed after connection');
        } catch (syncErr) {
            // Non-critical — user can manually sync later via the Posts page.
            console.warn('[OAuth Callback] Auto-sync failed (non-critical):', syncErr.message);
        }

        // Send new users straight to Posts & Reels so they can configure automations immediately
        return NextResponse.redirect(`${appUrl}/posts?connected=${connectionType}`);
    } catch (err) {
        console.error('OAuth callback error:', err);
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
 * Handle Instagram Login callback
 * Uses Instagram's own token endpoints
 */
async function handleInstagramCallback(code, userId) {
    // 1. Exchange code for short-lived Instagram token
    const shortToken = await exchangeCodeForInstagramToken(code);

    // 2. Exchange for long-lived token (60 days)
    const longToken = await getInstagramLongLivedToken(shortToken.access_token);
    const expiresIn = longToken.expires_in || 5184000;

    // 3. Get Instagram user profile
    const profile = await getInstagramUserProfile(longToken.access_token);

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
