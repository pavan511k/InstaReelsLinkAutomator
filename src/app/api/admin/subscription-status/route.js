import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { GRAPH_FB_BASE, GRAPH_IG_BASE } from '@/lib/meta-graph';

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

// What we expect to see for each platform. Used to compute a quick
// "missing fields" diff so the response is actionable at a glance.
const EXPECTED_IG_FIELDS = ['comments', 'messages', 'messaging_postbacks', 'mentions'];
const EXPECTED_FB_FIELDS = ['feed', 'messages', 'messaging_postbacks'];

/**
 * GET /api/admin/subscription-status
 *
 * Calls Meta's GET /{id}/subscribed_apps for every active connected_account
 * the caller's allowlist can see, and returns which webhook fields are
 * actually subscribed. Use this to debug "my automation isn't firing" --
 * a missing `comments` entry here means Meta won't deliver any comment
 * webhook events regardless of what the app code thinks it subscribed.
 *
 * Auth: same allowlist as /api/admin/email/send.
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!user.email || !ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Pull every active row -- the admin tool deliberately bypasses RLS so
    // the operator can audit subscriptions across all workspaces.
    const admin = createAdminClient();
    const { data: accounts, error } = await admin
        .from('connected_accounts')
        .select('id, user_id, workspace_id, platform, ig_user_id, ig_username, fb_page_id, fb_page_name, access_token, fb_page_access_token')
        .eq('is_active', true);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = await Promise.all((accounts || []).map(async (acct) => {
        const checks = [];

        // Instagram subscription -- present on platform='instagram' or 'both'
        if (acct.ig_user_id && (acct.platform === 'instagram' || acct.platform === 'both')) {
            const useIgApi = !acct.fb_page_access_token && acct.platform === 'instagram';
            const base = useIgApi ? GRAPH_IG_BASE : GRAPH_FB_BASE;
            const token = useIgApi ? acct.access_token : (acct.fb_page_access_token || acct.access_token);
            checks.push(probe('instagram', acct.ig_user_id, base, token, EXPECTED_IG_FIELDS));
        }

        // Facebook Page subscription -- present on platform='facebook' or 'both'
        if (acct.fb_page_id && (acct.platform === 'facebook' || acct.platform === 'both')) {
            const token = acct.fb_page_access_token || acct.access_token;
            checks.push(probe('facebook', acct.fb_page_id, GRAPH_FB_BASE, token, EXPECTED_FB_FIELDS));
        }

        const subscriptions = await Promise.all(checks);

        return {
            account_id:   acct.id,
            user_id:      acct.user_id,
            workspace_id: acct.workspace_id,
            platform:     acct.platform,
            ig_username:  acct.ig_username || null,
            fb_page_name: acct.fb_page_name || null,
            subscriptions,
        };
    }));

    return NextResponse.json({ accounts: results });
}

async function probe(kind, objectId, base, token, expected) {
    const url = `${base}/${objectId}/subscribed_apps?access_token=${encodeURIComponent(token)}`;
    try {
        const res  = await fetch(url);
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
            return {
                kind,
                object_id: objectId,
                ok: false,
                http_status: res.status,
                meta_error: json.error || json,
            };
        }

        // Meta returns { data: [{ id, subscribed_fields: [...] }] } when an
        // app is subscribed. Empty `data` means no app is subscribed at all.
        const apps = json.data || [];
        const subscribed = apps.flatMap((a) => a.subscribed_fields || []);
        const unique     = [...new Set(subscribed)];
        const missing    = expected.filter((f) => !unique.includes(f));

        return {
            kind,
            object_id: objectId,
            ok: true,
            subscribed_fields: unique,
            missing_fields:    missing,
            healthy: missing.length === 0 && apps.length > 0,
            raw_app_count: apps.length,
        };
    } catch (err) {
        return { kind, object_id: objectId, ok: false, fetch_error: err.message };
    }
}
