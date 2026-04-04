import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { subDays } from 'date-fns'

export interface CircadianHour {
  hour: number
  label: string
  completed: number
}

export async function GET() {
  try {
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString()

    const { data, error } = await supabase
      .from('completion_log')
      .select('hour_of_day')
      .gte('completed_at', thirtyDaysAgo)

    if (error) throw new Error(error.message)

    const hourCounts: CircadianHour[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      completed: 0,
    }))

    for (const row of data ?? []) {
      hourCounts[row.hour_of_day].completed++
    }

    const peakHour = hourCounts.reduce((a, b) => (b.completed > a.completed ? b : a))

    return NextResponse.json({ hours: hourCounts, peakHour, totalLogged: data?.length ?? 0 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load circadian data' },
      { status: 500 },
    )
  }
}
