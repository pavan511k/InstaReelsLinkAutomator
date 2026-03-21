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
 * Activates a plan for a user.
 * Writes ONLY to user_plans — the single source of truth for plan data.
 * connected_accounts is not touched.
 *
 * @param {object} supabase  - service-role client
 * @param {string} userId    - auth.users UUID
 * @param {string} planId    - 'pro' | 'business'
 * @param {Date}   expiresAt - when this plan period ends
 */
async function activatePlan(supabase, userId, planId, expiresAt) {
    const { error } = await supabase
        .from('user_plans')
        .upsert(
            {
                user_id:         userId,
                plan:            planId,
                plan_expires_at: expiresAt.toISOString(),
                updated_at:      new Date().toISOString(),
            },
            { onConflict: 'user_id' },
        );

    if (error) throw new Error(`user_plans upsert failed: ${error.message}`);

    console.log(`[activatePlan] Plan '${planId}' activated for user ${userId}, expires ${expiresAt.toISOString()}`);
}

/**
 * POST /api/payments/webhook
 * Cashfree payment webhook — called server-to-server on payment events.
 * Verifies signature, then upgrades user plan on PAYMENT_SUCCESS.
 */
export async function POST(request) {
    const rawBody   = await request.text();
    const signature = request.headers.get('x-webhook-signature');
    const timestamp = request.headers.get('x-webhook-timestamp');

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

    const eventType = event.type;

    console.log(`[Webhook/Payments] Event: ${eventType}`, {
        orderId: event.data?.order?.order_id,
    });

    if (eventType === 'PAYMENT_SUCCESS') {
        const orderId = event.data?.order?.order_id;
        if (!orderId) return NextResponse.json({ received: true });

        const supabase = createSupabase();

        const { data: order } = await supabase
            .from('payment_orders')
            .select('user_id, plan_id, status')
            .eq('order_id', orderId)
            .maybeSingle();

        if (!order) {
            console.warn(`[Webhook/Payments] Order ${orderId} not found — cannot activate plan`);
            return NextResponse.json({ received: true });
        }

        // Idempotency — skip if already processed
        if (order.status === 'paid') {
            console.log(`[Webhook/Payments] Order ${orderId} already paid — skipping`);
            return NextResponse.json({ received: true });
        }

        const planExpiresAt = new Date();
        planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);

        try {
            await activatePlan(supabase, order.user_id, order.plan_id, planExpiresAt);
        } catch (err) {
            console.error('[Webhook/Payments] activatePlan failed:', err.message);
            return NextResponse.json({ error: 'Plan activation failed' }, { status: 500 });
        }

        await supabase
            .from('payment_orders')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('order_id', orderId);
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
