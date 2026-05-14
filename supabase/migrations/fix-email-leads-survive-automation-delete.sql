-- ============================================================
-- Migration: email_leads — survive automation deletion + show
--            captured first_name/username on the Leads page.
--
-- Problem 1: email_leads.automation_id was declared
--    ON DELETE CASCADE NOT NULL
-- so deleting an email-collector automation hard-deleted every
-- email it ever captured. Data loss, not just UI-hidden.
--
-- Problem 2: the row only stored email + IGSID. Creators on
-- /leads see a bare email + numeric ID and can't recognize who
-- the lead is.
--
-- Fix:
--   - Change automation_id FK to ON DELETE SET NULL so leads
--     outlive their triggering automation. Drop NOT NULL.
--   - Add recipient_first_name + recipient_username columns
--     (populated by the webhook at email-capture time from the
--     dm_sent_log row that delivered the ask-message).
-- ============================================================

-- 1. Drop existing FK (Postgres names it predictably as
--    email_leads_automation_id_fkey, but be defensive).
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'email_leads'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%REFERENCES dm_automations%';
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE email_leads DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- 2. Allow NULL on automation_id so SET NULL works.
ALTER TABLE email_leads ALTER COLUMN automation_id DROP NOT NULL;

-- 3. Re-add the FK with ON DELETE SET NULL.
ALTER TABLE email_leads
    ADD CONSTRAINT email_leads_automation_id_fkey
    FOREIGN KEY (automation_id)
    REFERENCES dm_automations(id)
    ON DELETE SET NULL;

-- 4. Add display columns. Both nullable — populated at capture
--    time when the data is available; older leads stay null.
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS recipient_first_name text;
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS recipient_username   text;

-- 5. Best-effort backfill: pull the most recent dm_sent_log row
--    per (automation_id, recipient_ig_id) where the ask message
--    was sent. This recovers names/usernames for leads captured
--    before this migration. Safe to re-run.
UPDATE email_leads l
SET
    recipient_first_name = COALESCE(l.recipient_first_name, src.recipient_first_name),
    recipient_username   = COALESCE(l.recipient_username,   src.recipient_username)
FROM (
    SELECT DISTINCT ON (automation_id, recipient_ig_id)
        automation_id,
        recipient_ig_id,
        recipient_first_name,
        recipient_username
    FROM dm_sent_log
    WHERE recipient_ig_id IS NOT NULL
      AND (recipient_first_name IS NOT NULL OR recipient_username IS NOT NULL)
    ORDER BY automation_id, recipient_ig_id, sent_at DESC
) src
WHERE l.automation_id   = src.automation_id
  AND l.recipient_ig_id = src.recipient_ig_id
  AND (l.recipient_first_name IS NULL OR l.recipient_username IS NULL);
