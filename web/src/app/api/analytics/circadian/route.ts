import { NextResponse } from 'next/server'
import { getCompletedTasks } from '@/lib/todoist'
import { subDays } from 'date-fns'

export interface CircadianHour {
  hour: number
  label: string
  completed: number
}

const TZ_OFFSET_HOURS = parseInt(process.env.TZ_OFFSET_HOURS ?? '3') // Qatar = UTC+3

export async function GET() {
  try {
    // Use last 30 days of completed tasks — longer window = more meaningful pattern
    const since = subDays(new Date(), 30).toISOString()
    const tasks = await getCompletedTasks(since)

    const hourCounts: CircadianHour[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      completed: 0,
    }))

    for (const task of tasks) {
      if (!task.completedAt) continue
      const utcHour = new Date(task.completedAt).getUTCHours()
      // Shift to user's local timezone
      const localHour = (utcHour + TZ_OFFSET_HOURS + 24) % 24
      hourCounts[localHour].completed++
    }

    const totalLogged = tasks.length
    const peakHour = hourCounts.reduce((a, b) => (b.completed > a.completed ? b : a))

    return NextResponse.json({ hours: hourCounts, peakHour, totalLogged })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load circadian data' },
      { status: 500 },
    )
  }
}
