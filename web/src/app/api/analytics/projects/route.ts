import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { subDays, format } from 'date-fns'

export interface ProjectVolume {
  project_name: string
  total_completed: number
  total_active: number
  avg_overdue: number
}

export async function GET() {
  try {
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('task_snapshots')
      .select('project_name, completed_today, active_count, overdue_count')
      .gte('snapshot_date', thirtyDaysAgo)

    if (error) throw new Error(error.message)

    // Aggregate per project
    const byProject = new Map<string, { completed: number; active: number; overdue: number; days: number }>()

    for (const row of data ?? []) {
      const existing = byProject.get(row.project_name) ?? { completed: 0, active: 0, overdue: 0, days: 0 }
      byProject.set(row.project_name, {
        completed: existing.completed + (row.completed_today ?? 0),
        active: existing.active + (row.active_count ?? 0),
        overdue: existing.overdue + (row.overdue_count ?? 0),
        days: existing.days + 1,
      })
    }

    const projects: ProjectVolume[] = Array.from(byProject.entries())
      .map(([project_name, v]) => ({
        project_name,
        total_completed: v.completed,
        total_active: v.days > 0 ? Math.round(v.active / v.days) : 0,
        avg_overdue: v.days > 0 ? Math.round((v.overdue / v.days) * 10) / 10 : 0,
      }))
      .filter((p) => p.total_completed > 0 || p.total_active > 0)
      .sort((a, b) => b.total_completed - a.total_completed)
      .slice(0, 12)

    return NextResponse.json({ projects, daysOfData: data?.length ? 30 : 0 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load project data' },
      { status: 500 },
    )
  }
}
