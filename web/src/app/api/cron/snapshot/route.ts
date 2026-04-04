import { NextResponse } from 'next/server'
import { getActiveTasks, getOverdueTasks, getCompletedTasks, getProjects, normalizePriority } from '@/lib/todoist'
import { supabase } from '@/lib/supabase'
import { format, subDays } from 'date-fns'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const since = subDays(new Date(), 1).toISOString()
  const until = new Date().toISOString()

  const [tasks, overdueTasks, completedToday, projects] = await Promise.all([
    getActiveTasks(),
    getOverdueTasks(),
    getCompletedTasks(since, until),
    getProjects(),
  ])

  const projectMap = new Map(projects.map((p) => [p.id, p.name]))

  const activeByProject = new Map<string, number>()
  const overdueByProject = new Map<string, number>()
  const completedByProject = new Map<string, number>()

  for (const t of tasks) {
    const name = projectMap.get(t.projectId) ?? 'Inbox'
    activeByProject.set(name, (activeByProject.get(name) ?? 0) + 1)
  }
  for (const t of overdueTasks) {
    const name = projectMap.get(t.projectId) ?? 'Inbox'
    overdueByProject.set(name, (overdueByProject.get(name) ?? 0) + 1)
  }
  for (const t of completedToday) {
    const name = projectMap.get(t.projectId) ?? 'Inbox'
    completedByProject.set(name, (completedByProject.get(name) ?? 0) + 1)
  }

  // Upsert one row per project for today
  const snapshotRows = projects.map((p) => ({
    snapshot_date: today,
    project_id: p.id,
    project_name: p.name,
    active_count: activeByProject.get(p.name) ?? 0,
    overdue_count: overdueByProject.get(p.name) ?? 0,
    completed_today: completedByProject.get(p.name) ?? 0,
  }))

  await supabase
    .from('task_snapshots')
    .upsert(snapshotRows, { onConflict: 'snapshot_date,project_id' })

  // Log individual completions with hour of day for circadian analysis
  const completionRows = completedToday.map((t) => ({
    task_id: t.id,
    content: t.content ?? '',
    project_id: t.projectId,
    project_name: projectMap.get(t.projectId) ?? 'Inbox',
    completed_at: t.completedAt,
    hour_of_day: new Date(t.completedAt).getHours(),
    priority: 'p4', // Todoist completed tasks don't return priority; enrich later if needed
    labels: [] as string[],
  }))

  if (completionRows.length > 0) {
    await supabase
      .from('completion_log')
      .upsert(completionRows, { onConflict: 'task_id' })
  }

  return NextResponse.json({
    snapshotDate: today,
    projects: snapshotRows.length,
    completions: completionRows.length,
  })
}
