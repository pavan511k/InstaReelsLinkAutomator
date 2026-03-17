'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
    LayoutDashboard, Grid3X3, BookOpen, Settings,
    LogOut, Lock, Menu, X, Zap, ChevronRight, CreditCard, ScrollText,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import styles from './Sidebar.module.css';

const NAV = [
    { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard, locked: false },
    { href: '/posts',     label: 'Posts & Reels', icon: Grid3X3,         locked: true  },
    { href: '/stories',   label: 'Stories',       icon: BookOpen,        locked: true  },
    { href: '/logs',      label: 'DM Logs',       icon: ScrollText,      locked: true  },
    { href: '/settings',  label: 'Settings',      icon: Settings,        locked: false },
    { href: '/pricing',   label: 'Pricing',       icon: CreditCard,      locked: false },
];

export default function Sidebar({ user, isConnected = false, profilePicUrl = null }) {
    const pathname  = usePathname();
    const router    = useRouter();
    const supabase  = createClient();
    const [open, setOpen] = useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const initials = user?.email?.[0]?.toUpperCase() || 'U';
    const email    = user?.email || '';

    const SidebarContent = () => (
        <>
            {/* Logo */}
            <Link href="/dashboard" className={styles.logo} onClick={() => setOpen(false)}>
                <div className={styles.logoMark}>
                    <Image src="/logo.png" alt="AutoDM" width={18} height={18} />
                </div>
                <span className={styles.logoText}>
                    auto<span className={styles.logoDM}>dm</span>
                </span>
            </Link>

            {/* Connection status pill */}
            <div className={`${styles.connStatus} ${isConnected ? styles.connStatusOn : styles.connStatusOff}`}>
                <span className={styles.connDot} />
                {isConnected ? 'Account connected' : 'No account connected'}
            </div>

            {/* Nav */}
            <nav className={styles.nav}>
                <span className={styles.navSection}>Navigation</span>
                {NAV.map(({ href, label, icon: Icon, locked }) => {
                    const disabled = locked && !isConnected;
                    const active   = pathname === href;

                    if (disabled) {
                        return (
                            <span key={href} className={`${styles.navItem} ${styles.navDisabled}`} title="Connect your account first">
                                <Icon size={16} strokeWidth={2} />
                                <span>{label}</span>
                                <Lock size={11} className={styles.lockIcon} />
                            </span>
                        );
                    }

                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`${styles.navItem} ${active ? styles.navActive : ''}`}
                            onClick={() => setOpen(false)}
                        >
                            <Icon size={16} strokeWidth={2} />
                            <span>{label}</span>
                            {active && <ChevronRight size={13} className={styles.navChevron} />}
                        </Link>
                    );
                })}
            </nav>

            {/* Connect CTA (shown when not connected) */}
            {!isConnected && (
                <div className={styles.connectCta}>
                    <div className={styles.connectCtaIcon}>
                        <Zap size={14} />
                    </div>
                    <div className={styles.connectCtaBody}>
                        <p className={styles.connectCtaTitle}>Connect Instagram</p>
                        <p className={styles.connectCtaDesc}>Start automating DMs in minutes</p>
                    </div>
                    <Link href="/dashboard" className={styles.connectCtaBtn} onClick={() => setOpen(false)}>
                        Set up
                        <ChevronRight size={12} />
                    </Link>
                </div>
            )}

            {/* User section */}
            <div className={styles.user}>
                <div className={styles.avatar}>
                    {profilePicUrl ? (
                        <img src={profilePicUrl} alt="" className={styles.avatarImg} />
                    ) : (
                        <span>{initials}</span>
                    )}
                </div>
                <div className={styles.userInfo}>
                    <span className={styles.userEmail}>{email}</span>
                    <Link href="/pricing" className={styles.userRole} onClick={() => setOpen(false)} style={{ textDecoration: 'none', cursor: 'pointer' }}>
                        Free plan · Upgrade
                    </Link>
                </div>
                <button className={styles.logoutBtn} onClick={handleLogout} title="Sign out">
                    <LogOut size={15} strokeWidth={2} />
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* ── Desktop sidebar ──────────────────────────────── */}
            <aside className={styles.sidebar}>
                <SidebarContent />
            </aside>

            {/* ── Mobile top bar + drawer ───────────────────────── */}
            <div className={styles.mobileBar}>
                <Link href="/dashboard" className={styles.logo}>
                    <div className={styles.logoMark}>
                        <Image src="/logo.png" alt="AutoDM" width={16} height={16} />
                    </div>
                    <span className={styles.logoText}>
                        auto<span className={styles.logoDM}>dm</span>
                    </span>
                </Link>
                <button className={styles.menuBtn} onClick={() => setOpen(!open)}>
                    {open ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            {open && (
                <div className={styles.drawer}>
                    <SidebarContent />
                </div>
            )}
        </>
    );
}
