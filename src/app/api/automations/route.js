import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { extractUrlsFromConfig, buildTrackingMap } from '@/lib/click-tracking';
import { getUserEffectivePlan, requirePro } from '@/lib/plan-server';
import { isProOrTrial } from '@/lib/plans';

/**
 * Validate a single DM variant config.
 * Returns an error string, or null if valid.
 */
function validateDmConfig(dmConfig) {
    switch (dmConfig?.type) {
        case 'button_template': {
            const hasValid = (dmConfig.slides || []).some(
                (s) => (s.buttonLabel && s.buttonUrl) ||
                        (s.buttons || []).some((b) => b.label && b.value)
            );
            if (!hasValid) return 'Button template requires at least one slide with a button and URL';
            break;
        }
        case 'message_template':
            if (!dmConfig.message?.trim()) return 'Message template requires a message';
            break;
        case 'quick_reply':
            if (!dmConfig.message?.trim()) return 'Quick reply requires a message';
            if (!dmConfig.quickReplies?.length) return 'Quick reply requires at least one reply option';
            break;
        case 'multi_cta': {
            const hasBtn = (dmConfig.buttons || []).some((b) => b.label?.trim() && b.url?.trim());
            if (!hasBtn) return 'Multi-CTA requires at least one button with a label and URL';
            break;
        }
        case 'follow_up':
            if (!dmConfig.gateMessage?.trim()) return 'Follow Gate requires a gate message';
            break;
        case 'email_collector':
            if (!dmConfig.emailAskMessage?.trim()) return 'Email Collector requires an ask message';
            break;
        default:
            if (!dmConfig?.type) return 'DM type is required';
    }
    return null;
}

