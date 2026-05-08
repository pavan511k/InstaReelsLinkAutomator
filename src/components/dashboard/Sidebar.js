'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
    LayoutDashboard, Grid3X3, BookOpen, Settings,
    LogOut, Lock, Menu, X, Zap, ChevronRight, ChevronLeft, CreditCard, ScrollText,
    Sun, Moon, Globe, MessageSquarePlus, Users,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase-client';
import { useStyles, useIsDark } from '@/lib/useStyles';
import darkStyles from './Sidebar.module.css';
import lightStyles from './Sidebar.light.module.css';

// Items with only a `section` key render as a section label divider.
// `igOnly: true` items are hidden when the active connected account is
// Facebook-only — Stories don't exist on FB, Welcome Openers use the
// Instagram messenger_profile API, Email Leads + Follow Gate flows
// rely on IG-specific messaging semantics.
const NAV = [
    { section: 'Navigation' },
    { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard, locked: false },
    { href: '/posts',     label: 'Posts & Reels', icon: Grid3X3,         locked: true  },
    { href: '/stories',   label: 'Stories',       icon: BookOpen,        locked: true, igOnly: true },
    { href: '/logs',      label: 'DM Logs',       icon: ScrollText,      locked: true  },
    { section: 'Tools' },
    { href: '/global-automations', label: 'Global Triggers',  icon: Globe,              locked: true },
    { href: '/welcome-openers',    label: 'Welcome Openers',  icon: MessageSquarePlus,  locked: true, igOnly: true },
    { href: '/leads',              label: 'Email Leads',      icon: Users,              locked: true, igOnly: true },
    { section: 'Account' },
    { href: '/settings',  label: 'Settings',      icon: Settings,        locked: false },
    { href: '/pricing',   label: 'Pricing',       icon: CreditCard,      locked: false },
];

// ─── Plan Badge ─────────────────────────────────────────────────────────────
// Separate component so it can access Link and conditional logic cleanly.
function PlanBadge({ effectivePlan, trialDaysLeft, isConnected, styles, onNavigate }) {
    if (effectivePlan === 'pro' || effectivePlan === 'business') {
        return (
            <Link href="/pricing" className={styles.planBadgePro} onClick={onNavigate}>
                <span className={styles.planBadgeDot} />
                ✨ Pro plan
            </Link>
        );
    }

    if (effectivePlan === 'trial') {
        // Urgency: critical (0d) / urgent (1-2d) / warning (3-7d) / info (8+d)
        const urgency = trialDaysLeft <= 0 ? 'critical'
            : trialDaysLeft <= 2 ? 'urgent'
            : trialDaysLeft <= 7 ? 'warning'
            : 'info';
        const label = trialDaysLeft <= 0
            ? 'Trial ends today'
            : `Trial · ${trialDaysLeft}d`;
        return (
            <Link
                href="/pricing"
                className={`${styles.planBadgeTrial} ${styles[`planBadgeTrial_${urgency}`]}`}
                onClick={onNavigate}
            >
                <span className={styles.planBadgeDot} />
                🎁 {label}
            </Link>
        );
    }

    // Free plan
    return (
        <Link href="/pricing" className={styles.planBadgeFree} onClick={onNavigate}>
            Free plan · Upgrade
        </Link>
    );
}

const COLLAPSED_KEY = 'autodm-sidebar-collapsed';

