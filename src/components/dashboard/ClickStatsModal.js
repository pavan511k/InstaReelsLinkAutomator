'use client';

import { useEffect, useState } from 'react';
import { X, MousePointerClick, Users, ExternalLink, RefreshCw, TrendingUp, Link2, FlaskConical, Trophy } from 'lucide-react';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './ClickStatsModal.module.css';
import lightStyles from './ClickStatsModal.light.module.css';

/** Tiny sparkline SVG — 30 bars, height proportional to max */
function Sparkline({ data, styles }) {
    if (!data || data.length === 0) return null;
    const max    = Math.max(...data.map((d) => d.clicks), 1);
    const W      = 560;
    const H      = 80;
    const barW   = Math.floor(W / data.length) - 2;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.sparkline} preserveAspectRatio="none">
            {data.map((d, i) => {
                const barH = Math.max(2, Math.round((d.clicks / max) * (H - 8)));
                const x    = i * (barW + 2);
                const y    = H - barH;
                return (
                    <rect
                        key={d.date}
                        x={x} y={y}
                        width={barW} height={barH}
                        rx={2}
                        className={d.clicks > 0 ? styles.barActive : styles.barEmpty}
                    >
                        <title>{d.label}: {d.clicks} click{d.clicks !== 1 ? 's' : ''}</title>
                    </rect>
                );
            })}
        </svg>
    );
}

function truncateUrl(url, max = 48) {
    if (!url) return '—';
    try {
        const u = new URL(url);
        const display = u.hostname + u.pathname + u.search;
        return display.length > max ? display.slice(0, max) + '…' : display;
    } catch {
        return url.length > max ? url.slice(0, max) + '…' : url;
    }
}

