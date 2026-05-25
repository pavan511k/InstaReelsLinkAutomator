import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getUserEffectivePlan, requirePro } from '@/lib/plan-server';
import { GRAPH_FB_BASE as GRAPH, GRAPH_IG_BASE } from '@/lib/meta-graph';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * Resolves the user + active workspace + a Supabase client to use for
 * RLS-scoped reads/writes. Supports two auth paths:
 *   - Web: cookie session via supabase-server createClient
 *   - Mobile: Authorization: Bearer <JWT> + optional ?workspace_id=
 *     query string. Returns the admin client so subsequent queries
 *     don't depend on the auth.uid() RLS context.
 *
 * Returns { error: NextResponse } on auth failure so callers can `return`
 * directly. On success returns { user, workspaceId, supabase, isMobile }.
 */
async function resolveAuth(request) {
    const authHeader = request?.headers?.get?.('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (bearer) {
        const admin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
        );
        const { data, error } = await admin.auth.getUser(bearer);
        if (error || !data?.user) {
            return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
        }
        const user = data.user;

        const { searchParams } = new URL(request.url);
        const requestedWs = searchParams.get('workspace_id');
        let workspaceId = null;
        if (requestedWs) {
            const { data: owned } = await admin
                .from('workspaces')
                .select('id')
                .eq('owner_id', user.id)
                .eq('id', requestedWs)
                .maybeSingle();
            if (owned?.id) workspaceId = owned.id;
            if (!workspaceId) {
                const { data: member } = await admin
                    .from('workspace_members')
                    .select('workspace_id')
                    .eq('user_id', user.id)
                    .eq('workspace_id', requestedWs)
                    .in('role', ['owner', 'admin'])
                    .maybeSingle();
                if (member?.workspace_id) workspaceId = member.workspace_id;
            }
        }
        if (!workspaceId) {
            const { data: oldest } = await admin
                .from('workspaces')
                .select('id')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
            workspaceId = oldest?.id ?? null;
        }
        if (!workspaceId) {
            return { error: NextResponse.json({ error: 'No active workspace' }, { status: 400 }) };
        }
        return { user, workspaceId, supabase: admin, isMobile: true };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
    const workspaceId = await getActiveWorkspaceId(supabase);
    if (!workspaceId) return { error: NextResponse.json({ error: 'No active workspace' }, { status: 400 }) };
    return { user, workspaceId, supabase, isMobile: false };
}

/**
 * GET /api/ice-breakers
 * Returns the ice breakers stored in default_config (our saved config).
 * We store locally rather than always fetching from Meta to avoid API overhead.
 */
