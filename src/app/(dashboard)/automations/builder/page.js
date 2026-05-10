import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import BuilderView from './BuilderView';
import { getUserEffectivePlan } from '@/lib/plan-server';
import { isProOrTrial } from '@/lib/plans';

const VALID_TYPES = new Set([
  'comment-to-dm',
  'story-reply',
  // 'ice-breakers' moved to /tools/ice-breakers (account-level config).
  'dm-auto-responder',
  'email-collector',
]);

// Templates that require Pro/Trial. Free users hitting the builder
// directly via URL get bounced to /automations?upgrade=email-collector
// which pops the PricingModal — same UX as the picker tile lock.
const PRO_ONLY_TYPES = new Set(['email-collector']);

/**
 * /automations/builder — flow builder.
 *
 * Two modes:
 *   - CREATE: query params `type=<template>` + `name=<draft name>`,
 *     set by the NameAutomationModal "Continue to Builder" action.
 *   - EDIT:   query param `edit=<automation-id>`. We fetch that row
 *     and pass the full record to BuilderView, which hydrates state
 *     from it. The URL alone is enough — no other params required.
 *
 * Anything else redirects to /automations (no "open the builder cold"
 * path).
 */
export const metadata = {
  title: 'Flow builder — AutoDM',
};

export default async function FlowBuilderPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params  = await searchParams;
  const editId  = (params?.edit || '').toString();

  // ── Edit mode: load the existing row and derive type/name from it ─
  let initialAutomation = null;
  let type = (params?.type || '').toString();
  let name = (params?.name || '').toString();

  if (editId) {
    const { data: row } = await supabase
      .from('dm_automations')
      .select('*')
      .eq('id', editId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!row) {
      redirect('/automations');
    }
    initialAutomation = row;
    // Settings_config carries the builder template type + display
    // name; fall back to anything sensible if older rows were saved
    // by the legacy endpoint (which doesn't write these fields).
    type = row.settings_config?.templateType || row.dm_config?.templateType || 'comment-to-dm';
    name = row.settings_config?.automationName || row.settings_config?.name || 'Automation';
  }

  if (!VALID_TYPES.has(type) || !name) {
    redirect('/automations');
  }

  // IG handle + profile picture for the phone preview header. Falls
  // back to a generic placeholder/icon when the user hasn't connected
  // an account yet (still possible via the modal flow if they navigate
  // here mid-onboarding).
  const { data: account } = await supabase
    .from('connected_accounts')
    .select('id, ig_username, ig_profile_picture_url, default_config')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const igUsername  = account?.ig_username || 'your_handle';
  const igAvatarUrl = account?.ig_profile_picture_url || null;
  // Seed values for new automations from the user's saved Settings
  // → Default Configuration. Edit-mode automations ignore these
  // (they hydrate from their own saved row).
  const accountDefaults = account?.default_config || {};

  // Posts grid for the "Specific Post" / "Specific Story" pickers in
  // the builder. We split on `is_story` so each template only shows
  // the right kind. RLS restricts these rows to accounts owned by the
  // current user. If no account, the array is empty and the picker
  // shows its own empty state.
  //
  // We try to fetch the engagement counts (like_count / comments_count)
  // first — those columns are added by `add-post-engagement.sql`. If
  // the migration hasn't been applied yet the query errors, in which
  // case we fall back to a query without those fields so the picker
  // still works (counts simply render as em-dashes).
  let posts = [];
  if (account?.id) {
    const wantStories = type === 'story-reply';
    const tryWithCounts = await supabase
      .from('instagram_posts')
      .select('id, ig_post_id, caption, thumbnail_url, media_url, media_type, timestamp, is_story, like_count, comments_count')
      .eq('account_id', account.id)
      .eq('is_story', wantStories)
      .order('timestamp', { ascending: false })
      .limit(60);

    if (!tryWithCounts.error) {
      posts = tryWithCounts.data || [];
    } else {
      const fallback = await supabase
        .from('instagram_posts')
        .select('id, ig_post_id, caption, thumbnail_url, media_url, media_type, timestamp, is_story')
        .eq('account_id', account.id)
        .eq('is_story', wantStories)
        .order('timestamp', { ascending: false })
        .limit(60);
      posts = fallback.data || [];
    }
  }

  // Effective plan gates the Pro features in AdvancedCard
  // (Ask-to-follow + Send follow-up). 'trial' counts as Pro for
  // feature access (full Pro experience during the 30-day trial).
  const effectivePlan = await getUserEffectivePlan(supabase, user.id);

  // Pro-only template types — block direct URL access in edit mode is
  // fine (the row already exists), but block CREATE for free users so
  // they don't waste time building a flow that won't save.
  if (!editId && PRO_ONLY_TYPES.has(type) && !isProOrTrial(effectivePlan)) {
    redirect(`/automations?upgrade=${encodeURIComponent(type)}`);
  }

  return (
    <BuilderView
      type={type}
      initialName={name}
      igUsername={igUsername}
      igAvatarUrl={igAvatarUrl}
      posts={posts}
      initialAutomation={initialAutomation}
      effectivePlan={effectivePlan}
      accountDefaults={accountDefaults}
    />
  );
}
