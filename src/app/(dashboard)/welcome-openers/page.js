import { createClient } from '@/lib/supabase-server';
import WelcomeOpenersContent from '@/components/dashboard/WelcomeOpenersContent';

export const metadata = { title: 'Welcome Openers — AutoDM' };

export default async function WelcomeOpenersPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let connectedAccounts = [];
    try {
        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('id, platform, is_active, default_config')
            .eq('user_id', user.id);
        connectedAccounts = accounts || [];
    } catch { /* table may not exist */ }

    return <WelcomeOpenersContent connectedAccounts={connectedAccounts} />;
}
