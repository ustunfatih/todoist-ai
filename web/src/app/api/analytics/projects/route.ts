import { NextResponse } from 'next/server'
import { getActiveTasks, getCompletedTasks, getProjects } from '@/lib/todoist'
import { subDays } from 'date-fns'

export interface ProjectVolume {
  project_name: string
  total_completed: number
  total_active: number
  avg_overdue: number
}

export async function GET() {
  try {
    const since = subDays(new Date(), 30).toISOString()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [activeTasks, completedTasks, projects] = await Promise.all([
      getActiveTasks(),
      getCompletedTasks(since),
      getProjects(),
    ])

    const projectMap = new Map(projects.map((p) => [p.id, p.name]))

    // Active task count per project
    const activeByProject = new Map<string, number>()
    let overdueByProject = new Map<string, number>()

    for (const task of activeTasks) {
      const name = projectMap.get(task.projectId) ?? 'Inbox'
      activeByProject.set(name, (activeByProject.get(name) ?? 0) + 1)

      if (task.due) {
        const due = new Date(task.due.date)
        due.setHours(0, 0, 0, 0)
        if (due < today) {
          overdueByProject.set(name, (overdueByProject.get(name) ?? 0) + 1)
        }
      }
    }

    // Completed count per project (last 30 days)
    const completedByProject = new Map<string, number>()
    for (const task of completedTasks) {
      const name = projectMap.get(task.projectId) ?? 'Inbox'
      completedByProject.set(name, (completedByProject.get(name) ?? 0) + 1)
    }

    // Merge into unified list
    const allNames = new Set([
      ...Array.from(activeByProject.keys()),
      ...Array.from(completedByProject.keys()),
    ])

    const projectList: ProjectVolume[] = Array.from(allNames)
      .map((name) => ({
        project_name: name,
        total_completed: completedByProject.get(name) ?? 0,
        total_active: activeByProject.get(name) ?? 0,
        avg_overdue: overdueByProject.get(name) ?? 0,
      }))
      .filter((p) => p.total_active > 0 || p.total_completed > 0)
      .sort((a, b) => (b.total_completed + b.total_active) - (a.total_completed + a.total_active))
      .slice(0, 12)

    return NextResponse.json({ projects: projectList, daysOfData: 30 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load project data' },
      { status: 500 },
    )
  }
}
