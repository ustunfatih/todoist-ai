/**
 * Todoist API client — all endpoints are on /api/v1/ (the official v1 REST API).
 *
 * Correct endpoint paths (verified from @doist/todoist-sdk v8 source):
 *   Active tasks:      GET /api/v1/tasks
 *   Projects:          GET /api/v1/projects
 *   Completed tasks:   GET /api/v1/tasks/completed/by_completion_date
 *   Productivity stats:GET /api/v1/tasks/completed/stats
 *
 * IMPORTANT — field naming is INCONSISTENT across endpoints:
 *   Active tasks (/tasks):      camelCase  (projectId, createdAt, isCompleted …)
 *   Completed tasks (/completed): snake_case (project_id, completed_at …)
 *   Stats (/stats):               snake_case (days_items, daily_goal, weekly_goal …)
 *   due object:                   mixed      (is_recurring snake, rest varies)
 *
 * normalizeCompleted() and normalizeStats() map snake_case → camelCase so the
 * rest of the app can use a consistent interface.
 */

const API_KEY = process.env.TODOIST_API_KEY!
const BASE = 'https://api.todoist.com/api/v1'

function headers() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { headers: headers(), cache: 'no-store' })
  if (!res.ok) throw new Error(`Todoist error ${res.status} ${path}: ${await res.text()}`)
  return res.json() as Promise<T>
}

/** Unwrap either a plain array or { results: T[] } paginated response. */
function unwrapArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && 'results' in data) {
    const r = (data as { results: unknown }).results
    if (Array.isArray(r)) return r as T[]
  }
  return []
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodoistTask {
  id: string
  content: string
  description: string
  projectId: string
  sectionId: string | null
  parentId: string | null
  priority: number   // 1=p4 (lowest) … 4=p1 (highest)
  // Note: the `due` object mixes conventions — `is_recurring` stays snake_case
  // in the v1 API even though all top-level task fields are camelCase.
  due: { date: string; datetime?: string; string: string; is_recurring: boolean } | null
  deadline: { date: string } | null
  duration: { amount: number; unit: 'minute' | 'day' } | null
  labels: string[]
  order: number
  isCompleted: boolean
  completedAt: string | null
  createdAt: string
}

export interface TodoistCompletedTask {
  id: string
  content: string
  projectId: string
  completedAt: string
}

export interface TodoistProject {
  id: string
  name: string
  parentId: string | null
  color: string
  isFavorite: boolean
  isInboxProject: boolean
}

export interface TodoistStats {
  karma: number
  karmaTrend: string
  daysItems: Array<{ date: string; totalCompleted: number }>
  weekItems: Array<{ from: string; to: string; totalCompleted: number }>
  goals: {
    dailyGoal: number
    weeklyGoal: number
    ignoreDays: number[]
  }
}

/** Convert API priority number → readable string (p1 = most urgent). */
export function normalizePriority(apiPriority: number): 'p1' | 'p2' | 'p3' | 'p4' {
  switch (apiPriority) {
    case 4: return 'p1'
    case 3: return 'p2'
    case 2: return 'p3'
    default: return 'p4'
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getActiveTasks(filter?: string): Promise<TodoistTask[]> {
  const params: Record<string, string> = {}
  if (filter) params.filter = filter
  const data = await get<unknown>('/tasks', params)
  return unwrapArray<TodoistTask>(data)
}

export async function getTodayTasks(): Promise<TodoistTask[]> {
  return getActiveTasks('today | overdue')
}

export async function getOverdueTasks(): Promise<TodoistTask[]> {
  return getActiveTasks('overdue')
}

export async function getProjects(): Promise<TodoistProject[]> {
  const data = await get<unknown>('/projects')
  return unwrapArray<TodoistProject>(data)
}

/** Completed tasks between `sinceDate` and `untilDate` (ISO datetime strings).
 *  Both `since` and `until` are required by the API; `until` defaults to now.
 *  The completed-tasks endpoint returns snake_case — we normalize here. */
export async function getCompletedTasks(sinceDate: string, untilDate?: string): Promise<TodoistCompletedTask[]> {
  const until = untilDate ?? new Date().toISOString()
  // Use `unknown` so we can safely normalize before casting
  const data = await get<{ items: Array<Record<string, unknown>> }>(
    '/tasks/completed/by_completion_date',
    { since: sinceDate, until, limit: '200' },
  )
  return (data.items ?? []).map((item) => ({
    id: (item.id ?? item.task_id ?? '') as string,
    content: (item.content ?? '') as string,
    // API returns project_id (snake_case)
    projectId: (item.projectId ?? item.project_id ?? '') as string,
    // API returns completed_at (snake_case)
    completedAt: (item.completedAt ?? item.completed_at ?? '') as string,
  }))
}

/** Karma, goals, and daily/weekly completion counts.
 *  The stats endpoint returns snake_case — we normalize here. */
export async function getProductivityStats(): Promise<TodoistStats> {
  const raw = await get<Record<string, unknown>>('/tasks/completed/stats')
  // Normalize snake_case → camelCase
  const goals = (raw.goals ?? {}) as Record<string, unknown>
  return {
    karma: (raw.karma ?? 0) as number,
    karmaTrend: (raw.karma_trend ?? raw.karmaTrend ?? '') as string,
    daysItems: ((raw.days_items ?? raw.daysItems ?? []) as Array<Record<string, unknown>>).map((d) => ({
      date: d.date as string,
      totalCompleted: (d.total_completed ?? d.totalCompleted ?? 0) as number,
    })),
    weekItems: ((raw.week_items ?? raw.weekItems ?? []) as Array<Record<string, unknown>>).map((w) => ({
      from: (w.from ?? '') as string,
      to: (w.to ?? '') as string,
      totalCompleted: (w.total_completed ?? w.totalCompleted ?? 0) as number,
    })),
    goals: {
      dailyGoal: (goals.daily_goal ?? goals.dailyGoal ?? 0) as number,
      weeklyGoal: (goals.weekly_goal ?? goals.weeklyGoal ?? 0) as number,
      ignoreDays: (goals.ignore_days ?? goals.ignoreDays ?? []) as number[],
    },
  }
}

/** Update a task (partial). */
export async function updateTask(
  taskId: string,
  updates: { dueDate?: string; priority?: number; labels?: string[] },
): Promise<void> {
  await fetch(`${BASE}/tasks/${taskId}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(updates),
  })
}

/** Delete a task. */
export async function deleteTask(taskId: string): Promise<void> {
  await fetch(`${BASE}/tasks/${taskId}`, { method: 'DELETE', headers: headers() })
}

/** Close (complete) a task. */
export async function closeTask(taskId: string): Promise<void> {
  await fetch(`${BASE}/tasks/${taskId}/close`, { method: 'POST', headers: headers() })
}
