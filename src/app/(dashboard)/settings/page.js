import { createClient } from '@/lib/supabase-server';
import SettingsContent from '@/components/dashboard/SettingsContent';

export const metadata = {
    title: 'Settings — AutoDM',
};

export default async function SettingsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch connected accounts
    let connectedAccounts = [];
    try {
        const { data: accounts } = await supabase
            .from('connected_accounts')
            .select('id, platform, ig_username, ig_profile_picture_url, fb_page_name, fb_page_id, is_active, rate_limit_per_hour, default_config, scopes, created_at')
            .eq('user_id', user.id);

        connectedAccounts = accounts || [];
    } catch {
        // Table may not exist yet
    }

    return (
        <SettingsContent
            user={user}
            connectedAccounts={connectedAccounts}
        />
    );
}
