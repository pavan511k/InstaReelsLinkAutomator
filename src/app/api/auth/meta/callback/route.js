import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
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

        // Save to Supabase (upsert)
        const supabase = await createClient();
        const { data: existingAccount } = await supabase
            .from('connected_accounts')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (existingAccount) {
            const { error: updateError } = await supabase
                .from('connected_accounts')
                .update({ ...accountData, updated_at: new Date().toISOString() })
                .eq('id', existingAccount.id);

            if (updateError) {
                console.error('Failed to update account:', updateError);
                return NextResponse.redirect(`${appUrl}/dashboard?error=save_failed`);
            }
        } else {
            const { error: insertError } = await supabase
                .from('connected_accounts')
                .insert(accountData);

            if (insertError) {
                console.error('Failed to save account:', insertError);
                return NextResponse.redirect(`${appUrl}/dashboard?error=save_failed`);
            }
        }

        return NextResponse.redirect(`${appUrl}/dashboard?connected=${connectionType}`);
    } catch (err) {
        console.error('OAuth callback error:', err);
        return NextResponse.redirect(
            `${appUrl}/dashboard?error=oauth_failed&message=${encodeURIComponent(err.message)}`
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
