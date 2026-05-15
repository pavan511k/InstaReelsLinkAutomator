import { createClient } from '@/lib/supabase-server';
import SettingsContent from '@/components/dashboard/SettingsContent';
import { getActiveWorkspaceId } from '@/lib/workspace-context';
import { getUserEffectivePlan } from '@/lib/plan-server';
import { getWorkspaceLimit } from '@/lib/plans';

export const metadata = {
    title: 'Settings — AutoDM',
};

export default async function SettingsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const workspaceId = await getActiveWorkspaceId(supabase);

    let connectedAccounts = [];
    try {
        const { data: accounts } = workspaceId ? await supabase
            .from('connected_accounts')
            .select('id, platform, ig_username, ig_profile_picture_url, fb_page_name, fb_page_id, is_active, default_config, scopes, created_at')
            .eq('workspace_id', workspaceId) : { data: [] };

        connectedAccounts = accounts || [];
    } catch {
        // Table may not exist yet
    }

    let workspaces = [];
    try {
        const { data } = await supabase
            .from('workspaces')
            .select('id, name, slug, is_locked, created_at')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: true });
        workspaces = data || [];
    } catch { /* table may not exist in very fresh deploys */ }

    const effectivePlan      = await getUserEffectivePlan(supabase, user.id);
    const workspaceLimit     = getWorkspaceLimit(effectivePlan);
    const canCreateWorkspace = workspaces.length < workspaceLimit;

    return (
        <SettingsContent
            user={user}
            connectedAccounts={connectedAccounts}
            workspaces={workspaces}
            activeWorkspaceId={workspaceId}
            workspaceLimit={workspaceLimit}
            canCreateWorkspace={canCreateWorkspace}
            effectivePlan={effectivePlan}
        />
    );
}
