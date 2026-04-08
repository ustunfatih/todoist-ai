import { NextResponse } from 'next/server'
import { getOverdueTasks, getProjects, normalizePriority } from '@/lib/todoist'
import { generateJSON } from '@/lib/ai'
import { differenceInDays } from 'date-fns'

export interface OverdueInsight {
  summary: string
  worstProjects: Array<{ name: string; avgOverdue: number; trend: 'improving' | 'worsening' | 'stable' }>
  patterns: string[]
  recommendation: string
}

export async function GET() {
  try {
    const [overdueTasks, projects] = await Promise.all([
      getOverdueTasks(),
      getProjects(),
    ])

    if (overdueTasks.length === 0) {
      return NextResponse.json({
        summary: 'No overdue tasks right now — great work staying on top of things!',
        worstProjects: [],
        patterns: [],
        recommendation: 'Keep maintaining your current pace and review due dates each week.',
      } satisfies OverdueInsight)
    }

    const projectMap = new Map(projects.map((p) => [p.id, p.name]))
    const today = new Date()

    // Group overdue tasks by project and compute stats
    const byProject = new Map<string, { count: number; daysOverdue: number[]; priorities: string[] }>()
    for (const task of overdueTasks) {
      const name = projectMap.get(task.projectId) ?? 'Inbox'
      const daysLate = task.due ? differenceInDays(today, new Date(task.due.date)) : 0
      const existing = byProject.get(name) ?? { count: 0, daysOverdue: [], priorities: [] }
      existing.count++
      existing.daysOverdue.push(daysLate)
      existing.priorities.push(normalizePriority(task.priority))
      byProject.set(name, existing)
    }

    const projectSummary = Array.from(byProject.entries())
      .map(([name, v]) => ({
        name,
        overdueCount: v.count,
        avgDaysLate: Math.round(v.daysOverdue.reduce((a, b) => a + b, 0) / v.daysOverdue.length),
        maxDaysLate: Math.max(...v.daysOverdue),
        highPriorityOverdue: v.priorities.filter((p) => p === 'p1' || p === 'p2').length,
      }))
      .sort((a, b) => b.overdueCount - a.overdueCount)

    const prompt = `You are a productivity analyst reviewing current Todoist overdue tasks.

Overdue tasks by project (live data):
${JSON.stringify(projectSummary, null, 2)}

Total overdue: ${overdueTasks.length}

Analyze and provide:
1. Overall overdue health assessment
2. Which projects are most problematic
3. Behavioral patterns you observe (e.g. "finance tasks consistently delayed", "high-priority tasks being skipped")
4. One specific actionable recommendation

Return JSON:
{
  "summary": "2-sentence honest assessment",
  "worstProjects": [
    { "name": "...", "avgOverdue": N, "trend": "stable" }
  ],
  "patterns": ["pattern 1", "pattern 2", "pattern 3"],
  "recommendation": "One concrete, specific action"
}`

    const insight = await generateJSON<OverdueInsight>(prompt)
    return NextResponse.json(insight)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze overdue patterns' },
      { status: 500 },
    )
  }
}
