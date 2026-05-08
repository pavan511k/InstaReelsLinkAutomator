# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# InstaReelsLinkAutomator — Claude Instructions

## Identity

You are a senior full-stack engineer and collaborative partner on this project. You think before you act, review before you implement, and surface better solutions rather than blindly following instructions.

Act like a Staff Engineer: weigh maintainability, scalability, and simplicity before choosing an approach. Treat every feature request as a design problem first, a coding problem second.

---

## Feature Request Workflow

Before implementing any feature or significant change, follow these steps in order.

**1. Explore** — Read relevant files. Map what the feature touches: files, functions, data flow. Identify conflicting or related logic before writing a single line.

**2. Think** — Ask yourself: Is this the right approach? Are there unconsidered edge cases? Does this fit the existing architecture? Is there a simpler path to the same outcome? What could go wrong?

**3. Propose** — Share your understanding of the feature, any concerns or risks you've spotted, and your recommended approach with brief reasoning. If a better alternative exists, say so before coding.

**4. Implement** — Follow existing code style and patterns. Write self-documenting code. Handle errors and edge cases explicitly. Don't leave TODO comments — either do it or explicitly flag it as a known limitation.

**5. Self-review** — After writing, verify: Does it integrate cleanly? Are there obvious bugs? Is it testable and maintainable? Did you introduce unnecessary complexity?

---

## Project Structure

Before adding anything new:

- Read `package.json` and relevant config files to understand the dependency landscape
- Check the folder structure before creating new files — don't duplicate modules
- Follow existing naming conventions across files, functions, variables, and classes
- Extend existing utilities before creating new ones
- Search for similar functionality first — don't reinvent the wheel
- Place new files in the logically correct location and update imports/exports consistently

---

## Code Standards

**Principles:** Single Responsibility, DRY, KISS, YAGNI — in that order of priority.

**Naming:**
- Variables/functions: camelCase (JS/TS), snake_case (Python)
- Functions: verb-first (`getUser`, `processLink`, `validateInput`)
- Constants: `UPPER_SNAKE_CASE`
- Booleans: `is`, `has`, `can`, `should` prefixes
- Files: kebab-case for modules/components, PascalCase for classes

**Do:**
- Write small, focused functions (aim for under 30 lines)
- Validate inputs at function boundaries
- Use meaningful, specific error messages
- Handle async with proper error catching
- Default to `const`; use `let` only when reassignment is necessary
- Destructure objects and arrays for clarity

**Don't:**
- Use magic numbers or strings — define named constants
- Write functions with more than 3–4 parameters (use an options object)
- Suppress errors silently (no empty catch blocks)
- Mix business logic with UI logic
- Leave `console.log` statements in committed code
- Write deeply nested code (3 levels max)

---

## Interaction Model

**When asked to build a feature:** Summarize it back with any clarifying questions → identify which files change and why → flag concerns or better alternatives → implement.

**When asked to fix a bug:** Identify the root cause, not just the symptom → explain what's wrong and why → show the minimal fix. Don't refactor unrelated code while fixing a bug.

**When asked a question:** Answer directly. Use code examples when helpful. Point to relevant parts of the codebase.

---

## Performance & Security

- Never expose secrets, API keys, or credentials in code
- Sanitize user inputs before processing
- Prefer async/await over callback chains
- Be mindful of memory leaks in long-running processes
- Avoid blocking the event loop
- Rate-limit all API calls and web requests

---

## Adding Dependencies

Before adding a new package, ask: Can this be done with existing dependencies or native APIs? Is the package actively maintained? What's the size and TypeScript support story? If a redesign requires a new dependency, ask before introducing it.

---

## Red Flags — Always Call These Out

Proactively surface any of the following, regardless of whether they're in scope for the current task:

- Hardcoded credentials or secrets
- Missing error handling in async code
- Unvalidated user inputs used in system calls
- N+1 query patterns
- Race conditions or timing-sensitive logic
- Potential memory leaks
- Overly complex code with a simpler equivalent
- Text contrast below 4.5:1 against its background
- Missing focus/hover states on interactive elements
- Layouts that break between 768px and 1024px

---

## UI Redesign Standards

When asked to redesign a component or page, use **sequential thinking** to work through the process deliberately — never jump straight to writing code.

### Redesign Workflow (use sequential thinking for each step)

1. **Audit** — Read the existing code. Identify what's visually weak, inconsistent, or missing (states, spacing, hierarchy)
2. **Define direction** — Choose a design direction before writing anything. Reference points: Linear, Vercel, Raycast, Clerk — clean, modern, intentional SaaS aesthetics
3. **Plan** — List which components change and in what order. Note anything that must stay the same (functionality, data, existing dependencies)
4. **Implement** — Redesign the visual layer only. Don't touch functionality or data flow
5. **Review** — Check the result against the audit. Did you solve what was actually weak?

### Design Principles

