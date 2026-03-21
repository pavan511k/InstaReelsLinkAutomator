import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const CASHFREE_BASE = process.env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

/**
 * Activates a plan for a user.
 * Writes ONLY to user_plans — the single source of truth for plan data.
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
}

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
        const res = await fetch(`${CASHFREE_BASE}/orders/${orderId}`, {
            method: 'GET',
            headers: {
                'x-api-version':   '2023-08-01',
                'x-client-id':     process.env.CASHFREE_APP_ID,
                'x-client-secret': process.env.CASHFREE_SECRET_KEY,
            },
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json({ status: 'error', message: data.message }, { status: 500 });
        }

        const orderStatus = data.order_status;

        if (orderStatus === 'PAID') {
            // Service-role client for writes (bypasses RLS on user_plans)
            const serviceSupabase = createServiceClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY,
            );

            const authSupabase = await createClient();
            const { data: { user } } = await authSupabase.auth.getUser();

            if (user) {
                const planExpiresAt = new Date();
                planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);

                await activatePlan(serviceSupabase, user.id, planId, planExpiresAt);

                await serviceSupabase
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
