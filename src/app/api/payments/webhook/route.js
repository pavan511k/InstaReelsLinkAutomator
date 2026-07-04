// Webhooks cannot use Edge runtime — they need Node for crypto signature verification
import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { BILLING_PLANS, computePlanExpiresAt } from '@/lib/plans';
import { enforceWorkspaceLocks } from '@/lib/workspace-locks';

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
                // Clear trial — once the user has paid, the trial concept is
                // done. getEffectivePlan() already prefers paid-pro over trial,
                // so this is purely a data-cleanliness step (no behavior
                // change), but it keeps the row semantically accurate and
                // simplifies future analytics ("trial → paid" conversion).
                trial_ends_at:   null,
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

    // ── Verify Cashfree signature — fail closed ────────────────
    const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('[Webhook/Payments] CASHFREE_WEBHOOK_SECRET not configured');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    if (!signature || !timestamp) {
        console.warn('[Webhook/Payments] Missing signature or timestamp header');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    const signedPayload = `${timestamp}${rawBody}`;
    const expectedSig = createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('base64');

    if (expectedSig !== signature) {
        console.warn('[Webhook/Payments] Invalid Cashfree signature — ignoring');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
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

        // Look up the SKU the user purchased; map to entitlement + duration.
        // Falls back to monthly Pro for legacy rows that have plan_id='pro'.
        const billingPlan  = BILLING_PLANS[order.plan_id] || BILLING_PLANS.pro;
        const planExpiresAt = computePlanExpiresAt(
            BILLING_PLANS[order.plan_id] ? order.plan_id : 'pro',
        );

        // Defense-in-depth: never grant Pro for an underpayment / wrong
        // currency. The order amount is server-set so this normally matches
        // exactly — it only trips on partial payments, a dashboard order
        // amendment, or misconfig. On a mismatch we log and ack (so Cashfree
        // doesn't retry a non-transient issue) but do NOT activate.
        const expectedInr  = billingPlan.priceInr;
        const paidAmount   = Number(event.data?.payment?.payment_amount ?? event.data?.order?.order_amount);
        const paidCurrency = String(event.data?.payment?.payment_currency ?? event.data?.order?.order_currency ?? 'INR').toUpperCase();
        if (!Number.isFinite(paidAmount) || paidAmount + 0.01 < expectedInr || paidCurrency !== 'INR') {
            console.error(`[Webhook/Payments] Amount mismatch for order ${orderId}: paid ${paidAmount} ${paidCurrency}, expected ${expectedInr} INR — NOT activating.`);
            return NextResponse.json({ received: true });
        }

        try {
            await activatePlan(supabase, order.user_id, billingPlan.entitlement, planExpiresAt);
        } catch (err) {
            console.error('[Webhook/Payments] activatePlan failed:', err.message);
            return NextResponse.json({ error: 'Plan activation failed' }, { status: 500 });
        }

        await supabase
            .from('payment_orders')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('order_id', orderId);

        // Reconcile workspace locks: the new plan likely covers more
        // workspaces than the previous one, so previously-locked entries
        // need to unlock. Non-fatal — webhook still acks the payment.
        try {
            const result = await enforceWorkspaceLocks(supabase, order.user_id);
            if (result.unlocked.length > 0) {
                console.log(`[Webhook/Payments] Unlocked ${result.unlocked.length} workspace(s) for ${order.user_id}`);
            }
        } catch (err) {
            console.warn('[Webhook/Payments] Lock reconciliation failed:', err.message);
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