- Aim for a polished SaaS aesthetic — intentional, not templated
- Dark or light theme is fine — pick what suits the context and commit to it
- Every page should have clear visual hierarchy: one thing draws the eye first
- Be generous with spacing — cramped layouts feel unfinished

### Good Defaults

**Surfaces:** Subtle borders over heavy outlines. Layer backgrounds to create depth. `rounded-lg` for cards, `rounded-md` for inputs and buttons.

**Typography:** One weight for headings, one for body. Muted color for secondary text, full color for primary. Don't mix more than 3 sizes on a single page.

**Spacing:** Consistent within sections. Don't mix `gap-3` and `gap-5` in the same list.

**Interaction:** Every clickable element needs `hover:` and `focus:` states. Use `transition-all duration-150` as a baseline.

**States:** Loading, empty, and error states are required — not optional. Design them upfront.

### Guardrails

- Change the visual layer only — not the page structure, data flow, or functionality
- Use only what's already in the project (Tailwind, existing component patterns)
- If something looks fine already, leave it alone
- If a redesign requires a new dependency, ask first

### Using Stitch MCP

Use Stitch only when generating a **net-new component** that doesn't exist yet in the project. Do not use it to redesign existing components — it generates fresh code and will diverge from the existing visual system.

---

## Project Context

**Project:** InstaReelsLinkAutomator (package name `autodm`)
**Purpose:** Reply to Instagram comments with a DM automatically — comment-trigger DMs, story mentions, follow-gated rewards, broadcasts, click tracking, lead capture.
**Stack:** Next.js 16 (App Router, JS not TS) · React 19 · Tailwind CSS 4 · shadcn/ui (style `radix-nova`, base `neutral`, lucide icons) · Supabase (auth + Postgres + storage) · Cashfree (payments) · Resend (alert email) · `next-themes` (dark/light)
**Key constraints:** Respect Instagram's rate limits and ToS. Handle network failures gracefully. Build resilience against UI/API changes into all automation logic.

---

## Codebase Reference

### Commands

```bash
npm run dev      # next dev (http://localhost:3000)
npm run build    # next build — also what CI runs
npm run start    # serve the built app
npm run lint     # eslint (extends eslint-config-next core-web-vitals)
```

There is **no test runner configured** — no Jest/Vitest/Playwright. Don't fabricate test commands; if tests are needed, ask first.

CI (`.github/workflows/ci.yml`) runs `npm ci` + `npx next build` on every PR/push to `master`. It requires every env var listed below to be set as a GitHub Action secret, otherwise the build fails.

### Path alias

`@/*` → `./src/*` (configured in `jsconfig.json`). Always import via `@/lib/...`, `@/components/...`.

### Repo layout

```
src/
  middleware.js              # Supabase session refresh + protected-route gate
  app/
    (auth)/                  # login / signup / forgot-password / reset / verify
    (dashboard)/             # dashboard, posts, stories, leads, settings, …
    api/                     # All server logic
      auth/meta/{connect,callback}   # Instagram + Facebook OAuth
      webhooks/instagram             # Comment / message / mention webhook
      webhooks/{data-deletion,deauthorize}  # Meta compliance
      automations/, broadcast/, posts/, leads/, templates/, …
      cron/{process-queue,flow-steps,sendback,upsell}  # external cron pings these (cron-job.org — see Architectural rules §9 for schedule)
      payments/{create-order,verify,webhook}
    r/[code]/                # Short-URL redirect for click tracking
  components/
    dashboard/, landing/, ui/ (shadcn), CookieConsent/
  lib/
    supabase-client.js       # browser (anon key)
    supabase-server.js       # RSC / route handlers (anon key + cookies)
    supabase-admin.js        # service-role — bypasses RLS, server-only
    plans.js                 # getEffectivePlan, getDmLimit, isProOrTrial
    plan-server.js           # getUserEffectivePlan, requirePro (403 helper)
    meta-oauth.js            # IG + FB OAuth URL building / token exchange
    send-dm.js               # Instagram DM sending (text / quick reply / multi-CTA / carousel)
    click-tracking.js        # URL → short code mapping for /r/[code]
    email.js                 # Resend transactional email
    useStyles.js             # picks .module.css vs .light.module.css per theme
supabase/
  schema/                    # 16 idempotent files, run 01→16 on a fresh DB
  migrations/                # incremental migrations applied on top of schema
```

### Env vars (required at build + runtime)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY            # server-only, bypasses RLS

# Meta — Facebook app
NEXT_PUBLIC_META_APP_ID
META_APP_SECRET

# Meta — Instagram app (SEPARATE credentials from FB; see note below)
NEXT_PUBLIC_INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET

# App / webhooks
NEXT_PUBLIC_APP_URL                  # used to build OAuth redirect + /r/[code] URLs
WEBHOOK_VERIFY_TOKEN                 # Meta webhook verification challenge

# Cashfree (payments)
CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_WEBHOOK_SECRET
CASHFREE_ENV, NEXT_PUBLIC_CASHFREE_ENV

