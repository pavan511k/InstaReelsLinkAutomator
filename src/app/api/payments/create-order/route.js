import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const CASHFREE_BASE = process.env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

const PLANS = {
    pro: { name: 'AutoDM Pro', amount: 30, currency: 'INR' },
};

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

    const plan = PLANS[planId];
    if (!plan) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const appUrl  = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const orderId = `AUTODM_${user.id.replace(/-/g, '').substring(0, 12)}_${Date.now()}`;

    const orderPayload = {
        order_id:      orderId,
        order_amount:  plan.amount,
        order_currency: plan.currency,
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
        order_note: `${plan.name} — ${user.email}`,
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
                amount:            plan.amount,
                currency:          plan.currency,
                status:            'pending',
            });
        } catch (dbErr) {
            // Non-critical — order can be reconciled via webhook
            console.warn('[Cashfree] Could not persist order (table may not exist yet):', dbErr.message);
        }

        return NextResponse.json({
            orderId:          data.order_id,
            paymentSessionId: data.payment_session_id,
            orderAmount:      plan.amount,
            planId,
        });
    } catch (err) {
        console.error('[Cashfree] Error:', err);
        return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 });
    }
}
