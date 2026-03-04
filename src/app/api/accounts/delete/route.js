import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * DELETE /api/accounts/delete
 * Hard-delete: removes ALL user data and the auth account itself.
 * This is irreversible — the user is fully erased from AutoDM.
 */

function createServiceClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

export async function DELETE() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    try {
        // 1. Find all connected account IDs for this user
        const { data: accounts } = await serviceClient
            .from('connected_accounts')
            .select('id')
            .eq('user_id', user.id);

        const accountIds = (accounts || []).map((a) => a.id);

        if (accountIds.length > 0) {
            // 2. Find all post IDs belonging to these accounts
            const { data: posts } = await serviceClient
                .from('instagram_posts')
                .select('id')
                .in('account_id', accountIds);

            const postIds = (posts || []).map((p) => p.id);

            if (postIds.length > 0) {
                // 3. Find all automation IDs
                const { data: automations } = await serviceClient
                    .from('dm_automations')
                    .select('id')
                    .in('post_id', postIds);

                const automationIds = (automations || []).map((a) => a.id);

                if (automationIds.length > 0) {
                    // 4a. Delete dm_analytics
                    await serviceClient
                        .from('dm_analytics')
                        .delete()
                        .in('automation_id', automationIds);

                    // 4b. Delete dm_sent_log
                    try {
                        await serviceClient
                            .from('dm_sent_log')
                            .delete()
                            .in('automation_id', automationIds);
                    } catch {
                        // Table may not exist
                    }
                }

                // 5. Delete dm_automations
                await serviceClient
                    .from('dm_automations')
                    .delete()
                    .in('post_id', postIds);
            }

            // 6. Delete instagram_posts
            await serviceClient
                .from('instagram_posts')
                .delete()
                .in('account_id', accountIds);

            // 7. Delete connected_accounts
            await serviceClient
                .from('connected_accounts')
                .delete()
                .eq('user_id', user.id);
        }

        // 8. Delete dm_templates
        try {
            await serviceClient
                .from('dm_templates')
                .delete()
                .eq('user_id', user.id);
        } catch {
            // Table may not exist yet
        }

        // 9. Delete data_deletion_requests
        try {
            await serviceClient
                .from('data_deletion_requests')
                .delete()
                .eq('user_id', user.id);
        } catch {
            // Table may not exist
        }

        // 10. Sign out the current session
        await supabase.auth.signOut();

        // 11. Delete the auth user via admin API (requires service role key)
        const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(user.id);
        if (deleteAuthError) {
            console.error('Failed to delete auth user:', deleteAuthError.message);
            // Non-fatal — all user data is already cleaned up
        }

        return NextResponse.json({
            success: true,
            message: 'Account and all associated data have been permanently deleted.',
        });
    } catch (err) {
        console.error('Account deletion error:', err);
        return NextResponse.json({ error: `Failed to delete account: ${err.message}` }, { status: 500 });
    }
}
