export const runtime = 'edge';

import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Meta Deauthorize Callback
 * POST /api/webhooks/deauthorize
 * 
 * Called when a user removes AutoDM from their Instagram/Facebook settings.
 * This is separate from the Data Deletion callback — deauthorization means
 * the app can no longer make API calls on behalf of this user.
 * 
 * We treat this the same as disconnect: scrub all Platform Data.
 * 
 * Register this URL in: Meta App Dashboard → Settings → Basic → Deauthorize Callback URL
 */
export async function POST(request) {
    try {
        const formData = await request.formData();
        const signedRequest = formData.get('signed_request');

        if (!signedRequest) {
            return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 });
        }

        // Parse and verify the signed request
        const parsedData = parseSignedRequest(signedRequest);
        if (!parsedData) {
            return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 });
        }

        const appScopedUserId = parsedData.user_id;
        console.log(`Deauthorize callback received for user: ${appScopedUserId}`);

        // Delete all Platform Data for this user
        await handleDeauthorization(appScopedUserId);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Deauthorize callback error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * Parse Meta's signed_request parameter
 */
function parseSignedRequest(signedRequest) {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
        console.error('META_APP_SECRET not set — cannot verify signed request');
        return null;
    }

    const [encodedSig, payload] = signedRequest.split('.');
    if (!encodedSig || !payload) return null;

    const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    const expectedSig = crypto
        .createHmac('sha256', appSecret)
        .update(payload)
        .digest();

    if (!crypto.timingSafeEqual(sig, expectedSig)) {
        console.error('Deauthorize: signature verification failed');
        return null;
    }

    const decodedPayload = Buffer.from(
        payload.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
    ).toString('utf8');

    return JSON.parse(decodedPayload);
}

/**
 * Handle deauthorization: delete all Platform Data
 */
async function handleDeauthorization(appScopedUserId) {
    try {
        const { createClient } = await import('@/lib/supabase-server');
        const supabase = await createClient();

        // Find connected accounts by the app-scoped user ID
        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('id')
            .or(`ig_user_id.eq.${appScopedUserId},fb_page_id.eq.${appScopedUserId}`);

        if (!accounts || accounts.length === 0) {
            console.log(`Deauthorize: no accounts found for user ${appScopedUserId}`);
            return;
        }

        const accountIds = accounts.map((a) => a.id);

        // Delete all posts (Platform Data)
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

        console.log(`Deauthorize: cleaned up ${accountIds.length} account(s) for user ${appScopedUserId}`);
    } catch (err) {
        console.error('Deauthorization handler error:', err);
    }
}
