-- Adds a partial unique index on dm_followup_queue for the
-- opening-message button-gate flow (status='awaiting_opening_tap').
-- Mirrors idx_followup_queue_unique_inflight (which gates the follow
-- gate's 'awaiting_confirmation' status).
--
-- Why: Meta retries webhook deliveries within 1-2s. Without this index
-- two concurrent inserts for the same (automation, recipient) would both
-- succeed and the bot would ship the opening DM twice. With the index
-- only the winner survives; the loser gets 23505 and bails before
-- sending a duplicate gate DM.
--
-- Status workflow for opening-button gate rows:
--   awaiting_opening_tap  -> user has been sent the opening DM
--   link_sent             -> user tapped the button, main DM dispatched

CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_queue_unique_opening_inflight
    ON dm_followup_queue (automation_id, recipient_ig_id)
    WHERE status = 'awaiting_opening_tap';
