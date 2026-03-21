-- ============================================================
-- Table: payment_orders
-- Tracks Cashfree payment orders created for Pro plan upgrades.
-- Written by the create-order API; updated by the webhook and
-- verify routes when payment completes.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_orders (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Our internal order ID (AUTODM_{userId}_{timestamp})
    order_id            text NOT NULL UNIQUE,

    -- Cashfree's internal order ID (cf_order_id)
    cashfree_order_id   text,

    plan_id             text NOT NULL DEFAULT 'pro',
    -- 'pro' | 'business'

    amount              integer NOT NULL,           -- Amount in smallest unit (₹299 = 299)
    currency            text NOT NULL DEFAULT 'INR',

    status              text NOT NULL DEFAULT 'pending',
    -- 'pending' | 'paid' | 'failed' | 'dropped'

    paid_at             timestamptz,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- RLS: users can read their own orders
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payment orders"
    ON payment_orders FOR SELECT
    USING (user_id = auth.uid());

-- Webhook reconciliation (order_id lookup)
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id
    ON payment_orders (order_id);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id
    ON payment_orders (user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_payment_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_orders_updated_at
    BEFORE UPDATE ON payment_orders
    FOR EACH ROW EXECUTE FUNCTION update_payment_orders_updated_at();
