-- Backfill story_expires_at for previously-synced stories.
-- Stories live exactly 24h from their `timestamp`. Older syncs missed
-- this column, so the dashboard can't tell live stories from expired
-- ones. Compute it from the existing timestamp.
UPDATE instagram_posts
SET    story_expires_at = (timestamp + INTERVAL '24 hours')
WHERE  is_story = true
  AND  story_expires_at IS NULL
  AND  timestamp IS NOT NULL;
