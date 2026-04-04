import { NextResponse } from 'next/server'
import { getActiveTasks, getProjects, normalizePriority } from '@/lib/todoist'
import { generateJSON } from '@/lib/ai'
import { differenceInDays, parseISO, format } from 'date-fns'

export type RecurringAction = 'keep' | 'pause' | 'reduce_frequency' | 'delete'

export interface RecurringTask {
  taskId: string
  content: string
  projectName: string
  priority: string
  dueString: string        // e.g. "every day", "every Monday"
  daysOverdue: number      // how many days past due right now
  action: RecurringAction
  reason: string
  skipSignal: 'never_overdue' | 'occasionally_late' | 'chronically_skipped'
}

export interface RecurringAuditResult {
  summary: string
  totalRecurring: number
  auditedTasks: RecurringTask[]
  healthyCount: number
  insights: string[]
}

export async function GET() {
  try {
    const [tasks, projects] = await Promise.all([getActiveTasks(), getProjects()])
    const projectMap = new Map(projects.map((p) => [p.id, p.name]))
    const today = new Date()

    // Filter to recurring tasks only
    const recurring = tasks.filter((t) => t.due?.isRecurring === true)

    const enriched = recurring.map((t) => {
      const dueDate = t.due?.date ?? null
      const daysOverdue = dueDate
        ? differenceInDays(today, parseISO(dueDate))
        : 0

      return {
        taskId: t.id,
        content: t.content ?? '',
        projectName: projectMap.get(t.projectId) ?? 'Inbox',
        priority: normalizePriority(t.priority),
        dueString: t.due?.string ?? 'recurring',
        daysOverdue: Math.max(0, daysOverdue),
        isOverdue: daysOverdue > 0,
        labels: t.labels,
      }
    })

    const overdueCount = enriched.filter((t) => t.isOverdue).length
    const healthyCount = enriched.length - overdueCount

    // Send all recurring tasks to AI — overdue ones are most important
    const prompt = `You are a personal productivity coach performing a recurring task audit.

Today: ${format(today, 'yyyy-MM-dd')}
Total recurring tasks: ${enriched.length}
Currently overdue recurring tasks: ${overdueCount}
Healthy (not overdue): ${healthyCount}

All recurring tasks:
${JSON.stringify(enriched, null, 2)}

A recurring task that is overdue is a strong signal that the person is consistently skipping it.
The more days overdue it is, the stronger the skip signal.

For EACH task, recommend one action:
- "keep": healthy habit, being completed on time — no changes needed
- "pause": currently being skipped but the underlying intent is good — suggest a break
- "reduce_frequency": good habit but too frequent — e.g. daily → weekly
- "delete": being skipped consistently AND the habit itself is low value or obsolete

Classify the skip signal:
- "never_overdue": 0 days overdue — healthy
- "occasionally_late": 1–3 days overdue — mild concern
- "chronically_skipped": 4+ days overdue — strong skip signal

Return JSON:
{
  "summary": "2-sentence honest assessment of the recurring task health",
  "totalRecurring": ${enriched.length},
  "auditedTasks": [
    {
      "taskId": "...",
      "content": "...",
      "projectName": "...",
      "priority": "p1|p2|p3|p4",
      "dueString": "...",
      "daysOverdue": N,
      "action": "keep|pause|reduce_frequency|delete",
      "reason": "specific reason for this recommendation",
      "skipSignal": "never_overdue|occasionally_late|chronically_skipped"
    }
  ],
  "healthyCount": ${healthyCount},
  "insights": ["behavioral insight about recurring habits 1", "insight 2", "insight 3"]
}`

    const result = await generateJSON<RecurringAuditResult>(prompt)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Recurring audit error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to audit recurring tasks' },
      { status: 500 },
    )
  }
}
