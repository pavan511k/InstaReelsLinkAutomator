import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/accounts/disconnect
 * 
 * Meta-compliant disconnect:
 * - HARD DELETES all Platform Data (posts, media URLs, profile info, tokens)
 *   as required by Meta Platform Terms Section 3(d)(i)
 * - PRESERVES DM automation configs (our own data, not Platform Data)
 *   but pauses them (is_active = false)
 * - Deactivates the connected_accounts row and scrubs Platform Data fields
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let accountId;
    try {
        const body = await request.json();
        accountId = body.accountId;
    } catch {
        // No body provided
    }

    try {
        // 1. Find the account(s) to disconnect
        let accountQuery = supabase
            .from('connected_accounts')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_active', true);

        if (accountId) {
            accountQuery = accountQuery.eq('id', accountId);
        }

        const { data: accounts } = await accountQuery;
        const accountIds = (accounts || []).map((a) => a.id);

        if (accountIds.length === 0) {
            return NextResponse.json({ error: 'No active accounts found' }, { status: 404 });
        }

        // 2. Find all post IDs for these accounts
        const { data: posts } = await supabase
            .from('instagram_posts')
            .select('id')
            .in('account_id', accountIds);

        const postIds = (posts || []).map((p) => p.id);

        // 3. PAUSE all automations (our data — keep but deactivate)
        if (postIds.length > 0) {
            await supabase
                .from('dm_automations')
                .update({ is_active: false })
                .in('post_id', postIds);
        }

        // 4. DELETE all Platform Data — posts fetched from Meta APIs
        //    This includes: captions, media_urls, thumbnail_urls, ig_post_id,
        //    timestamps — all came from the Graph API
        if (accountIds.length > 0) {
            await supabase
                .from('instagram_posts')
                .delete()
                .in('account_id', accountIds);
        }

        // 5. SCRUB Platform Data from connected_accounts and deactivate
        //    Remove: access_token, ig_user_id, ig_username, ig_profile_picture_url,
        //    fb_page_id, fb_page_name, fb_page_access_token, scopes
        //    Keep: id, user_id, platform, is_active=false (we know they HAD a connection)
        await supabase
            .from('connected_accounts')
            .update({
                is_active: false,
                access_token: null,
                ig_user_id: null,
                ig_username: null,
                ig_profile_picture_url: null,
                fb_page_id: null,
                fb_page_name: null,
                fb_page_access_token: null,
                scopes: null,
                updated_at: new Date().toISOString(),
            })
            .in('id', accountIds);

        return NextResponse.json({
            success: true,
            message: 'Account disconnected. All Platform Data (posts, profile info) has been deleted per Meta policy. Your DM automation configs are preserved but paused.',
            deletedPosts: postIds.length,
        });
    } catch (err) {
        console.error('Disconnect error:', err);
        return NextResponse.json({ error: `Disconnect failed: ${err.message}` }, { status: 500 });
    }
}
