'use client'

import { useState } from 'react'
import {
  RefreshCw, Zap, AlertCircle, CheckCircle2, Lightbulb,
  Trash2, PauseCircle, TrendingDown, Heart, RotateCcw,
} from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RecurringAuditResult, RecurringTask, RecurringAction } from '../api/recurring/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function actionIcon(action: RecurringAction) {
  switch (action) {
    case 'keep': return <Heart className="size-4 text-emerald-400" />
    case 'pause': return <PauseCircle className="size-4 text-amber-400" />
    case 'reduce_frequency': return <TrendingDown className="size-4 text-blue-400" />
    case 'delete': return <Trash2 className="size-4 text-red-400" />
  }
}

function actionLabel(action: RecurringAction) {
  switch (action) {
    case 'keep': return 'Keep'
    case 'pause': return 'Pause'
    case 'reduce_frequency': return 'Reduce frequency'
    case 'delete': return 'Delete'
  }
}

function actionBadgeVariant(action: RecurringAction): 'success' | 'warning' | 'default' | 'danger' {
  switch (action) {
    case 'keep': return 'success'
    case 'pause': return 'warning'
    case 'reduce_frequency': return 'default'
    case 'delete': return 'danger'
  }
}

function skipSignalColor(signal: RecurringTask['skipSignal']) {
  switch (signal) {
    case 'never_overdue': return 'text-emerald-400'
    case 'occasionally_late': return 'text-amber-400'
    case 'chronically_skipped': return 'text-red-400'
  }
}

function skipSignalLabel(signal: RecurringTask['skipSignal']) {
  switch (signal) {
    case 'never_overdue': return 'On track'
    case 'occasionally_late': return 'Occasionally late'
    case 'chronically_skipped': return 'Chronically skipped'
  }
}

// ─── Task card ────────────────────────────────────────────────────────────────

function RecurringTaskCard({
  task,
  dismissed,
  onDismiss,
}: {
  task: RecurringTask
  dismissed: boolean
  onDismiss: (id: string) => void
}) {
  if (dismissed) return null

  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all',
      task.action === 'delete' ? 'border-red-500/20 bg-red-500/5'
        : task.action === 'pause' ? 'border-amber-500/20 bg-amber-500/5'
        : task.skipSignal === 'chronically_skipped' ? 'border-slate-600/50 bg-slate-800/40'
        : 'border-slate-700/30 bg-slate-800/20',
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          {/* Content + project */}
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-200 leading-snug">{task.content}</span>
            <span className="text-xs text-slate-600">· {task.projectName}</span>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">
              <RotateCcw className="size-3" />
              {task.dueString}
            </span>
            {task.daysOverdue > 0 && (
              <span className="text-xs text-red-400">{task.daysOverdue}d overdue</span>
            )}
            <span className={cn('text-xs font-medium', skipSignalColor(task.skipSignal))}>
              {skipSignalLabel(task.skipSignal)}
            </span>
          </div>

          {/* Recommendation */}
          <div className="flex items-center gap-2">
            {actionIcon(task.action)}
            <Badge variant={actionBadgeVariant(task.action)}>
              {actionLabel(task.action)}
            </Badge>
            <span className="text-xs text-slate-500">{task.reason}</span>
          </div>
        </div>

        <button
          onClick={() => onDismiss(task.taskId)}
          className="shrink-0 text-slate-600 hover:text-slate-400 transition-colors"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const [result, setResult] = useState<RecurringAuditResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState<RecurringAction | 'all'>('all')

  async function runAudit() {
    setLoading(true)
    setError(null)
    setDismissed(new Set())
    setActiveFilter('all')
    try {
      const res = await fetch('/api/recurring')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Unknown error')
      }
      setResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit failed')
    } finally {
      setLoading(false)
    }
  }

  function dismiss(taskId: string) {
    setDismissed((prev) => new Set(prev).add(taskId))
  }

  const allTasks = result?.auditedTasks ?? []
  const filtered = allTasks.filter(
    (t) => !dismissed.has(t.taskId) && (activeFilter === 'all' || t.action === activeFilter),
  )
  const sorted = [...filtered].sort((a, b) => b.daysOverdue - a.daysOverdue)

  const counts = allTasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.action] = (acc[t.action] ?? 0) + 1
    return acc
  }, {})

  const chronicallySkipped = allTasks.filter((t) => t.skipSignal === 'chronically_skipped').length

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <RotateCcw className="size-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-slate-100">Recurring Task Audit</h1>
          </div>
          <p className="mt-1 text-slate-500">
            Reviews your recurring tasks and flags ones you've been consistently skipping.
          </p>
        </div>
        <Button onClick={runAudit} loading={loading} size="lg">
          {result ? <RefreshCw className="size-4" /> : <Zap className="size-4" />}
          {result ? 'Re-audit' : 'Run Audit'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 py-24 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-blue-600/10">
            <RotateCcw className="size-8 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-200">Audit your recurring habits</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Click <strong className="text-slate-300">Run Audit</strong> to scan all your recurring tasks and find
            which ones you're actually doing vs silently ignoring.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="h-20 animate-pulse rounded-xl bg-slate-800/50" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-800/50" />
          ))}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <RotateCcw className="size-5 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">{result.totalRecurring}</div>
                <div className="text-xs text-slate-500">Recurring tasks</div>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="size-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">{result.healthyCount}</div>
                <div className="text-xs text-slate-500">Healthy habits</div>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                <AlertCircle className="size-5 text-red-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">{chronicallySkipped}</div>
                <div className="text-xs text-slate-500">Chronically skipped</div>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                <Trash2 className="size-5 text-red-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">{counts['delete'] ?? 0}</div>
                <div className="text-xs text-slate-500">Suggested deletes</div>
              </div>
            </Card>
          </div>

          {/* Summary */}
          <Card>
            <p className="text-sm leading-relaxed text-slate-400">{result.summary}</p>
          </Card>

          {/* Insights */}
          {result.insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <Lightbulb className="size-4 text-amber-400" />
                  Habit Insights
                </CardTitle>
              </CardHeader>
              <ul className="mt-3 space-y-2">
                {result.insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-400/60" />
                    {insight}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'delete', 'pause', 'reduce_frequency', 'keep'] as const).map((f) => {
              const count = f === 'all' ? allTasks.length : (counts[f] ?? 0)
              if (f !== 'all' && count === 0) return null
              return (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all',
                    activeFilter === f
                      ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                      : 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600',
                  )}
                >
                  {f !== 'all' && actionIcon(f)}
                  <span>{f === 'all' ? 'All' : actionLabel(f)}</span>
                  <span className="text-slate-600">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Task list */}
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-10 text-center">
              <CheckCircle2 className="mx-auto mb-2 size-8 text-emerald-400" />
              <p className="text-sm text-emerald-400 font-medium">
                {activeFilter === 'all' ? 'All tasks reviewed' : 'No tasks in this category'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300">
                  Recurring Tasks
                  <span className="ml-2 text-slate-600">({sorted.length} shown)</span>
                </h2>
                <p className="text-xs text-slate-600">Sorted by days overdue · Dismiss to hide</p>
              </div>
              {sorted.map((task) => (
                <RecurringTaskCard
                  key={task.taskId}
                  task={task}
                  dismissed={dismissed.has(task.taskId)}
                  onDismiss={dismiss}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
