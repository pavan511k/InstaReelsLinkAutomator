export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * POST /api/accounts/disconnect
 * 
 * Meta-compliant disconnect:
 * - HARD DELETES all Platform Data (posts, media URLs, profile info, tokens)
 *   as required by Meta Platform Terms Section 3(d)(i)
 * - PRESERVES DM automation configs (our own data, not Platform Data)
 *   but pauses them (is_active = false)
 * - Deactivates the connected_accounts row and scrubs Platform Data fields

 * Uses service role client to bypass RLS for reliable data deletion.
 */

function createServiceClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

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

    // Use service role for all DB mutations (bypasses RLS)
    const serviceClient = createServiceClient();

    try {
        // 1. Find the account(s) to disconnect
        let accountQuery = serviceClient
            .from('connected_accounts')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_active', true);

        if (accountId) {
            accountQuery = accountQuery.eq('id', accountId);
        }

        const { data: accounts, error: findError } = await accountQuery;

        if (findError) {
            console.error('Disconnect — failed to find accounts:', findError);
            return NextResponse.json({ error: 'Failed to find accounts' }, { status: 500 });
        }

        const accountIds = (accounts || []).map((a) => a.id);

        if (accountIds.length === 0) {
            return NextResponse.json({ error: 'No active accounts found' }, { status: 404 });
        }

        // 2. Find all post IDs for these accounts
        const { data: posts } = await serviceClient
            .from('instagram_posts')
            .select('id')
            .in('account_id', accountIds);

        const postIds = (posts || []).map((p) => p.id);

        // 3. PAUSE all automations (our data — keep but deactivate)
        if (postIds.length > 0) {
            await serviceClient
                .from('dm_automations')
                .update({ is_active: false })
                .in('post_id', postIds);
        }

        // 4. DELETE all Platform Data — posts fetched from Meta APIs
        if (accountIds.length > 0) {
            const { error: deletePostsError } = await serviceClient
                .from('instagram_posts')
                .delete()
                .in('account_id', accountIds);

            if (deletePostsError) {
                console.error('Disconnect — failed to delete posts:', deletePostsError);
            }
        }

        // 5. SCRUB Platform Data from connected_accounts and deactivate
        const { error: scrubError } = await serviceClient
            .from('connected_accounts')
            .update({
                is_active: false,
                access_token: '',  // Schema enforces NOT NULL
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

        if (scrubError) {
            console.error('Disconnect — failed to scrub account:', scrubError);
            return NextResponse.json({ error: 'Failed to deactivate account' }, { status: 500 });
        }

        console.log(`[Disconnect] Successfully disconnected ${accountIds.length} account(s), deleted ${postIds.length} posts`);

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
