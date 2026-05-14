'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Settings,
  LogOut, Lock, Menu, X, Zap, ChevronRight, CreditCard, ScrollText,
  MessageSquarePlus, Users, PanelLeftClose, PanelLeftOpen, Workflow, AtSign, Mail,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

// `igOnly: true` items are hidden when the active connected account is
// Facebook-only — Stories don't exist on FB, Ice Breakers use the
// Instagram messenger_profile API, Email Leads rely on IG-specific
// messaging semantics.
//
// Notes:
// - Global Triggers removed: the new builder's Any Post / Any Story
//   target modes plus the DM Auto Responder template cover the same
//   use cases more cohesively.
// - Welcome Openers removed: replaced by /tools/ice-breakers, which
//   uses the same builder split-pane editor.
const NAV = [
  { section: 'Navigation' },
  { href: '/dashboard',            label: 'Dashboard',              icon: LayoutDashboard,    locked: false },
  { href: '/automations',          label: 'Automations',            icon: Workflow,           locked: true  },
  { href: '/tools/ice-breakers',   label: 'Ice Breakers',           icon: MessageSquarePlus,  locked: true,  igOnly: true },
  { href: '/tools/story-mention',  label: 'Story Mention Auto-DM',  icon: AtSign,             locked: true,  igOnly: true },
  { section: 'Data' },
  { href: '/contacts',             label: 'Contacts',               icon: Users,              locked: true  },
  { href: '/leads',                label: 'Email Leads',            icon: Mail,               locked: true },
  { href: '/logs',                 label: 'DM Logs',                icon: ScrollText,         locked: true  },
  { section: 'General' },
  { href: '/settings',             label: 'Settings',               icon: Settings,           locked: false },
  { href: '/pricing',              label: 'Pricing',                icon: CreditCard,         locked: false },
];

const COLLAPSED_KEY = 'autodm-sidebar-collapsed';

// ─── Plan Badge ─────────────────────────────────────────────────────────────
function PlanBadge({ effectivePlan, trialDaysLeft, onNavigate }) {
  if (effectivePlan === 'pro' || effectivePlan === 'business') {
    return (
      <Link
        href="/pricing"
        onClick={onNavigate}
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        ✨ Pro plan
      </Link>
    );
  }

  if (effectivePlan === 'trial') {
    // Urgency: critical (0d) / urgent (1-2d) / warning (3-7d) / info (8+d)
    const tone =
      trialDaysLeft <= 0  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'           :
      trialDaysLeft <= 2  ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100' :
      trialDaysLeft <= 7  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'   :
                            'border-[#E63946]/20 bg-[#FFF1F2] text-[#E63946] hover:bg-[#FFE5E7]';
    const dotTone =
      trialDaysLeft <= 0  ? 'bg-red-500'    :
      trialDaysLeft <= 2  ? 'bg-orange-500' :
      trialDaysLeft <= 7  ? 'bg-amber-500'  :
                            'bg-[#E63946]';
    const label = trialDaysLeft <= 0 ? 'Trial ends today' : `Trial · ${trialDaysLeft}d`;

    return (
      <Link
        href="/pricing"
        onClick={onNavigate}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${tone}`}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotTone}`} />
        🎁 {label}
      </Link>
    );
  }

  // Free plan
  return (
    <Link
      href="/pricing"
      onClick={onNavigate}
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-200 transition-colors"
    >
      Free plan · Upgrade
    </Link>
  );
}