export async function GET(request) {
    const auth = await resolveAuth(request);
    if (auth.error) return auth.error;
    const { workspaceId, supabase } = auth;

    try {
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('default_config')
            .eq('workspace_id', workspaceId)
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
    const auth = await resolveAuth(request);
    if (auth.error) return auth.error;
    const { user, workspaceId, supabase } = auth;

    // Pro gate. GET / DELETE are intentionally ungated so a downgraded user
    // can still view + remove their existing welcome openers; only saving new
    // ones requires Pro. The webhook (handleIceBreakerResponse) also re-checks
    // plan at send time so existing openers don't keep firing post-downgrade.
    const plan = await getUserEffectivePlan(supabase, user.id);
    const gate = requirePro(plan, 'Welcome Openers require a Pro plan.');
    if (gate) return gate;

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
            .eq('workspace_id', workspaceId)
            .maybeSingle();

        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

        const token    = account.fb_page_access_token || account.access_token;
        const pageOrIg = account.fb_page_id || account.ig_user_id;
        const iceBase  = account.fb_page_access_token ? GRAPH : GRAPH_IG_BASE;

        // Validate each ice breaker
        const validated = iceBreakers
            .filter((ib) => ib.title?.trim() && ib.responseMessage?.trim())
            .map((ib, i) => ({
                title:           ib.title.trim().slice(0, 80),
                responseMessage: ib.responseMessage.trim(),
                payload:         `ICE_BREAKER_${i}_${Date.now()}`,
            }));

        // Push to Meta messenger_profile.
        //
        // CRITICAL: Meta's IG ice_breakers payload is NOT a flat array of
        // {question, payload}. Per the docs, ice_breakers is an array of
        // locale-bucket objects, each with a `call_to_actions` array and
        // a (required) `locale`. `platform: 'instagram'` must also be in
        // the body, not just the query string. Sending the wrong shape
        // makes Meta accept the call but silently break the postback
        // delivery -- the icons render in the IG inbox but tapping fires
        // nothing, AND a DELETE later won't match because the original
        // POST didn't actually configure ice breakers correctly.
        //
        // Clearing: even with a correct POST format, Meta does not clear
        // ice_breakers when you POST an empty array. You MUST send a
        // DELETE with `fields: ['ice_breakers']`.
        //
        // Auth: per Meta's curl example access_token rides on the query
        // string (NOT the body) and platform appears in BOTH the query
        // string and the body. Sending access_token in the body has been
        // empirically rejected by Meta on this endpoint.
        const metaUrl =
            `${iceBase}/${pageOrIg}/messenger_profile`
            + `?platform=instagram`
            + `&access_token=${encodeURIComponent(token)}`;

        const metaPayload = {
            platform: 'instagram',
            ice_breakers: [
                {
                    call_to_actions: validated.map((ib) => ({
                        question: ib.title,
                        payload:  ib.payload,
                    })),
                    locale: 'default',
                },
            ],
        };

        // Aggressive diagnostic logging (user granted permission to include
        // sensitive data). Token is masked to first 8 / last 6 chars.
        const tokenSig  = token ? `${token.slice(0, 8)}...${token.slice(-6)} (len=${token.length})` : '(none)';
        const tokenType = account.fb_page_access_token === token ? 'fb_page_access_token' : 'ig_access_token';
        const urlForLog = metaUrl.replace(/access_token=[^&]+/, 'access_token=<MASKED>');

        let metaPushSuccess = false;
        let metaError = null;

        if (pageOrIg && token) {
            console.log('[IceBreakers] Meta request prep:', JSON.stringify({
                method:       validated.length === 0 ? 'DELETE' : 'POST',
                url:          urlForLog,
                pageOrIg,
                base:         iceBase,
                token_type:   tokenType,
                token_sig:    tokenSig,
                payload_size: validated.length,
            }));

            try {
                if (validated.length === 0) {
                    const requestBody = JSON.stringify({ fields: ['ice_breakers'] });
                    console.log('[IceBreakers] DELETE body:', requestBody);

                    const res = await fetch(metaUrl, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: requestBody,
                    });
                    const rawText = await res.text();
                    let data;
                    try { data = JSON.parse(rawText); } catch { data = { _raw: rawText }; }

                    console.log('[IceBreakers] DELETE response:', JSON.stringify({
                        status:     res.status,
                        statusText: res.statusText,
                        ok:         res.ok,
                        body:       data,
                    }));

                    if (res.ok) {
                        metaPushSuccess = true;
                        console.log('[IceBreakers] Cleared from Meta (response above).');
                    } else {
                        metaError = data.error?.message || `Meta DELETE failed (${res.status})`;
                        console.warn('[IceBreakers] Meta clear failed:', metaError);
                    }
                } else {
                    const requestBody = JSON.stringify(metaPayload);
                    console.log('[IceBreakers] POST body:', requestBody);

                    const res = await fetch(metaUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: requestBody,
                    });
                    const rawText = await res.text();
                    let data;
                    try { data = JSON.parse(rawText); } catch { data = { _raw: rawText }; }

                    console.log('[IceBreakers] POST response:', JSON.stringify({
                        status:     res.status,
                        statusText: res.statusText,
                        ok:         res.ok,
                        body:       data,
                    }));

                    if (res.ok && data.result === 'success') {
                        metaPushSuccess = true;
                        console.log(`[IceBreakers] Saved ${validated.length} to Meta`);
                    } else {
                        metaError = data.error?.message || `Meta API error (${res.status})`;
                        console.warn('[IceBreakers] Meta push failed:', metaError);
                    }
                }
            } catch (err) {
                metaError = err.message;
                console.warn('[IceBreakers] Meta push threw:', metaError);
            }
        } else {
            console.warn('[IceBreakers] Skipping Meta push -- missing pageOrIg or token:', JSON.stringify({
                hasPageOrIg: !!pageOrIg,
                hasToken:    !!token,
            }));
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
            .eq('workspace_id', workspaceId);

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
    const auth = await resolveAuth(request);
    if (auth.error) return auth.error;
    const { workspaceId, supabase } = auth;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

    try {
        const { data: account } = await supabase
            .from('connected_accounts')
            .select('id, access_token, ig_user_id, fb_page_id, fb_page_access_token, default_config')
            .eq('id', accountId)
            .eq('workspace_id', workspaceId)
            .maybeSingle();

        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

        const token    = account.fb_page_access_token || account.access_token;
        // Mirror the POST handler: fall back to ig_user_id for IG-Business-
        // Login-only accounts (no FB page). Without this fallback, IG-only
        // accounts silently skip the Meta DELETE — local config clears but
        // the openers keep rendering in Instagram.
        const pageOrIg = account.fb_page_id || account.ig_user_id;
        const iceBase  = account.fb_page_access_token ? GRAPH : GRAPH_IG_BASE;

        // Clear from Meta. Per Meta's IG ice_breakers docs:
        //   - access_token MUST be on the query string (sending it in the
        //     body has been rejected on this endpoint)
        //   - platform=instagram MUST be in the query string
        //   - body contains ONLY { fields: ['ice_breakers'] }
        // Errors are logged so a silent "didn't actually delete" doesn't
        // sit hidden behind a non-fatal catch.
        const tokenSig  = token ? `${token.slice(0, 8)}...${token.slice(-6)} (len=${token.length})` : '(none)';
        const tokenType = account.fb_page_access_token === token ? 'fb_page_access_token' : 'ig_access_token';

        if (pageOrIg && token) {
            const deleteUrl =
                `${iceBase}/${pageOrIg}/messenger_profile`
                + `?platform=instagram`
                + `&access_token=${encodeURIComponent(token)}`;
            const urlForLog = deleteUrl.replace(/access_token=[^&]+/, 'access_token=<MASKED>');

            console.log('[IceBreakers/DELETE] Meta request prep:', JSON.stringify({
                url:        urlForLog,
                pageOrIg,
                base:       iceBase,
                token_type: tokenType,
                token_sig:  tokenSig,
            }));

            try {
                const requestBody = JSON.stringify({ fields: ['ice_breakers'] });
                console.log('[IceBreakers/DELETE] body:', requestBody);

                const res = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: requestBody,
                });
                const rawText = await res.text();
                let data;
                try { data = JSON.parse(rawText); } catch { data = { _raw: rawText }; }

                console.log('[IceBreakers/DELETE] Meta response:', JSON.stringify({
                    status:     res.status,
                    statusText: res.statusText,
                    ok:         res.ok,
                    body:       data,
                }));

                if (!res.ok) {
                    console.warn(
                        '[IceBreakers/DELETE] Meta DELETE failed:',
                        data.error?.message || `status ${res.status}`,
                    );
                }
            } catch (err) {
                console.warn('[IceBreakers/DELETE] Meta DELETE threw:', err.message);
            }
        } else {
            console.warn('[IceBreakers/DELETE] Skipping Meta DELETE -- missing pageOrIg or token:', JSON.stringify({
                hasPageOrIg: !!pageOrIg,
                hasToken:    !!token,
            }));
        }

        // Clear locally
        const updatedConfig = { ...(account.default_config || {}), iceBreakers: [] };
        await supabase
            .from('connected_accounts')
            .update({ default_config: updatedConfig, updated_at: new Date().toISOString() })
            .eq('id', accountId)
            .eq('workspace_id', workspaceId);

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
