import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateJSON } from '@/lib/ai'
import { subDays, format } from 'date-fns'

export interface OverdueInsight {
  summary: string
  worstProjects: Array<{ name: string; avgOverdue: number; trend: 'improving' | 'worsening' | 'stable' }>
  patterns: string[]
  recommendation: string
}

export async function GET() {
  try {
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('task_snapshots')
      .select('snapshot_date, project_name, overdue_count')
      .gte('snapshot_date', thirtyDaysAgo)
      .order('snapshot_date', { ascending: true })

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      return NextResponse.json({
        summary: 'No historical data yet — data accumulates daily after the snapshot cron runs.',
        worstProjects: [],
        patterns: [],
        recommendation: 'Check back tomorrow after the first snapshot has been recorded.',
      } satisfies OverdueInsight)
    }

    // Aggregate avg overdue per project
    const byProject = new Map<string, number[]>()
    for (const row of data) {
      const arr = byProject.get(row.project_name) ?? []
      arr.push(row.overdue_count)
      byProject.set(row.project_name, arr)
    }

    const projectSummary = Array.from(byProject.entries())
      .map(([name, counts]) => ({
        name,
        avgOverdue: Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10,
        maxOverdue: Math.max(...counts),
        dataPoints: counts.length,
        recentTrend: counts.slice(-7),
      }))
      .filter((p) => p.avgOverdue > 0)
      .sort((a, b) => b.avgOverdue - a.avgOverdue)
      .slice(0, 10)

    const prompt = `You are a productivity analyst reviewing 30 days of Todoist overdue task data.

Data (overdue task counts per project, last 30 days):
${JSON.stringify(projectSummary, null, 2)}

Analyze the patterns and provide:
1. Which projects are chronically behind vs occasionally behind
2. Whether any projects show an improving or worsening trend
3. Likely root causes (too many tasks added, wrong priority, scope creep, etc.)
4. One concrete recommendation

Return JSON:
{
  "summary": "2-sentence overall assessment of overdue health",
  "worstProjects": [
    { "name": "...", "avgOverdue": N, "trend": "improving|worsening|stable" }
  ],
  "patterns": ["specific behavioral pattern 1", "pattern 2", "pattern 3"],
  "recommendation": "One specific, actionable recommendation"
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
