import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { BILLING_PLANS } from '@/lib/plans';
import { normalizeIndianMobile } from '@/lib/phone';

const CASHFREE_BASE = process.env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

/**
 * POST /api/payments/create-order
 * Creates a Cashfree order and returns the payment_session_id
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { planId = 'pro', phone } = body;

    const plan = BILLING_PLANS[planId];
    if (!plan) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Cashfree requires a real customer phone on the order. Validate at the
    // boundary — the client also validates, but never trust it.
    const customerPhone = normalizeIndianMobile(phone);
    if (!customerPhone) {
        return NextResponse.json(
            { error: 'A valid 10-digit Indian mobile number is required to process payment.' },
            { status: 400 },
        );
    }

    // Block re-purchase when the user already has an active paid Pro
    // subscription. Industry standard — Notion, Linear, Stripe, etc. all
    // prevent stacking. If a user wants more time they wait until expiry
    // approaches and renew, or they buy yearly (which is also blocked while
    // they're on Pro — they can switch tiers after current period ends).
    try {
        const { data: currentPlan } = await supabase
            .from('user_plans')
            .select('plan, plan_expires_at')
            .eq('user_id', user.id)
            .maybeSingle();

        const isActivePaidPro =
            currentPlan &&
            (currentPlan.plan === 'pro' || currentPlan.plan === 'business') &&
            currentPlan.plan_expires_at &&
            new Date(currentPlan.plan_expires_at) > new Date();

        if (isActivePaidPro) {
            return NextResponse.json(
                {
                    error: `You're already on Pro until ${new Date(currentPlan.plan_expires_at).toLocaleDateString()}. You can renew when your current period is closer to ending.`,
                    alreadyActive: true,
                    currentExpiresAt: currentPlan.plan_expires_at,
                },
                { status: 409 },
            );
        }
    } catch {
        // user_plans row may not exist for brand-new accounts — fall through.
    }

    const appUrl  = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const orderId = `AUTODM_${user.id.replace(/-/g, '').substring(0, 12)}_${Date.now()}`;

    const orderPayload = {
        order_id:      orderId,
        order_amount:  plan.priceInr,
        order_currency: 'INR',
        customer_details: {
            customer_id:    user.id.replace(/-/g, '').substring(0, 32),
            customer_email: user.email,
            customer_phone: customerPhone,
        },
        order_meta: {
            return_url: `${appUrl}/pricing/success?order_id={order_id}&plan=${planId}`,
            notify_url: `${appUrl}/api/payments/webhook`,
        },
        order_note: `${plan.label} — ${user.email}`,
    };

    // Persist the pending order BEFORE charging. Use the service client: the
    // payment_orders RLS has no INSERT policy, so a user-scoped insert is
    // silently denied. A Cashfree order must never exist without a local row —
    // BOTH the webhook and /verify key off it to activate the plan, so a
    // missing row means the user pays but never gets Pro. Fail closed so we
    // never charge for an order we can't reconcile.
    const serviceDb = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    const { error: persistErr } = await serviceDb.from('payment_orders').insert({
        user_id:  user.id,
        order_id: orderId,
        plan_id:  planId,
        amount:   plan.priceInr,
        currency: 'INR',
        status:   'pending',
    });
    if (persistErr) {
        console.error('[Cashfree] Could not persist pending order — aborting before charge:', persistErr.message);
        return NextResponse.json(
            { error: 'Could not start checkout. Please try again.' },
            { status: 500 },
        );
    }

    try {
        const res = await fetch(`${CASHFREE_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-version':   '2023-08-01',
                'x-client-id':     process.env.CASHFREE_APP_ID || '',
                'x-client-secret': process.env.CASHFREE_SECRET_KEY || '',
            },
            body: JSON.stringify(orderPayload),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error('[Cashfree] Create order failed:', data);
            return NextResponse.json(
                { error: data.message || 'Payment gateway error' },
                { status: 500 },
            );
        }

        // Attach Cashfree's order id for reference (best-effort — the pending
        // row already exists, keyed on our own order_id, which is what the
        // webhook and /verify look up).
        if (data.cf_order_id) {
            await serviceDb
                .from('payment_orders')
                .update({ cashfree_order_id: data.cf_order_id.toString() })
                .eq('order_id', orderId);
        }

        return NextResponse.json({
            orderId:          data.order_id,
            paymentSessionId: data.payment_session_id,
            orderAmount:      plan.priceInr,
            planId,
        });
    } catch (err) {
        console.error('[Cashfree] Error:', err);
        return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 });
    }
}
