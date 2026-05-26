'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Search, X, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { evaluateApp } from '../actions'
import type { EvaluatedAppCard } from '../actions'
import { CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import type { GenAIApp, CustomerClassification, TrustScores } from '@/lib/genai/types'

export interface CatalogEntry {
  app: GenAIApp
  score: TrustScores | null
  classification: CustomerClassification | null
  mode: 'enterprise' | 'personal'
}

interface Props {
  entries: CatalogEntry[]
  lastRunInfo: { status: string; apps_updated: number; apps_added: number } | null
  totalInDb: number
}

function RiskBadge({ score }: { score: number }) {
  if (score >= 85) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">Low Risk</span>
  if (score >= 70) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">Moderate</span>
  if (score >= 50) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Medium Risk</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">High Risk</span>
}

const APPROVAL_CHIP: Record<string, string> = {
  approved:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'under-review': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  draft:          'bg-muted/60 text-muted-foreground border-border',
  rejected:       'bg-red-500/10 text-red-400 border-red-500/20',
  expired:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

function AppCard({ app, score, classification, mode, href }: { app: GenAIApp; score: TrustScores | null; classification: CustomerClassification | null; mode: 'enterprise' | 'personal'; href: string }) {
  const cls = classification?.customer_classification ?? 'unknown'
  const clsMeta = CLASSIFICATION_LABELS[cls]
  const suggested = score?.suggested_classification ?? null
  const approvalStatus = classification?.approval_status ?? null

  return (
    <Link
      href={href}
      className="group block rounded-xl border border-border bg-card/50 p-4 hover:border-border-strong hover:bg-card transition-all shadow-sm"
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-foreground font-bold text-sm flex-shrink-0"
          style={{ backgroundColor: app.logo_bg }}
        >
          {app.logo_letter}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground group-hover:text-blue-300 transition-colors truncate">{app.app_name}</p>
          <p className="text-xs text-muted-foreground/80 truncate">{app.vendor} · {app.app_type}</p>
        </div>
        {score && <RiskBadge score={score.final_score} />}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={cn(
          'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
          mode === 'enterprise'
            ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
            : 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        )}>
          {mode === 'enterprise' ? 'Enterprise' : 'Personal'}
        </span>
        {app.app_group && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground/70 border border-border">
            {app.app_group}
          </span>
        )}
        {approvalStatus && (
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', APPROVAL_CHIP[approvalStatus] ?? APPROVAL_CHIP.draft)}>
            {approvalStatus.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">Trust Score</p>
          <div className={cn(
            'text-2xl font-bold tabular-nums',
            score!.final_score >= 85 ? 'text-green-400' :
            score!.final_score >= 70 ? 'text-blue-400' :
            score!.final_score >= 50 ? 'text-yellow-400' : 'text-red-400',
          )}>
            {score!.final_score}
            <span className="text-xs font-normal text-muted-foreground/80">/100</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">DLP Activities</p>
          <p className="text-sm font-semibold text-foreground">
            {score!.dlp_activities_supported}/{score!.dlp_activities_total}
          </p>
        </div>
      </div>

      <div className="h-1 bg-muted rounded-full mb-3 overflow-hidden">
        <div
          className={cn('h-full rounded-full',
            score!.final_score >= 85 ? 'bg-green-500' :
            score!.final_score >= 70 ? 'bg-blue-500' :
            score!.final_score >= 50 ? 'bg-yellow-500' : 'bg-red-500',
          )}
          style={{ width: `${score!.final_score}%` }}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/60">System suggests:</span>
          <span className="text-[10px] text-muted-foreground font-medium">
            {suggested ? (CLASSIFICATION_LABELS[suggested]?.label ?? '—') : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/60">Your classification:</span>
          {cls !== 'unknown' ? (
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded',
              clsMeta.color === 'green'  ? 'bg-green-500/15 text-green-400' :
              clsMeta.color === 'red'    ? 'bg-red-500/15 text-red-400' :
              clsMeta.color === 'amber'  ? 'bg-yellow-500/15 text-yellow-400' :
              clsMeta.color === 'blue'   ? 'bg-blue-500/15 text-blue-400' :
              clsMeta.color === 'purple' ? 'bg-purple-500/15 text-purple-400' :
              'bg-accent/50 text-muted-foreground',
            )}>{clsMeta.label}</span>
          ) : (
            <span className="text-[10px] text-muted-foreground/60 italic">Not set</span>
          )}
        </div>
      </div>
    </Link>
  )
}

function EvaluatingCard({ name }: { name: string }) {
  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 shadow-sm animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground/60">Evaluating…</p>
        </div>
      </div>
      <p className="text-xs text-blue-400/80 leading-relaxed">
        Running AI security evaluation — analysing enterprise posture, DLP activities, and compliance certifications. This usually takes 15–30 seconds.
      </p>
    </div>
  )
}

function NewlyEvaluatedCard({ data }: { data: EvaluatedAppCard }) {
  return (
    <Link
      href={`/genai-controls/apps/${data.app_id}`}
      className="group block rounded-xl border border-blue-500/40 bg-card/50 p-4 hover:border-blue-500/60 hover:bg-card transition-all shadow-sm relative"
    >
      <div className="absolute top-2 right-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
          <Sparkles className="w-2.5 h-2.5" />
          Just evaluated
        </span>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-foreground font-bold text-sm flex-shrink-0"
          style={{ backgroundColor: data.logo_bg }}
        >
          {data.logo_letter}
        </div>
        <div className="flex-1 min-w-0 pr-24">
          <p className="text-sm font-semibold text-foreground group-hover:text-blue-300 transition-colors truncate">{data.app_name}</p>
          <p className="text-xs text-muted-foreground/80 truncate">{data.vendor} · {data.app_type}</p>
        </div>
        <RiskBadge score={data.trustScore} />
      </div>

      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">Trust Score</p>
          <div className={cn(
            'text-2xl font-bold tabular-nums',
            data.trustScore >= 85 ? 'text-green-400' :
            data.trustScore >= 70 ? 'text-blue-400' :
            data.trustScore >= 50 ? 'text-yellow-400' : 'text-red-400',
          )}>
            {data.trustScore}
            <span className="text-xs font-normal text-muted-foreground/80">/100</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">DLP Activities</p>
          <p className="text-sm font-semibold text-foreground">
            {data.dlpActivitiesSupported}/{data.dlpActivitiesTotal}
          </p>
        </div>
      </div>

      <div className="h-1 bg-muted rounded-full mb-3 overflow-hidden">
        <div
          className={cn('h-full rounded-full',
            data.trustScore >= 85 ? 'bg-green-500' :
            data.trustScore >= 70 ? 'bg-blue-500' :
            data.trustScore >= 50 ? 'bg-yellow-500' : 'bg-red-500',
          )}
          style={{ width: `${data.trustScore}%` }}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/60">System suggests:</span>
          <span className="text-[10px] text-muted-foreground font-medium">{data.suggestedClassification}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/60">Your classification:</span>
          <span className="text-[10px] text-muted-foreground/60 italic">Not set</span>
        </div>
      </div>
    </Link>
  )
}

export function AppCatalogClient({ entries, lastRunInfo, totalInDb }: Props) {
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [evaluatedApp, setEvaluatedApp] = useState<EvaluatedAppCard | null>(null)
  const [evalError, setEvalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const trimmed = search.trim()

  const filtered = trimmed.length === 0
    ? entries
    : entries.filter(e =>
        e.app.app_name.toLowerCase().includes(trimmed.toLowerCase()) ||
        e.app.vendor.toLowerCase().includes(trimmed.toLowerCase()) ||
        e.app.domain.toLowerCase().includes(trimmed.toLowerCase()),
      )

  const showNotFound = trimmed.length > 2 && filtered.length === 0 && !isPending && !evaluatedApp

  function handleEvaluate() {
    setEvalError(null)
    setEvaluatedApp(null)
    startTransition(async () => {
      const result = await evaluateApp(trimmed)
      if (result.error) setEvalError(result.error)
      else if (result.data) setEvaluatedApp(result.data)
    })
  }

  function clearSearch() {
    setSearch('')
    setEvaluatedApp(null)
    setEvalError(null)
    inputRef.current?.focus()
  }

  // When a new evaluation result appears, clear the search so the card shows in main grid
  useEffect(() => {
    if (evaluatedApp) setSearch('')
  }, [evaluatedApp])

  const scoredCount = entries.length
  const pendingCount = totalInDb - scoredCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">App Catalog</h1>
          <p className="text-sm text-muted-foreground/80 mt-1">
            {scoredCount} fully evaluated GenAI applications.
            {pendingCount > 0 && (
              <span className="text-muted-foreground/50"> · {pendingCount} pending evaluation</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Low Risk</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Moderate</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Medium</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />High</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            {lastRunInfo ? (
              <>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  lastRunInfo.status === 'completed' ? 'bg-green-500' :
                  lastRunInfo.status === 'failed'    ? 'bg-red-500'   : 'bg-yellow-500 animate-pulse',
                )} />
                <span>Last refresh: {lastRunInfo.apps_updated} updated · {lastRunInfo.apps_added} added</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span>No refresh runs yet</span>
              </>
            )}
            <Link href="/genai-controls/refresh-logs" className="underline hover:text-muted-foreground/80 transition-colors ml-1">
              View logs →
            </Link>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => {
            setSearch(e.target.value)
            setEvaluatedApp(null)
            setEvalError(null)
          }}
          placeholder="Search apps by name, vendor, or domain…"
          className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-border bg-card/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border-strong focus:bg-card transition-all"
        />
        {trimmed.length > 0 && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Evaluating card */}
      {isPending && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <EvaluatingCard name={trimmed} />
        </div>
      )}

      {/* Newly evaluated result (shown above the grid) */}
      {evaluatedApp && !isPending && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-2">Evaluation Result</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <NewlyEvaluatedCard data={evaluatedApp} />
          </div>
        </div>
      )}

      {/* Not found + evaluate CTA */}
      {showNotFound && (
        <div className="rounded-xl border border-border bg-card/30 px-6 py-8 text-center space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">"{trimmed}" is not in the catalog yet</p>
            <p className="text-xs text-muted-foreground/70">
              Run an AI evaluation to assess this application's enterprise security posture, DLP activity support, and data governance controls.
            </p>
          </div>
          <button
            onClick={handleEvaluate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Evaluate "{trimmed}"
          </button>
          {evalError && (
            <p className="text-xs text-red-400 mt-2">{evalError}</p>
          )}
        </div>
      )}

      {/* App grid */}
      {!isPending && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(({ app, score, classification, mode }) => (
            <AppCard
              key={`${app.app_id}-${mode}`}
              app={app}
              score={score}
              classification={classification}
              mode={mode}
              href={`/genai-controls/apps/${app.app_id}`}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && !isPending && !showNotFound && trimmed.length > 0 && (
        <p className="text-sm text-muted-foreground/60 text-center py-8">
          No results for "{trimmed}"
        </p>
      )}

      {entries.length === 0 && trimmed.length === 0 && !isPending && (
        <div className="text-center py-16 text-muted-foreground/60">
          <p className="text-sm">No evaluated apps yet. Use the search above to evaluate your first app.</p>
        </div>
      )}
    </div>
  )
}
