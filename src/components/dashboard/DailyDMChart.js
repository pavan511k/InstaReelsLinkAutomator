'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useStyles } from '@/lib/useStyles';
import { useIsDark } from '@/lib/useStyles';
import darkStyles from './DailyDMChart.module.css';
import lightStyles from './DailyDMChart.light.module.css';

function CustomTooltip({ active, payload, label, isDark }) {
    if (active && payload?.length) {
        const tooltipStyle = {
            background: isDark ? '#12173B' : '#FFFFFF',
            border: '1px solid rgba(109,80,240,.3)',
            borderRadius: '12px',
            padding: '8px 12px',
            boxShadow: isDark ? '0 8px 24px rgba(109,80,240,.2)' : '0 4px 16px rgba(30,21,53,0.10)',
        };
        return (
            <div style={tooltipStyle}>
                <p style={{ color: isDark ? 'rgba(255,255,255,.55)' : 'rgba(30,21,53,0.55)', fontSize: '11px', margin: 0 }}>{label}</p>
                <p style={{ color: isDark ? '#A78BFA' : '#7C3AED', fontSize: '14px', fontWeight: 700, margin: '2px 0 0' }}>
                    {payload[0].value} DMs
                </p>
            </div>
        );
    }
    return null;
}

export default function DailyDMChart({ data = [] }) {
    const styles = useStyles(darkStyles, lightStyles);
    const isDark  = useIsDark();

    if (!data || data.length === 0) {
        return (
            <div className={styles.container}>
                <h3 className={styles.title}>Daily DMs Sent</h3>
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📊</div>
                    <p>No DM data yet</p>
                    <span>DM activity will appear here once automations start sending</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Daily DMs Sent</h3>
            <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="dmGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6D50F0" stopOpacity={0.28} />
                                <stop offset="95%" stopColor="#6D50F0" stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#94A3B8' }}
                            dy={8}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#94A3B8' }}
                            width={28}
                            allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ stroke: 'rgba(109,80,240,.2)', strokeWidth: 1 }} />
                        <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#6D50F0"
                            strokeWidth={2.5}
                            fill="url(#dmGradient)"
                            dot={false}
                            activeDot={{ r: 5, fill: '#6D50F0', stroke: '#fff', strokeWidth: 2.5 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