export default function Sidebar({ user, isConnected = false, profilePicUrl = null, profilePicAccountId = null, effectivePlan = 'free', trialDaysLeft = 0, activePlatform = null, dmUsed = 0, dmLimit = null }) {
    // Filter out IG-only items when the user is on a Facebook-only account.
    // 'instagram', 'both', and null (no account yet) all show everything.
    const filteredNav = activePlatform === 'facebook'
        ? NAV.filter((item) => !item.igOnly)
        : NAV;
    const pathname  = usePathname();
    const router    = useRouter();
    const supabase  = createClient();
    const [open, setOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const styles = useStyles(darkStyles, lightStyles);
    const { setTheme } = useTheme();
    const isDark = useIsDark(); // mount-guarded — safe from hydration mismatch
    /* Avatar fallback + self-healing refresh:
       Meta's IG profile-picture URLs are short-lived signed CDN URLs.
       When they go stale the <img> silently fails to load. The error
       handler swaps to initials immediately AND fires a server-side
       refresh in the background that re-fetches the URL from Meta and
       updates the row. The fresh URL replaces the stale one in local
       state so the avatar reappears without a page reload.

       avatarUrl is local state (not just the prop) so the refresh result
       can swap it in without forcing a layout-level re-render. We sync
       it to the prop whenever the prop changes (e.g. between sessions). */
    const [avatarUrl, setAvatarUrl] = useState(profilePicUrl);
    const [avatarErrored, setAvatarErrored] = useState(false);
    useEffect(() => {
        setAvatarUrl(profilePicUrl);
        setAvatarErrored(false);
    }, [profilePicUrl]);

    const handleAvatarError = async () => {
        setAvatarErrored(true);
        if (!profilePicAccountId) return;
        try {
            const res = await fetch('/api/accounts/refresh-profile-pic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: profilePicAccountId }),
            });
            const data = await res.json();
            if (data?.refreshed && data?.profilePictureUrl
                && data.profilePictureUrl !== avatarUrl) {
                setAvatarUrl(data.profilePictureUrl);
                setAvatarErrored(false);
            }
        } catch { /* non-fatal — initials stay shown */ }
    };

    // Restore the collapsed preference on mount.
    useEffect(() => {
        try {
            if (localStorage.getItem(COLLAPSED_KEY) === 'true') setCollapsed(true);
        } catch {}
    }, []);

    // Sync the sidebar width to a CSS variable on <html> so any element
    // anywhere in the app (notably modal overlays that need to compensate
    // for the sidebar) can reference it via calc(var(--sidebar-width)).
    useEffect(() => {
        document.documentElement.style.setProperty('--sidebar-width', collapsed ? '64px' : '260px');
    }, [collapsed]);

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
            return next;
        });
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const initials = user?.email?.[0]?.toUpperCase() || 'U';
    const email    = user?.email || '';

    // The mobile drawer always shows the full sidebar content regardless
    // of the collapsed state — only the desktop aside collapses.
    const SidebarContent = ({ canCollapse = false }) => {
        const isCollapsed = canCollapse && collapsed;
        return (
            <>
                {/* Logo */}
                <Link href="/dashboard" className={styles.logo} onClick={() => setOpen(false)}>
                    <div className={styles.logoMark}>
                        <Image src="/logo.png" alt="AutoDM" width={18} height={18} />
                    </div>
                    {!isCollapsed && (
                        <span className={styles.logoText}>
                            auto<span className={styles.logoDM}>dm</span>
                        </span>
                    )}
                </Link>

                {/* Connection status pill — hidden when collapsed */}
                {!isCollapsed && (
                    <div className={`${styles.connStatus} ${isConnected ? styles.connStatusOn : styles.connStatusOff}`}>
                        <span className={styles.connDot} />
                        {isConnected ? 'Account connected' : 'No account connected'}
                    </div>
                )}

                {/* Nav */}
                <nav className={styles.nav}>
                    {filteredNav.map((item) => {
                        // Section label divider — hidden when collapsed
                        if (item.section) {
                            if (isCollapsed) return null;
                            return (
                                <span key={item.section} className={styles.navSection}>{item.section}</span>
                            );
                        }

                        const { href, label, icon: Icon, locked } = item;
                        const disabled = locked && !isConnected;
                        const active   = pathname === href;

                        if (disabled) {
                            return (
                                <span
                                    key={href}
                                    className={`${styles.navItem} ${styles.navDisabled}`}
                                    title={isCollapsed ? `${label} — connect your account first` : 'Connect your account first'}
                                >
                                    <Icon size={16} strokeWidth={2} />
                                    {!isCollapsed && <span>{label}</span>}
                                    {!isCollapsed && <Lock size={11} className={styles.lockIcon} />}
                                </span>
                            );
                        }

                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`${styles.navItem} ${active ? styles.navActive : ''}`}
                                onClick={() => setOpen(false)}
                                title={isCollapsed ? label : undefined}
                            >
                                <Icon size={16} strokeWidth={2} />
                                {!isCollapsed && <span>{label}</span>}
                                {!isCollapsed && active && <ChevronRight size={13} className={styles.navChevron} />}
                            </Link>
                        );
                    })}
                </nav>

                {/* Connect CTA — hidden when collapsed (label-heavy block) */}
                {!isCollapsed && !isConnected && (
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
                <div className={`${styles.user} ${isCollapsed ? styles.userCollapsed : ''}`}>
                    <div className={styles.avatar}>
                        {avatarUrl && !avatarErrored ? (
                            <img
                                src={avatarUrl}
                                alt=""
                                className={styles.avatarImg}
                                onError={handleAvatarError}
                            />
                        ) : (
                            <span>{initials}</span>
                        )}
                    </div>
                    {!isCollapsed && (
                        <div className={styles.userInfo}>
                            <span className={styles.userEmail}>{email}</span>
                            <PlanBadge
                                effectivePlan={effectivePlan}
                                trialDaysLeft={trialDaysLeft}
                                isConnected={isConnected}
                                styles={styles}
                                onNavigate={() => setOpen(false)}
                            />
                            {dmLimit !== null && (
                                <Link
                                    href="/settings"
                                    className={styles.quotaChip}
                                    onClick={() => setOpen(false)}
                                    title={`${dmUsed.toLocaleString()} of ${dmLimit.toLocaleString()} DMs used this month`}
                                >
                                    <span className={styles.quotaTrack}>
                                        <span
                                            className={styles.quotaFill}
                                            style={{ width: `${Math.min(100, Math.round((dmUsed / dmLimit) * 100))}%` }}
                                        />
                                    </span>
                                    <span className={styles.quotaLabel}>
                                        {dmUsed.toLocaleString()} / {dmLimit.toLocaleString()}
                                    </span>
                                </Link>
                            )}
                        </div>
                    )}
                    <button
                        className={styles.themeBtn}
                        onClick={() => setTheme(isDark ? 'light' : 'dark')}
                        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {isDark ? <Sun size={14} strokeWidth={2} /> : <Moon size={14} strokeWidth={2} />}
                    </button>
                    <button className={styles.logoutBtn} onClick={handleLogout} title="Sign out">
                        <LogOut size={15} strokeWidth={2} />
                    </button>
                </div>
            </>
        );
    };

    return (
        <>
            {/* ── Desktop sidebar ──────────────────────────────── */}
            <div className={`${styles.sidebarWrap} ${collapsed ? styles.sidebarWrapCollapsed : ''}`}>
                <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
                    <SidebarContent canCollapse />
                </aside>
                <button
                    className={styles.collapseBtn}
                    onClick={toggleCollapsed}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
                </button>
            </div>

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
