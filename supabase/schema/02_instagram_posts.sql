-- ============================================================
-- Table: instagram_posts
-- Synced from the Instagram / Facebook Graph API.
-- One row per post/reel/story per account.
-- Deleted on disconnect (Meta Platform Terms compliance).
-- ============================================================

CREATE TABLE IF NOT EXISTS instagram_posts (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id      uuid REFERENCES connected_accounts(id) ON DELETE CASCADE NOT NULL,

    -- Instagram media identifiers
    ig_post_id      text NOT NULL,
    caption         text,
    thumbnail_url   text,
    media_url       text,
    media_type      text,           -- 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
    timestamp       timestamptz,    -- When the post was published on Instagram
    is_story        boolean NOT NULL DEFAULT false,

    created_at      timestamptz DEFAULT now()
);

-- RLS: users access posts through their connected account
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own posts"
    ON instagram_posts FOR ALL
    USING (
        account_id IN (
            SELECT id FROM connected_accounts WHERE user_id = auth.uid()
        )
    );

-- Fast lookup: all posts for an account, sorted newest first (posts page)
CREATE INDEX IF NOT EXISTS idx_instagram_posts_account
    ON instagram_posts (account_id, timestamp DESC);

-- Webhook routing: find post row by IG media ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_instagram_posts_ig_post_id
    ON instagram_posts (ig_post_id);
