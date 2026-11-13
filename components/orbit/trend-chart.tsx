'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { deviationStatus, type IndicatorState } from '@/lib/orbit/health'
import { STATUS_STYLE } from '@/lib/orbit/status-style'

export function TrendChart({ indicator, height = 180 }: { indicator: IndicatorState; height?: number }) {
  const { history, baseline, meta, id } = indicator
  const usesBand = id !== 'radiationDose' && id !== 'crewPulse'
  const low = meta.bad === 'high' ? baseline : baseline * (1 - meta.watchPct)
  const high = meta.bad === 'low' ? baseline : baseline * (1 + meta.watchPct)
  const values = history.map((p) => p.value)
  const min = Math.min(...values, usesBand ? low : Infinity)
  const max = Math.max(...values, usesBand ? high : id === 'radiationDose' ? baseline : -Infinity)
  const pad = (max - min) * 0.15 || 1
  const gradientId = `fill-${id}`

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={history} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(d) => `D${d}`}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={meta.decimals > 0}
          />
          {usesBand && (
            <ReferenceArea y1={low} y2={high} fill="var(--status-ok)" fillOpacity={0.08} />
          )}
          {id !== 'crewPulse' && (
            <ReferenceLine
              y={baseline}
              stroke={id === 'radiationDose' ? 'var(--status-act)' : 'var(--status-ok)'}
              strokeDasharray="4 4"
              label={{
                value: id === 'radiationDose' ? 'Career limit' : 'Your normal',
                fill: 'var(--muted-foreground)',
                fontSize: 11,
                position: 'insideTopRight',
              }}
            />
          )}
          <Tooltip
            cursor={{ stroke: 'var(--border)' }}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(d) => `Mission day ${d}`}
            formatter={(v) => [`${Number(v).toFixed(meta.decimals)} ${meta.unit}`, meta.label]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload, index } = props as {
                cx: number
                cy: number
                payload: { value: number }
                index: number
              }
              const status = usesBand
                ? deviationStatus(payload.value, baseline, meta).status
                : indicator.status
              const isLast = index === history.length - 1
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={isLast ? 5 : 2.5}
                  fill={STATUS_STYLE[status].color}
                  stroke="var(--card)"
                  strokeWidth={isLast ? 2 : 0}
                />
              )
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
