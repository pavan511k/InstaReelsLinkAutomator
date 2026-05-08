import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { BILLING_PLANS } from '@/lib/plans';

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
    const { planId = 'pro' } = body;

    const plan = BILLING_PLANS[planId];
    if (!plan) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
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
            // Cashfree requires phone — collect in a future billing profile step
            customer_phone: '9999999999',
        },
        order_meta: {
            return_url: `${appUrl}/pricing/success?order_id={order_id}&plan=${planId}`,
            notify_url: `${appUrl}/api/payments/webhook`,
        },
        order_note: `${plan.label} — ${user.email}`,
    };

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

        // Persist the pending order for webhook reconciliation
        try {
            await supabase.from('payment_orders').insert({
                user_id:           user.id,
                order_id:          orderId,
                cashfree_order_id: data.cf_order_id?.toString(),
                plan_id:           planId,
                amount:            plan.priceInr,
                currency:          'INR',
                status:            'pending',
            });
        } catch (dbErr) {
            // Non-critical — order can be reconciled via webhook
            console.warn('[Cashfree] Could not persist order (table may not exist yet):', dbErr.message);
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
