import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getUserEffectivePlan } from '@/lib/plan-server';
import LeadsContent from '@/components/dashboard/LeadsContent';
import { getActiveWorkspaceId } from '@/lib/workspace-context';

export const metadata = { title: 'Email Leads — AutoDM' };

export default async function LeadsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Defensive — middleware should already protect this route, but if a session
    // expires mid-render the page must not crash trying to read user.id.
    if (!user) redirect('/login');
    const workspaceId = await getActiveWorkspaceId(supabase);

    const plan = await getUserEffectivePlan(supabase, user.id);
    const isPro = plan === 'pro' || plan === 'business' || plan === 'trial';

    let connectedAccounts = [];
    try {
        const { data: accounts } = workspaceId ? await supabase
            .from('connected_accounts')
            .select('id, platform, is_active')
            .eq('workspace_id', workspaceId) : { data: [] };
        connectedAccounts = accounts || [];
    } catch { /* table may not exist */ }

    return <LeadsContent connectedAccounts={connectedAccounts} isPro={isPro} />;
}
