'use client'

import { useState, useTransition, useRef, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Search, X, Loader2, Sparkles, LayoutList, LayoutGrid, ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight, Settings2, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { evaluateApp } from '../actions'
import type { EvaluatedAppCard } from '../actions'
import { AppLogo } from './app-logo'
import { CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import type { GenAIApp, CustomerClassification, TrustScores } from '@/lib/genai/types'

export interface CatalogEntry {
  app: GenAIApp
  score: TrustScores | null
  classification: CustomerClassification | null
}

interface Props {
  entries: CatalogEntry[]
  lastRunInfo: { status: string; apps_updated: number; apps_added: number } | null
  totalInDb: number
}

const PAGE_SIZE = 20

// ── Shared helpers ────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  return s >= 85 ? 'text-green-400' : s >= 70 ? 'text-blue-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400'
}
function scoreBarColor(s: number) {
  return s >= 85 ? 'bg-green-500' : s >= 70 ? 'bg-blue-500' : s >= 50 ? 'bg-yellow-500' : 'bg-red-500'
}
function riskLabel(s: number) {
  return s >= 85 ? 'Low Risk' : s >= 70 ? 'Moderate' : s >= 50 ? 'Medium Risk' : 'High Risk'
}
function riskColors(s: number) {
  return s >= 85
    ? 'bg-green-500/10 text-green-400 border-green-500/20'
    : s >= 70
    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    : s >= 50
    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    : 'bg-red-500/10 text-red-400 border-red-500/20'
}

function RiskBadge({ score }: { score: number }) {
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap', riskColors(score))}>
      {riskLabel(score)}
    </span>
  )
}

const CLS_CHIP: Record<string, string> = {
  approved:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'under-review': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  draft:          'bg-muted/60 text-muted-foreground border-border',
  rejected:       'bg-red-500/10 text-red-400 border-red-500/20',
  expired:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

// ── Column definitions ────────────────────────────────────────────────────────

const ALL_COLUMNS = ['score', 'dlp', 'risk', 'category', 'classification'] as const
type ColKey = typeof ALL_COLUMNS[number]
const COL_LABELS: Record<ColKey, string> = {
  score:          'Trust Score',
  dlp:            'DLP',
  risk:           'Risk',
  category:       'Category',
  classification: 'Classification',
}

// ── Sorting ───────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'score' | 'dlp'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sort }: { col: SortKey; sort: { key: SortKey; dir: SortDir } }) {
  if (sort.key !== col) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/30" />
  return sort.dir === 'asc'
    ? <ChevronUp   className="w-3 h-3 text-foreground/70" />
    : <ChevronDown className="w-3 h-3 text-foreground/70" />
}

// ── Table row ─────────────────────────────────────────────────────────────────

