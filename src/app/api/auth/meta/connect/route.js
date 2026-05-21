import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { buildAuthUrl } from '@/lib/meta-oauth';

// Closed-beta gate for Facebook. While FB_BETA_MODE=true, only users on
// ALLOWED_EMAILS can initiate a Facebook OAuth. Everyone else is sent
// back to the dashboard with a "Coming soon" message. Flip
// FB_BETA_MODE=false after smoke-testing to open FB to all users.
// ALLOWED_EMAILS is the same list used by middleware's maintenance gate.
const FB_BETA_MODE = process.env.FB_BETA_MODE === 'true';
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const isEmailAllowlisted = (email) =>
    !!email && ALLOWED_EMAILS.includes(email.toLowerCase());

/**
 * GET /api/auth/meta/connect?type=instagram|facebook
 * Redirects the user to the Meta OAuth dialog.
 *
 * Rule: a user can have ONE active platform at a time (IG XOR FB). If
 * they're already connected to one and request the OTHER, we bounce
 * them back to /dashboard with a friendly "disconnect first" message.
 * Re-OAuth of the SAME platform is allowed (token refresh / scope update).
 *
 * The legacy 'both' type is no longer accepted for new connections, but
 * existing connected_accounts rows with platform='both' keep working —
 * the OAuth callback still handles that value defensively.
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const connectionType = searchParams.get('type') || 'instagram';

    // Validate connection type — 'both' removed; single-platform only.
    if (!['instagram', 'facebook'].includes(connectionType)) {
        return NextResponse.json(
            { error: 'Invalid connection type. Must be instagram or facebook.' },
            { status: 400 }
        );
    }

    // Get the logged-in user. Two paths:
    //   1. Web flow → session cookie (existing behavior).
    //   2. Mobile flow → ?token= query param carrying the Supabase JWT.
    //      We can't share cookies with WebBrowser.openAuthSessionAsync, so
    //      the mobile app passes the JWT in the URL. Validated via the
    //      admin client.
    const isMobile = searchParams.get('source') === 'mobile';
    const mobileToken = searchParams.get('token');

    let user = null;
    let supabase = null; // user-context client; only created on web flow

    if (isMobile && mobileToken) {
        try {
            const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
            const adminClient = createSupabaseClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY,
            );
            const { data, error: tokenError } = await adminClient.auth.getUser(mobileToken);
            if (tokenError) {
                console.warn('[OAuth/Connect] Mobile token rejected:', tokenError.message);
            } else {
                user = data.user;
            }
        } catch (err) {
            console.warn('[OAuth/Connect] Mobile token validation threw:', err.message);
        }
    } else {
        supabase = await createClient();
        ({ data: { user } } = await supabase.auth.getUser());
    }

    if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // FB closed-beta gate — block FB initiation for users outside the
    // allowlist. Direct URL hits get the same treatment as the UI button.
    if (connectionType === 'facebook' && FB_BETA_MODE && !isEmailAllowlisted(user.email)) {
        const url = new URL('/dashboard', request.url);
        url.searchParams.set('error', 'fb_coming_soon');
        return NextResponse.redirect(url);
    }

    // Single-account-per-workspace rule. Applies to BOTH web and mobile
    // flows. Web uses the cookie-bound getActiveWorkspaceId; mobile uses
    // the same "oldest owned workspace" fallback that the callback route
    // uses for upsert. Without this guard, a creator could end up with
    // multiple active connected_accounts rows per workspace and the
    // automations engine wouldn't know which one to fire on.
    let preflightWorkspaceId = null;
    if (isMobile) {
        try {
            const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
            const adminClient = createSupabaseClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY,
            );

            // The mobile client MUST send workspace_id (lib/oauth.ts
            // now hard-fails when its store has none). When present,
            // we validate the user owns it OR is a member of it via
            // workspace_members.role IN ('owner','admin') — supports
            // both solo workspaces and future team workspaces. Silent
            // fallback to "oldest owned" was the source of the
            // workspace-1 bug, so it's removed: if the mobile-sent
            // workspace_id doesn't validate, we error back instead.
            const requestedWorkspaceId = searchParams.get('workspace_id');
            console.log('[OAuth/Connect] Mobile inbound:', { user_id: user.id, workspace_id: requestedWorkspaceId, type: connectionType });

            if (requestedWorkspaceId) {
                const { data: owned } = await adminClient
                    .from('workspaces')
                    .select('id')
                    .eq('owner_id', user.id)
                    .eq('id',       requestedWorkspaceId)
                    .maybeSingle();
                if (owned?.id) {
                    preflightWorkspaceId = owned.id;
                } else {
                    // Not owner — check membership for the team case.
                    const { data: member } = await adminClient
                        .from('workspace_members')
                        .select('workspace_id, role')
                        .eq('user_id',      user.id)
                        .eq('workspace_id', requestedWorkspaceId)
                        .in('role', ['owner', 'admin'])
                        .maybeSingle();
                    preflightWorkspaceId = member?.workspace_id ?? null;
                }
                if (!preflightWorkspaceId) {
                    console.warn('[OAuth/Connect] Mobile requested workspace_id', requestedWorkspaceId, 'not accessible to user', user.id);
                    return new NextResponse(null, {
                        status: 303,
                        headers: { Location: 'autodm://oauth-complete?status=err&message=workspace_not_accessible' },
                    });
                }
            } else {
                // Legacy mobile build: no workspace_id sent. Fall back
                // to oldest owned (preserve old behavior so old TestFlight
                // builds don't break overnight).
                console.warn('[OAuth/Connect] Mobile request missing workspace_id — legacy fallback to oldest workspace');
                const { data: ws } = await adminClient
                    .from('workspaces')
                    .select('id')
                    .eq('owner_id', user.id)
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .maybeSingle();
                preflightWorkspaceId = ws?.id ?? null;
            }
            console.log('[OAuth/Connect] Preflight workspace resolved:', preflightWorkspaceId);

            if (preflightWorkspaceId) {
                const { data: activeAccounts } = await adminClient
                    .from('connected_accounts')
                    .select('platform')
                    .eq('workspace_id', preflightWorkspaceId)
                    .eq('is_active', true);
                if (activeAccounts && activeAccounts.length > 0) {
                    // Any active account blocks adding another — same
                    // platform or different — to keep the model simple.
                    // Skip the callback round-trip; respond with a 303
                    // straight to autodm:// so the mobile app can show
                    // the error without opening Meta's OAuth dialog.
                    return new NextResponse(null, {
                        status: 303,
                        headers: { Location: 'autodm://oauth-complete?status=err&message=disconnect_first' },
                    });
                }
            }
        } catch (err) {
            console.warn('[OAuth/Connect] Mobile preflight check failed:', err.message);
            // Fall through — let the callback handle conflicts via the
            // unique-index path. Better to attempt than to block.
        }
    } else if (supabase) {
        const { getActiveWorkspaceId } = await import('@/lib/workspace-context');
        const workspaceId = await getActiveWorkspaceId(supabase);
        if (workspaceId) {
            const { data: activeAccounts } = await supabase
                .from('connected_accounts')
                .select('platform')
                .eq('workspace_id', workspaceId)
                .eq('is_active', true);

            if (activeAccounts && activeAccounts.length > 0) {
                // Any active account blocks adding another — single-
                // account-per-workspace rule.
                const url = new URL('/settings', request.url);
                url.searchParams.set('error', 'disconnect_first');
                return NextResponse.redirect(url);
            }
        }
    }

    // Build the OAuth URL with user ID as state. When initiated by the
    // mobile app, append `:mobile` so the callback knows to redirect
    // back to the autodm:// deep link instead of the web `/settings`
    // route. Also encode the workspace_id when we have one so the
    // callback inserts into the right workspace — not the user's
    // oldest. State format for mobile:
    //   `<userId>:[<workspaceId>:]mobile`
    // Web flows are unchanged.
    let stateArg = user.id;
    if (isMobile) {
        stateArg = preflightWorkspaceId
            ? `${user.id}:${preflightWorkspaceId}:mobile`
            : `${user.id}:mobile`;
    }
    const authUrl = buildAuthUrl(connectionType, stateArg);

    return NextResponse.redirect(authUrl);
}
