# Feature Audit Checklist

Working list of every feature advertised on the pricing page, the plan tiers + platform expectations for each, the code paths that own them, and an audit status. We tick these off **one feature at a time**, asking the same four questions per row:

1. **Does it work end-to-end** for the plan tier the pricing page promises?
2. **Does the plan-gate hold** at all three layers (UI · API · runtime)?
3. **Does it behave correctly per platform** (Instagram-only, Facebook-only, Both)?
4. **Is the UI consistent and the flow easy?** — same dropdown / chip / counter / branding patterns as everything else; setup is obvious and forgiving; nothing surprises the user; preview reflects wire content; copy is clear and honest.

> **Not in production yet.** Free to refactor flows, rename labels, drop confusing fields, restructure forms, change defaults — anything that improves usefulness and reduces setup friction. No need for backwards-compat migrations on user data.

> Trial is treated as Pro for feature access (`isProOrTrial` returns `true` for `'pro' | 'business' | 'trial'`). When the trial expires the user reverts to `'free'`; existing Pro automations keep firing until the DM cap is hit, but new Pro features can't be created.

## Status legend

| Symbol | Meaning |
|---|---|
| ⏳ | Not yet audited |
| 🔍 | Audit in progress |
| ✅ | Verified end-to-end + fixes shipped (functional **and** UX) |
| 🎨 | Functional ✓ but UX redesign recommended (see notes column) |
| ⚠️ | Audited; gaps documented but deferred (e.g. needs schema migration) |
| ❌ | Not yet implemented |

## Plan-tier shorthand

| Tag | Means |
|---|---|
| **Free** | available on free plan |
| **Pro** | requires `pro` / `business` / `trial` (anything `isProOrTrial`) |

## Platform shorthand

| Tag | Means |
|---|---|
| **IG** | Instagram-only |
| **IG/FB** | Works on both, possibly with text-only degradation on FB |
| **IG-only by API** | Only IG implements the underlying Meta API; FB has no equivalent |

---

## A. DM Types (already audited)

| # | Feature | Plan | Platform | Code path | Status |
|---|---|---|---|---|---|
| A1 | Button Template (image card + CTA button) | Free | IG-only by API · FB filtered out | `send-dm.js: sendButtonTemplateDM` · `DMSetupTab.js` · `PhonePreview.renderButtonTemplate` | ✅ |
| A2 | Message Template (plain text DM) | Free | IG/FB | `send-dm.js: sendTextDM` + `applyBranding` · `PhonePreview.renderMessageTemplate` | ✅ |
| A3 | Quick Reply (tappable chips + chip-tap response loop) | Free | IG-only by API · FB filtered | `send-dm.js: sendQuickReplyDM` · webhook `handleQuickReplyTap` · `DMSetupTab.js` chip-card form | ✅ |
| A4 | Multi-CTA (text + up to 3 URL buttons) | Free | IG-only by API · FB filtered | `send-dm.js: sendMultiCtaDM` · `PhonePreview.renderMultiCta` | ✅ |
| A5 | Follow Gate (send link after follow verified) | Pro | IG-only by API | `webhooks/instagram: handleFollowUpAutomation` + `handleIncomingDMReply` + `checkUserIsFollower` | ✅ |
| A6 | Email Collector (capture leads via DM reply) | Pro | IG/FB (FB picker filters; mechanically works as text) | `webhooks/instagram: handleEmailCollectorAutomation` + `handleEmailCollectorReply` · `email_collect_queue` · `email_leads` | ✅ |

---

## B. Plan Limits & Infrastructure

