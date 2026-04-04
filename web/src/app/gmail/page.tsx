'use client'

import { useState } from 'react'
import {
  Mail, Zap, RefreshCw, AlertCircle, CheckCheck,
  Clock, ArrowUpCircle, Plus, Check, ExternalLink,
} from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { GmailScanResult, EmailSuggestion } from '../api/gmail/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urgencyBadge(urgency: EmailSuggestion['urgency']) {
  switch (urgency) {
    case 'high': return <Badge variant="danger">Today</Badge>
    case 'medium': return <Badge variant="warning">This week</Badge>
    case 'low': return <Badge variant="muted">Someday</Badge>
  }
}

function fromName(from: string) {
  // "John Smith <john@example.com>" → "John Smith"
  const match = from.match(/^([^<]+)</)
  return match ? match[1].trim() : from.replace(/<[^>]+>/, '').trim()
}

// ─── Suggestion card ──────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  selected,
  added,
  onToggle,
}: {
  suggestion: EmailSuggestion
  selected: boolean
  added: boolean
  onToggle: (id: string) => void
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all',
      added ? 'border-emerald-500/30 bg-emerald-500/5 opacity-60'
        : selected ? 'border-indigo-500/50 bg-indigo-500/5'
        : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600/50',
    )}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => !added && onToggle(suggestion.emailId)}
          disabled={added}
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition-all',
            added ? 'border-emerald-500 bg-emerald-500'
              : selected ? 'border-indigo-500 bg-indigo-500'
              : 'border-slate-600 hover:border-indigo-400',
          )}
        >
          {(selected || added) && <Check className="size-3 text-white" />}
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          {/* Email meta */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-medium text-slate-200 leading-snug">{suggestion.subject}</p>
              <p className="text-xs text-slate-500 mt-0.5">from {fromName(suggestion.from)}</p>
            </div>
            {urgencyBadge(suggestion.urgency)}
          </div>

          {/* Email snippet */}
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{suggestion.snippet}</p>

          {/* Suggested task */}
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Plus className="size-3 text-indigo-400" />
              <span className="text-xs font-medium text-indigo-400">Suggested task</span>
            </div>
            <p className="text-sm text-slate-300">{suggestion.suggestedTask}</p>
          </div>

          {/* Reason */}
          <p className="text-xs text-slate-500 italic">{suggestion.reason}</p>

          {added && (
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <Check className="size-3" /> Added to Todoist
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Not connected state ──────────────────────────────────────────────────────

function NotConnected() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 py-24 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-red-600/10">
        <Mail className="size-8 text-red-400" />
      </div>
      <h2 className="text-lg font-semibold text-slate-200">Google not connected</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Connect your Google account to scan Gmail for actionable emails.
      </p>
      <a
        href="/api/auth/google"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
      >
        <ExternalLink className="size-4" />
        Connect Google Account
      </a>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GmailPage() {
  const [result, setResult] = useState<GmailScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notConnected, setNotConnected] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [added, setAdded] = useState<Set<string>>(new Set())

  async function scan() {
    setLoading(true)
    setError(null)
    setSelected(new Set())
    setAdded(new Set())
    try {
      const res = await fetch('/api/gmail')
      const data = await res.json()
      if (res.status === 403) { setNotConnected(true); return }
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')
      setResult(data)
      // Auto-select high urgency items
      const highIds = new Set<string>(data.suggestions.filter((s: EmailSuggestion) => s.urgency === 'high').map((s: EmailSuggestion) => s.emailId))
      setSelected(highIds)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to scan Gmail')
    } finally {
      setLoading(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function applySelected() {
    if (!result || selected.size === 0) return
    setApplying(true)
    try {
      const tasks = result.suggestions
        .filter((s) => selected.has(s.emailId))
        .map((s) => ({ content: s.suggestedTask, urgency: s.urgency }))

      const res = await fetch('/api/gmail/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Mark as added
      setAdded((prev) => new Set([...prev, ...selected]))
      setSelected(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tasks')
    } finally {
      setApplying(false)
    }
  }

  const suggestions = result?.suggestions ?? []
  const pendingSelected = [...selected].filter((id) => !added.has(id))

  if (notConnected) return (
    <div className="min-h-screen p-8">
      <div className="mb-8 flex items-center gap-3">
        <Mail className="size-6 text-red-400" />
        <h1 className="text-2xl font-bold text-slate-100">Gmail Scanner</h1>
      </div>
      <NotConnected />
    </div>
  )

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Mail className="size-6 text-red-400" />
            <h1 className="text-2xl font-bold text-slate-100">Gmail Scanner</h1>
          </div>
          <p className="mt-1 text-slate-500">
            Scans your recent inbox for actionable emails and suggests Todoist tasks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingSelected.length > 0 && (
            <Button onClick={applySelected} loading={applying} variant="primary">
              <Plus className="size-4" />
              Add {pendingSelected.length} to Todoist
            </Button>
          )}
          <Button onClick={scan} loading={loading} size="lg" variant={result ? 'secondary' : 'primary'}>
            {result ? <RefreshCw className="size-4" /> : <Zap className="size-4" />}
            {result ? 'Re-scan' : 'Scan Inbox'}
          </Button>
        </div>
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
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-red-600/10">
            <Mail className="size-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-200">Turn emails into tasks</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Click <strong className="text-slate-300">Scan Inbox</strong> to analyse your last 48 hours of email
            and extract anything that needs action.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-800/50" />
          ))}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-500/10">
                <Mail className="size-5 text-slate-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">{result.scanned}</div>
                <div className="text-xs text-slate-500">Emails scanned</div>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                <ArrowUpCircle className="size-5 text-indigo-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">{result.actionable}</div>
                <div className="text-xs text-slate-500">Actionable</div>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCheck className="size-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">{added.size}</div>
                <div className="text-xs text-slate-500">Added to Todoist</div>
              </div>
            </Card>
          </div>

          {/* Summary */}
          <Card>
            <p className="text-sm text-slate-400">{result.summary}</p>
            {suggestions.length > 0 && (
              <p className="mt-2 text-xs text-slate-600">
                <Clock className="inline size-3 mr-1" />
                High-urgency items are pre-selected. Check the ones you want to add, then click "Add to Todoist".
              </p>
            )}
          </Card>

          {/* Suggestions */}
          {suggestions.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-12 text-center">
              <CheckCheck className="mx-auto mb-2 size-8 text-emerald-400" />
              <p className="text-sm text-emerald-400 font-medium">Inbox zero — no actionable emails found</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300">
                  Actionable Emails
                  <span className="ml-2 text-slate-600">({suggestions.length})</span>
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelected(new Set(suggestions.filter(s => !added.has(s.emailId)).map(s => s.emailId)))}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Select all
                  </button>
                  <span className="text-slate-700">·</span>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.emailId}
                  suggestion={s}
                  selected={selected.has(s.emailId)}
                  added={added.has(s.emailId)}
                  onToggle={toggleSelect}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
