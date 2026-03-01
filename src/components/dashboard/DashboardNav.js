'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, LayoutDashboard, Grid3X3, BookOpen, LogOut, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import styles from './DashboardNav.module.css';

export default function DashboardNav({ user, isConnected = false }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const navItems = [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresConnection: false },
        { href: '/posts', label: 'Posts & Reels', icon: Grid3X3, requiresConnection: true },
        { href: '/stories', label: 'Stories', icon: BookOpen, requiresConnection: true },
    ];

    return (
        <nav className={styles.dashNav}>
            <div className={styles.navInner}>
                <Link href="/dashboard" className={styles.logo}>
                    <MessageSquare size={24} strokeWidth={2.5} />
                    <span className={styles.logoText}>Auto<span className={styles.logoDM}>DM</span></span>
                </Link>

                <div className={styles.navLinks}>
                    {navItems.map((item) => {
                        const isDisabled = item.requiresConnection && !isConnected;
                        const isActive = pathname === item.href;

                        if (isDisabled) {
                            return (
                                <span
                                    key={item.href}
                                    className={`${styles.navLink} ${styles.disabled}`}
                                    title="Connect your account first"
                                >
                                    <item.icon size={16} />
                                    {item.label}
                                    <Lock size={12} className={styles.lockIcon} />
                                </span>
                            );
                        }

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                            >
                                <item.icon size={16} />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>

                <div className={styles.navRight}>
                    {!isConnected && (
                        <Link href="/dashboard" className={styles.connectProfileBtn}>
                            Connect Profile
                        </Link>
                    )}
                    <div className={styles.userInfo}>
                        <div className={styles.avatar}>
                            {user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className={styles.userEmail}>{user?.email || 'User'}</span>
                    </div>
                    <button onClick={handleLogout} className={styles.logoutBtn} title="Log Out">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </nav>
    );
}
