'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import type { CircadianHour } from '@/app/api/analytics/circadian/route'

interface Props {
  hours: CircadianHour[]
  peakHour: CircadianHour
}

export default function CircadianChart({ hours, peakHour }: Props) {
  // Only show hours 6–23 (filter out dead-of-night noise)
  const visible = hours.filter((h) => h.hour >= 6)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={visible} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={2}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          itemStyle={{ color: '#a78bfa' }}
          cursor={{ fill: 'rgba(99,102,241,0.08)' }}
        />
        <ReferenceLine x={peakHour.label} stroke="#6366f1" strokeDasharray="3 3" />
        <Bar dataKey="completed" radius={[3, 3, 0, 0]}>
          {visible.map((h) => (
            <Cell
              key={h.hour}
              fill={h.hour === peakHour.hour ? '#6366f1' : '#334155'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