export default function ClickStatsModal({ automationId, postCaption, onClose }) {
    const styles = useStyles(darkStyles, lightStyles);
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/clicks?automationId=${automationId}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load');
            setData(json);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [automationId]);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.headerIcon}>
                            <MousePointerClick size={16} />
                        </div>
                        <div>
                            <h2 className={styles.title}>Click Tracking</h2>
                            {postCaption && (
                                <p className={styles.subtitle}>{postCaption.slice(0, 60)}{postCaption.length > 60 ? '…' : ''}</p>
                            )}
                        </div>
                    </div>
                    <div className={styles.headerRight}>
                        <button className={styles.refreshBtn} onClick={load} disabled={loading} title="Refresh">
                            <RefreshCw size={13} className={loading ? styles.spin : ''} />
                        </button>
                        <button className={styles.closeBtn} onClick={onClose}>
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                {loading && !data ? (
                    <div className={styles.loadingState}>
                        <RefreshCw size={22} className={styles.spin} />
                        <p>Loading click data…</p>
                    </div>
                ) : error ? (
                    <div className={styles.errorState}>
                        <p>{error}</p>
                        <button className={styles.retryBtn} onClick={load}>Try again</button>
                    </div>
                ) : data ? (
                    <div className={styles.body}>

                        {/* Stat pills */}
                        <div className={styles.statRow}>
                            <div className={styles.statCard}>
                                <div className={styles.statIcon} style={{ background: 'rgba(124,58,237,0.14)', color: '#A78BFA' }}>
                                    <MousePointerClick size={15} />
                                </div>
                                <div>
                                    <p className={styles.statVal}>{data.totalClicks.toLocaleString()}</p>
                                    <p className={styles.statLbl}>Total clicks</p>
                                </div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statIcon} style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                                    <Users size={15} />
                                </div>
                                <div>
                                    <p className={styles.statVal}>{data.uniqueClicks.toLocaleString()}</p>
                                    <p className={styles.statLbl}>Unique visitors</p>
                                </div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statIcon} style={{ background: 'rgba(59,130,246,0.12)', color: '#93C5FD' }}>
                                    <TrendingUp size={15} />
                                </div>
                                <div>
                                    <p className={styles.statVal}>
                                        {data.byDay.slice(-7).reduce((s, d) => s + d.clicks, 0)}
                                    </p>
                                    <p className={styles.statLbl}>Last 7 days</p>
                                </div>
                            </div>
                        </div>

                        {/* Sparkline */}
                        {data.totalClicks > 0 && (
                            <div className={styles.chartWrap}>
                                <div className={styles.chartHeader}>
                                    <span className={styles.chartTitle}>Clicks per day — last 30 days</span>
                                </div>
                                <Sparkline data={data.byDay} styles={styles} />
                                <div className={styles.chartAxis}>
                                    <span>{data.byDay[0]?.label}</span>
                                    <span>{data.byDay[data.byDay.length - 1]?.label}</span>
                                </div>
                            </div>
                        )}

                        {/* ── A/B Test results panel ── */}
                        {data.isAB && data.abStats && (
                            <div className={styles.abSection}>
                                <div className={styles.abSectionHeader}>
                                    <FlaskConical size={13} />
                                    A/B Test Results
                                    {data.abStats.winner && (
                                        <span className={styles.abWinnerBadge}>
                                            <Trophy size={11} /> Variant {data.abStats.winner} wins
                                        </span>
                                    )}
                                </div>

                                {!data.abStats.hasEnoughData && !data.abStats.winner && (
                                    <div className={styles.abProgress}>
                                        <span className={styles.abProgressText}>
                                            Needs {data.abStats.minSends} sends per variant to declare a winner.
                                            Currently: A={data.abStats.variantA.sends}, B={data.abStats.variantB.sends}.
                                        </span>
                                        <div className={styles.abProgressBar}>
                                            <div
                                                className={styles.abProgressFill}
                                                style={{ width: `${Math.min(100, Math.round(((data.abStats.variantA.sends + data.abStats.variantB.sends) / (data.abStats.minSends * 2)) * 100))}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className={styles.abCards}>
                                    {(['A', 'B']).map((v) => {
                                        const stat    = v === 'A' ? data.abStats.variantA : data.abStats.variantB;
                                        const isWinner = data.abStats.winner === v;
                                        const maxCtr  = Math.max(data.abStats.variantA.ctr, data.abStats.variantB.ctr, 1);
                                        return (
                                            <div key={v} className={`${styles.abCard} ${isWinner ? styles.abCardWinner : ''}`}>
                                                <div className={styles.abCardTop}>
                                                    <span className={styles.abCardLabel}>Variant {v}</span>
                                                    {isWinner && <Trophy size={13} className={styles.abTrophy} />}
                                                </div>
                                                <div className={styles.abMetricRow}>
                                                    <div className={styles.abMetric}>
                                                        <span className={styles.abMetricVal}>{stat.sends.toLocaleString()}</span>
                                                        <span className={styles.abMetricLbl}>Sent</span>
                                                    </div>
                                                    <div className={styles.abMetric}>
                                                        <span className={styles.abMetricVal}>{stat.clicks.toLocaleString()}</span>
                                                        <span className={styles.abMetricLbl}>Clicks</span>
                                                    </div>
                                                    <div className={styles.abMetric}>
                                                        <span className={`${styles.abMetricVal} ${isWinner ? styles.abMetricValWinner : ''}`}>{stat.ctr}%</span>
                                                        <span className={styles.abMetricLbl}>CTR</span>
                                                    </div>
                                                </div>
                                                <div className={styles.abCtrBar}>
                                                    <div
                                                        className={`${styles.abCtrFill} ${isWinner ? styles.abCtrFillWinner : ''}`}
                                                        style={{ width: `${maxCtr > 0 ? Math.round((stat.ctr / maxCtr) * 100) : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Per-link table */}
                        <div className={styles.linksSection}>
                            <p className={styles.linksTitle}>
                                <Link2 size={13} />
                                Tracked links
                            </p>

                            {data.byLink.length === 0 ? (
                                <div className={styles.noLinks}>
                                    <p>No tracked links yet.</p>
                                    <p className={styles.noLinksHint}>
                                        Links are tracked automatically when an automation with URL buttons is saved.
                                        Re-save the automation to generate tracking codes.
                                    </p>
                                </div>
                            ) : (
                                <div className={styles.linkList}>
                                    {data.byLink.map((link) => (
                                        <div key={link.code} className={styles.linkRow}>
                                            <div className={styles.linkInfo}>
                                                <div className={styles.linkCodeRow}>
                                                    <span className={styles.linkCode}>/r/{link.code}</span>
                                                    {link.abVariant && (
                                                        <span className={`${styles.linkVariantTag} ${link.abVariant === 'A' ? styles.linkVariantA : styles.linkVariantB}`}>
                                                            {link.abVariant}
                                                        </span>
                                                    )}
                                                </div>
                                                <a
                                                    href={link.originalUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={styles.linkUrl}
                                                    title={link.originalUrl}
                                                >
                                                    {truncateUrl(link.originalUrl)}
                                                    <ExternalLink size={10} />
                                                </a>
                                            </div>
                                            <div className={styles.linkStats}>
                                                <span className={styles.linkClickCount}>
                                                    {link.clicks} click{link.clicks !== 1 ? 's' : ''}
                                                </span>
                                                {data.totalClicks > 0 && (
                                                    <div className={styles.linkBar}>
                                                        <div
                                                            className={styles.linkBarFill}
                                                            style={{ width: `${Math.round((link.clicks / data.totalClicks) * 100)}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {data.totalClicks === 0 && data.byLink.length > 0 && (
                            <div className={styles.zeroClicks}>
                                <MousePointerClick size={28} style={{ color: 'rgba(255,255,255,0.15)' }} />
                                <p>No clicks yet. Tracking links are ready and will record clicks as soon as someone taps a button in the DM.</p>
                            </div>
                        )}

                    </div>
                ) : null}
            </div>
        </div>
    );
}
