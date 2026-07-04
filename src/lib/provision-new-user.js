import { createHash } from 'crypto';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { TRIAL_DAYS } from '@/lib/plans';
import { sendTrialStartedEmail } from '@/lib/email';
import { enforceWorkspaceLocks } from '@/lib/workspace-locks';

/**
 * Normalize an email and return its SHA-256 hex hash — or null if empty.
 *
 * Normalization: trim + lowercase + strip a "+alias" from the local part
 * (you+farm@x.com → you@x.com), which closes the obvious repeat-trial trick.
 * The `trial_history` ledger stores ONLY this hash — never the email — so the
 * abuse block holds no PII and can safely survive account deletion.
 *
 * Kept in sync with the normalization in
 * supabase/migrations/backfill-trial-history.sql.
 */
export function hashEmail(email) {
    let normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return null;

    const at = normalized.indexOf('@');
    if (at > 0) {
        const local  = normalized.slice(0, at).split('+')[0];
        const domain = normalized.slice(at); // includes '@'
        normalized = `${local}${domain}`;
    }
    return createHash('sha256').update(normalized).digest('hex');
}

/**
 * First-time user provisioning — the single place that turns a freshly
 * authenticated user into a usable AutoDM account:
 *   1. A 30-day Pro trial row in `user_plans` (+ the "trial started" email),
 *      UNLESS this email has already had a trial (abuse block) — then a plain
 *      Free row with no trial and no email.
 *   2. A Default workspace if they own none.
 *   3. A defensive workspace-lock reconciliation.
 *
 * Idempotent — safe to call on every auth. Skips everything trial-related when
 * a `user_plans` row already exists, so it never resets a paid user or
 * re-emails a returning one.
 *
 * Shared by every trial-grant path (/auth/callback, /auth/confirm, the mobile
 * /api/auth/provision-trial endpoint, and the dashboard layout fallback) so the
 * one-free-trial-per-email rule can't leak through any of them.
 *
 * @param {{ id: string, email?: string, user_metadata?: object }} user
 * @returns {Promise<{ activeWorkspaceId: string|null, trialGranted: boolean, trialEndsAt: string|null, alreadyExisted: boolean }>}
 */
export async function provisionNewUser(user) {
    const serviceDb = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    const userId = user.id;

    // ── Plan: trial (or Free-no-trial for a repeat email), first time only ──
    const { data: existingPlan } = await serviceDb
        .from('user_plans').select('user_id')
        .eq('user_id', userId).maybeSingle();

    const alreadyExisted = !!existingPlan;
    let trialGranted = false;
    let trialEndsAt  = null;

    if (!existingPlan) {
        // One free trial per email, ever. Fail OPEN — if the ledger lookup
        // errors (or the table isn't migrated yet), we grant the trial rather
        // than break signup on the abuse guard.
        const emailHash = hashEmail(user.email);
        let priorTrial = false;
        if (emailHash) {
            try {
                const { data: hist } = await serviceDb
                    .from('trial_history').select('email_hash')
                    .eq('email_hash', emailHash).maybeSingle();
                priorTrial = !!hist;
            } catch (e) {
                console.warn('[provisionNewUser] trial_history lookup failed (granting trial):', e?.message);
            }
        }

        if (priorTrial) {
            // Repeat email → Free, no trial, no welcome email.
            await serviceDb.from('user_plans').upsert(
                { user_id: userId, plan: 'free', trial_ends_at: null },
                { onConflict: 'user_id', ignoreDuplicates: true },
            );
            console.log(`[provisionNewUser] Repeat email for ${userId} — Free, no trial`);
        } else {
            const ends = new Date();
            ends.setDate(ends.getDate() + TRIAL_DAYS);

            // Insert-if-absent and report whether WE won the insert (empty on
            // conflict), so the welcome email + ledger write fire exactly once
            // even if two provisioners race for the same brand-new user.
            const { data: inserted } = await serviceDb.from('user_plans').upsert(
                { user_id: userId, plan: 'free', trial_ends_at: ends.toISOString() },
                { onConflict: 'user_id', ignoreDuplicates: true },
            ).select('user_id');

            if (Array.isArray(inserted) && inserted.length > 0) {
                trialGranted = true;
                trialEndsAt  = ends.toISOString();

                // Record the grant so a future re-signup with this email is
                // blocked. Best-effort; a 23505 just means a concurrent grant
                // already recorded it.
                if (emailHash) {
                    const { error: histErr } = await serviceDb
                        .from('trial_history').insert({ email_hash: emailHash });
                    if (histErr && histErr.code !== '23505') {
                        console.warn('[provisionNewUser] trial_history insert failed:', histErr.message);
                    }
                }

                console.log(`[provisionNewUser] Trial provisioned for ${userId} — expires ${ends.toDateString()}`);

                // Fire-and-forget "trial started" email — a send failure must
                // not block the auth redirect.
                const userEmail = user.email;
                const userName  = user.user_metadata?.full_name || '';
                if (userEmail) {
                    sendTrialStartedEmail({
                        to:          userEmail,
                        name:        userName,
                        igUsername:  '', // not connected yet — email copy handles this
                        trialEndsAt,
                    }).catch((e) => console.warn('[provisionNewUser] Trial email send failed:', e.message));
                }
            }
        }
    }

    // ── Default workspace (first time only) ──────────────────────────────
    let activeWorkspaceId = null;
    const { data: existingWs } = await serviceDb
        .from('workspaces').select('id')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true })
        .limit(1).maybeSingle();

    if (existingWs) {
        activeWorkspaceId = existingWs.id;
    } else {
        const { data: newWs } = await serviceDb
            .from('workspaces')
            .insert({ owner_id: userId, name: 'Default', slug: 'default' })
            .select('id').single();
        if (newWs) {
            await serviceDb.from('workspace_members')
                .insert({ workspace_id: newWs.id, user_id: userId, role: 'owner' });
            activeWorkspaceId = newWs.id;
            console.log(`[provisionNewUser] Default workspace ${newWs.id} created for ${userId}`);
        }
    }

    // Reconcile workspace locks defensively (trial/plan may have lapsed since
    // the user last touched the app).
    try {
        await enforceWorkspaceLocks(serviceDb, userId);
    } catch (err) {
        console.warn('[provisionNewUser] Lock reconciliation failed:', err.message);
    }

    return { activeWorkspaceId, trialGranted, trialEndsAt, alreadyExisted };
}
