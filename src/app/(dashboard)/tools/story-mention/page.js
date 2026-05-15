import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import StoryMentionView from './StoryMentionView';
import { getUserEffectivePlan } from '@/lib/plan-server';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

export const metadata = {
  title: 'Story Mention Auto-DM — AutoDM',
};

export default async function StoryMentionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const workspaceId = await getActiveWorkspaceId(supabase);

  const { data: account } = workspaceId ? await supabase
    .from('connected_accounts')
    .select('id, ig_username, ig_profile_picture_url, default_config')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() : { data: null };

  if (!account) redirect('/settings');

  const igUsername  = account.ig_username || 'your_handle';
  const igAvatarUrl = account.ig_profile_picture_url || null;

  const mentionCfg = account.default_config?.mentionDm || {};
  const initialEnabled = !!mentionCfg.enabled;
  const initialMessage =
    mentionCfg.message ||
    'Hey! Thanks for mentioning us 🙌 We saw your story and wanted to reach out!';

  const effectivePlan = await getUserEffectivePlan(supabase, user.id);

  return (
    <StoryMentionView
      accountId={account.id}
      defaultConfig={account.default_config || {}}
      igUsername={igUsername}
      igAvatarUrl={igAvatarUrl}
      initialEnabled={initialEnabled}
      initialMessage={initialMessage}
      effectivePlan={effectivePlan}
    />
  );
}
