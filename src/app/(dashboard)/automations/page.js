import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import AutomationsView from './AutomationsView';
import { getUserEffectivePlan } from '@/lib/plan-server';

/**
 * /automations — unified list of every automation built with the new
 * flow builder (dm_type='builder_v2'). Legacy rows from the old per-
 * type pages aren't surfaced here yet — they'll be migrated in a
 * follow-up. Each row carries its post relation (when bound) so the
 * list can show a thumbnail + caption snippet without a second
 * round-trip.
 */
export const metadata = {
  title: 'Automations — AutoDM',
};

export default async function AutomationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch builder_v2 rows for this user. instagram_posts is joined
  // inline so the list can render a post thumbnail + caption next
  // to each automation without an N+1 lookup. Sorted newest-first
  // (updated_at) so the most-recently-touched automation is on top.
  //
  // We try to include the engagement counts (comments_count) added by
  // `add-post-engagement.sql` and fall back to a query without them if
  // that migration hasn't run yet.
  let rows = [];
  const tryWithCounts = await supabase
    .from('dm_automations')
    .select(`
      id, post_id, dm_type, dm_config, trigger_config, settings_config,
      is_active, scheduled_start_at, expires_at, updated_at, created_at,
      instagram_posts:post_id (id, thumbnail_url, media_url, caption, is_story, comments_count)
    `)
    .eq('user_id', user.id)
    .eq('dm_type', 'builder_v2')
    .order('updated_at', { ascending: false });

  if (!tryWithCounts.error) {
    rows = tryWithCounts.data || [];
  } else {
    const fallback = await supabase
      .from('dm_automations')
      .select(`
        id, post_id, dm_type, dm_config, trigger_config, settings_config,
        is_active, scheduled_start_at, expires_at, updated_at, created_at,
        instagram_posts:post_id (id, thumbnail_url, media_url, caption, is_story)
      `)
      .eq('user_id', user.id)
      .eq('dm_type', 'builder_v2')
      .order('updated_at', { ascending: false });
    rows = fallback.data || [];
  }

  // Aggregate stats (Runs / Clicks / last-run timestamp) via the
  // builder_automation_stats RPC so we hit dm_sent_log + click_events
  // exactly once each instead of per-row. If the migration hasn't
  // been applied yet, the RPC returns an error — we fall through with
  // zeros so the list still renders (the columns just show "—").
  const statsByAutomation = {};
  try {
    const { data: rpcStats, error: rpcErr } = await supabase
      .rpc('builder_automation_stats', { user_uuid: user.id });
    if (!rpcErr && Array.isArray(rpcStats)) {
      for (const s of rpcStats) {
        statsByAutomation[s.automation_id] = {
          runs:       Number(s.runs || 0),
          clicks:     Number(s.clicks || 0),
          lastRunAt:  s.last_run_at || null,
        };
      }
    }
  } catch { /* RPC not deployed yet — render zeros */ }

  const automations = (rows || []).map((r) => {
    const post = r.instagram_posts || null;
    const triggerCfg  = r.trigger_config  || {};
    const settingsCfg = r.settings_config || {};
    const dmCfg       = r.dm_config       || {};
    const stats = statsByAutomation[r.id] || { runs: 0, clicks: 0, lastRunAt: null };
    return {
      id:               r.id,
      name:             settingsCfg.automationName || 'Untitled automation',
      templateType:     settingsCfg.templateType || dmCfg.templateType || 'comment-to-dm',
      isActive:         r.is_active,
      scheduledStartAt: r.scheduled_start_at,
      expiresAt:        r.expires_at,
      updatedAt:        r.updated_at,
      createdAt:        r.created_at,
      postTargetMode:   triggerCfg.postTargetMode || 'specific',
      keywords:         Array.isArray(triggerCfg.keywords) ? triggerCfg.keywords : [],
      anyKeyword:       Boolean(triggerCfg.anyKeyword),
      postId:           r.post_id,
      postThumbUrl:     post ? (post.thumbnail_url || post.media_url) : null,
      postCaption:      post?.caption || null,
      // Total comments under the bound post — used by the resend
      // modal to approximate "comments available to DM" (= total
      // minus already-sent). Null until the engagement sync runs.
      postCommentsCount: typeof post?.comments_count === 'number' ? post.comments_count : null,
      runs:             stats.runs,
      clicks:           stats.clicks,
      lastRunAt:        stats.lastRunAt,
    };
  });

  const effectivePlan = await getUserEffectivePlan(supabase, user.id);

  return <AutomationsView automations={automations} effectivePlan={effectivePlan} />;
}
