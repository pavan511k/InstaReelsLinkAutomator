'use client';

import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const PERIODS = [
  { key: 7,  label: '7d'  },
  { key: 14, label: '14d' },
  { key: 30, label: '30d' },
];

// Tailwind classes can't be passed into Recharts SVG, so chart colours
// are defined here as the source of truth (all coral now, was violet).
const ACCENT       = '#E63946';
const ACCENT_LIGHT = '#FF7785';
const TICK_COLOR   = 'rgba(23,23,23,0.45)';
const GRID_COLOR   = 'rgba(23,23,23,0.06)';
const CURSOR_COLOR = 'rgba(230,57,70,0.18)';
const DOT_STROKE   = '#FFFFFF';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-neutral-900">
        {payload[0].value.toLocaleString()} DMs
      </p>
    </div>
  );
}

export default function AnalyticsChart({ data = [] }) {
  const [period, setPeriod] = useState(14);

  const sliced = useMemo(() => {
    if (!data.length) return [];
    return data.slice(-period);
  }, [data, period]);

  const total     = useMemo(() => sliced.reduce((s, d) => s + d.count, 0), [sliced]);
  const avgPerDay = sliced.length ? Math.round(total / sliced.length) : 0;

  const peakDay = useMemo(() => {
    if (!sliced.length) return null;
    return sliced.reduce((max, d) => d.count > max.count ? d : max, sliced[0]);
  }, [sliced]);

  // ─── Empty state ───────────────────────────────────────────────────
  if (!data || data.length === 0) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">DM Activity</h3>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
          <div className="mb-3 flex h-20 items-end gap-1">
            {[3, 6, 4, 8, 5, 9, 7, 5, 8, 6, 4, 7, 9, 6].map((h, i) => (
              <div
                key={i}
                className="w-2 rounded-t bg-neutral-300"
                style={{ height: `${h * 8}%` }}
              />
            ))}
          </div>
          <p className="max-w-xs text-xs text-neutral-500">
            DM activity will appear once your automations start sending.
          </p>
        </div>
      </div>
    );
  }

  // ─── Chart ─────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">DM Activity</h3>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
            <span className="text-lg font-bold text-neutral-900">{total.toLocaleString()}</span>
            <span className="text-neutral-500">DMs in last {period} days</span>
            <span className="hidden text-neutral-300 sm:inline">·</span>
            <span className="text-neutral-500">{avgPerDay}/day avg</span>
          </div>
        </div>
        <div className="inline-flex rounded-lg bg-neutral-100 p-0.5">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={[
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                period === key
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Peak highlight */}
      {peakDay && peakDay.count > 0 && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#FFF1F2] px-3 py-1 text-[11px] font-medium text-[#E63946]">
          🔥 Peak: <strong className="font-bold">{peakDay.count.toLocaleString()} DMs</strong> on {peakDay.date}
        </div>
      )}

      {/* Chart */}
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sliced} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={ACCENT} stopOpacity={0.22} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: TICK_COLOR, fontFamily: 'Inter, sans-serif' }}
              interval={period === 7 ? 0 : period === 14 ? 1 : 4}
              dy={6}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: TICK_COLOR, fontFamily: 'Inter, sans-serif' }}
              width={30}
              allowDecimals={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: CURSOR_COLOR, strokeWidth: 1, strokeDasharray: '4 2' }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={ACCENT_LIGHT}
              strokeWidth={2}
              fill="url(#areaGrad)"
              dot={false}
              activeDot={{ r: 4, fill: ACCENT_LIGHT, stroke: DOT_STROKE, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