| # | Feature | Plan | Platform | Code path | Status |
|---|---|---|---|---|---|
| B1 | **3,000 DMs per month** | Free | IG/FB | `lib/plans.js: getDmLimit` · `cron/process-queue` billing gate · `webhooks: monthly count check` | ✅ |
| B2 | **Unlimited DMs per month** | Pro | IG/FB | Same — `getDmLimit('pro')` returns `null` (no cap) | ✅ |
| B3 | **Per-account rate limiting** | Free | IG/FB | `connected_accounts.rate_limit_per_hour` · enforced in `cron/process-queue` | ✅ |
| B4 | **Excess DM Queue** (handles viral spikes) | Free | IG/FB | `dm_queue` table · `cron/process-queue` route · `webhooks: enqueue path` | ✅ |
| B5 | **SendBack — auto-retry failed DMs** | Free | IG/FB | `cron/sendback` route · uses `dm_sent_log.retry_count` | ✅ |

---

## C. Triggers

| # | Feature | Plan | Platform | Code path | Status |
|---|---|---|---|---|---|
| C1 | Keyword triggers | Free | IG/FB | `webhooks: processAutomationForComment` keyword match · `TriggerSetupTab` | ✅ |
| C2 | All comments trigger | Free | IG/FB | Same handler — `triggerType: 'all_comments'` | ✅ |
| C3 | Emojis-only trigger | Free | IG/FB | Same handler — `triggerType: 'emojis_only'` | ✅ |
| C4 | @Mentions-only trigger | Free | IG/FB | Same handler — `triggerType: 'mentions_only'` | ✅ |
| C5 | Auto-reply to triggering comment | Free | IG/FB | `replyToComment` in `send-dm.js` · uses `useIgApi` for routing | ✅ |
| C6 | Send delay (humanised random timing) | Free | IG/FB | `dmConfig.settings.delayMessage` → `scheduled_after` on `dm_queue` | ✅ |
| C7 | **Global Triggers** (account-wide keywords) | Pro | IG/FB | `processGlobalTriggers` in webhook · `global_automations` table · `/global-automations` page | ✅ |

---

## D. Scheduling

| # | Feature | Plan | Platform | Code path | Status |
|---|---|---|---|---|---|
| D1 | **Schedule automation start time** | Pro | IG/FB | `dmConfig.settings.scheduledStartEnabled` · `scheduledStartAt` · `dm_automations.scheduled_start_at` | ✅ |
| D2 | Set automation expiry date | Free | IG/FB | `dm_automations.expires_at` · checked in webhook before send | ✅ |

---

## E. Slides / Templates

| # | Feature | Plan | Platform | Code path | Status |
|---|---|---|---|---|---|
| E1 | Carousel slides (up to 3) | Free | IG-only by API | `DMSetupTab: FREE_SLIDE_LIMIT = 3` · `dm_config.slides` | ✅ (limit enforcement audited as part of A1) |
| E2 | **Unlimited carousel slides** | Pro | IG-only by API | Same — picker shows "Pro" pill once at free limit; capped at META_MAX_CARDS=10 per IG generic-template spec | ✅ |
| E3 | **Save & load DM templates** | Pro | IG/FB | `dm_templates` table · `/api/templates` · `DMSetupTab` template bar | ✅ |

---

## F. Advanced DM Features

| # | Feature | Plan | Platform | Code path | Status |
|---|---|---|---|---|---|
| F1 | **A/B message testing with winner detection** | Pro | IG-only by API | `dm_config.abEnabled` · `dm_sent_log.ab_variant` · `processAutomationForComment` variant pick · `checkAndDeclareAbWinner` | ✅ |
| F2 | **Send DMs to previous comments (backfill)** | Pro | IG/FB | `/api/automations/backfill` route · enqueues to `dm_queue` | ✅ |
| F3 | **Multi-step Flow Automation** (sequential DMs) | Pro | IG/FB | `dm_automations.settings_config.flowSteps` · `cron/flow-steps` route · `dm_sent_log.flow_step` | ✅ |
| F4 | **Follow-up DMs to non-clickers** | Pro | IG/FB | `cron/upsell` route · per-recipient attribution via `?r=<igsid>` on tracked URLs (`lib/click-tracking.js: attachRecipient`) · `click_events.recipient_ig_id` · cron skips recipients with a click row | ✅ |
| F5 | **Welcome Openers** (inbox quick-reply buttons / ice breakers) | Pro | IG-only by API | `/api/ice-breakers` route · `connected_accounts.default_config.iceBreakers` · webhook `handleIceBreakerResponse` · `/welcome-openers` page | ✅ |
| F6 | **Story Mention Auto-DM** | Pro | IG-only by API | `webhooks: handleStoryMentionEvent` · `connected_accounts.default_config.mentionDm` | ✅ |

