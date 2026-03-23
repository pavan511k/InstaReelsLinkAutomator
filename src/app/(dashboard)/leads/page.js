import { createClient } from '@/lib/supabase-server';
import LeadsContent from '@/components/dashboard/LeadsContent';

export const metadata = { title: 'Email Leads — AutoDM' };

export default async function LeadsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let connectedAccounts = [];
    try {
        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('id, platform, is_active')
            .eq('user_id', user.id);
        connectedAccounts = accounts || [];
    } catch { /* table may not exist */ }

    return <LeadsContent connectedAccounts={connectedAccounts} />;
}
