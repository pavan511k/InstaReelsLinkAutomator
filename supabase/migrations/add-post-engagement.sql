-- ============================================================
-- Migration: add engagement counts to instagram_posts
-- Why: the flow builder's "Select a Post" picker shows a modal
-- of all posts with their likes/comments so users can identify
-- their best-performing content at a glance.
-- ============================================================

ALTER TABLE instagram_posts
    ADD COLUMN IF NOT EXISTS like_count     integer,
    ADD COLUMN IF NOT EXISTS comments_count integer;

-- 02_instagram_posts.sql in /schema also gains these columns so a
-- fresh-DB bootstrap stays consistent with what migrations apply.