/**
 * POST /api/automations
 * Create or update a DM automation for a post
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { postId, dmConfig, triggerConfig, settingsConfig } = body;

    // Extract expiresAt from settingsConfig — stored both in JSONB and as a proper column
    const expiresAt = settingsConfig?.expiresAt && settingsConfig?.expiresEnabled
        ? new Date(settingsConfig.expiresAt).toISOString()
        : null;

    // Extract scheduledStartAt — when set and in the future, automation starts inactive
    const rawScheduled   = settingsConfig?.scheduledStartAt && settingsConfig?.scheduledStartEnabled
        ? new Date(settingsConfig.scheduledStartAt)
        : null;
    const scheduledStartAt = rawScheduled && rawScheduled > new Date()
        ? rawScheduled.toISOString()
        : null;
    // is_active = false when a future start is scheduled; true otherwise
    const isActiveOnSave = !scheduledStartAt;

    if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    if (!dmConfig || !triggerConfig) {
        return NextResponse.json({ error: 'DM and trigger configurations are required' }, { status: 400 });
    }

    // ── Plan gates ────────────────────────────────────────────────────────
    const effectivePlan = await getUserEffectivePlan(supabase, user.id);
    const isPro         = isProOrTrial(effectivePlan);

    // Pro-only DM types
    const proOnlyTypes = ['follow_up', 'email_collector'];
    const usedType = dmConfig.abEnabled
        ? (dmConfig.variantA?.type || dmConfig.variantB?.type)
        : dmConfig.type;
    if (proOnlyTypes.includes(usedType) && !isPro) {
        return NextResponse.json(
            { error: `${usedType === 'follow_up' ? 'Follow Gate' : 'Email Collector'} requires a Pro plan.`, upgradeRequired: true },
            { status: 403 }
        );
    }

    // A/B testing is Pro-only
    if (dmConfig.abEnabled && !isPro) {
        return NextResponse.json(
            { error: 'A/B message testing requires a Pro plan.', upgradeRequired: true },
            { status: 403 }
        );
    }

    // Backfill (send to previous comments) is Pro-only
    if ((dmConfig.sendToPreviousComments || settingsConfig?.sendToPreviousComments) && !isPro) {
        return NextResponse.json(
            { error: 'Sending DMs to previous comments requires a Pro plan.', upgradeRequired: true },
            { status: 403 }
        );
    }

    // Flow steps and upsell are Pro-only
    if (settingsConfig?.flowAutomation && settingsConfig?.flowSteps?.length > 0 && !isPro) {
        return NextResponse.json(
            { error: 'Flow Automation requires a Pro plan.', upgradeRequired: true },
            { status: 403 }
        );
    }
    if (settingsConfig?.upsell?.enabled && !isPro) {
        return NextResponse.json(
            { error: 'Upsell follow-up requires a Pro plan.', upgradeRequired: true },
            { status: 403 }
        );
    }

    // Only require keywords when trigger type is 'keywords'
    const triggerType = triggerConfig.type || 'keywords';
    if (triggerType === 'keywords' && (!triggerConfig.keywords || triggerConfig.keywords.length === 0)) {
        return NextResponse.json({ error: 'At least one trigger keyword is required for keyword triggers' }, { status: 400 });
    }

    // Validate DM config — handles both regular and A/B modes
    if (dmConfig.abEnabled) {
        if (!dmConfig.variantA || !dmConfig.variantB) {
            return NextResponse.json({ error: 'A/B test requires both Variant A and Variant B to be configured' }, { status: 400 });
        }
        const errA = validateDmConfig(dmConfig.variantA);
        if (errA) return NextResponse.json({ error: `Variant A: ${errA}` }, { status: 400 });
        const errB = validateDmConfig(dmConfig.variantB);
        if (errB) return NextResponse.json({ error: `Variant B: ${errB}` }, { status: 400 });
    } else {
        const err = validateDmConfig(dmConfig);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
        // Extra follow_up reward check
        if (dmConfig.type === 'follow_up') {
            const hasReward = dmConfig.linkMessage?.trim() ||
                (dmConfig.linkDmConfig?.buttons || []).some((b) => b.label?.trim() && b.url?.trim()) ||
                (dmConfig.linkDmConfig?.slides || []).some((s) => s.buttonUrl?.trim());
            if (!hasReward) return NextResponse.json({ error: 'Follow Gate requires a reward link (Step 4)' }, { status: 400 });
        }
    }

    try {
        // Verify the post belongs to this user
        const { data: post, error: postError } = await supabase
            .from('instagram_posts')
            .select('id, account_id, connected_accounts!inner(user_id)')
            .eq('id', postId)
            .single();

        if (postError || !post) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        if (post.connected_accounts.user_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { data: automation, error: upsertError } = await supabase
            .from('dm_automations')
            .upsert({
                user_id:             user.id,
                post_id:             postId,
                dm_type:             dmConfig.type,
                dm_config:           dmConfig,
                trigger_config:      triggerConfig,
                settings_config:     settingsConfig || {},
                expires_at:          expiresAt,
                scheduled_start_at:  scheduledStartAt,
                is_active:           isActiveOnSave,
                updated_at:          new Date().toISOString(),
            }, { onConflict: 'post_id' })
            .select()
            .single();

        if (upsertError) {
            console.error('Failed to save automation:', upsertError);
            return NextResponse.json({ error: 'Failed to save automation' }, { status: 500 });
        }

        // ── Generate click-tracking codes for all outgoing URLs ────────
        // For A/B automations, generate codes per variant for proper attribution.
        try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
            if (appUrl) {
                if (dmConfig.abEnabled && dmConfig.variantA && dmConfig.variantB) {
                    const urlsA = extractUrlsFromConfig(dmConfig.variantA);
                    const urlsB = extractUrlsFromConfig(dmConfig.variantB);
                    if (urlsA.length > 0) await buildTrackingMap(urlsA, automation.id, user.id, supabase, appUrl, 'A');
                    if (urlsB.length > 0) await buildTrackingMap(urlsB, automation.id, user.id, supabase, appUrl, 'B');
                } else {
                    const urls = extractUrlsFromConfig(dmConfig);
                    if (urls.length > 0) await buildTrackingMap(urls, automation.id, user.id, supabase, appUrl);
                }
            }
        } catch (trackErr) {
            console.warn('[Automations] Click tracking setup failed (non-fatal):', trackErr.message);
        }

        // ── Trigger backfill if sendToPreviousComments is enabled ──────────
        // Fire-and-forget: don't block the save response
        if (dmConfig.sendToPreviousComments || settingsConfig?.sendToPreviousComments) {
            const backfillUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/automations/backfill`;
            fetch(backfillUrl, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'x-backfill-internal': '1' },
                body:    JSON.stringify({ automationId: automation.id, postId }),
            }).catch((e) => console.warn('[Automations] Backfill trigger failed (non-fatal):', e.message));
        }

        return NextResponse.json({
            success: true,
            scheduled: !!scheduledStartAt,
            scheduledStartAt: scheduledStartAt || null,
            backfilling: !!(dmConfig.sendToPreviousComments || settingsConfig?.sendToPreviousComments),
            automation: {
                id:      automation.id,
                postId:  automation.post_id,
                isActive: automation.is_active,
            },
        });
    } catch (err) {
        console.error('Automation save error:', err);
        return NextResponse.json({ error: `Save failed: ${err.message}` }, { status: 500 });
    }
}

/**
 * GET /api/automations
 */
export async function GET(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    try {
        let query = supabase
            .from('dm_automations')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (postId) {
            query = query.eq('post_id', postId);
        }

        const { data: automations, error } = await query;

        if (error) {
            return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 });
        }

        return NextResponse.json({ automations: automations || [] });
    } catch (err) {
        return NextResponse.json({ error: `Fetch failed: ${err.message}` }, { status: 500 });
    }
}

/**
 * DELETE /api/automations
 */
export async function DELETE(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    try {
        const { error } = await supabase
            .from('dm_automations')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', user.id);

        if (error) {
            return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: `Delete failed: ${err.message}` }, { status: 500 });
    }
}