function TableRow({ app, score, classification, visibleCols }: CatalogEntry & { visibleCols: Set<ColKey> }) {
  const cls     = classification?.customer_classification ?? 'unknown'
  const clsMeta = CLASSIFICATION_LABELS[cls]
  const approval = classification?.approval_status ?? null
  const s = score?.final_score ?? 0

  // Build grid template based on visible columns
  const colTemplate = [
    'minmax(0,2fr)',
    visibleCols.has('score')          ? '100px' : null,
    visibleCols.has('dlp')            ? '56px'  : null,
    visibleCols.has('risk')           ? '108px' : null,
    visibleCols.has('category')       ? 'minmax(0,1fr)' : null,
    visibleCols.has('classification') ? 'minmax(0,1fr)' : null,
    '24px',
  ].filter(Boolean).join(' ')

  return (
    <Link
      href={`/genai-controls/apps/${app.app_id}`}
      className="group grid items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/10 transition-colors"
      style={{ gridTemplateColumns: colTemplate }}
    >
      {/* App */}
      <div className="flex items-center gap-3 min-w-0">
        <AppLogo domain={app.domain} letter={app.logo_letter} bg={app.logo_bg} size={32} radius="rounded-lg" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors truncate">{app.app_name}</p>
          <p className="text-xs text-muted-foreground/60 truncate">{app.vendor}</p>
        </div>
      </div>

      {visibleCols.has('score') && (
        <div>
          <div className="flex items-baseline gap-0.5 mb-1">
            <span className={cn('text-sm font-bold tabular-nums', scoreColor(s))}>{s}</span>
            <span className="text-[10px] text-muted-foreground/50">/100</span>
          </div>
          <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', scoreBarColor(s))} style={{ width: `${s}%` }} />
          </div>
        </div>
      )}

      {visibleCols.has('dlp') && (
        <div className="text-center">
          <span className={cn('text-sm font-semibold tabular-nums',
            (score?.dlp_activities_supported ?? 0) >= 5 ? 'text-green-400' :
            (score?.dlp_activities_supported ?? 0) >= 3 ? 'text-yellow-400' : 'text-red-400',
          )}>
            {score?.dlp_activities_supported ?? '—'}/{score?.dlp_activities_total ?? 7}
          </span>
        </div>
      )}

      {visibleCols.has('risk') && <div><RiskBadge score={s} /></div>}

      {visibleCols.has('category') && (
        <div className="min-w-0">
          <p className="text-xs text-foreground/70 truncate">{app.app_group ?? app.app_type}</p>
        </div>
      )}

      {visibleCols.has('classification') && (
        <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
          {approval && (
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', CLS_CHIP[approval] ?? CLS_CHIP.draft)}>
              {approval.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          )}
          {cls !== 'unknown' ? (
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded',
              clsMeta.color === 'green'  ? 'bg-green-500/10 text-green-400' :
              clsMeta.color === 'red'    ? 'bg-red-500/10 text-red-400' :
              clsMeta.color === 'amber'  ? 'bg-yellow-500/10 text-yellow-400' :
              clsMeta.color === 'blue'   ? 'bg-blue-500/10 text-blue-400' :
              clsMeta.color === 'purple' ? 'bg-purple-500/10 text-purple-400' :
              'bg-muted/40 text-muted-foreground',
            )}>{clsMeta.label}</span>
          ) : (
            <span className="text-[10px] text-muted-foreground/40 italic">Not set</span>
          )}
        </div>
      )}

      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors shrink-0" />
    </Link>
  )
}

// ── Table header ──────────────────────────────────────────────────────────────

function TableHeader({ sort, onSort, visibleCols }: {
  sort: { key: SortKey; dir: SortDir }
  onSort: (k: SortKey) => void
  visibleCols: Set<ColKey>
}) {
  const colTemplate = [
    'minmax(0,2fr)',
    visibleCols.has('score')          ? '100px' : null,
    visibleCols.has('dlp')            ? '56px'  : null,
    visibleCols.has('risk')           ? '108px' : null,
    visibleCols.has('category')       ? 'minmax(0,1fr)' : null,
    visibleCols.has('classification') ? 'minmax(0,1fr)' : null,
    '24px',
  ].filter(Boolean).join(' ')

  return (
    <div
      className="grid gap-3 px-4 py-2.5 bg-card/80 border-b border-border text-[11px] text-muted-foreground/50 uppercase tracking-wide"
      style={{ gridTemplateColumns: colTemplate }}
    >
      <button className="flex items-center gap-1 hover:text-foreground/70 transition-colors text-left" onClick={() => onSort('name')}>
        App <SortIcon col="name" sort={sort} />
      </button>
      {visibleCols.has('score') && (
        <button className="flex items-center gap-1 hover:text-foreground/70 transition-colors" onClick={() => onSort('score')}>
          Score <SortIcon col="score" sort={sort} />
        </button>
      )}
      {visibleCols.has('dlp') && (
        <button className="flex items-center gap-1 hover:text-foreground/70 transition-colors" onClick={() => onSort('dlp')}>
          DLP <SortIcon col="dlp" sort={sort} />
        </button>
      )}
      {visibleCols.has('risk')           && <span>Risk</span>}
      {visibleCols.has('category')       && <span>Category</span>}
      {visibleCols.has('classification') && <span>Classification</span>}
      <span />
    </div>
  )
}

