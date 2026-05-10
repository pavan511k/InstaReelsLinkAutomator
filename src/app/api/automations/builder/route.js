import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getUserEffectivePlan } from '@/lib/plan-server';
import { isProOrTrial, getAutomationLimit } from '@/lib/plans';

/**
 * /api/automations/builder
 *
 * The new flow builder posts here. We deliberately keep this separate
 * from /api/automations (legacy upsert-by-post_id) so:
 *   - the new builder can save MULTIPLE automations per post (the
 *     legacy endpoint would clobber them via its onConflict: post_id),
 *   - we can validate the new field shape without back-compat shims,
 *   - the legacy /posts and /stories pages keep working untouched.
 *
 * Body shape — fields are mapped into the existing JSONB columns
 * (dm_config / trigger_config / settings_config) so no top-level
 * schema migration is needed beyond the multi-automation enabler in
 * `add-multi-automation-and-target-mode.sql`.
 */

const VALID_TYPES = new Set(['comment-to-dm', 'story-reply', 'dm-auto-responder', 'email-collector']);
const VALID_POST_TARGET_MODES = new Set(['specific', 'next', 'any']);

// Convert the builder's flat body shape into the row-shaped object
// that lands in dm_automations. This is the single source of truth
// for how the new builder state maps to the JSONB columns. The
// webhook reads these same fields back when firing.
function buildRowFromBody(body, userId, planIsPro) {
    const {
        type,
        name,
        postId,
        postTargetMode,
        anyKeyword,
        keywords,
        dmMessage,
        dmImageUrl,
        linkButtons,
        openingEnabled,
        openingMessage,
        openingButtonText,
        replyPublicly,
        publicReplies,
        reactWithHeart,
        askToFollow,
        askToFollowMessage,
        askToFollowButtonText,
        sendFollowUp,
        followUpMessage,
        emailAskMessage,
        emailThanksMessage,
        isActive,
    } = body;

    // Pro gate enforced server-side too. A free-plan user submitting
    // these flags via direct API call has them silently stripped so
    // the saved row never claims they're enabled.
    const askToFollowEffective = planIsPro && Boolean(askToFollow);
    const sendFollowUpEffective = planIsPro && Boolean(sendFollowUp);

    // Inner builder_v2 dm_config — this is what the webhook ultimately
    // sends to the recipient (either directly, or after the gate
    // check passes). For Email Collector the user-visible "DM" is
    // the ask message — we pipe it into `message` here so the
    // existing builder_v2 send path delivers it without any
    // template-specific branching downstream. The thank-you copy is
    // kept on settings_config and consumed by the email-reply
    // capture handler.
    const isEmailCollector = type === 'email-collector';
    const innerBuilderDmConfig = {
        templateType:      type,
        message:           isEmailCollector ? (emailAskMessage || '') : (dmMessage || ''),
        imageUrl:          isEmailCollector ? null : (dmImageUrl || null),
        buttons:           isEmailCollector ? [] : (Array.isArray(linkButtons) ? linkButtons : []),
        openingEnabled:    isEmailCollector ? false : Boolean(openingEnabled),
        openingMessage:    isEmailCollector ? '' : (openingMessage || ''),
        openingButtonText: isEmailCollector ? '' : (openingButtonText || ''),
    };

    // dm_type stays 'builder_v2' even when ask-to-follow is on. The
    // gate is now conditional (only fires for non-followers, decided
    // at webhook fire time), so we don't need to pre-emptively
    // reroute through the legacy follow_up dm_type. The webhook
    // reads `settings_config.askToFollow` and dispatches to the gate
    // path itself when needed.
    const dmType = 'builder_v2';
    const dmConfig = innerBuilderDmConfig;

    // Send-follow-up rides on the existing upsell cron, which already
    // does click-gating (skip recipients who tapped the link) and
    // 24h scheduling. We just shape its config block.
    const upsellBlock = sendFollowUpEffective
        ? {
            enabled:    true,
            delayHours: 24,
            message:    followUpMessage || 'Hey {first_name}, just checking in — did you get a chance to look? 👀',
            dmType:     'message_template',
        }
        : undefined;

    return {
        user_id: userId,
        // post_id is nullable now — only 'specific' mode binds to one.
        post_id: postTargetMode === 'specific' ? (postId || null) : null,
        dm_type: dmType,
        dm_config: dmConfig,
        trigger_config: {
            type:           'keywords',
            anyKeyword:     Boolean(anyKeyword),
            keywords:       Array.isArray(keywords) ? keywords : [],
            postTargetMode: postTargetMode || 'specific',
        },
        settings_config: {
            automationName:      name || '',
            templateType:        type,
            replyPublicly:       Boolean(replyPublicly),
            publicReplies:       Array.isArray(publicReplies) ? publicReplies : [],
            reactWithHeart:      Boolean(reactWithHeart),
            // Round-trip the source toggle state so the builder can
            // reconstruct UI on edit even though the row's dm_type
            // changes when askToFollow flips.
            askToFollow:            askToFollowEffective,
            askToFollowMessage:     askToFollowMessage || '',
            askToFollowButtonText:  askToFollowButtonText || "I'm following!",
            sendFollowUp:           sendFollowUpEffective,
            followUpMessage:        followUpMessage || '',
            emailAskMessage:        emailAskMessage || '',
            emailThanksMessage:     emailThanksMessage || '',
            ...(upsellBlock ? { upsell: upsellBlock } : {}),
        },
        is_active: Boolean(isActive),
        updated_at: new Date().toISOString(),
    };
}