---

## G. Analytics & Logs

| # | Feature | Plan | Platform | Code path | Status |
|---|---|---|---|---|---|
| G1 | Analytics dashboard (server-rendered, refresh-to-update) | Free | IG/FB | `(dashboard)/dashboard/page.js` server component · `DashboardView` · `AnalyticsChart` · `DailyDMChart` | ✅ |
| G2 | DM sent log with comment history (+ platform filter) | Free | IG/FB | `/api/logs` · `LogsContent.js` · `dm_sent_log.platform` (recent fix) | ✅ (logs page audited + redesigned) |
| G3 | Usage limit alerts (email + webhook) | Free | IG/FB | `/api/alerts` · `alert_preferences` table · `fireAlerts` from webhook · webhook self-gates on `alertLimit === null` (Pro users skipped — they have no limit to warn about) | ✅ |
| G4 | Link click count (tracked short URLs) | Free | IG/FB | `dm_link_codes` · `/r/[code]` redirect · `click_events` table · `lib/click-tracking` (per-recipient `?r=` attribution added in F4) | ✅ |
| G5 | CTR % in posts table | Free | IG/FB | `(dashboard)/posts/page.js` enrichment · `PostsTable.js` CTR column with Pro/Free split (Pro → clickable modal, Free → percent + 🔒 upsell) | ✅ |
| G6 | **Full click analytics dashboard** (charts, per-link, A/B) | Pro | IG/FB | `ClickStatsModal.js` · `/api/clicks` (Pro-gated) · per-link breakdown · daily series with A/B split | ✅ |
| G7 | **Email Leads list + CSV export** | Pro | IG (FB filtered) | `/api/leads` · `LeadsContent.js` · CSV-injection escape (recent fix) | ✅ (audited as part of A6 + earlier) |

---

## H. Platform Support

| # | Feature | Plan | Platform | Code path | Status |
|---|---|---|---|---|---|
| H1 | Instagram Posts & Reels | Free | IG | `/api/posts/sync` (routes IG/FB via correct API base · dedups by ig_post_id) · `instagram_posts` table · `is_story = false` rows | ✅ |
| H2 | Instagram Stories | Free | IG | `instagram_posts.is_story = true` · `/stories` page · `StoriesContent.js` (UI hides expired stories via 24h filter) | ✅ |
| H3 | Facebook Pages | Free | FB | `auth/meta/callback` page-link path · `connected_accounts.platform = 'facebook'` · webhook `handleFacebookCommentEvent` · DMSetupTab forces `message_template` when `platform === 'facebook'` (text-only by API constraint) | ✅ |

---

## I. Support

| # | Feature | Plan | Notes |
|---|---|---|---|
| I1 | Email support | Free | `support@autodm.pro` consistent across app (lib/email.js, terms, privacy, footer, verify, success). **Manual verification still needed: confirm the inbox is actively monitored.** | ✅ (code-side) |
| I2 | **Priority support** | Pro | No code-side priority routing — depends on whoever reads the inbox to manually prioritize Pro users. Could be improved by auto-tagging mailto subjects with `[Pro]` so triage is filter-friendly. | ⚠️ |

---

## Common audit checklist (for every row)

When auditing each item, the answers we need:

