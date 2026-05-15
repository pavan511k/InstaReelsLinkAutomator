/**
 * Bind builder_v2 automations saved with trigger_config.postTargetMode='next'
 * to the oldest post the user has published AFTER the automation was created.
 * Flips the mode to 'specific' so the binding is one-shot. Idempotent —
 * already-bound rows have post_id != null and are skipped by the filter.
 *
 * Called from two places:
 *   1. /api/posts/sync (bulk, after the full sync upsert)
 *   2. Webhook lazy-sync path (single-post, after fetchAndUpsertPost)
 *
 * Non-fatal — any failure is logged and swallowed so the calling flow
 * continues. Pending automations stay pending and bind on the next pass.
 */
export async function bindPendingNextPostAutomations(supabase, workspaceId, accountIds) {
    if (!accountIds || accountIds.length === 0) return;
    if (!workspaceId) return;
    try {
        const { data: pendingNext } = await supabase
            .from('dm_automations')
            .select('id, created_at, trigger_config')
            .eq('workspace_id', workspaceId)
            .eq('dm_type', 'builder_v2')
            .eq('is_active', true)
            .is('post_id', null)
            .filter('trigger_config->>postTargetMode', 'eq', 'next');

        if (!pendingNext || pendingNext.length === 0) return;

        for (const auto of pendingNext) {
            const { data: candidates } = await supabase
                .from('instagram_posts')
                .select('id, timestamp')
                .in('account_id', accountIds)
                .eq('is_story', false)
                .gt('timestamp', auto.created_at)
                .order('timestamp', { ascending: true })
                .limit(1);
            const target = candidates?.[0];
            if (!target) continue;
            const nextTrigger = { ...(auto.trigger_config || {}), postTargetMode: 'specific' };
            const { error: bindErr } = await supabase
                .from('dm_automations')
                .update({
                    post_id:        target.id,
                    trigger_config: nextTrigger,
                    updated_at:     new Date().toISOString(),
                })
                .eq('id', auto.id);
            if (bindErr) {
                console.warn(`[NextPostBind] Failed for automation ${auto.id}:`, bindErr.message);
            } else {
                console.log(`[NextPostBind] Bound automation ${auto.id} to post ${target.id}`);
            }
        }
    } catch (err) {
        console.warn('[NextPostBind] Pass failed:', err.message);
    }
}
