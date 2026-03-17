-- Payment Orders Table
-- Tracks Cashfree payment orders for plan upgrades.
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS payment_orders (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    order_id            text NOT NULL UNIQUE,          -- Our AUTODM_xxx_timestamp ID
    cashfree_order_id   text,                          -- Cashfree's internal cf_order_id
    plan_id             text NOT NULL DEFAULT 'pro',   -- 'pro' | 'business'
    amount              integer NOT NULL,              -- in smallest currency unit (₹30 = 30)
    currency            text NOT NULL DEFAULT 'INR',
    status              text NOT NULL DEFAULT 'pending',
    -- pending | paid | failed | dropped
    paid_at             timestamptz,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

-- Users can read their own orders
CREATE POLICY "Users view own payment orders"
    ON payment_orders FOR SELECT
    USING (user_id = auth.uid());

-- Only the service role (webhooks) can insert/update
-- No user-facing INSERT policy — orders are created server-side only

-- Index for webhook reconciliation (order_id lookups)
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id
    ON payment_orders(order_id);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id
    ON payment_orders(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_payment_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_orders_updated_at
    BEFORE UPDATE ON payment_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_orders_updated_at();
