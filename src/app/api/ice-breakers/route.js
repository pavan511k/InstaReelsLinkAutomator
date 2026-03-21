import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const GRAPH = 'https://graph.facebook.com/v21.0';

/**
 * GET /api/ice-breakers
 * Returns the ice breakers stored in default_config (our saved config).
 * We store locally rather than always fetching from Meta to avoid API overhead.
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    try {
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('default_config')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

        const iceBreakers = account?.default_config?.iceBreakers || [];
        return NextResponse.json({ iceBreakers });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/ice-breakers
 * Saves ice breakers config locally AND pushes to Meta messenger_profile API.
 *
 * Body: {
 *   accountId: string,
 *   iceBreakers: Array<{
 *     title: string,         // button text shown to user (max 80 chars)
 *     responseMessage: string, // what we auto-reply when they tap
 *   }>
 * }
 *
 * Meta API: POST /{page-id}/messenger_profile
 * Payload:  { ice_breakers: [{ question, payload }] }
 * The `payload` is a sanitized identifier we store locally to map back to responseMessage.
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { accountId, iceBreakers = [] } = body;

    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    if (iceBreakers.length > 4) return NextResponse.json({ error: 'Maximum 4 ice breakers allowed' }, { status: 400 });

    try {
        // Fetch the account to get access token
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('id, access_token, ig_user_id, fb_page_id, fb_page_access_token, default_config')
            .eq('id', accountId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

        const token    = account.fb_page_access_token || account.access_token;
        const pageOrIg = account.fb_page_id || account.ig_user_id;

        // Validate each ice breaker
        const validated = iceBreakers
            .filter((ib) => ib.title?.trim() && ib.responseMessage?.trim())
            .map((ib, i) => ({
                title:           ib.title.trim().slice(0, 80),
                responseMessage: ib.responseMessage.trim(),
                payload:         `ICE_BREAKER_${i}_${Date.now()}`,
            }));

        // Push to Meta messenger_profile
        // Ice breakers are set per locale. We use en_US as default.
        const metaPayload = {
            ice_breakers: validated.map((ib) => ({
                question: ib.title,
                payload:  ib.payload,
            })),
        };

        let metaPushSuccess = false;
        let metaError = null;

        if (pageOrIg && token) {
            try {
                const res = await fetch(`${GRAPH}/${pageOrIg}/messenger_profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...metaPayload, access_token: token }),
                });
                const data = await res.json();
                if (res.ok && data.result === 'success') {
                    metaPushSuccess = true;
                } else {
                    metaError = data.error?.message || 'Meta API error';
                    console.warn('[IceBreakers] Meta push failed:', metaError);
                }
            } catch (err) {
                metaError = err.message;
                console.warn('[IceBreakers] Meta push threw:', metaError);
            }
        }

        // Always save locally in default_config regardless of Meta result
        // This preserves the config even if Meta push fails temporarily
        const updatedConfig = {
            ...(account.default_config || {}),
            iceBreakers: validated,
        };

        await supabase
            .from('connected_accounts')
            .update({ default_config: updatedConfig, updated_at: new Date().toISOString() })
            .eq('id', accountId)
            .eq('user_id', user.id);

        return NextResponse.json({
            success: true,
            savedCount: validated.length,
            metaPushSuccess,
            metaError,
        });
    } catch (err) {
        console.error('[IceBreakers] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * DELETE /api/ice-breakers
 * Clears all ice breakers from Meta and locally.
 */
export async function DELETE(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

    try {
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('id, access_token, fb_page_id, fb_page_access_token, default_config')
            .eq('id', accountId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

        const token    = account.fb_page_access_token || account.access_token;
        const pageOrIg = account.fb_page_id;

        // Clear from Meta
        if (pageOrIg && token) {
            try {
                await fetch(`${GRAPH}/${pageOrIg}/messenger_profile`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fields: ['ice_breakers'], access_token: token }),
                });
            } catch { /* non-fatal */ }
        }

        // Clear locally
        const updatedConfig = { ...(account.default_config || {}), iceBreakers: [] };
        await supabase
            .from('connected_accounts')
            .update({ default_config: updatedConfig, updated_at: new Date().toISOString() })
            .eq('id', accountId)
            .eq('user_id', user.id);

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
