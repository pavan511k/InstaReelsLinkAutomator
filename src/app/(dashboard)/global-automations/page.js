import { createClient } from '@/lib/supabase-server';
import GlobalAutomationsContent from '@/components/dashboard/GlobalAutomationsContent';
import { getUserEffectivePlan } from '@/lib/plan-server';

export const metadata = { title: 'Global Triggers — AutoDM' };

export default async function GlobalAutomationsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let connectedAccounts = [];
    try {
        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('id, platform, is_active, default_config, ig_username, fb_page_name, fb_page_id')
            .eq('user_id', user.id);
        connectedAccounts = accounts || [];
    } catch { /* table may not exist */ }

    const userPlan = await getUserEffectivePlan(supabase, user.id);

    return <GlobalAutomationsContent connectedAccounts={connectedAccounts} userPlan={userPlan} />;
}