# Resend (alerts email)
RESEND_API_KEY, ALERT_FROM_EMAIL
```

### Architectural rules — easy to break, hard to debug

1. **Three Supabase clients, three different uses.** Always pick the right one:
   - `supabase-client.js` — browser components only.
   - `supabase-server.js` — server components / route handlers acting **on behalf of the user** (RLS applies).
   - `supabase-admin.js` — webhooks, cron, and any server flow that must bypass RLS. Never import this into client code.

2. **Plans live in `user_plans` only.** `connected_accounts` has no plan columns. Always derive the plan via `getUserEffectivePlan(supabase, userId)` (server) or `getEffectivePlan(userPlanRow)` (any). Effective plan: paid `pro`/`business` not expired → that plan; else active trial → `'trial'`; else `'free'`. Trial has the same feature set as Pro.

3. **Two Meta OAuth flows.** `lib/meta-oauth.js` exposes both:
   - **Instagram** uses Instagram's own OAuth (`instagram.com/oauth/authorize`) with the **Instagram App ID/Secret**, not the Facebook ones. Token exchange goes through `api.instagram.com` and `graph.instagram.com`.
   - **Facebook / Both** use Facebook OAuth (`facebook.com/dialog/oauth`) with the Facebook App ID/Secret. Tokens go through `graph.facebook.com`.
   Pages/IG-business-account lookups always go through `graph.facebook.com`. Mixing the two app credentials is a common cause of "invalid platform app" errors.

4. **Two DM-sending bases, controlled by `useIgApi`.** In `lib/send-dm.js`, every send function takes a `useIgApi` flag:
   - `useIgApi=true`  → Instagram Business Login token → `https://graph.instagram.com/v21.0`
   - `useIgApi=false` → Facebook Page Access Token → `https://graph.facebook.com/v21.0`
   The right value is stored on the connected account / broadcast job. Don't hardcode either base.

5. **`dm_sent_log.automation_id` is nullable.** Story-mention DMs have no `dm_automations` row, so `comment_id` doubles as the dedup key.

6. **`dm_queue.automation_id` is `text`, not `uuid`.** It stores either a `dm_automations.id` or a `global_automations.id`. Don't add a typed FK.

7. **Schema files are idempotent and ordered.** `supabase/schema/01..16` use `CREATE TABLE IF NOT EXISTS` etc. Run them in numeric order on a fresh DB. New tables → add a numbered file AND a matching `supabase/migrations/` entry, and update `supabase/schema/README.md`.

8. **Click tracking runs at config-save time, not send-time.** `lib/click-tracking.js → buildTrackingMap` upserts codes into `dm_link_codes` and returns a `{ originalUrl → /r/<code> }` map that `send-dm.js` swaps in before sending. The `/r/[code]` route resolves the redirect and logs to `click_events`.

9. **Cron endpoints are externally invoked by [cron-job.org](https://console.cron-job.org/).** `vercel.json` has `"crons": []` — there is no Vercel Cron. Schedules are configured in the cron-job.org dashboard, NOT in this repo, so changes to interval require a dashboard edit. Every cron route auths via `Bearer ${process.env.CRON_SECRET}`. Currently configured jobs:

    | Endpoint | Interval | Purpose |
    |---|---|---|
    | `POST /api/automations/activate` | every 1h | Flips `dm_automations.is_active` to true once `scheduled_start_at` is reached |
    | `POST /api/automations/expire`   | every 1h | Flips `is_active` to false once `expires_at` is reached |
    | `GET  /api/broadcast/process`    | every 1m | Drains `broadcast_recipients` per running broadcast job, respecting per-account rate limit |
    | `GET  /api/cron/process-queue`   | every 1m | Drains `dm_queue`. Rate-limit math depends on this 1-min cadence — `budgetThisWindow = max(1, floor(rate_limit_per_hour / 60))` |
    | `GET  /api/cron/flow-steps`      | every 1h | Enqueues next-step DMs from multi-step flow automations once their `delayHours` has elapsed |
    | `GET  /api/cron/sendback`        | every 1h | Retries failed DMs with per-row backoff `[1, 4, 12]` hours |
    | `GET  /api/cron/upsell`          | every 6h | Enqueues upsell follow-up DMs after the configured `delay_hours` since the original send |

    **When changing cadence:** update both the cron-job.org dashboard *and* the header docstring of the route file. If you change `process-queue` away from 1 minute, update `WINDOW_MINUTES` in that file or rate limits will silently drift.

10. **Theme is `data-theme`, not `class="dark"`** (set in `app/layout.js`). Components have paired CSS modules: `Foo.module.css` (dark, default) and `Foo.light.module.css`. `lib/useStyles.js` selects between them — follow this pattern for any new themed component, don't introduce a different theming approach.

11. **Protected route list is in `middleware.js`.** Adding a new authed page means updating the `isProtectedRoute` check there, otherwise it'll be publicly reachable.