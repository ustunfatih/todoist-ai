'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { ProjectVolume } from '@/app/api/analytics/projects/route'

interface Props {
  projects: ProjectVolume[]
}

export default function ProjectsChart({ projects }: Props) {
  const data = projects.map((p) => ({
    name: p.project_name.length > 14 ? p.project_name.slice(0, 14) + '…' : p.project_name,
    Completed: p.total_completed,
    'Avg Active': p.total_active,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={100}
        />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          cursor={{ fill: 'rgba(99,102,241,0.08)' }}
        />
        <Bar dataKey="Completed" fill="#6366f1" radius={[0, 3, 3, 0]} />
        <Bar dataKey="Avg Active" fill="#334155" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
