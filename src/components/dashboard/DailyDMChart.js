'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './DailyDMChart.module.css';

const CUSTOM_TOOLTIP_STYLE = {
    background: '#0F172A',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
};

function CustomTooltip({ active, payload, label }) {
    if (active && payload && payload.length) {
        return (
            <div style={CUSTOM_TOOLTIP_STYLE}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', margin: 0 }}>{label}</p>
                <p style={{ color: '#60A5FA', fontSize: '14px', fontWeight: 700, margin: '2px 0 0' }}>
                    {payload[0].value} DMs
                </p>
            </div>
        );
    }
    return null;
}

export default function DailyDMChart({ data = [] }) {
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
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
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
                            allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(59,130,246,0.2)', strokeWidth: 1 }} />
                        <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            fill="url(#dmGradient)"
                            dot={false}
                            activeDot={{ r: 4, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
