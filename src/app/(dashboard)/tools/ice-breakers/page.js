import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import IceBreakersView from './IceBreakersView';
import { getUserEffectivePlan } from '@/lib/plan-server';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

/**
 * /tools/ice-breakers — account-level Ice Breakers editor.
 *
 * Ice Breakers are inbox-level prompts (up to 4 questions visible
 * the moment a non-follower opens the DM thread). They're a single
 * config per account, NOT per-automation, so they live under /tools
 * rather than /automations.
 *
 * The split-pane builder layout (phone preview left, editor right)
 * is reused via the same `builder-fullbleed` class — same useEffect-
 * driven layout strip that the automations builder uses.
 */
export const metadata = {
  title: 'Ice Breakers — AutoDM',
};

export default async function IceBreakersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const workspaceId = await getActiveWorkspaceId(supabase);

  // Active connected account — Ice Breakers attach per-account at the
  // Meta `messenger_profile` API, so we need the account id + a way
  // to render the IG handle / avatar in the preview.
  const { data: account } = workspaceId ? await supabase
    .from('connected_accounts')
    .select('id, ig_username, ig_profile_picture_url, default_config')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() : { data: null };

  if (!account) {
    // No connected account → bounce them to settings to connect one.
    // Ice breakers are useless without an account behind them.
    redirect('/settings');
  }

  const igUsername  = account.ig_username || 'your_handle';
  const igAvatarUrl = account.ig_profile_picture_url || null;

  // Pre-seeded defaults so first-time users see "what does this look
  // like?" rather than 4 empty boxes. Loaded values from
  // default_config.iceBreakers override these when present.
  const DEFAULT_QUESTIONS = [
    { title: 'How can I help?',         responseMessage: "Hey! What can I help you with today? 🙌" },
    { title: 'Tell me about your work', responseMessage: "Glad you asked! Here's a quick rundown of what I do…" },
  ];

  const saved = Array.isArray(account.default_config?.iceBreakers)
    && account.default_config.iceBreakers.length > 0
      ? account.default_config.iceBreakers
      : DEFAULT_QUESTIONS;

  // The "enabled" flag isn't stored on Meta — it's a local-only
  // toggle: enabled=true means push to Meta, false means clear from
  // Meta. We infer it from whether the saved array has any items.
  const initialEnabled = Array.isArray(account.default_config?.iceBreakers)
    && account.default_config.iceBreakers.length > 0;

  const effectivePlan = await getUserEffectivePlan(supabase, user.id);

  return (
    <IceBreakersView
      accountId={account.id}
      igUsername={igUsername}
      igAvatarUrl={igAvatarUrl}
      initialEnabled={initialEnabled}
      initialQuestions={saved}
      effectivePlan={effectivePlan}
    />
  );
}
