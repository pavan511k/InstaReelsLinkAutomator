'use client';

import styles from './UsageProgress.module.css';

export default function UsageProgress({ used = 0, limit = 1000 }) {
    const pct       = Math.min(100, (used / limit) * 100);
    const remaining = Math.max(0, limit - used);
    const isWarning = pct >= 80;
    const isDanger  = pct >= 95;

    // SVG ring
    const radius      = 44;
    const circumference = 2 * Math.PI * radius;
    const strokeDash  = (pct / 100) * circumference;

    const ringColor = isDanger ? '#EF4444' : isWarning ? '#F59E0B' : '#7C3AED';
    const ringGlow  = isDanger ? 'rgba(239,68,68,0.35)' : isWarning ? 'rgba(245,158,11,0.3)' : 'rgba(124,58,237,0.3)';

    return (
        <div className={styles.wrap}>
            {/* Ring */}
            <div className={styles.ringWrap}>
                <svg width="110" height="110" viewBox="0 0 110 110" className={styles.ring}>
                    {/* Track */}
                    <circle
                        cx="55" cy="55" r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.07)"
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
                    <span className={styles.statDot} style={{ background: 'rgba(255,255,255,0.15)' }} />
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
                    background: isDanger ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                    borderColor: isDanger ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                    color: isDanger ? '#FCA5A5' : '#FCD34D',
                }}>
                    {isDanger
                        ? '⚠️ Almost at your limit. Upgrade to avoid interruptions.'
                        : '📊 You\'re approaching your monthly limit.'}
                </div>
            )}
        </div>
    );
}
