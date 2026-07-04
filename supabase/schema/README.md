# AutoDM — Database Schema

This folder contains the complete SQL schema for AutoDM, split into
**one file per table** so each can be read, reviewed, or re-run independently.

Run these scripts **in order** (01 → 21) in the Supabase SQL Editor when
setting up a fresh database. Every script is idempotent — it uses
`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and
`ON CONFLICT DO NOTHING`, so re-running a script on an existing database
is safe and will not overwrite data.

---

## Run order

| # | File | What it creates |
|---|------|-----------------|
| 01 | `01_connected_accounts.sql` | Instagram / Facebook OAuth accounts |
| 02 | `02_instagram_posts.sql` | Posts/Reels synced from Meta APIs |
| 03 | `03_dm_automations.sql` | Per-post DM automation configs |
| 04 | `04_dm_sent_log.sql` | Append-only DM send/fail log |
| 05 | `05_dm_followup_queue.sql` | Follow Gate mid-flow state |
| 06 | `06_global_automations.sql` | Account-wide keyword triggers (Pro) |
| 07 | `07_dm_templates.sql` | Saved DM config templates (Pro) |
| 08 | `08_click_tracking.sql` | Short-URL click tracking (Pro) |
| 09 | `09_email_collector.sql` | Email lead capture queue + leads table |
| 10 | `10_alert_preferences.sql` | DM usage limit alert settings |
| 11 | `11_broadcast.sql` | Bulk broadcast campaigns |
| 12 | `12_dm_queue.sql` | Controlled send pipeline / cron queue |
| 13 | `13_payment_orders.sql` | Cashfree payment order tracking |
| 14 | `14_user_plans.sql` | **Single source of truth for billing plans** |
| 15 | `15_data_deletion_requests.sql` | Meta Platform data deletion compliance |
| 16 | `16_storage_dm_images.sql` | Storage bucket for DM slide images |
| 17 | `17_admin_email_log.sql` | Audit log for the admin /admin/email tool |
| 18 | `18_contacts_rpc.sql` | `contacts_for_user(uuid)` RPC powering /contacts |
| 19 | `19_workspaces.sql` | Workspaces + memberships, adds `workspace_id` to all scoped tables |
| 20 | `20_processed_dm_events.sql` | Inbound webhook idempotency ledger (ice-breaker / quick-reply dedup) |
| 21 | `21_trial_history.sql` | One-free-trial-per-email ledger (email-hash; survives account deletion) |

> **Order matters.** Each table references tables created by earlier scripts
> via foreign keys. Running out of order will produce FK constraint errors.

---

## One-time data migrations (optional — run manually)

A few scripts in `supabase/migrations/` are **not** part of the numbered `01 → 21`
schema run. They're one-off data operations — apply them deliberately, once, from
the Supabase SQL Editor:

| Script | When | What |
|---|---|---|
| `backfill-trial-history.sql` | Once, **after** `21_trial_history.sql` exists | Seeds `trial_history` with a one-way hash of every existing user's email, so the "one free trial per email" block also covers users who signed up before it shipped. Enables `pgcrypto`; idempotent (`ON CONFLICT DO NOTHING`). Skip it and the ledger just fills from new signups instead. |

---

## Quick setup (copy-paste the whole block)

Open the Supabase SQL Editor, paste and run each file in order.
Or paste and run them all at once — every statement is safe to run sequentially:

```sql
-- Run in Supabase SQL Editor
-- Paste each file's contents one at a time, in the order listed above.
-- Or select all files and run them together.
```

---

## Table relationships

```
auth.users
    │
    ├── user_plans              (1:1 — billing plan, source of truth)
    ├── payment_orders          (1:N — Cashfree payment records)
    ├── alert_preferences       (1:1 — DM usage alert config)
    ├── dm_templates            (1:N — saved DM configs)
    ├── broadcast_jobs          (1:N — bulk send campaigns)
    │       └── broadcast_recipients (1:N)
    │
    └── connected_accounts      (1:N — Instagram / Facebook accounts)
            │
            ├── instagram_posts (1:N — synced posts/reels)
            │       └── dm_automations (1:1 per post)
            │               ├── dm_sent_log         (1:N)
            │               ├── dm_link_codes        (1:N)
            │               │       └── click_events (1:N)
            │               └── dm_followup_queue    (1:N)
            │
            ├── global_automations  (1:N — account-wide triggers)
            ├── dm_queue            (1:N — pending sends)
            ├── email_collect_queue (1:N)
            └── email_leads         (1:N)
```

---

## Key architectural notes

### Plans live in `user_plans` only
`connected_accounts` has **no plan columns**. The plan is always read from
`user_plans` keyed on `auth.users.id`. This means a user retains their paid
plan even if they disconnect/reconnect their Instagram account.

Effective plan is computed in `src/lib/plans.js → getEffectivePlan()`:
- `plan = 'pro'` + `plan_expires_at > now()` → **'pro'**
- `trial_ends_at > now()` → **'trial'** (same features as Pro)
- Anything else → **'free'**

### `dm_sent_log.automation_id` is nullable
Story-mention DMs are logged with `automation_id = NULL` because there is no
`dm_automations` row for them. The `comment_id` field is used as a dedup key
in that case.

### `dm_queue.automation_id` is `text`, not `uuid`
This allows both `dm_automations.id` (UUID) and `global_automations.id` (UUID)
to be stored without a typed FK constraint.

### RLS summary
All tables have Row Level Security enabled. Users can only read/write rows
that belong to them. Server-side operations (webhooks, cron jobs) use the
**service role key** which bypasses RLS.

---

## Environment variables required

```
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon key (browser-safe)
SUPABASE_SERVICE_ROLE_KEY       # Service role key (server-side only — keep secret)
```

---

## Adding a new table

1. Create a new file: `{next_number}_{table_name}.sql`
2. Follow the pattern: `CREATE TABLE IF NOT EXISTS` → RLS → policies → indexes
3. Add it to the table above in this README
4. Add a matching entry to `supabase/migrations/` for Supabase CLI users
