# Design — Trial-Abuse Block (one free trial per email)

**Date:** 2026-07-04
**Status:** Draft for review (no code written yet)
**Decision:** Option A — block the *trial* on re-signup, never the *account*. One trial ever, per email.

---

## Problem

Every new user gets a 30-day Pro trial, provisioned on first sign-in keyed on the
new `auth.users` id. Deleting the account removes `user_plans`, so re-signing up
(even with the same email) mints a brand-new id → a fresh 30-day trial. Repeatable
indefinitely.

## Goal / Non-goals

- **Goal:** a given email address gets **at most one** free 30-day Pro trial, ever.
  A repeat signup starts on **Free** (can use the product, can pay for Pro).
- **Non-goals:**
  - NOT blocking account re-creation (legitimate; only the freebie is denied).
  - NOT payment/device fingerprinting (heavier, privacy-invasive, false-positives).
  - NOT retaining PII — we store only a one-way hash, so the "we delete all your
    data" promise still holds.

## Data model

New table (survives account deletion by design — **no FK to `auth.users`**, so
nothing cascades it away; that persistence is the whole point):

```sql
-- supabase/schema/21_trial_history.sql  (+ migrations/add-trial-history.sql)
CREATE TABLE IF NOT EXISTS trial_history (
    email_hash     text PRIMARY KEY,              -- SHA-256 of the normalized email
    first_trial_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE trial_history ENABLE ROW LEVEL SECURITY;   -- no policy: service-role only
```

- No email, no user id, no PII — just an opaque hash + a timestamp for support/audit.
- PK on `email_hash` gives an atomic "already granted?" via insert-on-conflict.

## Email normalization + hashing

`src/lib/provision-trial.js`:

```js
import { createHash } from 'crypto';

export function hashEmail(email) {
    let e = String(email || '').trim().toLowerCase();
    if (!e) return null;
    // Strip +alias in the local part (user+farm@x.com → user@x.com) — a common
    // trial-farming vector. Different real people effectively never collide here.
    const [local, domain] = e.split('@');
    if (local && domain) e = `${local.split('+')[0]}@${domain}`;
    return createHash('sha256').update(e).digest('hex');
}
```

- Deferred/optional: Gmail dot-stripping (`a.b@gmail == ab@gmail`) — provider-specific
  and risks false-positives on domains where dots are significant, so not in v1.

## Centralized provisioning (the crux)

> **Update — the shared provisioner now exists.** The confirmation-email (PKCE) fix
> extracted `src/lib/provision-new-user.js → provisionNewUser(user)` and routed both
> `/auth/callback` (OAuth) and `/auth/confirm` (email links) through it. The trial-abuse
> check drops into its **"no existing `user_plans` row"** branch; the two remaining grant
> sites — `api/auth/provision-trial` (mobile) and the `(dashboard)/layout.js` fallback —
> then get pointed at the same function so the block can't leak.
>
> **Repeat email → Free, `trial_ends_at: null`, and NO trial-started email** — the email
> only fires inside the branch that actually grants a trial, so a repeat is silently Free.

Eligibility logic added inside that "no existing plan" branch:

```js
// src/lib/provision-trial.js
export async function provisionUserPlan(serviceDb, { userId, email }) {
    // Idempotent: never overwrite an existing plan (esp. a paid one).
    const { data: existing } = await serviceDb
        .from('user_plans').select('user_id').eq('user_id', userId).maybeSingle();
    if (existing) return { status: 'existing', trial: false };

    const emailHash = hashEmail(email);

    // Has this email had a trial before? Fail OPEN — if the ledger is missing or
    // errors, we grant the trial (never break signup on the abuse-guard).
    let priorTrial = false;
    if (emailHash) {
        try {
            const { data } = await serviceDb
                .from('trial_history').select('email_hash').eq('email_hash', emailHash).maybeSingle();
            priorTrial = !!data;
        } catch { priorTrial = false; }
    }

    if (priorTrial) {
        await serviceDb.from('user_plans')
            .upsert({ user_id: userId, plan: 'free', trial_ends_at: null },
                    { onConflict: 'user_id', ignoreDuplicates: true });
        return { status: 'repeat', trial: false };           // Free, no trial
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
    await serviceDb.from('user_plans')
        .upsert({ user_id: userId, plan: 'free', trial_ends_at: trialEndsAt.toISOString() },
                { onConflict: 'user_id', ignoreDuplicates: true });

    // Record the grant so a future re-signup is caught. Best-effort.
    if (emailHash) {
        try { await serviceDb.from('trial_history').insert({ email_hash: emailHash }); }
        catch (e) { if (e?.code !== '23505') console.warn('[trial] history insert failed:', e?.message); }
    }
    return { status: 'granted', trial: true, trialEndsAt: trialEndsAt.toISOString() };
}
```

