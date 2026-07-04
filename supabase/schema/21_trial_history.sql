-- ============================================================
-- Table: trial_history
-- One-way ledger of which email addresses have already been granted a
-- 30-day Pro trial. Enforces "one free trial per email, ever" so a user
-- can't delete their account and re-sign-up to farm repeat trials.
--
-- Privacy by design:
--   • Stores ONLY a SHA-256 hash of the normalized email — never the email,
--     never a user id. So it reveals nothing and holds no PII.
--   • Deliberately has NO foreign key to auth.users, so account deletion
--     does NOT cascade it away — surviving deletion is the whole point.
--   • This blocks only the *trial* on re-signup; the account can always be
--     re-created and the user can still pay for Pro. (Decision: Option A.)
-- ============================================================

CREATE TABLE IF NOT EXISTS trial_history (
    email_hash     text PRIMARY KEY,               -- SHA-256 hex of the normalized email
    first_trial_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: written/read only by the trial provisioner via the service-role key
-- (which bypasses RLS). No end user ever touches this table, so RLS is on
-- with NO policy — normal authenticated clients get zero access.
ALTER TABLE trial_history ENABLE ROW LEVEL SECURITY;
