'use client';

import { useState, useMemo } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import styles from './AnalyticsChart.module.css';

const PERIODS = [
    { key: 7,  label: '7d'  },
    { key: 14, label: '14d' },
    { key: 30, label: '30d' },
];

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className={styles.tooltip}>
            <p className={styles.tooltipDate}>{label}</p>
            <p className={styles.tooltipVal}>{payload[0].value.toLocaleString()} DMs</p>
        </div>
    );
}

export default function AnalyticsChart({ data = [] }) {
    const [period, setPeriod] = useState(14);

    const sliced = useMemo(() => {
        if (!data.length) return [];
        return data.slice(-period);
    }, [data, period]);

    const total   = useMemo(() => sliced.reduce((s, d) => s + d.count, 0), [sliced]);
    const maxVal  = useMemo(() => Math.max(...sliced.map((d) => d.count), 0), [sliced]);
    const avgPerDay = sliced.length ? Math.round(total / sliced.length) : 0;

    // Find the peak day
    const peakDay = useMemo(() => {
        if (!sliced.length) return null;
        return sliced.reduce((max, d) => d.count > max.count ? d : max, sliced[0]);
    }, [sliced]);

    if (!data || data.length === 0) {
        return (
            <div className={styles.wrap}>
                <div className={styles.headerRow}>
                    <div>
                        <h3 className={styles.title}>DM Activity</h3>
                        <p className={styles.subtitle}>No data yet</p>
                    </div>
                </div>
                <div className={styles.empty}>
                    <div className={styles.emptyBars}>
                        {[3, 6, 4, 8, 5, 9, 7, 5, 8, 6, 4, 7, 9, 6].map((h, i) => (
                            <div key={i} className={styles.emptyBar} style={{ height: `${h * 8}%` }} />
                        ))}
                    </div>
                    <p className={styles.emptyText}>DM activity will appear once your automations start sending</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.wrap}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div>
                    <h3 className={styles.title}>DM Activity</h3>
                    <div className={styles.headerStats}>
                        <span className={styles.totalVal}>{total.toLocaleString()}</span>
                        <span className={styles.totalLabel}>DMs in last {period} days</span>
                        <span className={styles.dot} />
                        <span className={styles.avgLabel}>{avgPerDay}/day avg</span>
                    </div>
                </div>
                <div className={styles.periodTabs}>
                    {PERIODS.map(({ key, label }) => (
                        <button
                            key={key}
                            className={`${styles.periodBtn} ${period === key ? styles.periodActive : ''}`}
                            onClick={() => setPeriod(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Peak highlight */}
            {peakDay && peakDay.count > 0 && (
                <div className={styles.peakBadge}>
                    🔥 Peak: <strong>{peakDay.count.toLocaleString()} DMs</strong> on {peakDay.date}
                </div>
            )}

            {/* Chart */}
            <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sliced} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                        <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%"   stopColor="#7C3AED" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.05)"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.28)', fontFamily: 'Inter, sans-serif' }}
                            interval={period === 7 ? 0 : period === 14 ? 1 : 4}
                            dy={6}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.28)', fontFamily: 'Inter, sans-serif' }}
                            width={30}
                            allowDecimals={false}
                        />
                        <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ stroke: 'rgba(167,139,250,0.2)', strokeWidth: 1, strokeDasharray: '4 2' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#A78BFA"
                            strokeWidth={2}
                            fill="url(#areaGrad)"
                            dot={false}
                            activeDot={{ r: 4, fill: '#A78BFA', stroke: '#1a0e35', strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
