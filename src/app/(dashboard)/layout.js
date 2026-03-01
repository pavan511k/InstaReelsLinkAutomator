import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import DashboardNav from '@/components/dashboard/DashboardNav';

export const metadata = {
    title: 'Dashboard — AutoDM',
};

export default async function DashboardLayout({ children }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Check if user has any active connected accounts
    let isConnected = false;

    try {
        const { data, error } = await supabase
            .from('connected_accounts')
            .select('id, platform')
            .eq('user_id', user.id)
            .eq('is_active', true);

        if (data && !error && data.length > 0) {
            isConnected = true;
        }
    } catch {
        // Table may not exist yet — that's OK, isConnected stays false
    }

    return (
        <div>
            <DashboardNav
                user={user}
                isConnected={isConnected}
            />
            <main style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--color-gray-50)' }}>
                {children}
            </main>
        </div>
    );
}
