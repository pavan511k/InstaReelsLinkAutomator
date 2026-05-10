-- Adds recipient_first_name to dm_sent_log and dm_queue so the {first_name}
-- placeholder can substitute to the user's actual display-name first word
-- instead of duplicating recipient_username (which is the IG handle).
--
-- Source data:
--   - Instagram comments: fetched via Graph API (GET /{ig-scoped-id}?fields=name)
--     using instagram_business_basic. The name field is the user's display
--     name; we take the first whitespace-delimited token.
--   - Facebook comments: parsed from from.name in the webhook payload.
--   - Story mentions / story replies / queue follow-ups: nullable.
--
-- Nullable. When NULL, downstream substitution falls back to a neutral
-- "there" so DMs never leak {first_name} or the numeric IGSID.

ALTER TABLE dm_sent_log
    ADD COLUMN IF NOT EXISTS recipient_first_name text DEFAULT NULL;

ALTER TABLE dm_queue
    ADD COLUMN IF NOT EXISTS recipient_first_name text DEFAULT NULL;
