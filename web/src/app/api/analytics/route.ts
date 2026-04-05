import { NextResponse } from 'next/server'
import { getProductivityStats, getCompletedTasks } from '@/lib/todoist'
import { format, subDays } from 'date-fns'

export async function GET() {
  try {
    const today = new Date()
    const weekStartStr = subDays(today, 7).toISOString()

    // Fetch in parallel — stats for karma/goals, completed tasks as fallback for daily counts
    const [stats, completedTasks] = await Promise.all([
      getProductivityStats(),
      getCompletedTasks(weekStartStr),
    ])

    // Build per-date count from completed tasks (more reliable than daysItems)
    const completedByDate: Record<string, number> = {}
    for (const task of completedTasks) {
      const date = task.completedAt?.split('T')[0]
      if (date) completedByDate[date] = (completedByDate[date] ?? 0) + 1
    }

    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(today, 6 - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      // Prefer daysItems from stats API; fall back to counting completed tasks directly
      const fromStats = stats.daysItems?.find((d) => d.date === dateStr)?.totalCompleted
      return {
        date: format(date, 'EEE'),
        completed: fromStats ?? completedByDate[dateStr] ?? 0,
      }
    })

    const totalThisWeek = days.reduce((sum, d) => sum + d.completed, 0)
    const avgPerDay = Number((totalThisWeek / 7).toFixed(1))

    return NextResponse.json({
      days,
      karma: stats.karma ?? 0,
      dailyGoal: stats.goals?.dailyGoal ?? 5,
      weeklyGoal: stats.goals?.weeklyGoal ?? 25,
      totalThisWeek,
      avgPerDay,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load analytics' },
      { status: 500 },
    )
  }
}