The three existing sites are refactored to call it (behavior preserved, incl. who emails):

| Site | Change |
|---|---|
| `src/app/auth/callback/route.js` | Replace the inline `if (!existingPlan) { insert… }` with `provisionUserPlan(...)`; send the trial-started email **iff** `result.trial === true`. |
| `src/app/api/auth/provision-trial/route.js` | Same — call `provisionUserPlan(...)`, email iff `result.trial`, return `alreadyExisted`/`trial` in the JSON. |
| `src/app/(dashboard)/layout.js` | Replace the fallback upsert with `provisionUserPlan(...)`, then re-read for render. No email (unchanged behavior). |

## Interactions

- **Account deletion (`/api/accounts/delete`):** no change needed — `trial_history` has
  no user link, so deletion can't (and mustn't) remove it. This is intentional.
- **Paid user who deletes, then re-signs up — warn + support (decided).** We do **not**
  auto-restore remaining paid time (that would require persisting paid-plan data past
  deletion, undercutting the "we delete all your data" promise, for a rare event). Instead:
  (a) **warn at deletion** if the user is on an active paid plan — "You have Pro until
  \<date\>; deleting forfeits the remaining time"; (b) the rare accidental case is handled
  by **support**, who can verify the charge in Cashfree and manually reinstate. On re-signup
  such a user is treated as a normal repeat email → Free, no trial. *(The deletion-warning
  copy is a small addition to the delete-account modal, tracked with this feature.)*
- **Payments:** unaffected. A repeat-email user is on Free and can buy Pro normally
  (create-order → verify/webhook set `plan='pro'`).
- **Google + mobile:** both already funnel through one of the three sites → covered by
  the central function.

## Edge cases

- **No email on the user** → `hashEmail` returns null → we grant the trial (fail-open; rare).
- **`trial_history` table not migrated yet** → the check fails open → behaves exactly
  like today until the migration runs. Safe to deploy code first.
- **Existing pre-feature users** aren't in the ledger, so one delete+rejoin could still
  get a trial after ship. **Optional one-time backfill:** hash all current `auth.users`
  emails into `trial_history` (hashes only — same privacy posture). Recommended but not
  required for v1.
- **Concurrent provisioning** (two sign-ins racing) → `user_plans` PK + `ignoreDuplicates`
  and the `trial_history` PK make it safe.

## Rollout

1. Run `migrations/add-trial-history.sql` (create the table).
2. Deploy the code (fails open, so order is safe).
3. *(Optional)* run the backfill to cover existing users.

## Files

- **New:** `supabase/schema/21_trial_history.sql`, `supabase/migrations/add-trial-history.sql`,
  README update, `src/lib/provision-trial.js`.
- **Modified:** `auth/callback/route.js`, `api/auth/provision-trial/route.js`, `(dashboard)/layout.js`.
- **Optional:** `supabase/migrations/backfill-trial-history.sql` (or a one-off script).

## Verification

- Manual: signup → verify → **trial** granted; delete account → re-signup same email →
  **Free, no trial**; signup with a different email → **trial**. Confirm a paid user who
  re-signs in is never reset (existing-plan short-circuit).
- Code: diagnostics clean; the central function reasoned through for the fail-open and
  concurrency paths.
