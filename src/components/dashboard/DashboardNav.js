'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { LayoutDashboard, Grid3X3, BookOpen, Settings, LogOut, Lock, Menu, X, ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './DashboardNav.module.css';
import lightStyles from './DashboardNav.light.module.css';

const NAV_ITEMS = [
    { href: '/dashboard',  label: 'Overview',      icon: LayoutDashboard, requiresConnection: false },
    { href: '/posts',      label: 'Posts & Reels', icon: Grid3X3,          requiresConnection: true  },
    { href: '/stories',    label: 'Stories',       icon: BookOpen,         requiresConnection: true  },
    { href: '/settings',   label: 'Settings',      icon: Settings,         requiresConnection: false },
];

export default function DashboardNav({ user, isConnected = false, profilePicUrl = null }) {
    const pathname = usePathname();
    const router   = useRouter();
    const supabase = createClient();
    const [menuOpen, setMenuOpen] = useState(false);
    const styles = useStyles(darkStyles, lightStyles);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const displayName  = user?.email?.split('@')[0] || 'User';
    const initials     = displayName.slice(0, 2).toUpperCase();

    return (
        <header className={styles.header}>
            <div className={styles.inner}>

                {/* Logo */}
                <Link href="/dashboard" className={styles.logo}>
                    <div className={styles.logoMark}>
                        <Image src="/logo.png" alt="AutoDM" width={16} height={16} />
                    </div>
                    <span className={styles.logoText}>
                        auto<span className={styles.logoDM}>dm</span>
                    </span>
                </Link>

                {/* Desktop nav */}
                <nav className={styles.nav}>
                    {NAV_ITEMS.map(({ href, label, icon: Icon, requiresConnection }) => {
                        const locked  = requiresConnection && !isConnected;
                        const active  = pathname === href;

                        if (locked) {
                            return (
                                <span key={href} className={`${styles.navLink} ${styles.locked}`} title="Connect your account first">
                                    <Icon size={15} strokeWidth={2} />
                                    {label}
                                    <Lock size={11} className={styles.lockIcon} strokeWidth={2.5} />
                                </span>
                            );
                        }

                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`${styles.navLink} ${active ? styles.active : ''}`}
                            >
                                <Icon size={15} strokeWidth={2} />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Right: connect CTA + user */}
                <div className={styles.right}>
                    {!isConnected && (
                        <Link href="/dashboard" className={styles.connectBtn}>
                            Connect profile
                        </Link>
                    )}

                    {/* User menu */}
                    <div className={styles.userWrap}>
                        <div className={styles.avatar}>
                            {profilePicUrl
                                ? <img src={profilePicUrl} alt="" className={styles.avatarImg} />
                                : <span>{initials}</span>
                            }
                        </div>
                        <span className={styles.userEmail}>{user?.email}</span>
                        <button onClick={handleLogout} className={styles.logoutBtn} title="Sign out">
                            <LogOut size={15} strokeWidth={2} />
                        </button>
                    </div>

                    {/* Mobile toggle */}
                    <button className={styles.toggle} onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
                        {menuOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
            </div>

            {/* Mobile menu */}
            {menuOpen && (
                <div className={styles.mobileMenu}>
                    {NAV_ITEMS.map(({ href, label, icon: Icon, requiresConnection }) => {
                        const locked = requiresConnection && !isConnected;
                        const active = pathname === href;

                        if (locked) {
                            return (
                                <span key={href} className={`${styles.mobileLink} ${styles.locked}`}>
                                    <Icon size={16} strokeWidth={2} /> {label}
                                    <Lock size={12} className={styles.lockIcon} strokeWidth={2.5} />
                                </span>
                            );
                        }

                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`${styles.mobileLink} ${active ? styles.active : ''}`}
                                onClick={() => setMenuOpen(false)}
                            >
                                <Icon size={16} strokeWidth={2} /> {label}
                            </Link>
                        );
                    })}

                    <div className={styles.mobileDivider} />
                    <div className={styles.mobileUser}>
                        <div className={styles.avatar}>
                            {profilePicUrl
                                ? <img src={profilePicUrl} alt="" className={styles.avatarImg} />
                                : <span>{initials}</span>
                            }
                        </div>
                        <span className={styles.userEmail}>{user?.email}</span>
                    </div>
                    <button onClick={handleLogout} className={styles.mobileLogout}>
                        <LogOut size={15} strokeWidth={2} /> Sign out
                    </button>
                </div>
            )}
        </header>
    );
}
