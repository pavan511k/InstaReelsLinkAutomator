'use client';

import { useStyles, useIsDark } from '@/lib/useStyles';
import darkStyles from './UsageProgress.module.css';
import lightStyles from './UsageProgress.light.module.css';

export default function UsageProgress({ used = 0, limit = 3000 }) {
    const styles = useStyles(darkStyles, lightStyles);
    const isDark = useIsDark();

    // Pro / Business plan — unlimited DMs
    if (limit === null) {
        return (
            <div className={styles.wrap}>
                <div className={styles.ringWrap}>
                    <svg width="110" height="110" viewBox="0 0 110 110">
                        <circle cx="55" cy="55" r="44" fill="none"
                            stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(30,21,53,0.08)'}
                            strokeWidth="9" />
                        <circle cx="55" cy="55" r="44" fill="none"
                            stroke="#7C3AED" strokeWidth="9" strokeLinecap="round"
                            strokeDasharray="276.46 276.46"
                            strokeDashoffset="69.12"
                            style={{ filter: 'drop-shadow(0 0 6px rgba(124,58,237,0.35))' }} />
                    </svg>
                    <div className={styles.ringInner}>
                        <span className={styles.ringPct} style={{ color: '#7C3AED', fontSize: 13, fontWeight: 700 }}>∞</span>
                        <span className={styles.ringLabel}>unlimited</span>
                    </div>
                </div>
                <div className={styles.stats}>
                    <div className={styles.statRow}>
                        <span className={styles.statDot} style={{ background: '#7C3AED' }} />
                        <span className={styles.statName}>Used</span>
                        <span className={styles.statVal}>{used.toLocaleString()}</span>
                    </div>
                    <div className={styles.statRow}>
                        <span className={styles.statDot} style={{ background: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(30,21,53,0.22)' }} />
                        <span className={styles.statName}>Remaining</span>
                        <span className={styles.statVal}>Unlimited</span>
                    </div>
                    <div className={styles.divider} />
                    <div className={styles.statRow}>
                        <span className={styles.statName}>Monthly limit</span>
                        <span className={styles.statVal} style={{ color: '#7C3AED', fontWeight: 600 }}>✨ Unlimited</span>
                    </div>
                </div>
            </div>
        );
    }

    const pct       = Math.min(100, (used / limit) * 100);
    const remaining = Math.max(0, limit - used);
    const isWarning = pct >= 80;
    const isDanger  = pct >= 95;

    // SVG ring
    const radius        = 44;
    const circumference = 2 * Math.PI * radius;
    const strokeDash    = (pct / 100) * circumference;

    const ringColor = isDanger ? '#EF4444' : isWarning ? '#F59E0B' : '#7C3AED';
    const ringGlow  = isDanger ? 'rgba(239,68,68,0.35)' : isWarning ? 'rgba(245,158,11,0.3)' : 'rgba(124,58,237,0.3)';

    // Track color is theme-aware — white on dark, dark-violet on light
    const trackStroke = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(30,21,53,0.12)';
    // "Remaining" dot colour
    const remainDot   = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(30,21,53,0.22)';

    return (
        <div className={styles.wrap}>
            {/* Ring */}
            <div className={styles.ringWrap}>
                <svg width="110" height="110" viewBox="0 0 110 110" className={styles.ring}>
                    {/* Track */}
                    <circle
                        cx="55" cy="55" r={radius}
                        fill="none"
                        stroke={trackStroke}
                        strokeWidth="9"
                    />
                    {/* Progress */}
                    <circle
                        cx="55" cy="55" r={radius}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={`${strokeDash} ${circumference}`}
                        strokeDashoffset={circumference * 0.25}
                        style={{ filter: `drop-shadow(0 0 6px ${ringGlow})`, transition: 'stroke-dasharray 600ms ease' }}
                    />
                </svg>
                <div className={styles.ringInner}>
                    <span className={styles.ringPct} style={{ color: ringColor }}>{Math.round(pct)}%</span>
                    <span className={styles.ringLabel}>used</span>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.stats}>
                <div className={styles.statRow}>
                    <span className={styles.statDot} style={{ background: ringColor }} />
                    <span className={styles.statName}>Used</span>
                    <span className={styles.statVal}>{used.toLocaleString()}</span>
                </div>
                <div className={styles.statRow}>
                    <span className={styles.statDot} style={{ background: remainDot }} />
                    <span className={styles.statName}>Remaining</span>
                    <span className={styles.statVal}>{remaining.toLocaleString()}</span>
                </div>
                <div className={styles.divider} />
                <div className={styles.statRow}>
                    <span className={styles.statName}>Monthly limit</span>
                    <span className={styles.statVal}>{limit.toLocaleString()}</span>
                </div>
            </div>

            {/* Warning */}
            {isWarning && (
                <div className={styles.warning} style={{
                    background:  isDanger ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                    borderColor: isDanger ? 'rgba(239,68,68,0.2)'  : 'rgba(245,158,11,0.2)',
                    color:       isDanger ? '#DC2626'               : '#B45309',
                }}>
                    {isDanger
                        ? '⚠️ Almost at your limit. Upgrade to avoid interruptions.'
                        : '📊 You\'re approaching your monthly limit.'}
                </div>
            )}
        </div>
    );
}
