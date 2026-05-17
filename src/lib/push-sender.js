import { createClient as createServiceClient } from '@supabase/supabase-js';

/**
 * Push notification sender. Talks to Expo's Push API directly — no auth
 * key needed, anonymous tokens are fine for our scale. Best-effort: any
 * error is logged and swallowed so push failures never break the caller.
 *
 * Production hardening (later):
 *   - Batch tokens (Expo accepts arrays up to 100 messages per call)
 *   - Track receipts and drop DeviceNotRegistered tokens
 *   - Per-user notification preferences (quiet hours, opted out, etc.)
 *
 * Reference: https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function admin() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

/**
 * Send a push notification to every device this user has registered.
 * Returns the array of receipts (may be empty if user has no tokens).
 * Never throws — failures are logged and swallowed.
 *
 * @param {string} userId   - auth.users.id
 * @param {object} payload  - { title, body, data? }
 * @returns {Promise<unknown[]>}
 */
export async function sendPushToUser(userId, { title, body, data } = {}) {
    if (!userId || !title) {
        console.warn('[Push] sendPushToUser called without userId or title');
        return [];
    }
    try {
        const { data: rows, error } = await admin()
            .from('expo_push_tokens')
            .select('token')
            .eq('user_id', userId);
        if (error) {
            console.warn('[Push] token lookup failed:', error.message);
            return [];
        }
        const tokens = (rows || []).map((r) => r.token).filter(Boolean);
        if (tokens.length === 0) return [];

        const messages = tokens.map((to) => ({
            to,
            title,
            body,
            ...(data ? { data } : {}),
            sound: 'default',
        }));

        const res = await fetch(EXPO_PUSH_URL, {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept':       'application/json',
                'Accept-Encoding': 'gzip, deflate',
            },
            body: JSON.stringify(messages),
        });

        if (!res.ok) {
            console.warn('[Push] Expo Push API non-OK:', res.status);
            return [];
        }
        const json = await res.json().catch(() => ({}));
        return json?.data ?? [];
    } catch (err) {
        console.warn('[Push] send threw:', err.message);
        return [];
    }
}