export default function Sidebar({
  user,
  isConnected         = false,
  profilePicUrl       = null,
  profilePicAccountId = null,
  effectivePlan       = 'free',
  trialDaysLeft       = 0,
  activePlatform      = null,
  dmUsed              = 0,
  dmLimit             = null,
}) {
  const filteredNav = activePlatform === 'facebook'
    ? NAV.filter((item) => !item.igOnly)
    : NAV;

  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();

  const [open, setOpen]           = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profilePicUrl);
  const [avatarErrored, setAvatarErrored] = useState(false);

  /* Avatar self-healing: Meta IG profile-picture URLs are short-lived.
     When they expire <img> silently fails; we swap to initials and fire a
     server-side refresh that updates the row + replaces avatarUrl when
     fresh data comes back. */
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
      if (data?.refreshed && data?.profilePictureUrl && data.profilePictureUrl !== avatarUrl) {
        setAvatarUrl(data.profilePictureUrl);
        setAvatarErrored(false);
      }
    } catch { /* non-fatal — initials stay shown */ }
  };

  // Restore collapsed preference on mount + sync to a CSS var so any
  // overlay/modal anywhere in the app can read calc(var(--sidebar-width)).
  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSED_KEY) === 'true') setCollapsed(true);
    } catch {}
  }, []);
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

  const SidebarContent = ({ canCollapse = false }) => {
    const isCollapsed = canCollapse && collapsed;
    return (
      <div className="flex h-full flex-col">
        {/* Logo + collapse toggle.
            Expanded: row layout — logo+wordmark on left, PanelLeftClose on
            right via justify-between (Notion/Linear/Cal pattern).
            Collapsed: column layout — logo on top, PanelLeftOpen stacked
            below it (the 64px column has no horizontal room for both). */}
        <div className={[
          'flex items-center px-5 pt-6 pb-4',
          isCollapsed ? 'flex-col gap-3 px-3' : 'justify-between',
        ].join(' ')}>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex min-w-0 items-center gap-2.5"
          >
            <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-neutral-200 shadow-sm">
              <Image src="/logo.png" alt="AutoDM" width={32} height={32} className="h-8 w-8 object-contain" priority />
            </span>
            {!isCollapsed && (
              <span className="text-[15px] font-semibold tracking-tight">
                <span className="text-neutral-900">Auto</span>
                <span className="text-[#E63946]">DM</span>
              </span>
            )}
          </Link>
          {canCollapse && (
            <button
              type="button"
              onClick={toggleCollapsed}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
            >
              {isCollapsed
                ? <PanelLeftOpen  className="h-4 w-4" strokeWidth={2} />
                : <PanelLeftClose className="h-4 w-4" strokeWidth={2} />}
            </button>
          )}
        </div>

        {/* Connection status pill — only when expanded */}
        {!isCollapsed && (
          <div className="px-5 pb-4">
            <div className={[
              'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium',
              isConnected
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-neutral-200 bg-neutral-50 text-neutral-600',
            ].join(' ')}>
              <span className={[
                'inline-block h-1.5 w-1.5 rounded-full',
                isConnected ? 'bg-emerald-500' : 'bg-neutral-400',
              ].join(' ')} />
              {isConnected ? 'Account connected' : 'No account connected'}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className={[
          'flex flex-1 flex-col gap-0.5 overflow-y-auto px-3',
          isCollapsed ? 'items-center' : '',
        ].join(' ')}>
          {filteredNav.map((item) => {
            // Section divider — hide when collapsed
            if (item.section) {
              if (isCollapsed) return null;
              return (
                <span
                  key={item.section}
                  className="mt-3 mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400"
                >
                  {item.section}
                </span>
              );
            }

            const { href, label, icon: Icon, locked } = item;
            const disabled = locked && !isConnected;
            const active   = pathname === href;

            const baseClasses = [
              'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
              isCollapsed ? 'h-9 w-9 justify-center' : 'px-3 py-2',
            ].join(' ');

            if (disabled) {
              return (
                <span
                  key={href}
                  className={`${baseClasses} cursor-not-allowed text-neutral-400`}
                  title={isCollapsed ? `${label} — connect your account first` : 'Connect your account first'}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 truncate">{label}</span>
                      <Lock className="h-3 w-3 flex-shrink-0 text-neutral-300" strokeWidth={2.5} />
                    </>
                  )}
                </span>
              );
            }

            const stateClasses = active
              ? 'bg-[#E63946]/10 text-[#E63946]'
              : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900';

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                title={isCollapsed ? label : undefined}
                className={`${baseClasses} ${stateClasses}`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate">{label}</span>
                    {active && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.5} />}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Connect CTA — only when expanded AND not connected */}
        {!isCollapsed && !isConnected && (
          <div className="mx-3 mb-3 mt-2 rounded-xl border border-[#E63946]/20 bg-[#FFF1F2] p-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#E63946] text-white">
                <Zap className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-900">Connect Instagram</p>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">Start automating DMs in minutes</p>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="mt-2 inline-flex items-center gap-0.5 text-xs font-semibold text-[#E63946] hover:text-[#CC2E3B] transition-colors"
                >
                  Set up
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Sidebar footer: user card + DM usage + sign out ────────────
            Three visual zones, separated by a single divider, all sitting
            inside a soft-bordered card so the bottom of the sidebar reads
            as one cohesive surface instead of three stacked rows. */}
        <div className="border-t border-neutral-200 p-3">
          {isCollapsed ? (
            /* Collapsed: avatar + sign-out icon, both centered */
            <div className="flex flex-col items-center gap-2">
              <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-sm font-semibold text-neutral-700 ring-2 ring-white">
                {avatarUrl && !avatarErrored ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={handleAvatarError} />
                ) : (
                  <span>{initials}</span>
                )}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
              >
                <LogOut className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ) : (
            /* Expanded: user card with sign-out icon-button in corner,
               followed by DM usage row */
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 overflow-hidden">
              {/* Top: avatar + email/plan + sign-out icon */}
              <div className="flex items-center gap-3 px-3 py-3">
                <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 text-sm font-semibold text-neutral-700 ring-2 ring-white">
                  {avatarUrl && !avatarErrored ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={handleAvatarError} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </span>

                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-xs font-medium text-neutral-800" title={email}>{email}</p>
                  <PlanBadge
                    effectivePlan={effectivePlan}
                    trialDaysLeft={trialDaysLeft}
                    onNavigate={() => setOpen(false)}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out"
                  aria-label="Sign out"
                  className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-white hover:text-neutral-900 hover:shadow-sm transition-all"
                >
                  <LogOut className="h-[15px] w-[15px]" strokeWidth={2} />
                </button>
              </div>

              {/* Bottom: DM usage — same card, separated by a thin rule */}
              {dmLimit !== null && (
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  title={`${dmUsed.toLocaleString()} of ${dmLimit.toLocaleString()} DMs used this month`}
                  className="block border-t border-neutral-200/70 bg-white/40 hover:bg-white px-3 py-2.5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      DMs this month
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-neutral-700">
                      {dmUsed.toLocaleString()}<span className="text-neutral-400"> / {dmLimit.toLocaleString()}</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200/70">
                    <div
                      className={[
                        'h-full rounded-full transition-all',
                        (dmUsed / dmLimit) >= 0.9
                          ? 'bg-[#E63946]'
                          : (dmUsed / dmLimit) >= 0.7
                            ? 'bg-orange-500'
                            : 'bg-neutral-700',
                      ].join(' ')}
                      style={{ width: `${Math.min(100, Math.round((dmUsed / dmLimit) * 100))}%` }}
                    />
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ─── Desktop sidebar ──────────────────────────────────────────── */}
      {/* lg:sticky + lg:top-0 + lg:h-screen makes the sidebar stay put as
          the page scrolls. Without sticky it scrolled with the content,
          taking the user info / sign-out off-screen on long pages. */}
      <div className={[
        'hidden flex-shrink-0 border-r border-neutral-200 bg-white transition-[width] duration-200 lg:sticky lg:top-0 lg:block lg:h-screen',
        collapsed ? 'w-16' : 'w-[260px]',
      ].join(' ')}>
        <aside className="flex h-full flex-col">
          <SidebarContent canCollapse />
        </aside>
      </div>

      {/* ─── Mobile top bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-neutral-200">
            <Image src="/logo.png" alt="AutoDM" width={28} height={28} className="h-7 w-7 object-contain" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            <span className="text-neutral-900">Auto</span>
            <span className="text-[#E63946]">DM</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 transition-colors"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* ─── Mobile drawer ────────────────────────────────────────────── */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[280px] overflow-y-auto bg-white shadow-xl lg:hidden">
            <SidebarContent />
          </div>
        </>
      )}
    </>
  );
}