// Returns an error string when the body is missing required pieces
// for the chosen template / target mode. Keep validation centralized
// so Save and Go Live share the same gate.
function validateBody(body) {
    const { type, name, postTargetMode, anyKeyword, keywords, dmMessage, postId } = body;

    if (!type || !VALID_TYPES.has(type)) return 'Invalid template type.';
    if (!name?.trim())                   return 'Automation name is required.';

    // Post-bound templates need a target mode + a post when 'specific'.
    if (type === 'comment-to-dm' || type === 'story-reply') {
        if (!postTargetMode || !VALID_POST_TARGET_MODES.has(postTargetMode)) {
            return 'Pick how this automation targets posts (Specific / Next / Any).';
        }
        if (postTargetMode === 'specific' && !postId) {
            return 'Pick a specific post first, or switch to Next Post / Any Post.';
        }
    }

    // Keywords: either anyKeyword toggle OR at least one keyword. We
    // disallow saving a "fires on nothing" config since it's almost
    // certainly a mistake.
    if (!anyKeyword && (!Array.isArray(keywords) || keywords.length === 0)) {
        return 'Add at least one keyword, or enable "Any keyword".';
    }

    if (type === 'email-collector') {
        // For email-collector the "main DM" is the ask message. The
        // standard dmMessage textarea isn't shown to the user for
        // this template.
        if (!body.emailAskMessage?.trim()) return 'Add the ask message that requests the email.';
        if (!body.emailThanksMessage?.trim()) return 'Add the thank-you message that confirms capture.';
    } else if (!dmMessage?.trim()) {
        return 'DM message text is required.';
    }

    return null;
}

/**
 * Server-side automation count gate. Free users are capped at
 * FREE_AUTOMATION_LIMIT total automations. Returns null when the user
 * can create another, or a NextResponse with 403 when they're at cap.
 * Counts non-archived rows only — once we add archive semantics those
 * shouldn't burn a slot.
 */
async function checkAutomationLimit(supabase, userId, plan) {
    const limit = getAutomationLimit(plan);
    if (limit == null) return null; // unlimited

    const { count, error } = await supabase
        .from('dm_automations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (error) {
        console.error('[Builder] Count check failed:', error);
        return null; // fail-open — don't block on a count failure
    }
    if ((count ?? 0) >= limit) {
        return NextResponse.json(
            {
                error: `Free plan is limited to ${limit} automations. Upgrade to Pro for unlimited automations.`,
                upgradeRequired: true,
                limit,
                current: count,
            },
            { status: 403 },
        );
    }
    return null;
}

// ── Create a new automation ──────────────────────────────────────────────────
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

    const validationError = validateBody(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    // Pro/Trial gate for the two advanced toggles. We re-check on the
    // server because the client-side disabled state is just UX —
    // a determined user could submit body.askToFollow=true on free.
    const plan       = await getUserEffectivePlan(supabase, user.id);
    const planIsPro  = isProOrTrial(plan);
    if (!planIsPro && (body.askToFollow || body.sendFollowUp)) {
        return NextResponse.json(
            { error: 'Ask-to-follow and Send follow-up require a Pro plan.', upgradeRequired: true },
            { status: 403 },
        );
    }

    // Email Collector is a Pro-only template. Block at the templateType
    // level so the picker on the client gets a clean upgrade prompt
    // and a determined user can't bypass via direct API call.
    if (!planIsPro && body.type === 'email-collector') {
        return NextResponse.json(
            { error: 'Email Collector is a Pro feature. Upgrade to capture leads via DM.', upgradeRequired: true },
            { status: 403 },
        );
    }

    // Free-tier automation cap. Pro/Trial bypass.
    const capResp = await checkAutomationLimit(supabase, user.id, plan);
    if (capResp) return capResp;

    // If postId is set, double-check the user owns the post (RLS will
    // also enforce, but we want a clean 403 instead of a silent insert
    // failure on a foreign key violation).
    if (body.postTargetMode === 'specific' && body.postId) {
        const { data: post } = await supabase
            .from('instagram_posts')
            .select('id, account_id, connected_accounts!inner(user_id)')
            .eq('id', body.postId)
            .single();
        if (!post || post.connected_accounts.user_id !== user.id) {
            return NextResponse.json({ error: 'Post not found or not yours' }, { status: 404 });
        }
    }

    const row = buildRowFromBody(body, user.id, planIsPro);
    const { data, error } = await supabase
        .from('dm_automations')
        .insert(row)
        .select('id, is_active, post_id')
        .single();

    if (error) {
        console.error('[Builder] Insert failed:', error);
        return NextResponse.json({ error: 'Failed to save automation' }, { status: 500 });
    }

    return NextResponse.json({ success: true, automation: data });
}