### Functional correctness
- [ ] **End-to-end works** on Instagram-only account (free if free-tier feature, Pro if Pro)
- [ ] **End-to-end works** on Facebook-only account where applicable, OR is correctly hidden/filtered if not
- [ ] **End-to-end works** on Both (per-post platform routing where relevant)
- [ ] **Plan-gate** at UI (picker / form lock / upgrade pill)
- [ ] **Plan-gate** at API (`/api/...` returns 403 with `upgradeRequired: true`)
- [ ] **Plan-gate** at runtime (webhook / cron honours plan; free user with stale Pro data hits cap-not-feature-fence)
- [ ] **Branding parity** if it sends DMs — free gets the AutoDM footer, Pro respects `dm_config.branding`
- [ ] **Variable substitution** (`{first_name}` / `{username}` / `{email}` where relevant) renders correctly in send + preview
- [ ] **Preview matches wire content** in `PhonePreview` (no surprises at send time)

### UI consistency & UX flow
- [ ] **Light + dark theme** — no inline-styled boxes, all CSS classes themed; reads cleanly on both
- [ ] **Custom Select** (not native `<select>`) for any dropdowns — matches the rest of the app
- [ ] **Char counters + maxLength** on every textarea that maps to a Meta API limit; empty-state hint when blank
- [ ] **Modal Pro upgrade pill** uses the locked-chip-with-upgrade-link pattern (same as Branding fields)
- [ ] **Save validation** — empty / malformed configs blocked at save with a clear error, not silently allowed
- [ ] **Inline help / hints** for non-obvious fields (URL forgiveness, character limits, what gets sent when)
- [ ] **Form label honesty** — labels match what the field actually controls (e.g. "Card heading" not "Message" if the API treats it as a 80-char title)
- [ ] **Setup feels obvious for a first-time user** — flow has clear steps, no "what do I put here?" moments, sample-substituted previews

### "Should we change the UX?" — questions to ask per feature
- Is anything **redundant** (two fields that produce the same outcome)?
- Is anything **misleading** (label promises X, behaviour does Y)?
- Is anything **missing** that creators will obviously want (e.g. missing per-chip response on Quick Reply was a half-built feature)?
- Is anything **over-built** (e.g. dead-code multi-button-per-slide path nobody uses)?
- Could the **default values** be smarter (a sensible starting message instead of an empty textarea)?
- Should rare options be **collapsed** behind an "Advanced" disclosure to keep the first-time setup short?
- Is there an **earlier gate** that would save the user time — e.g. checking trigger keywords before letting them craft a long DM?
- For Pro-only features: is the **upgrade affordance** present and helpful, or just a 403?
- Does the **mobile layout** still work (modal sheets, thumb-reachable CTAs)?

Since we're pre-prod, it's cheaper to **rename / restructure / change defaults now** than after creators build muscle memory around the current shape.

## Plan-tier matrix (sanity check)

| Plan | Effective name in code | Feature surface |
|---|---|---|
| `free` | `'free'` | A1–A4, B1 (capped 3K), B3–B5, C1–C6, D2, E1, G1, G2, G4, G5, H1, H2, H3, I1 |
| `trial` (7 days) | `'trial'` (treated as Pro by `isProOrTrial`) | Everything in `free` + all Pro features |
| `pro` | `'pro'` | Free + A5, A6, B2 (uncapped), C7, D1, E2, E3, F1–F6, G3, G6, G7, I2 |
| `business` | `'business'` | Same as Pro currently — reserved for future seat / volume tier |

## Per-platform feature matrix (what's promised vs what works)

| Capability | IG | FB | Both |
|---|---|---|---|
| Plain-text DMs | ✅ | ✅ | per-post |
| Button Template / image cards | ✅ | hidden in picker | per-post |
| Quick Reply chips + tap loop | ✅ | hidden | per-post |
| Multi-CTA (3 buttons) | ✅ | hidden | per-post |
| Follow Gate | ✅ | not applicable | IG posts only |
| Email Collector | ✅ | hidden (mechanically text-only) | IG posts only |
| Story features | ✅ | n/a (FB has no Stories) | IG only |
| Welcome Openers | ✅ | n/a | IG only |
| Comment auto-reply | ✅ | ✅ | per-post |
| A/B testing | ✅ | hidden when picker filtered | per-post |
| Global Triggers | ✅ | ✅ (text-only DMs on FB) | both |
| Click tracking (`/r/<code>`) | ✅ | ✅ | both |
