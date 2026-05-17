-- ============================================================
-- Table: expo_push_tokens
-- Stores Expo Push tokens for the mobile app. One row per
-- (user, token) — same user can register tokens from multiple
-- devices, but each token is unique.
--
-- Used by:
--   - POST /api/push/register-token   (mobile sign-in / app boot)
--   - DELETE /api/push/register-token (mobile sign-out)
--   - lib/push-sender.js              (webhook lead capture, future cron)
--
-- Idempotent. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS expo_push_tokens (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    -- Stored as the full ExponentPushToken[xxx] string. Unique per device
    -- — Expo guarantees one token per install. If a user reinstalls, the
    -- old token becomes a DeviceNotRegistered error on send and we drop it.
    token        text NOT NULL UNIQUE,
    -- 'ios' | 'android' — used for analytics and future platform-targeted
    -- copy ("New iOS app shortcut!" etc.).
    platform     text NOT NULL CHECK (platform IN ('ios', 'android')),
    device_name  text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expo_push_tokens_user
    ON expo_push_tokens (user_id);

ALTER TABLE expo_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push tokens" ON expo_push_tokens;
CREATE POLICY "Users manage own push tokens"
    ON expo_push_tokens FOR ALL
    USING (auth.uid() = user_id);
