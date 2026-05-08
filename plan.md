# InstaReelsLinkAutomator — Roadmap

A prioritized backlog of feature ideas that build on the existing primitives (broadcasts, DM automations, link tracking, A/B variants, follow-ups). Items are grouped by theme and ordered by impact-to-effort within each group.

---

## P0 — Reliability & Trust

These fix or harden things users have already paid for emotionally. Ship before adding net-new surface area.

### Adaptive rate limiting
When Meta returns `4` / `17` / `613` (rate-limit codes) or HTTP 429, the broadcast worker should:
- back off exponentially per-account,
- record the throttle event on the job,
- surface a "Throttled by Meta — retrying in Xs" banner in `BroadcastModal`.

Current behavior: each recipient row is just marked `failed`, even though the underlying account is fine and the user would happily wait.

### Real-time progress (Supabase Realtime / SSE)
Replace the 4-second polling loop in `BroadcastModal.js` with a Realtime subscription on `broadcast_jobs` (and a derived recipient counter). Cuts request volume by ~95% and shows progress within ~200ms of each send.

### Cancellation grace period
After clicking **Start Broadcast**, show a 10s undo banner ("Sending in 10s — Undo") before the recipient rows are inserted. Removes the "I clicked the wrong post" panic.

### Per-recipient retry queue
Recipients that fail with a transient error (network, 5xx, throttle) should be re-queued up to 3 times with backoff, separate from permanent failures (user blocked, account deleted). Today, every failure is terminal.

---

## P1 — Audience & Targeting

### Audience preview before send
On the **Confirm** phase, show the first 10 commenter usernames + a total count, fetched from a lightweight `/api/broadcast/preview?postId=` endpoint. Today users have to trust an opaque "All commenters" label.

### Comment-keyword filters
Let the user broadcast only to commenters whose comment matches a regex / keyword (e.g. only people who commented "LINK"). Reuses the comment fetch path already in `start/route.js`.

### Bot / low-quality account heuristic skip
Skip recipients whose IG profile fails simple checks: zero followers, default username pattern, or no profile picture. Optional toggle, off by default.

### Segment by prior interaction
Three audience presets in addition to "All commenters":
- **New commenters only** (never received a DM from this automation)
- **Re-engagement** (received a DM 30+ days ago, no click)
- **Hot leads** (clicked a tracking link in the last DM)

Backed by `dm_sent_log` + `dm_link_codes` joins.

---

## P2 — Content & Personalization

### Template variables
Support `{{first_name}}`, `{{comment_excerpt}}`, `{{post_caption}}` in `dm_config.message`. Resolve at send-time inside `process/route.js`. Massive perceived-quality jump for ~50 lines of code.

### AI-generated message variants
"Generate 3 variants" button in `BroadcastModal` configure phase. Calls Claude with the post caption + brand tone and returns three alternative phrasings. User picks one or edits.

### Saved template library
A `dm_templates` table keyed by user, with a "Load template" dropdown above the message textarea. Common templates ("link in DMs", "thanks for the comment", "limited-time offer") shipped as defaults.

### Multi-language auto-translation
Detect commenter language from comment text (or IG profile locale if available) and pick the matching variant. Builds on the existing A/B variant infrastructure — just relabel `variantA` / `variantB` as locale-keyed.

### Multi-CTA improvements
- Drag-to-reorder buttons.
- Live mobile-frame preview to the right of the textarea.
- Per-button click counter once links resolve.

---

## P3 — Scheduling & Sequencing

### Schedule a broadcast
Pick a future date/time on the **Confirm** phase. Persist as `scheduled_for` on `broadcast_jobs`; the cron worker promotes scheduled jobs to `running` when their time arrives.

### Drip campaigns (multi-step DMs)
After the first DM is delivered, optionally queue a second/third DM at +1d, +3d, +7d. Reuses the existing follow-ups/flow-steps pipeline rather than reinventing it.

### Smart send window
Only send during 9am–9pm in the recipient's local timezone (best-effort from IG profile region). Lowers reported / blocked rates significantly.

---

## P4 — Analytics & Insights

### Broadcast performance dashboard
Per-job: sent / delivered / opened (via tracking-link first-byte) / clicked / replied. Already have `dm_link_codes` infrastructure — just need a `/dashboard/broadcasts/[id]` page.

### A/B variant report
For automations using A/B variants, show conversion (click-through rate) per variant with a confidence indicator once each side has 100+ sends.

### Account-health monitor
A small widget on the dashboard that surfaces:
- Today's send count vs. Meta's daily soft cap (~100 conversation-initiations).
- Throttle events in the last 24h.
- Tokens nearing expiry.

### Slack / email digest
Daily summary delivered via Resend (already a dependency): jobs completed, failures, top-clicked links.

---

## P5 — Operational Polish

### CSV export of recipients
On a completed job, "Export CSV" button → recipient_ig_id, status, sent_at, error_message. Critical for support and reconciliation.

### Multi-account broadcast picker
If a user has multiple connected accounts, let them choose which one sends each broadcast. Today the post's `account_id` is implicit.

### Audit log
A append-only `audit_events` table for sensitive actions (broadcast started, automation deleted, account disconnected). Visible at `/dashboard/audit`.

### In-app onboarding tour
First-run walkthrough that creates a sample automation against a test post. Reduces "what does this app even do" drop-off.

---

## Constraints & Considerations

- **Meta ToS:** every feature must respect Meta's [DM policy](https://developers.facebook.com/docs/messenger-platform/instagram/features/messaging-window) — broadcast DMs must follow up on a comment within the 24h messaging window or use a paid message tag.
- **Vercel cron limits:** Hobby plan crons run at most daily. Anything tighter than daily (drip, smart window, real-time retry) needs Pro plan or an external scheduler (e.g., Upstash QStash, Inngest).
- **Database growth:** `broadcast_recipients` and `dm_sent_log` will be the heaviest tables. Plan a retention policy (e.g., archive completed jobs older than 90 days to cold storage) before growth becomes a problem.
- **Cost of polling vs. realtime:** the current 4s polling is fine for one user but will dominate request volume at scale. Realtime should land before paid-tier launch.

---

## Sequencing Recommendation

1. **Week 1–2:** Adaptive rate limiting + per-recipient retry (P0). Without these, nothing else matters at scale.
2. **Week 2–3:** Realtime progress + audience preview (P0/P1). Two highest-visibility quality wins.
3. **Week 3–4:** Template variables + saved templates (P2). Largest perceived-value lift per line of code.
4. **Month 2:** Scheduling + drip campaigns (P3). Unlocks recurring-revenue use cases.
5. **Month 3:** Analytics dashboard + A/B report (P4). Justifies the price tag.