// ── Duplicate by id (POST body: { id }) ──────────────────────────────────────
// Creates a new dm_automations row that mirrors the source's config
// but starts inactive (so the duplicate doesn't fire until the user
// reviews + activates it) and with a "(copy)" suffix on the name so
// the list view differentiates them. The original row stays
// untouched.
export async function PATCH(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

    const id = body?.id;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    // Free-tier automation cap also blocks duplicates — a duplicate
    // creates a new row, so it consumes a slot just like POST.
    const plan    = await getUserEffectivePlan(supabase, user.id);
    const capResp = await checkAutomationLimit(supabase, user.id, plan);
    if (capResp) return capResp;

    // Fetch source row (RLS scopes by user, but we explicitly check
    // for a clean 404 instead of a silent "not found").
    const { data: src, error: srcErr } = await supabase
        .from('dm_automations')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
    if (srcErr || !src) {
        return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    const newSettings = {
        ...(src.settings_config || {}),
        automationName: `${(src.settings_config?.automationName || 'Automation')} (copy)`,
    };

    const { data: created, error: insErr } = await supabase
        .from('dm_automations')
        .insert({
            user_id:         user.id,
            post_id:         src.post_id,
            dm_type:         src.dm_type,
            dm_config:       src.dm_config,
            trigger_config:  src.trigger_config,
            settings_config: newSettings,
            // Duplicates start paused so users can review before it
            // fires. They flip the toggle on the list to activate.
            is_active:       false,
            // Carry over neither expiry nor scheduled-start; they
            // were set on the source row and rarely apply identically
            // to the copy. User can re-set if needed.
            expires_at:        null,
            scheduled_start_at: null,
        })
        .select('id')
        .single();

    if (insErr) {
        console.error('[Builder] Duplicate failed:', insErr);
        return NextResponse.json({ error: 'Failed to duplicate automation' }, { status: 500 });
    }
    return NextResponse.json({ success: true, automation: created });
}

// ── Delete by id (?id=<uuid>) ────────────────────────────────────────────────
// We accept the id via query string so the AutomationsList can issue
// a plain DELETE without a body. RLS enforces ownership; we still
// scope by user_id explicitly for a clean 404 path.
export async function DELETE(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { error, count } = await supabase
        .from('dm_automations')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        console.error('[Builder] Delete failed:', error);
        return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 });
    }
    if (count === 0) {
        return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
}

// ── Update an existing automation by id ──────────────────────────────────────
export async function PUT(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

    const id = body?.id;
    if (!id) return NextResponse.json({ error: 'Automation id is required' }, { status: 400 });

    const validationError = validateBody(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    // Same Pro gate as POST — silently strip on free plans.
    const plan       = await getUserEffectivePlan(supabase, user.id);
    const planIsPro  = isProOrTrial(plan);
    if (!planIsPro && (body.askToFollow || body.sendFollowUp)) {
        return NextResponse.json(
            { error: 'Ask-to-follow and Send follow-up require a Pro plan.', upgradeRequired: true },
            { status: 403 },
        );
    }

    // Verify ownership before mutating — RLS enforces this on the
    // update too, but a clean 404 beats a silent zero-row update.
    const { data: existing } = await supabase
        .from('dm_automations')
        .select('id, user_id')
        .eq('id', id)
        .single();
    if (!existing || existing.user_id !== user.id) {
        return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    const row = buildRowFromBody(body, user.id, planIsPro);
    // Don't overwrite created_at; keep the original lifecycle.
    const { data, error } = await supabase
        .from('dm_automations')
        .update(row)
        .eq('id', id)
        .select('id, is_active, post_id')
        .single();

    if (error) {
        console.error('[Builder] Update failed:', error);
        return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 });
    }

    return NextResponse.json({ success: true, automation: data });
}
