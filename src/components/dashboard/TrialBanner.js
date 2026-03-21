'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Zap, Clock, Crown } from 'lucide-react';
import { useTheme } from 'next-themes';

/**
 * TrialBanner — shown at the top of every dashboard page during an active trial.
 *
 * Urgency tiers (all visible unless dismissed):
 *   > 7 days  → subtle purple info strip
 *   3-7 days  → amber warning
 *   1-2 days  → orange urgent
 *   0 days    → red critical — NOT dismissible
 *
 * Dismissed state is stored in sessionStorage so it reappears
 * each browser session. The last-day banner can never be dismissed.
 *
 * Colors are theme-aware: dark bg uses soft transparent overlays;
 * light bg uses saturated, opaque tints so the banner is clearly visible.
 */

function urgencyConfig(daysLeft, isDark) {
    if (daysLeft <= 0) return {
        level: 'critical',
        bg:     isDark ? 'rgba(239,68,68,0.12)'  : 'rgba(239,68,68,0.10)',
        border: isDark ? 'rgba(239,68,68,0.28)'  : 'rgba(239,68,68,0.35)',
        text:   isDark ? '#FCA5A5'               : '#991B1B',
        strong: isDark ? '#FEE2E2'               : '#7F1D1D',
        btnBg:  '#DC2626',
        btnHover: '#B91C1C',
        btnText: '#fff',
        icon: Clock,
        label: 'Trial ends today',
        sub: "Upgrade now to keep Pro features — your automations will pause at midnight.",
        dismissible: false,
    };
    if (daysLeft <= 2) return {
        level: 'urgent',
        bg:     isDark ? 'rgba(234,88,12,0.10)'  : 'rgba(234,88,12,0.09)',
        border: isDark ? 'rgba(234,88,12,0.25)'  : 'rgba(234,88,12,0.32)',
        text:   isDark ? '#FDBA74'               : '#9A3412',
        strong: isDark ? '#FED7AA'               : '#7C2D12',
        btnBg:  '#EA580C',
        btnHover: '#C2410C',
        btnText: '#fff',
        icon: Clock,
        label: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your trial`,
        sub: "Your Pro features will pause when the trial ends. Lock them in now.",
        dismissible: true,
    };
    if (daysLeft <= 7) return {
        level: 'warning',
        bg:     isDark ? 'rgba(245,158,11,0.08)'  : 'rgba(245,158,11,0.10)',
        border: isDark ? 'rgba(245,158,11,0.22)'  : 'rgba(180,115,8,0.30)',
        text:   isDark ? '#FCD34D'                : '#92400E',
        strong: isDark ? '#FEF3C7'                : '#78350F',
        btnBg:  '#D97706',
        btnHover: '#B45309',
        btnText: '#fff',
        icon: Clock,
        label: `${daysLeft} days left in your trial`,
        sub: "Enjoying Pro? Upgrade before your trial ends to keep everything.",
        dismissible: true,
    };
    // Info tier (8+ days) — purple
    return {
        level: 'info',
        bg:     isDark ? 'rgba(124,58,237,0.10)'  : 'rgba(109,40,217,0.07)',
        border: isDark ? 'rgba(167,139,250,0.22)' : 'rgba(109,40,217,0.22)',
        text:   isDark ? '#C4B5FD'                : '#4C1D95',
        strong: isDark ? '#EDE9FE'                : '#3B0764',
        btnBg:  '#7C3AED',
        btnHover: '#6D28D9',
        btnText: '#fff',
        icon: Zap,
        label: `${daysLeft} days left in your free trial`,
        sub: "You're on the Pro trial — enjoy unlimited DMs, A/B testing, and all Pro features.",
        dismissible: true,
    };
}

export default function TrialBanner({ effectivePlan, trialDaysLeft = 0 }) {
    const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
    const [mounted, setMounted]     = useState(false);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme !== 'light'; // default to dark until resolved

    const cfg = urgencyConfig(trialDaysLeft, isDark);
    const storageKey = `trial_banner_dismissed_${trialDaysLeft}`;

    useEffect(() => {
        setMounted(true);
        if (cfg.dismissible) {
            const wasDismissed = sessionStorage.getItem(storageKey) === '1';
            setDismissed(wasDismissed);
        } else {
            // Critical (last day) — never dismissed
            setDismissed(false);
        }
    }, [trialDaysLeft]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDismiss = () => {
        sessionStorage.setItem(storageKey, '1');
        setDismissed(true);
    };

    // Only show for active trial users
    if (effectivePlan !== 'trial') return null;
    if (!mounted || dismissed) return null;

    const Icon = cfg.icon;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 20px',
            background: cfg.bg,
            borderBottom: `1px solid ${cfg.border}`,
            fontSize: 13,
            lineHeight: 1.4,
            flexShrink: 0,
        }}>
            {/* Icon */}
            <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: `${cfg.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: cfg.strong,
            }}>
                <Icon size={14} strokeWidth={2.5} />
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: cfg.strong, marginRight: 6 }}>
                    {cfg.label}.
                </span>
                <span style={{ color: cfg.text, opacity: 0.9 }}>
                    {cfg.sub}
                </span>
            </div>

            {/* Upgrade CTA */}
            <Link
                href="/pricing"
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    height: 30, padding: '0 14px', borderRadius: 7,
                    background: cfg.btnBg, color: cfg.btnText,
                    fontSize: 12, fontWeight: 700, textDecoration: 'none',
                    flexShrink: 0, whiteSpace: 'nowrap',
                    transition: 'background 150ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = cfg.btnHover}
                onMouseLeave={e => e.currentTarget.style.background = cfg.btnBg}
            >
                <Crown size={12} strokeWidth={2.5} />
                Upgrade to Pro
            </Link>

            {/* Dismiss (only when dismissible) */}
            {cfg.dismissible && (
                <button
                    onClick={handleDismiss}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: cfg.text, opacity: 0.6, padding: 4, borderRadius: 5,
                        display: 'flex', alignItems: 'center', flexShrink: 0,
                        transition: 'opacity 150ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                    title="Dismiss"
                >
                    <X size={14} strokeWidth={2} />
                </button>
            )}
        </div>
    );
}