// ── Card view ─────────────────────────────────────────────────────────────────

function AppCard({ app, score, classification }: CatalogEntry) {
  const cls = classification?.customer_classification ?? 'unknown'
  const clsMeta = CLASSIFICATION_LABELS[cls]
  const approval = classification?.approval_status ?? null
  const s = score?.final_score ?? 0

  return (
    <Link
      href={`/genai-controls/apps/${app.app_id}`}
      className="group block rounded-xl border border-border bg-card/50 p-4 hover:border-border-strong hover:bg-card transition-all shadow-sm"
    >
      <div className="flex items-start gap-3 mb-3">
        <AppLogo domain={app.domain} letter={app.logo_letter} bg={app.logo_bg} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground group-hover:text-blue-300 transition-colors truncate">{app.app_name}</p>
          <p className="text-xs text-muted-foreground/80 truncate">{app.vendor} · {app.app_type}</p>
        </div>
        <RiskBadge score={s} />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {app.app_group && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground/70 border border-border">{app.app_group}</span>
        )}
        {approval && (
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', CLS_CHIP[approval] ?? CLS_CHIP.draft)}>
            {approval.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">Trust Score</p>
          <div className={cn('text-2xl font-bold tabular-nums', scoreColor(s))}>
            {s}<span className="text-xs font-normal text-muted-foreground/80">/100</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">DLP Activities</p>
          <p className="text-sm font-semibold text-foreground">{score?.dlp_activities_supported ?? '—'}/{score?.dlp_activities_total ?? 7}</p>
        </div>
      </div>
      <div className="h-1 bg-muted rounded-full mb-3 overflow-hidden">
        <div className={cn('h-full rounded-full', scoreBarColor(s))} style={{ width: `${s}%` }} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground/60">Classification:</span>
        {cls !== 'unknown' ? (
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
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
    </Link>
  )
}

// ── Evaluate states ───────────────────────────────────────────────────────────

function EvaluatingRow({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-blue-500/20 bg-blue-500/5 animate-pulse">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-blue-400/80">Running AI security evaluation — usually 15–30 seconds…</p>
        </div>
      </div>
    </div>
  )
}

// ── Filter select ─────────────────────────────────────────────────────────────

function FilterSelect({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'appearance-none pl-2.5 pr-6 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer focus:outline-none',
          value !== 'all'
            ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
            : 'border-border bg-card/50 text-foreground/70 hover:border-border-strong hover:text-foreground',
        )}
      >
        <option value="all">{label}: All</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
    </div>
  )
}

// ── Column picker (gear) ──────────────────────────────────────────────────────

function ColumnPicker({ visibleCols, onChange }: {
  visibleCols: Set<ColKey>
  onChange: (cols: Set<ColKey>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(col: ColKey) {
    const next = new Set(visibleCols)
    if (next.has(col)) {
      if (next.size > 1) next.delete(col)
    } else {
      next.add(col)
    }
    onChange(next)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'p-1.5 rounded-lg border transition-colors',
          open ? 'border-border-strong bg-muted text-foreground' : 'border-border bg-card/50 text-muted-foreground/60 hover:text-foreground hover:border-border-strong',
        )}
        title="Customize columns"
      >
        <Settings2 className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-border bg-card shadow-lg p-2 space-y-0.5">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide px-2 pb-1.5">Columns</p>
          {ALL_COLUMNS.map(col => (
            <button
              key={col}
              onClick={() => toggle(col)}
              className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg hover:bg-muted/40 transition-colors text-left"
            >
              <div className={cn(
                'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors',
                visibleCols.has(col) ? 'border-blue-500 bg-blue-500' : 'border-border',
              )}>
                {visibleCols.has(col) && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-foreground/80">{COL_LABELS[col]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, total, perPage, onChange }: {
  page: number
  total: number
  perPage: number
  onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null

  const start = (page - 1) * perPage + 1
  const end   = Math.min(page * perPage, total)

  // Build page numbers to show: always show first, last, current ±1
  const pages: (number | '...')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <div className="flex items-center justify-between px-1 py-3">
      <p className="text-xs text-muted-foreground/60">
        {start}–{end} of {total} apps
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg border border-border text-muted-foreground/60 hover:text-foreground hover:border-border-strong disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-muted-foreground/40">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={cn(
                'min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-medium transition-colors',
                p === page
                  ? 'bg-blue-600 text-white border border-blue-600'
                  : 'border border-border text-muted-foreground/70 hover:text-foreground hover:border-border-strong',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg border border-border text-muted-foreground/60 hover:text-foreground hover:border-border-strong disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function AppCatalogClient({ entries, lastRunInfo, totalInDb }: Props) {
  const [search,       setSearch]       = useState('')
  const [view,         setView]         = useState<'table' | 'grid'>('table')
  const [sort,         setSort]         = useState<{ key: SortKey; dir: SortDir }>({ key: 'name', dir: 'asc' })
  const [filterRisk,   setFilterRisk]   = useState('all')
  const [filterCls,    setFilterCls]    = useState('all')
  const [filterGroup,  setFilterGroup]  = useState('all')
  const [page,         setPage]         = useState(1)
  const [visibleCols,  setVisibleCols]  = useState<Set<ColKey>>(new Set(ALL_COLUMNS))
  const [isPending,    startTransition] = useTransition()
  const [evaluatedApp, setEvaluatedApp] = useState<EvaluatedAppCard | null>(null)
  const [evalError,    setEvalError]    = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const trimmed = search.trim()

  // Canonical app_group options derived from data
  const groupOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const { app } of entries) if (app.app_group) seen.add(app.app_group)
    return [...seen].sort().map(v => ({ value: v, label: v }))
  }, [entries])

  // Filter
  const filtered = useMemo(() => {
    return entries.filter(({ app, score, classification }) => {
      const s   = score?.final_score ?? 0
      const cls = classification?.customer_classification ?? 'unknown'
      if (trimmed.length > 0) {
        const q = trimmed.toLowerCase()
        if (!app.app_name.toLowerCase().includes(q) && !app.vendor.toLowerCase().includes(q) && !app.domain.toLowerCase().includes(q)) return false
      }
      if (filterRisk !== 'all') {
        if (filterRisk === 'low'      && s < 85)              return false
        if (filterRisk === 'moderate' && (s < 70 || s >= 85)) return false
        if (filterRisk === 'medium'   && (s < 50 || s >= 70)) return false
        if (filterRisk === 'high'     && s >= 50)             return false
      }
      if (filterCls !== 'all') {
        if (filterCls === 'not-set' && cls !== 'unknown') return false
        if (filterCls !== 'not-set' && cls !== filterCls) return false
      }
      if (filterGroup !== 'all' && app.app_group !== filterGroup) return false
      return true
    })
  }, [entries, trimmed, filterRisk, filterCls, filterGroup])

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let diff = 0
      if (sort.key === 'name')  diff = a.app.app_name.localeCompare(b.app.app_name)
      if (sort.key === 'score') diff = (a.score?.final_score ?? 0) - (b.score?.final_score ?? 0)
      if (sort.key === 'dlp')   diff = (a.score?.dlp_activities_supported ?? 0) - (b.score?.dlp_activities_supported ?? 0)
      return sort.dir === 'asc' ? diff : -diff
    })
  }, [filtered, sort])

  const totalPages   = Math.ceil(sorted.length / PAGE_SIZE)
  const pagedEntries = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const activeFilters = [filterRisk, filterCls, filterGroup].filter(f => f !== 'all').length

  function toggleSort(key: SortKey) {
    setPage(1)
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'name' ? 'asc' : 'desc' },
    )
  }

  const resetPage = useCallback(() => setPage(1), [])

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

  function clearAllFilters() {
    setFilterRisk('all')
    setFilterCls('all')
    setFilterGroup('all')
    setPage(1)
  }

  useEffect(() => { if (evaluatedApp) setSearch('') }, [evaluatedApp])
  useEffect(() => { setPage(1) }, [filterRisk, filterCls, filterGroup, trimmed])

  const scoredCount  = entries.length
  const pendingCount = totalInDb - scoredCount
  const showNotFound = trimmed.length > 2 && filtered.length === 0 && !isPending && !evaluatedApp

  const clsFilterOptions = [
    { value: 'not-set',                  label: 'Not Set' },
    { value: 'enterprise-approved',      label: 'Approved' },
    { value: 'approved-with-conditions', label: 'Approved w/ Conditions' },
    { value: 'permitted-with-restriction', label: 'Restricted' },
    { value: 'personal',                 label: 'Personal Only' },
    { value: 'prohibited',               label: 'Prohibited' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">App Catalog</h1>
          <p className="text-sm text-muted-foreground/80 mt-0.5">
            {scoredCount} fully evaluated GenAI applications
            {pendingCount > 0 && <span className="text-muted-foreground/50"> · {pendingCount} pending</span>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0 text-xs text-muted-foreground/60">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Low Risk</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Moderate</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Medium</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />High</span>
          </div>
          <div className="flex items-center gap-2">
            {lastRunInfo ? (
              <>
                <span className={cn('w-1.5 h-1.5 rounded-full',
                  lastRunInfo.status === 'completed' ? 'bg-green-500' :
                  lastRunInfo.status === 'failed'    ? 'bg-red-500' : 'bg-yellow-500 animate-pulse',
                )} />
                <span>Last refresh: {lastRunInfo.apps_updated} updated · {lastRunInfo.apps_added} added</span>
              </>
            ) : (
              <><span className="w-1.5 h-1.5 rounded-full bg-accent" /><span>No refresh runs yet</span></>
            )}
            <Link href="/genai-controls/refresh-logs" className="underline hover:text-muted-foreground/80 ml-1">View logs →</Link>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setEvaluatedApp(null); setEvalError(null) }}
            placeholder="Search by name, vendor, or domain…"
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-border bg-card/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border-strong focus:bg-card transition-all"
          />
          {trimmed.length > 0 && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground/70">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <FilterSelect label="Risk" value={filterRisk} options={[
          { value: 'low',      label: 'Low Risk (≥85)'   },
          { value: 'moderate', label: 'Moderate (70–84)' },
          { value: 'medium',   label: 'Medium (50–69)'   },
          { value: 'high',     label: 'High Risk (<50)'  },
        ]} onChange={v => { setFilterRisk(v); resetPage() }} />

        <FilterSelect label="Classification" value={filterCls} options={clsFilterOptions} onChange={v => { setFilterCls(v); resetPage() }} />

        {groupOptions.length > 1 && (
          <FilterSelect label="Category" value={filterGroup} options={groupOptions} onChange={v => { setFilterGroup(v); resetPage() }} />
        )}

        {activeFilters > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground/70 hover:text-foreground border border-border hover:border-border-strong transition-colors"
          >
            <X className="w-3 h-3" />
            Clear ({activeFilters})
          </button>
        )}

        {/* Spacer */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Column picker (table only) */}
          {view === 'table' && (
            <ColumnPicker visibleCols={visibleCols} onChange={setVisibleCols} />
          )}

          {/* View toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card/50 p-1">
            <button
              onClick={() => setView('table')}
              className={cn('p-1.5 rounded-md transition-colors', view === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground/50 hover:text-foreground/70')}
              title="Table view"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={cn('p-1.5 rounded-md transition-colors', view === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground/50 hover:text-foreground/70')}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Result count when filtered */}
      {(activeFilters > 0 || trimmed.length > 0) && !showNotFound && (
        <p className="text-xs text-muted-foreground/60">
          Showing {sorted.length} of {scoredCount} apps
        </p>
      )}

      {/* Evaluating */}
      {isPending && view === 'table' && (
        <div className="rounded-xl border border-border overflow-hidden">
          <EvaluatingRow name={trimmed} />
        </div>
      )}
      {isPending && view === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <div><p className="text-sm font-semibold text-foreground">{trimmed}</p><p className="text-xs text-blue-400/80">Evaluating…</p></div>
            </div>
          </div>
        </div>
      )}

      {/* New evaluation result */}
      {evaluatedApp && !isPending && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-2">Evaluation Result</p>
          <Link
            href={`/genai-controls/apps/${evaluatedApp.app_id}`}
            className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-500/40 bg-card/50 hover:bg-card transition-all"
          >
            <AppLogo domain={evaluatedApp.domain} letter={evaluatedApp.logo_letter} bg={evaluatedApp.logo_bg} size={32} radius="rounded-lg" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{evaluatedApp.app_name}</p>
              <p className="text-xs text-muted-foreground/60">{evaluatedApp.vendor} · {evaluatedApp.app_type}</p>
            </div>
            <span className={cn('text-sm font-bold tabular-nums', scoreColor(evaluatedApp.trustScore))}>{evaluatedApp.trustScore}/100</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />Just evaluated
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
          </Link>
        </div>
      )}

      {/* Not found CTA */}
      {showNotFound && (
        <div className="rounded-xl border border-border bg-card/30 px-6 py-8 text-center space-y-4">
          <p className="text-sm font-semibold text-foreground">"{trimmed}" is not in the catalog yet</p>
          <p className="text-xs text-muted-foreground/70 max-w-md mx-auto">
            Run an AI evaluation to assess this application's enterprise security posture, DLP activity support, and data governance controls.
          </p>
          <button onClick={handleEvaluate} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
            <Sparkles className="w-4 h-4" />
            Evaluate "{trimmed}"
          </button>
          {evalError && <p className="text-xs text-red-400">{evalError}</p>}
        </div>
      )}

      {/* ── Table view ── */}
      {!isPending && view === 'table' && sorted.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <TableHeader sort={sort} onSort={toggleSort} visibleCols={visibleCols} />
          <div>
            {pagedEntries.map(entry => (
              <TableRow key={entry.app.app_id} {...entry} visibleCols={visibleCols} />
            ))}
          </div>
          <div className="px-4 border-t border-border/60 bg-card/40">
            <Pagination page={page} total={sorted.length} perPage={PAGE_SIZE} onChange={setPage} />
          </div>
        </div>
      )}

      {/* ── Grid view ── */}
      {!isPending && view === 'grid' && sorted.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pagedEntries.map(entry => (
              <AppCard key={entry.app.app_id} {...entry} />
            ))}
          </div>
          <Pagination page={page} total={sorted.length} perPage={PAGE_SIZE} onChange={setPage} />
        </>
      )}

      {/* Empty states */}
      {!isPending && !showNotFound && sorted.length === 0 && entries.length > 0 && (
        <div className="text-center py-12 text-muted-foreground/60">
          <p className="text-sm">No apps match the current filters.</p>
          <button onClick={clearAllFilters} className="text-xs text-blue-400 hover:text-blue-300 mt-2 underline">Clear all filters</button>
        </div>
      )}
      {entries.length === 0 && trimmed.length === 0 && !isPending && (
        <div className="text-center py-16 text-muted-foreground/60">
          <p className="text-sm">No evaluated apps yet. Use the search above to evaluate your first app.</p>
        </div>
      )}
    </div>
  )
}
