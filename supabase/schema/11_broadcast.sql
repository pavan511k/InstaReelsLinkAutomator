-- ============================================================
-- Tables: broadcast_jobs + broadcast_recipients
-- Broadcast = send a DM to everyone who commented on a post
-- in one bulk campaign.
-- ============================================================

-- ── broadcast_jobs ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS broadcast_jobs (
    id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    automation_id       uuid REFERENCES dm_automations(id) ON DELETE SET NULL,
    post_id             uuid REFERENCES instagram_posts(id) ON DELETE CASCADE NOT NULL,

    ig_post_id          text NOT NULL,          -- IG media ID for Graph API calls
    ig_account_id       text NOT NULL,          -- Sender IG user ID
    access_token        text NOT NULL,          -- OAuth token snapshot at job creation time

    -- DM config snapshot at time of broadcast
    dm_type             text NOT NULL DEFAULT 'message_template',
    dm_config           jsonb NOT NULL DEFAULT '{}',

    -- Progress counters
    status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','running','paused','completed','failed')),
    total_recipients    integer NOT NULL DEFAULT 0,
    processed_count     integer NOT NULL DEFAULT 0,
    sent_count          integer NOT NULL DEFAULT 0,
    failed_count        integer NOT NULL DEFAULT 0,
    skipped_count       integer NOT NULL DEFAULT 0,

    -- Rate limiting (DMs per minute during the broadcast)
    rate_limit_per_min  integer NOT NULL DEFAULT 20
                        CHECK (rate_limit_per_min BETWEEN 1 AND 60),

    started_at          timestamptz,
    completed_at        timestamptz,
    error_message       text,

    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_user
    ON broadcast_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_status
    ON broadcast_jobs (status)
    WHERE status IN ('running', 'pending');

CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_post
    ON broadcast_jobs (post_id);

-- RLS
ALTER TABLE broadcast_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own broadcast jobs"
    ON broadcast_jobs FOR ALL
    USING (user_id = auth.uid());


-- ── broadcast_recipients ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS broadcast_recipients (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id          uuid REFERENCES broadcast_jobs(id) ON DELETE CASCADE NOT NULL,
    recipient_ig_id text NOT NULL,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','failed','skipped')),
    error_message   text,
    processed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_job
    ON broadcast_recipients (job_id, status);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_pending
    ON broadcast_recipients (job_id)
    WHERE status = 'pending';

-- RLS
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own broadcast recipients"
    ON broadcast_recipients FOR SELECT
    USING (
        job_id IN (SELECT id FROM broadcast_jobs WHERE user_id = auth.uid())
    );
