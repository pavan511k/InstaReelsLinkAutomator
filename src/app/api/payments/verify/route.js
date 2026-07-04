import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { BILLING_PLANS, computePlanExpiresAt } from '@/lib/plans';
import { enforceWorkspaceLocks } from '@/lib/workspace-locks';

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
                // Mirrors the webhook's activatePlan: clear trial once paid so
                // the row is semantically clean. getEffectivePlan() already
                // prefers paid Pro over trial, so this is purely cosmetic.
                trial_ends_at:   null,
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

            // Entitlement is driven ONLY by the stored order — never by the
            // `plan` query param (presentational only), and never re-applied
            // once the order is already paid. Trusting the param and skipping
            // the ownership + idempotency checks previously let a user self-
            // upgrade (?plan=pro_yearly) or replay the URL to keep resetting
            // their plan period for free. The webhook is the authoritative
            // activator; this GET is best-effort so the user sees Pro on
            // redirect. Mirrors the webhook's safe read-then-activate logic.
            if (user) {
                const { data: order } = await serviceSupabase
                    .from('payment_orders')
                    .select('user_id, plan_id, status')
                    .eq('order_id', orderId)
                    .maybeSingle();

                if (order && order.user_id === user.id && order.status !== 'paid') {
                    const billingPlan  = BILLING_PLANS[order.plan_id] || BILLING_PLANS.pro;
                    const expectedInr  = billingPlan.priceInr;
                    const paidAmount   = Number(data.order_amount);
                    const paidCurrency = String(data.order_currency || 'INR').toUpperCase();

                    // Defense-in-depth: don't activate on an underpayment /
                    // wrong currency (partial payment, order amendment, misconfig).
                    if (!Number.isFinite(paidAmount) || paidAmount + 0.01 < expectedInr || paidCurrency !== 'INR') {
                        console.error(`[Verify] Amount mismatch for order ${orderId}: paid ${paidAmount} ${paidCurrency}, expected ${expectedInr} INR — NOT activating.`);
                    } else {
                        const planExpiresAt = computePlanExpiresAt(
                            BILLING_PLANS[order.plan_id] ? order.plan_id : 'pro',
                        );

                        await activatePlan(serviceSupabase, user.id, billingPlan.entitlement, planExpiresAt);

                        // Conditional flip — only claims the transition if a
                        // concurrent webhook hasn't already marked it paid.
                        await serviceSupabase
                            .from('payment_orders')
                            .update({ status: 'paid', paid_at: new Date().toISOString() })
                            .eq('order_id', orderId)
                            .eq('user_id', user.id)
                            .neq('status', 'paid');

                        // Unlock any workspaces the new plan now covers.
                        try {
                            await enforceWorkspaceLocks(serviceSupabase, user.id);
                        } catch (err) {
                            console.warn('[Verify] Lock reconciliation failed:', err.message);
                        }
                    }
                }
            }

            return NextResponse.json({ status: 'paid', planId });
        }

        return NextResponse.json({ status: orderStatus.toLowerCase() });
    } catch (err) {
        console.error('[Verify] Error:', err);
        return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
    }
}
