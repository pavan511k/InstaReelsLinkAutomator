import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

/**
 * Mobile-only endpoint. Stores or removes an Expo Push token for the
 * caller. Authenticates via Authorization: Bearer <Supabase JWT> since
 * mobile doesn't have session cookies.
 *
 * POST   /api/push/register-token   body: { token, platform, deviceName? }
 * DELETE /api/push/register-token   body: { token }  (logout cleanup)
 */

function admin() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

async function getUserFromBearer(request) {
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) return null;
    try {
        const { data, error } = await admin().auth.getUser(token);
        if (error) return null;
        return data.user;
    } catch {
        return null;
    }
}

export async function POST(request) {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

    const { token, platform, deviceName } = body || {};
    if (typeof token !== 'string' || !token.startsWith('ExponentPushToken[')) {
        return NextResponse.json({ error: 'Invalid Expo push token' }, { status: 400 });
    }
    if (platform !== 'ios' && platform !== 'android') {
        return NextResponse.json({ error: 'platform must be ios or android' }, { status: 400 });
    }

    // Upsert by token — same device re-registering on every app boot
    // just bumps updated_at; new devices get a fresh row. Re-binding a
    // token that previously belonged to a different user means the old
    // user lost the install (uninstall + new login), so user_id is
    // updated in place too.
    const { error } = await admin()
        .from('expo_push_tokens')
        .upsert({
            user_id:     user.id,
            token,
            platform,
            device_name: typeof deviceName === 'string' ? deviceName.slice(0, 80) : null,
            updated_at:  new Date().toISOString(),
        }, { onConflict: 'token' });

    if (error) {
        console.error('[PushRegister] Insert failed:', error.message);
        return NextResponse.json({ error: 'Failed to register token' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
}

export async function DELETE(request) {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

    const { token } = body || {};
    if (typeof token !== 'string' || !token) {
        return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    // Only delete the row if it belongs to the caller — otherwise a
    // malicious user could spam-delete tokens by guessing the prefix.
    await admin()
        .from('expo_push_tokens')
        .delete()
        .eq('token', token)
        .eq('user_id', user.id);

    return NextResponse.json({ success: true });
}
