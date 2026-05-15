import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { scrubPlatformDataReferences } from '@/lib/platform-data-scrub';

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
 * Parse Meta's signed_request parameter.
 *
 * IMPORTANT: we have TWO Meta apps configured — Facebook and Instagram —
 * each with its own app secret. The deauthorize callback can come from
 * either, depending on which OAuth flow the user originally completed.
 * We try both secrets and accept whichever matches. Logs which secret
 * matched so we can see in practice which flow the deauth came from.
 */
function parseSignedRequest(signedRequest) {
    const fbSecret = process.env.META_APP_SECRET;
    const igSecret = process.env.INSTAGRAM_APP_SECRET;

    if (!fbSecret && !igSecret) {
        console.error('[Deauth] Neither META_APP_SECRET nor INSTAGRAM_APP_SECRET set — cannot verify signed request');
        return null;
    }

    const [encodedSig, payload] = signedRequest.split('.');
    if (!encodedSig || !payload) {
        console.error('[Deauth] Malformed signed_request (missing sig or payload)');
        return null;
    }

    const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    const candidates = [
        { label: 'FB',  secret: fbSecret },
        { label: 'IG',  secret: igSecret },
    ].filter((c) => !!c.secret);

    let matchedLabel = null;
    for (const c of candidates) {
        const expected = crypto.createHmac('sha256', c.secret).update(payload).digest();
        if (expected.length === sig.length && crypto.timingSafeEqual(sig, expected)) {
            matchedLabel = c.label;
            break;
        }
    }

    if (!matchedLabel) {
        console.error('[Deauth] Signature verification failed against BOTH app secrets', JSON.stringify({
            sig_preview:        encodedSig.slice(0, 16),
            payload_preview:    payload.slice(0, 32),
            tried_fb_secret:    !!fbSecret,
            tried_ig_secret:    !!igSecret,
        }));
        return null;
    }

    console.log(`[Deauth] Signature verified against ${matchedLabel} app secret`);

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

        // Anonymize Platform Data identifiers in historical send/lead/click rows.
        // Per Meta Platform Terms 3(d)(i) we must remove IGSIDs and IG profile
        // data on revoke. Aggregate counts (rows themselves) are kept so the
        // user's analytics history survives a future reconnect.
        await scrubPlatformDataReferences(supabase, accountIds);

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
