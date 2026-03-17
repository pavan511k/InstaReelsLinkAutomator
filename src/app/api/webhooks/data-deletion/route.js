import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Meta Data Deletion Request Callback
 * POST /api/webhooks/data-deletion
 * 
 * When a user removes AutoDM from their Facebook/Instagram settings,
 * Meta sends a signed request to this endpoint.
 * 
 * Per Meta Platform Terms Section 3(d)(i), we MUST:
 * 1. Delete all Platform Data for this user
 * 2. Return a JSON response with a status_url and confirmation_code
 * 
 * Register this URL in: Meta App Dashboard → Settings → Basic → Data Deletion Request URL
 */
export async function POST(request) {
    try {
        const formData = await request.formData();
        const signedRequest = formData.get('signed_request');

        if (!signedRequest) {
            return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 });
        }

        // Parse the signed request
        const parsedData = parseSignedRequest(signedRequest);
        if (!parsedData) {
            return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 });
        }

        const appScopedUserId = parsedData.user_id;

        // Generate a unique confirmation code
        const confirmationCode = crypto.randomUUID();

        // Delete user data
        await deleteUserPlatformData(appScopedUserId, confirmationCode);

        // Build the status check URL
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000';

        const statusUrl = `${appUrl}/api/webhooks/data-deletion?code=${confirmationCode}`;

        // Return required response per Meta spec
        return NextResponse.json({
            url: statusUrl,
            confirmation_code: confirmationCode,
        });
    } catch (err) {
        console.error('Data deletion callback error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * GET /api/webhooks/data-deletion?code=<confirmation_code>
 * Status check endpoint — user can verify their data was deleted
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'Confirmation code required' }, { status: 400 });
    }

    try {
        // Dynamic import to avoid build issues if supabase isn't configured
        const { createClient } = await import('@/lib/supabase-server');
        const supabase = await createClient();

        const { data: deletion } = await supabase
            .from('data_deletion_requests')
            .select('status, requested_at, completed_at')
            .eq('confirmation_code', code)
            .single();

        if (!deletion) {
            return NextResponse.json({ error: 'Deletion request not found' }, { status: 404 });
        }

        return NextResponse.json({
            status: deletion.status,
            requested_at: deletion.requested_at,
            completed_at: deletion.completed_at,
        });
    } catch {
        return NextResponse.json({ error: 'Could not check status' }, { status: 500 });
    }
}

/**
 * Parse Meta's signed_request parameter
 * @see https://developers.facebook.com/docs/games/gamesonfacebook/login#parsingsr
 */
function parseSignedRequest(signedRequest) {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
        console.error('META_APP_SECRET not set — cannot verify signed request');
        return null;
    }

    const [encodedSig, payload] = signedRequest.split('.');
    if (!encodedSig || !payload) return null;

    // Decode the signature
    const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    // Verify signature using HMAC SHA256
    const expectedSig = crypto
        .createHmac('sha256', appSecret)
        .update(payload)
        .digest();

    if (!crypto.timingSafeEqual(sig, expectedSig)) {
        console.error('Data deletion: signature verification failed');
        return null;
    }

    // Decode payload
    const decodedPayload = Buffer.from(
        payload.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
    ).toString('utf8');

    return JSON.parse(decodedPayload);
}

/**
 * Delete all Platform Data for a user identified by app-scoped user ID
 */
async function deleteUserPlatformData(appScopedUserId, confirmationCode) {
    try {
        const { createClient } = await import('@/lib/supabase-server');
        const supabase = await createClient();

        // Find connected accounts by ig_user_id (which is the app-scoped ID)
        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('id, user_id')
            .or(`ig_user_id.eq.${appScopedUserId},fb_page_id.eq.${appScopedUserId}`);

        const userId = accounts?.[0]?.user_id || null;

        // Record the deletion request
        await supabase
            .from('data_deletion_requests')
            .insert({
                app_scoped_user_id: appScopedUserId,
                user_id: userId,
                confirmation_code: confirmationCode,
                status: 'processing',
            });

        if (!accounts || accounts.length === 0) {
            // No data found — mark as complete
            await supabase
                .from('data_deletion_requests')
                .update({ status: 'complete', completed_at: new Date().toISOString() })
                .eq('confirmation_code', confirmationCode);
            return;
        }

        const accountIds = accounts.map((a) => a.id);

        // Delete posts (Platform Data)
        await supabase
            .from('instagram_posts')
            .delete()
            .in('account_id', accountIds);

        // Scrub Platform Data from connected_accounts
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

        // Pause all automations + delete follow-up queue entries
        const { data: posts } = await supabase
            .from('instagram_posts')
            .select('id')
            .in('account_id', accountIds);

        if (posts && posts.length > 0) {
            const postIds = posts.map((p) => p.id);

            await supabase
                .from('dm_automations')
                .update({ is_active: false })
                .in('post_id', postIds);

            // Delete follow-up queue entries for these automations
            try {
                const { data: automations } = await supabase
                    .from('dm_automations')
                    .select('id')
                    .in('post_id', postIds);

                if (automations && automations.length > 0) {
                    await supabase
                        .from('dm_followup_queue')
                        .delete()
                        .in('automation_id', automations.map((a) => a.id));
                }
            } catch {
                // dm_followup_queue may not exist yet
            }
        }

        // Mark deletion as complete
        await supabase
            .from('data_deletion_requests')
            .update({
                status: 'complete',
                completed_at: new Date().toISOString(),
                details: { deleted_accounts: accountIds.length },
            })
            .eq('confirmation_code', confirmationCode);

    } catch (err) {
        console.error('Platform data deletion error:', err);
        // Still try to mark as failed
        try {
            const { createClient } = await import('@/lib/supabase-server');
            const supabase = await createClient();
            await supabase
                .from('data_deletion_requests')
                .update({ status: 'error', details: { error: err.message } })
                .eq('confirmation_code', confirmationCode);
        } catch {
            // Best effort
        }
    }
}
