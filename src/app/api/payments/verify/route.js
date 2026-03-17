import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const CASHFREE_BASE = process.env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

/**
 * GET /api/payments/verify?order_id=xxx&plan=pro
 * Called after redirect back from Cashfree to confirm payment status.
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');
    const planId  = searchParams.get('plan') || 'pro';

    if (!orderId) {
        return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    try {
        // Fetch order status directly from Cashfree
        const res = await fetch(`${CASHFREE_BASE}/orders/${orderId}`, {
            method: 'GET',
            headers: {
                'x-api-version': '2023-08-01',
                'x-client-id':     process.env.CASHFREE_APP_ID,
                'x-client-secret': process.env.CASHFREE_SECRET_KEY,
            },
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json({ status: 'error', message: data.message }, { status: 500 });
        }

        const orderStatus = data.order_status; // PAID | ACTIVE | EXPIRED | CANCELLED

        if (orderStatus === 'PAID') {
            // Activate plan in Supabase
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // Update connected_accounts plan
                await supabase
                    .from('connected_accounts')
                    .update({ plan: planId, updated_at: new Date().toISOString() })
                    .eq('user_id', user.id)
                    .eq('is_active', true);

                // Update payment_orders record
                await supabase
                    .from('payment_orders')
                    .update({ status: 'paid', paid_at: new Date().toISOString() })
                    .eq('order_id', orderId)
                    .eq('user_id', user.id);
            }

            return NextResponse.json({ status: 'paid', planId });
        }

        return NextResponse.json({ status: orderStatus.toLowerCase() });
    } catch (err) {
        console.error('[Verify] Error:', err);
        return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
    }
}
