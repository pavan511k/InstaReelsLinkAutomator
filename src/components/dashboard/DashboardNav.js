'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, LayoutDashboard, Grid3X3, BookOpen, LogOut, Lock, Menu, X } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import styles from './DashboardNav.module.css';

export default function DashboardNav({ user, isConnected = false }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

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

    const closeMenu = () => setIsMenuOpen(false);

    return (
        <nav className={styles.dashNav}>
            <div className={styles.navInner}>
                <Link href="/dashboard" className={styles.logo} onClick={closeMenu}>
                    <MessageSquare size={24} strokeWidth={2.5} />
                    <span className={styles.logoText}>Auto<span className={styles.logoDM}>DM</span></span>
                </Link>

                {/* Hamburger Toggle */}
                <button
                    className={styles.mobileToggle}
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Toggle menu"
                >
                    {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>

                <div className={`${styles.navContent} ${isMenuOpen ? styles.navContentOpen : ''}`}>
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
                                    onClick={closeMenu}
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
                            <Link href="/dashboard" className={styles.connectProfileBtn} onClick={closeMenu}>
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
                            <span className={styles.logoutText}>Log Out</span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
