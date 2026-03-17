// Webhooks cannot use Edge runtime — they need Node for crypto signature verification
import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

function createSupabase() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
}

/**
 * POST /api/payments/webhook
 * Cashfree payment webhook — called server-to-server on payment events.
 * Verifies signature, then upgrades user plan on PAYMENT_SUCCESS.
 */
export async function POST(request) {
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature');
    const timestamp  = request.headers.get('x-webhook-timestamp');

    // ── Verify Cashfree signature ──────────────────────────────
    if (signature && timestamp && process.env.CASHFREE_WEBHOOK_SECRET) {
        const signedPayload = `${timestamp}${rawBody}`;
        const expectedSig = createHmac('sha256', process.env.CASHFREE_WEBHOOK_SECRET)
            .update(signedPayload)
            .digest('base64');

        if (expectedSig !== signature) {
            console.warn('[Webhook/Payments] Invalid Cashfree signature — ignoring');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
    }

    let event;
    try {
        event = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventType = event.type; // PAYMENT_SUCCESS | PAYMENT_FAILED | PAYMENT_USER_DROPPED

    console.log(`[Webhook/Payments] Event: ${eventType}`, {
        orderId: event.data?.order?.order_id,
    });

    if (eventType === 'PAYMENT_SUCCESS') {
        const orderId   = event.data?.order?.order_id;
        const customerId = event.data?.customer_details?.customer_id; // this is user.id with dashes removed

        if (!orderId) {
            return NextResponse.json({ received: true });
        }

        const supabase = createSupabase();

        // Look up the order to find user_id and plan_id
        const { data: order } = await supabase
            .from('payment_orders')
            .select('user_id, plan_id')
            .eq('order_id', orderId)
            .maybeSingle();

        if (order) {
            // Activate plan
            await supabase
                .from('connected_accounts')
                .update({ plan: order.plan_id, updated_at: new Date().toISOString() })
                .eq('user_id', order.user_id)
                .eq('is_active', true);

            // Mark order paid
            await supabase
                .from('payment_orders')
                .update({ status: 'paid', paid_at: new Date().toISOString() })
                .eq('order_id', orderId);

            console.log(`[Webhook/Payments] Activated ${order.plan_id} plan for user ${order.user_id}`);
        } else {
            console.warn(`[Webhook/Payments] Order ${orderId} not found in DB — cannot activate plan`);
        }
    }

    if (eventType === 'PAYMENT_FAILED' || eventType === 'PAYMENT_USER_DROPPED') {
        const orderId = event.data?.order?.order_id;
        if (orderId) {
            const supabase = createSupabase();
            await supabase
                .from('payment_orders')
                .update({ status: eventType === 'PAYMENT_FAILED' ? 'failed' : 'dropped' })
                .eq('order_id', orderId);
        }
    }

    return NextResponse.json({ received: true });
}
