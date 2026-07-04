-- OPTIONAL backfill — run ONLY if you want EXISTING users covered by the
-- trial-abuse block. Without it, the ledger starts empty, so a user who
-- signed up BEFORE this feature could still get one more trial by
-- deleting + re-signing-up once. New signups are covered regardless.
--
-- It hashes every current auth.users email the SAME way the app does
-- (lower + trim + strip "+alias" from the local part → SHA-256 hex) and
-- inserts the hashes. Stores only hashes — no emails, no PII. Idempotent.
--
-- NOT part of the standard schema run order — apply it deliberately, once,
-- from the Supabase SQL editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO trial_history (email_hash)
SELECT DISTINCT
    encode(
        digest(
            regexp_replace(lower(trim(email)), '\+[^@]*@', '@'),  -- strip +alias, matches hashEmail()
            'sha256'
        ),
        'hex'
    )
FROM auth.users
WHERE email IS NOT NULL AND trim(email) <> ''
ON CONFLICT (email_hash) DO NOTHING;
