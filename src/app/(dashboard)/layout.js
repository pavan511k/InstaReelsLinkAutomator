import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import styles from './layout.module.css';

export const metadata = {
    title: 'Dashboard — AutoDM',
};

export default async function DashboardLayout({ children }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    let isConnected = false;
    let profilePicUrl = null;

    try {
        const { data } = await supabase
            .from('connected_accounts')
            .select('id, platform, ig_profile_picture_url')
            .eq('user_id', user.id)
            .eq('is_active', true);

        if (data && data.length > 0) {
            isConnected = true;
            profilePicUrl = data.find((a) => a.ig_profile_picture_url)?.ig_profile_picture_url || null;
        }
    } catch { /* table may not exist */ }

    return (
        <div className={styles.shell}>
            <Sidebar
                user={user}
                isConnected={isConnected}
                profilePicUrl={profilePicUrl}
            />
            <div className={styles.body}>
                <main className={styles.main}>
                    {children}
                </main>
            </div>
        </div>
    );
}
