-- ============================================================
-- Table: data_deletion_requests
-- Tracks Meta Platform data deletion requests (required by
-- Meta Platform Terms Section 3(d)(i)).
--
-- When a user deauthorises the app from Meta's side, Meta POSTs
-- a signed request to /api/webhooks/data-deletion.
-- We log it here, delete the user's platform data, and return
-- a confirmation URL that Meta can check.
-- ============================================================

CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Meta's app-scoped user ID (different from our auth.users.id)
    app_scoped_user_id  text NOT NULL,

    -- Our internal user, if we can match them (may be NULL if the
    -- account was already deleted before we processed the request)
    user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Unique code returned to Meta as the confirmation URL parameter
    -- e.g. https://autodm.pro/deletion-status?code=ABC123
    confirmation_code   text NOT NULL UNIQUE,

    status              text NOT NULL DEFAULT 'pending',
    -- 'pending' | 'completed' | 'failed'

    requested_at        timestamptz DEFAULT now(),
    completed_at        timestamptz,

    -- Raw signed request and any processing notes
    details             jsonb DEFAULT '{}'
);

-- No RLS — accessed by webhooks (service role) and the public
-- status-check endpoint (which only exposes status, not PII).

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_code
    ON data_deletion_requests (confirmation_code);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user
    ON data_deletion_requests (app_scoped_user_id);
