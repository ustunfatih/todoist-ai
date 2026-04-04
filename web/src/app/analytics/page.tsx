'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import {
  BarChart3, TrendingUp, Clock, Target, Loader2, AlertCircle,
  CheckCheck, Moon, Lightbulb, FolderOpen, TrendingDown,
} from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CircadianHour } from '../api/analytics/circadian/route'
import type { ProjectVolume } from '../api/analytics/projects/route'
import type { OverdueInsight } from '../api/analytics/overdue-patterns/route'

const CompletionChart = dynamic(() => import('@/components/ui/completion-chart'), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-lg bg-slate-800/50" />,
})

const CircadianChart = dynamic(() => import('@/components/ui/circadian-chart'), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-lg bg-slate-800/50" />,
})

const ProjectsChart = dynamic(() => import('@/components/ui/projects-chart'), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-lg bg-slate-800/50" />,
})

interface BasicStats {
  days: Array<{ date: string; completed: number }>
  karma: number
  dailyGoal: number
  weeklyGoal: number
  totalThisWeek: number
  avgPerDay: number
}

interface CircadianData {
  hours: CircadianHour[]
  peakHour: CircadianHour
  totalLogged: number
}

interface ProjectData {
  projects: ProjectVolume[]
  daysOfData: number
}

function SectionLoader() {
  return (
    <div className="flex h-56 items-center justify-center text-slate-600">
      <Loader2 className="size-5 animate-spin" />
    </div>
  )
}

function NoDataNotice({ message }: { message: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
      <Clock className="size-6 text-slate-700" />
      <p className="text-sm text-slate-600">{message}</p>
      <p className="text-xs text-slate-700">Data accumulates daily — check back tomorrow.</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<BasicStats | null>(null)
  const [circadian, setCircadian] = useState<CircadianData | null>(null)
  const [projects, setProjects] = useState<ProjectData | null>(null)
  const [overdue, setOverdue] = useState<OverdueInsight | null>(null)

  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingCircadian, setLoadingCircadian] = useState(true)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingOverdue, setLoadingOverdue] = useState(true)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Basic stats — always available
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((data) => { if (data.error) throw new Error(data.error); setStats(data) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingStats(false))

    // Circadian — needs DB data
    fetch('/api/analytics/circadian')
      .then((r) => r.json())
      .then((data) => { if (!data.error) setCircadian(data) })
      .finally(() => setLoadingCircadian(false))

    // Project volume — needs DB data
    fetch('/api/analytics/projects')
      .then((r) => r.json())
      .then((data) => { if (!data.error) setProjects(data) })
      .finally(() => setLoadingProjects(false))

    // Overdue patterns — needs DB data + AI
    fetch('/api/analytics/overdue-patterns')
      .then((r) => r.json())
      .then((data) => { if (!data.error) setOverdue(data) })
      .finally(() => setLoadingOverdue(false))
  }, [])

  const days = stats?.days ?? []
  const dailyGoal = stats?.dailyGoal ?? 5
  const hasCircadianData = (circadian?.totalLogged ?? 0) > 0
  const hasProjectData = (projects?.projects.length ?? 0) > 0

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="size-6 text-indigo-400" />
          <h1 className="text-2xl font-bold text-slate-100">Life Analytics</h1>
        </div>
        <p className="mt-1 text-slate-500">
          Productivity patterns from your Todoist data — historical charts grow richer each day.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* KPI row */}
        {loadingStats ? (
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="size-5 animate-spin" />
            Loading analytics…
          </div>
        ) : stats && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: 'Tasks This Week', value: stats.totalThisWeek, icon: CheckCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Daily Average', value: stats.avgPerDay.toFixed(1), icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Daily Goal', value: stats.dailyGoal, icon: Target, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                { label: 'Karma Score', value: stats.karma.toLocaleString(), icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label} className="flex items-center gap-4">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                    <Icon className={`size-5 ${color}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-100">{value}</div>
                    <div className="text-xs text-slate-500">{label}</div>
                  </div>
                </Card>
              ))}
            </div>

            {/* 7-day chart */}
            {days.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tasks Completed — Last 7 Days</CardTitle>
                  <Badge variant={stats.totalThisWeek >= stats.weeklyGoal ? 'success' : 'warning'}>
                    {stats.totalThisWeek}/{stats.weeklyGoal} weekly goal
                  </Badge>
                </CardHeader>
                <div className="h-56">
                  <CompletionChart days={days} dailyGoal={dailyGoal} />
                </div>
              </Card>
            )}
          </>
        )}

        {/* Circadian chart */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Moon className="size-4 text-purple-400" />
              Circadian Productivity
            </CardTitle>
            {hasCircadianData && circadian && (
              <Badge variant="default">
                Peak: {circadian.peakHour.label}
              </Badge>
            )}
          </CardHeader>
          {loadingCircadian ? <SectionLoader /> : hasCircadianData && circadian ? (
            <>
              <p className="mb-3 text-xs text-slate-500">
                Your most productive hour is <strong className="text-purple-400">{circadian.peakHour.label}</strong> based
                on {circadian.totalLogged} logged completions — last 30 days.
              </p>
              <div className="h-56">
                <CircadianChart hours={circadian.hours} peakHour={circadian.peakHour} />
              </div>
            </>
          ) : (
            <NoDataNotice message="No completion data yet — the daily snapshot will log your completions each night." />
          )}
        </Card>

        {/* Project volume + Overdue patterns side by side */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Project volume */}
          <Card>
            <CardHeader>
              <CardTitle>
                <FolderOpen className="size-4 text-blue-400" />
                Task Volume by Project
              </CardTitle>
              {hasProjectData && (
                <span className="text-xs text-slate-500">Last 30 days</span>
              )}
            </CardHeader>
            {loadingProjects ? <SectionLoader /> : hasProjectData && projects ? (
              <div className="h-64">
                <ProjectsChart projects={projects.projects} />
              </div>
            ) : (
              <NoDataNotice message="No project snapshot data yet." />
            )}
          </Card>

          {/* Overdue patterns */}
          <Card>
            <CardHeader>
              <CardTitle>
                <TrendingDown className="size-4 text-red-400" />
                Overdue Pattern Analysis
              </CardTitle>
            </CardHeader>
            {loadingOverdue ? <SectionLoader /> : overdue ? (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-slate-400">{overdue.summary}</p>

                {overdue.worstProjects.length > 0 && (
                  <div className="space-y-2">
                    {overdue.worstProjects.slice(0, 4).map((p) => (
                      <div key={p.name} className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm text-slate-300">{p.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-500">{p.avgOverdue} avg overdue</span>
                          <Badge variant={
                            p.trend === 'worsening' ? 'danger'
                              : p.trend === 'improving' ? 'success'
                              : 'muted'
                          }>
                            {p.trend}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {overdue.patterns.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Patterns</p>
                    <ul className="space-y-1.5">
                      {overdue.patterns.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-red-400/60" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {overdue.recommendation && (
                  <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lightbulb className="size-3 text-indigo-400" />
                      <span className="text-xs font-medium text-indigo-400">Recommendation</span>
                    </div>
                    <p className="text-xs text-slate-400">{overdue.recommendation}</p>
                  </div>
                )}
              </div>
            ) : (
              <NoDataNotice message="No overdue pattern data yet." />
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
