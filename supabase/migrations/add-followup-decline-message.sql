-- Add decline_message column to dm_followup_queue
-- Run this ONLY if you already ran the initial add-followup-queue.sql migration.
-- If you haven't run it yet, just use add-followup-queue.sql directly (it already has this column).

ALTER TABLE dm_followup_queue
ADD COLUMN IF NOT EXISTS decline_message text NOT NULL
    DEFAULT 'No worries! Follow us and tap ✅ Yes whenever you''re ready 🙌';
