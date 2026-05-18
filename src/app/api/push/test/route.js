import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendPushToUser } from '@/lib/push-sender';

/**
 * POST /api/push/test
 * Dev helper. Sends a test push notification to every device the
 * caller has registered, so QA can verify the end-to-end push path
 * without needing to capture a real lead.
 *
 * Authenticates via Authorization: Bearer <Supabase JWT> — same as
 * the rest of the mobile-facing routes.
 *
 * Not gated by environment because the actual push trip can only
 * succeed if the user has a registered push token; locking it down
 * further would just make QA harder. Sending pushes to oneself is
 * harmless.
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

    const receipts = await sendPushToUser(user.id, {
        title: '🚀 Test from AutoDM',
        body:  'Push notifications are working! New leads will land here next.',
        data:  { kind: 'test' },
    });

    return NextResponse.json({
        success: true,
        receipts: receipts.length,
        // Empty array means no Expo Push tokens registered for this
        // user — useful info for the mobile UI to show "register on
        // a device first" instead of pretending it worked.
        no_devices: receipts.length === 0,
    });
}
