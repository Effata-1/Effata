'use client'

import { useState, useTransition, useRef, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, X, Loader2, Sparkles, LayoutList, LayoutGrid,
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight,
  Settings2, ChevronLeft, Tag, AlertTriangle, Lightbulb,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { evaluateApp, bulkSetClassification } from '../actions'
import type { EvaluatedAppCard } from '../actions'
import { AppLogo } from './app-logo'
import { CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import { FilterSelect, MultiFilterSelect } from '@/components/ui/filter-select'
import type { GenAIApp, CustomerClassification, TrustScores, CustomerClass } from '@/lib/genai/types'

export interface CatalogEntry {
  app: GenAIApp
  score: TrustScores | null
  classification: CustomerClassification | null
}

interface Props {
  entries: CatalogEntry[]
  totalInDb: number
  orgCategories?: { system_tag: string | null; name: string }[]
}

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100]

// ── Colour helpers ────────────────────────────────────────────────────────────

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

function clsColorClass(color: string) {
  if (color === 'green')  return 'bg-green-500/10 text-green-400'
  if (color === 'red')    return 'bg-red-500/10 text-red-400'
  if (color === 'amber')  return 'bg-yellow-500/10 text-yellow-400'
  if (color === 'blue')   return 'bg-blue-500/10 text-blue-400'
  if (color === 'purple') return 'bg-purple-500/10 text-purple-400'
  return 'bg-muted/40 text-muted-foreground'
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

// Default column widths in pixels (name is special — fills remaining space via flex)
type ColWidths = Record<ColKey, number>
const DEFAULT_COL_WIDTHS: ColWidths = {
  score:          110,
  dlp:            68,
  risk:           118,
  category:       170,
  classification: 210,
}
const NAME_COL_MIN = 180  // px minimum for App column

// ── Sorting ───────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'score' | 'dlp'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sort }: { col: SortKey; sort: { key: SortKey; dir: SortDir } }) {
  if (sort.key !== col) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/30" />
  return sort.dir === 'asc'
    ? <ChevronUp   className="w-3 h-3 text-foreground/70" />
    : <ChevronDown className="w-3 h-3 text-foreground/70" />
}

// ── Resize handle ─────────────────────────────────────────────────────────────

function ResizeHandle({ onDragStart }: { onDragStart: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onDragStart}
      className="absolute right-0 top-0 h-full w-4 cursor-col-resize flex items-center justify-center group/rh select-none z-10"
      onClick={e => e.stopPropagation()}
    >
      <div className="w-px h-4 bg-border group-hover/rh:bg-blue-400/60 group-hover/rh:w-0.5 transition-all" />
    </div>
  )
}

// ── Row checkbox ──────────────────────────────────────────────────────────────

function RowCheckbox({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={e => { e.stopPropagation(); onClick() }}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.stopPropagation(); onClick() } }}
      className={cn(
        'w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors',
        checked ? 'border-blue-500 bg-blue-500' : 'border-border hover:border-border-strong',
      )}
    >
      {checked && (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

// ── Table row ─────────────────────────────────────────────────────────────────

function TableRow({
  app, score, classification, visibleCols, colWidths, selected, onSelect,
}: CatalogEntry & {
  visibleCols: Set<ColKey>
  colWidths: ColWidths
  selected: boolean
  onSelect: (id: string) => void
}) {
  const router   = useRouter()
  const cls      = classification?.customer_classification ?? 'unknown'
  const clsMeta  = CLASSIFICATION_LABELS[cls]
  const approval = classification?.approval_status ?? null
  const s        = score?.final_score ?? 0

  return (
    <div
      role="row"
      onClick={() => router.push(`/genai-controls/apps/${app.app_id}`)}
      className={cn(
        'group flex items-center gap-0 border-b border-border/40 hover:bg-muted/10 transition-colors cursor-pointer',
        selected && 'bg-blue-500/5',
      )}
    >
      {/* Checkbox */}
      <div className="w-8 px-2 shrink-0 flex items-center justify-center py-3">
        <RowCheckbox checked={selected} onClick={() => onSelect(app.app_id)} />
      </div>

      {/* App name (fills remaining space) */}
      <div className="flex-1 min-w-0 flex items-center gap-3 px-3 py-3" style={{ minWidth: NAME_COL_MIN }}>
        <AppLogo domain={app.domain} letter={app.logo_letter} bg={app.logo_bg} logoUrl={app.logo_url} size={32} radius="rounded-lg" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors truncate">{app.app_name}</p>
          <p className="text-xs text-muted-foreground/60 truncate">{app.vendor}</p>
        </div>
      </div>

      {visibleCols.has('score') && (
        <div className="shrink-0 px-3 py-3" style={{ width: colWidths.score }}>
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
        <div className="shrink-0 flex items-center justify-center px-3 py-3" style={{ width: colWidths.dlp }}>
          <span className={cn('text-sm font-semibold tabular-nums',
            (score?.dlp_activities_supported ?? 0) >= 5 ? 'text-green-400' :
            (score?.dlp_activities_supported ?? 0) >= 3 ? 'text-yellow-400' : 'text-red-400',
          )}>
            {score?.dlp_activities_supported ?? '—'}/{score?.dlp_activities_total ?? 7}
          </span>
        </div>
      )}

      {visibleCols.has('risk') && (
        <div className="shrink-0 flex items-center px-3 py-3" style={{ width: colWidths.risk }}>
          <RiskBadge score={s} />
        </div>
      )}

      {visibleCols.has('category') && (
        <div className="shrink-0 flex items-center min-w-0 px-3 py-3" style={{ width: colWidths.category }}>
          <p className="text-xs text-foreground/70 truncate">{app.app_group ?? app.app_type}</p>
        </div>
      )}

      {visibleCols.has('classification') && (
        <div className="shrink-0 flex items-center gap-1.5 flex-wrap px-3 py-3" style={{ width: colWidths.classification }}>
          {approval && (
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', CLS_CHIP[approval] ?? CLS_CHIP.draft)}>
              {approval.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          )}
          {cls !== 'unknown' ? (
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', clsColorClass(clsMeta.color))}>
              {clsMeta.label}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/40 italic">Not set</span>
          )}
        </div>
      )}

      {/* Chevron */}
      <div className="w-9 shrink-0 flex items-center justify-center py-3">
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
      </div>
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
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className={cn(
          'p-1 rounded-md transition-colors',
          open ? 'text-foreground bg-muted' : 'text-muted-foreground/40 hover:text-muted-foreground/80 hover:bg-muted/60',
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

// ── Table header ──────────────────────────────────────────────────────────────

function TableHeader({
  sort, onSort, visibleCols, onColsChange, colWidths, onResizeStart,
  allSelected, someSelected, onSelectAll,
}: {
  sort: { key: SortKey; dir: SortDir }
  onSort: (k: SortKey) => void
  visibleCols: Set<ColKey>
  onColsChange: (cols: Set<ColKey>) => void
  colWidths: ColWidths
  onResizeStart: (col: ColKey, e: React.PointerEvent) => void
  allSelected: boolean
  someSelected: boolean
  onSelectAll: () => void
}) {
  return (
    <div className="flex items-center bg-card/80 border-b border-border text-[11px] text-muted-foreground/50 uppercase tracking-wide">
      {/* Select-all */}
      <div className="w-8 shrink-0 flex items-center justify-center px-2 py-2.5">
        <div
          role="checkbox"
          aria-checked={allSelected ? true : someSelected ? 'mixed' : false}
          tabIndex={0}
          onClick={onSelectAll}
          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') onSelectAll() }}
          className={cn(
            'w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors',
            allSelected ? 'border-blue-500 bg-blue-500' : someSelected ? 'border-blue-500/60 bg-blue-500/30' : 'border-border hover:border-border-strong',
          )}
        >
          {allSelected && (
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {someSelected && !allSelected && <div className="w-2 h-0.5 bg-blue-400 rounded-full" />}
        </div>
      </div>

      {/* App name (fills remaining space) */}
      <button
        className="relative flex-1 flex items-center gap-1 hover:text-foreground/70 transition-colors text-left px-3 py-2.5"
        style={{ minWidth: NAME_COL_MIN }}
        onClick={() => onSort('name')}
      >
        App <SortIcon col="name" sort={sort} />
      </button>

      {visibleCols.has('score') && (
        <div className="relative shrink-0 px-3 py-2.5" style={{ width: colWidths.score }}>
          <button className="flex items-center gap-1 hover:text-foreground/70 transition-colors" onClick={() => onSort('score')}>
            Score <SortIcon col="score" sort={sort} />
          </button>
          <ResizeHandle onDragStart={e => onResizeStart('score', e)} />
        </div>
      )}

      {visibleCols.has('dlp') && (
        <div className="relative shrink-0 px-3 py-2.5" style={{ width: colWidths.dlp }}>
          <button className="flex items-center gap-1 hover:text-foreground/70 transition-colors" onClick={() => onSort('dlp')}>
            DLP <SortIcon col="dlp" sort={sort} />
          </button>
          <ResizeHandle onDragStart={e => onResizeStart('dlp', e)} />
        </div>
      )}

      {visibleCols.has('risk') && (
        <div className="relative shrink-0 px-3 py-2.5" style={{ width: colWidths.risk }}>
          <span>Risk</span>
          <ResizeHandle onDragStart={e => onResizeStart('risk', e)} />
        </div>
      )}

      {visibleCols.has('category') && (
        <div className="relative shrink-0 px-3 py-2.5" style={{ width: colWidths.category }}>
          <span>Category</span>
          <ResizeHandle onDragStart={e => onResizeStart('category', e)} />
        </div>
      )}

      {visibleCols.has('classification') && (
        <div className="relative shrink-0 px-3 py-2.5" style={{ width: colWidths.classification }}>
          <span>Classification</span>
          <ResizeHandle onDragStart={e => onResizeStart('classification', e)} />
        </div>
      )}

      {/* Gear — always last */}
      <div className="w-9 shrink-0 flex items-center justify-center py-2.5">
        <ColumnPicker visibleCols={visibleCols} onChange={onColsChange} />
      </div>
    </div>
  )
}

// ── Bulk action bar ───────────────────────────────────────────────────────────

const BULK_CLS_OPTIONS: { value: CustomerClass; label: string }[] = [
  { value: 'enterprise-approved',        label: 'Approved & Supported'    },
  { value: 'approved-with-conditions',   label: 'Approved with Conditions' },
  { value: 'permitted-with-restriction', label: 'Restricted / Unassessed'  },
  { value: 'personal',                   label: 'Personal'                 },
  { value: 'unknown',                    label: 'Unknown'                  },
  { value: 'prohibited',                 label: 'Prohibited'               },
]

function BulkActionBar({ count, onClear, onApply, isPending, clsOptions = BULK_CLS_OPTIONS }: {
  count: number
  onClear: () => void
  onApply: (cls: CustomerClass) => void
  isPending: boolean
  clsOptions?: { value: string; label: string }[]
}) {
  const [selectedCls, setSelectedCls] = useState<string>('')

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-blue-600/10 border border-blue-500/30 rounded-xl">
      <span className="text-sm font-medium text-blue-300 shrink-0">{count} selected</span>
      <div className="h-4 w-px bg-border/60" />
      <Tag className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
      <span className="text-xs text-muted-foreground/70 shrink-0">Set classification:</span>
      <FilterSelect
        options={clsOptions}
        value={selectedCls}
        onChange={setSelectedCls}
        placeholder="Choose…"
        searchable={false}
      />
      <button
        disabled={!selectedCls || isPending}
        onClick={() => selectedCls && onApply(selectedCls as CustomerClass)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        Apply to {count}
      </button>
      <button onClick={onClear} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground/70 transition-colors shrink-0">
        <X className="w-3 h-3" /> Clear
      </button>
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
        <AppLogo domain={app.domain} letter={app.logo_letter} bg={app.logo_bg} logoUrl={app.logo_url} size={40} />
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
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', clsColorClass(clsMeta.color))}>
            {clsMeta.label}
          </span>
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
      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-blue-400/80">Running AI security evaluation — usually 15–30 seconds…</p>
      </div>
    </div>
  )
}

// ── Rows-per-page pager ───────────────────────────────────────────────────────

function TablePager({
  page, total, pageSize, onPage, onPageSize,
}: {
  page: number
  total: number
  pageSize: number
  onPage: (p: number) => void
  onPageSize: (n: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 bg-card/40 text-xs text-muted-foreground/70">
      {/* Rows per page */}
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <div className="relative">
          <select
            value={pageSize}
            onChange={e => { onPageSize(Number(e.target.value)); onPage(1) }}
            className="appearance-none bg-card border border-border rounded-lg pl-2.5 pr-6 py-1 text-xs text-foreground/80 focus:outline-none focus:border-border-strong cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
        </div>
      </div>

      {/* Page info + navigation */}
      <div className="flex items-center gap-3">
        <span>{start}–{end} of {total}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(1)}
            disabled={page === 1}
            className="p-1 rounded hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="First page"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            className="p-1 rounded hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous page"
          >
            ‹
          </button>
          <span className="px-2 text-foreground/70">{page} / {totalPages}</span>
          <button
            onClick={() => onPage(page + 1)}
            disabled={page === totalPages}
            className="p-1 rounded hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next page"
          >
            ›
          </button>
          <button
            onClick={() => onPage(totalPages)}
            disabled={page === totalPages}
            className="p-1 rounded hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Last page"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Eval error helpers ────────────────────────────────────────────────────────

function parseEvalError(rawError: string, searchTerm: string): {
  title:       string
  message:     string
  suggestions: string[]
} {
  const errLower = rawError.toLowerCase()

  // Service-level failures — show actionable guidance before app-specific hints
  const isTimeout     = errLower.includes('abort') || errLower.includes('timed out') || errLower.includes('timeout')
  const isAuthError   = errLower.includes('authentication') || errLower.includes('invalid api key') || errLower.includes('api_key') || errLower.includes('401')
  const isRateLimit   = errLower.includes('rate_limit') || errLower.includes('rate limit') || errLower.includes('429') || errLower.includes('too many request')
  const isServiceDown = errLower.includes('econnrefused') || errLower.includes('fetch failed') || errLower.includes('railway api error 5') || errLower.includes('not configured') || errLower.includes('connection error') || errLower.includes('api_error') || errLower.includes('overloaded') || errLower.includes('529')

  if (isTimeout) {
    return {
      title:   'Evaluation timed out',
      message: 'The AI evaluation took too long to complete — the service may be under high load. Please try again in a moment.',
      suggestions: ['Try again — timeouts are usually temporary', 'If it keeps timing out, try a well-known app name like "ChatGPT" or "Claude"'],
    }
  }

  if (isAuthError) {
    return {
      title:   'AI service not available',
      message: 'The evaluation service is not authorised. This is a configuration issue — please contact support.',
      suggestions: ['Contact your administrator to verify the AI service configuration'],
    }
  }

  if (isRateLimit) {
    return {
      title:   'Service rate limited',
      message: 'Too many evaluation requests in a short time. Please wait a minute and try again.',
      suggestions: ['Wait 60 seconds and try again', 'Search by exact product name for a faster result'],
    }
  }

  if (isServiceDown) {
    return {
      title:   'Evaluation service unavailable',
      message: 'The AI evaluation service is temporarily unreachable. Please try again shortly.',
      suggestions: ['Try again in a few minutes', 'Check your network connection'],
    }
  }

  const isAiRefusal  = rawError.includes('Unexpected token') || rawError.includes('not valid JSON') || rawError.includes('not able')
  const isNotRecog   = rawError.includes("doesn't appear to be a known GenAI application")

  const termLower = searchTerm.toLowerCase()
  const appHints: string[] = []

  if (termLower.includes('chatgpt') || termLower.includes('openai'))
    appHints.push('Try "ChatGPT" or the domain "openai.com"')
  if (termLower.includes('claude') || termLower.includes('claw') || termLower.includes('anthropic'))
    appHints.push('Try "Claude" or the domain "claude.ai"')
  if (termLower.includes('gemini') || termLower.includes('google') || termLower.includes('bard'))
    appHints.push('Try "Google Gemini" or "gemini.google.com"')
  if (termLower.includes('copilot') || termLower.includes('microsoft') || termLower.includes('bing'))
    appHints.push('Try "Microsoft Copilot" or "copilot.microsoft.com"')
  if (termLower.includes('gpt') && !termLower.includes('chatgpt'))
    appHints.push('Try "ChatGPT" for OpenAI\'s flagship model')
  if (termLower.includes('perplexity'))
    appHints.push('Try "Perplexity AI" or "perplexity.ai"')
  if (termLower.includes('articulate'))
    appHints.push('Try "Articulate 360" or the domain "articulate.com"')
  if (termLower.includes('midjourney') || termLower.includes('mid journey'))
    appHints.push('Try "Midjourney" or "midjourney.com"')
  if (termLower.includes('notion'))
    appHints.push('Try "Notion AI" or "notion.so"')
  if (termLower.includes('grammarly'))
    appHints.push('Try "Grammarly" or "grammarly.com"')
  if (termLower.includes('jasper'))
    appHints.push('Try "Jasper AI" or "jasper.ai"')
  if (termLower.includes('runway'))
    appHints.push('Try "Runway ML" or "runwayml.com"')
  if (termLower.includes('adobe') || termLower.includes('firefly'))
    appHints.push('Try "Adobe Firefly" or "firefly.adobe.com"')
  if (termLower.includes('canva'))
    appHints.push('Try "Canva AI" or "canva.com"')
  if (termLower.includes('github'))
    appHints.push('Try "GitHub Copilot" or "github.com/features/copilot"')
  if (termLower.includes('mistral') || termLower.includes('llama') || termLower.includes('groq'))
    appHints.push('Search by the exact model provider domain (e.g. "mistral.ai", "groq.com")')

  const defaultSuggestions = [
    'Use the full product name (e.g. "ChatGPT", "Google Gemini", "Microsoft Copilot")',
    'Search by the app\'s domain (e.g. "openai.com", "claude.ai")',
    'Include the vendor name (e.g. "OpenAI", "Anthropic", "Google")',
    'Browse the catalog below — the app may already be listed',
  ]

  const suggestions = appHints.length > 0 ? appHints : defaultSuggestions

  if (isNotRecog) {
    return {
      title:   'App not recognised',
      message: `The AI couldn't identify "${searchTerm}" as a known GenAI application. It may be an unofficial name, abbreviation, or a very new tool.`,
      suggestions,
    }
  }

  if (isAiRefusal) {
    return {
      title:   'Couldn\'t evaluate this search',
      message: `The AI was unable to assess "${searchTerm}" — this usually means the term is ambiguous, too short, or doesn't look like a GenAI application.`,
      suggestions,
    }
  }

  // Generic server/network error — still show app-specific hints if we recognise the term
  return {
    title:   'Evaluation failed',
    message: 'Something went wrong while evaluating this application. Please try again.',
    suggestions: appHints.length > 0
      ? ['Check your network connection and retry', ...appHints]
      : ['Check your network connection and retry', ...defaultSuggestions.slice(0, 2)],
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function AppCatalogClient({ entries, totalInDb, orgCategories = [] }: Props) {
  const [search,       setSearch]       = useState('')
  const [view,         setView]         = useState<'table' | 'grid'>('table')
  const [sort,         setSort]         = useState<{ key: SortKey; dir: SortDir }>({ key: 'name', dir: 'asc' })
  const [filterRisk,   setFilterRisk]   = useState('')
  const [filterCls,    setFilterCls]    = useState('')
  const [filterGroups, setFilterGroups] = useState<string[]>([])
  const [page,         setPage]         = useState(1)
  const [pageSize,     setPageSize]     = useState(DEFAULT_PAGE_SIZE)
  const [visibleCols,  setVisibleCols]  = useState<Set<ColKey>>(new Set(ALL_COLUMNS))
  const [colWidths,    setColWidths]    = useState<ColWidths>({ ...DEFAULT_COL_WIDTHS })
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [isPending,    startTransition]     = useTransition()
  const [isBulkPending, startBulkTransition] = useTransition()
  const [evaluatedApp,   setEvaluatedApp]   = useState<EvaluatedAppCard | null>(null)
  const [evalError,      setEvalError]      = useState<string | null>(null)
  const [evalErrorOpen,  setEvalErrorOpen]  = useState(false)
  const [evalErrorTerm,  setEvalErrorTerm]  = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Column resize
  const resizingRef = useRef<{ col: ColKey; startX: number; startWidth: number } | null>(null)

  const handleResizeStart = useCallback((col: ColKey, e: React.PointerEvent) => {
    e.preventDefault()
    resizingRef.current = { col, startX: e.clientX, startWidth: colWidths[col] }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [colWidths])

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!resizingRef.current) return
      const { col, startX, startWidth } = resizingRef.current
      const newWidth = Math.max(56, startWidth + (e.clientX - startX))
      setColWidths(prev => ({ ...prev, [col]: newWidth }))
    }
    function onUp() { resizingRef.current = null }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [])

  const trimmed = search.trim()

  const groupOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const { app } of entries) if (app.app_group) seen.add(app.app_group)
    return [...seen].sort().map(v => ({ value: v, label: v }))
  }, [entries])

  const filtered = useMemo(() => {
    return entries.filter(({ app, score, classification }) => {
      const s   = score?.final_score ?? 0
      const cls = classification?.customer_classification ?? 'unknown'
      if (trimmed.length > 0) {
        const q = trimmed.toLowerCase()
        if (!app.app_name.toLowerCase().includes(q) && !app.vendor.toLowerCase().includes(q) && !app.domain.toLowerCase().includes(q)) return false
      }
      if (filterRisk !== '') {
        if (filterRisk === 'low'      && s < 85)              return false
        if (filterRisk === 'moderate' && (s < 70 || s >= 85)) return false
        if (filterRisk === 'medium'   && (s < 50 || s >= 70)) return false
        if (filterRisk === 'high'     && s >= 50)             return false
      }
      if (filterCls !== '') {
        if (filterCls === 'not-set' && cls !== 'unknown') return false
        if (filterCls !== 'not-set' && cls !== filterCls) return false
      }
      if (filterGroups.length > 0 && !filterGroups.includes(app.app_group ?? '')) return false
      return true
    })
  }, [entries, trimmed, filterRisk, filterCls, filterGroups])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let diff = 0
      if (sort.key === 'name')  diff = a.app.app_name.localeCompare(b.app.app_name)
      if (sort.key === 'score') diff = (a.score?.final_score ?? 0) - (b.score?.final_score ?? 0)
      if (sort.key === 'dlp')   diff = (a.score?.dlp_activities_supported ?? 0) - (b.score?.dlp_activities_supported ?? 0)
      return sort.dir === 'asc' ? diff : -diff
    })
  }, [filtered, sort])

  const totalFiltered = sorted.length
  const pagedEntries  = sorted.slice((page - 1) * pageSize, page * pageSize)

  const activeFilters = [filterRisk !== '', filterCls !== '', filterGroups.length > 0].filter(Boolean).length

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
    setEvalErrorOpen(false)
    setEvaluatedApp(null)
    const termSnapshot = trimmed
    startTransition(async () => {
      const result = await evaluateApp(termSnapshot)
      if (result.error) {
        setEvalError(result.error)
        setEvalErrorTerm(termSnapshot)
        setEvalErrorOpen(true)
      } else if (result.data) {
        setEvaluatedApp(result.data)
      }
    })
  }

  function clearSearch() {
    setSearch('')
    setEvaluatedApp(null)
    setEvalError(null)
    setEvalErrorOpen(false)
    inputRef.current?.focus()
  }

  function clearAllFilters() {
    setFilterRisk('')
    setFilterCls('')
    setFilterGroups([])
    setPage(1)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleSelectAll() {
    const pageIds = pagedEntries.map(e => e.app.app_id)
    const allPageSelected = pageIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allPageSelected) pageIds.forEach(id => next.delete(id))
      else pageIds.forEach(id => next.add(id))
      return next
    })
  }

  function handleBulkApply(cls: CustomerClass) {
    const ids = [...selectedIds]
    startBulkTransition(async () => {
      await bulkSetClassification(ids, cls)
      setSelectedIds(new Set())
    })
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (evaluatedApp) setSearch('') }, [evaluatedApp])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1) }, [filterRisk, filterCls, filterGroups, trimmed])

  const pageIds         = pagedEntries.map(e => e.app.app_id)
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))
  const someSelected    = pageIds.some(id => selectedIds.has(id))

  const scoredCount  = entries.length
  const pendingCount = totalInDb - scoredCount
  const showNotFound = trimmed.length > 2 && filtered.length === 0 && !isPending && !evaluatedApp

  const catNameMap = Object.fromEntries(orgCategories.map(c => [c.system_tag ?? '', c.name]))
  const clsFilterOptions = [
    { value: 'not-set',                    label: 'Not Set' },
    { value: 'enterprise-approved',        label: catNameMap['enterprise-approved']        ?? 'Approved & Supported' },
    { value: 'approved-with-conditions',   label: catNameMap['approved-with-conditions']   ?? 'Approved w/ Conditions' },
    { value: 'permitted-with-restriction', label: catNameMap['permitted-with-restriction'] ?? 'Restricted' },
    { value: 'personal',                   label: 'Personal Only' },
    { value: 'prohibited',                 label: catNameMap['prohibited']                 ?? 'Prohibited' },
  ]

  const riskFilterOptions = [
    { value: 'low',      label: 'Low Risk (≥85)'   },
    { value: 'moderate', label: 'Moderate (70–84)' },
    { value: 'medium',   label: 'Medium (50–69)'   },
    { value: 'high',     label: 'High Risk (<50)'  },
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
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setEvaluatedApp(null); setEvalError(null); setEvalErrorOpen(false) }}
            placeholder="Search by name, vendor, or domain…"
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-border bg-card/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border-strong focus:bg-card transition-all"
          />
          {trimmed.length > 0 && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground/70">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <FilterSelect options={riskFilterOptions} value={filterRisk} onChange={v => { setFilterRisk(v); resetPage() }} placeholder="Risk" />
        <FilterSelect options={clsFilterOptions} value={filterCls} onChange={v => { setFilterCls(v); resetPage() }} placeholder="Classification" />
        {groupOptions.length > 1 && (
          <MultiFilterSelect options={groupOptions} value={filterGroups} onChange={v => { setFilterGroups(v); resetPage() }} placeholder="Category" />
        )}

        {activeFilters > 0 && (
          <button onClick={clearAllFilters} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground/70 hover:text-foreground border border-border hover:border-border-strong transition-colors">
            <X className="w-3 h-3" />Clear ({activeFilters})
          </button>
        )}

        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-border bg-card/50 p-1">
          <button onClick={() => setView('table')} className={cn('p-1.5 rounded-md transition-colors', view === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground/50 hover:text-foreground/70')} title="Table view">
            <LayoutList className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setView('grid')} className={cn('p-1.5 rounded-md transition-colors', view === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground/50 hover:text-foreground/70')} title="Grid view">
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {(activeFilters > 0 || trimmed.length > 0) && !showNotFound && (
        <p className="text-xs text-muted-foreground/60">Showing {totalFiltered} of {scoredCount} apps</p>
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())} onApply={handleBulkApply} isPending={isBulkPending} clsOptions={[
          { value: 'enterprise-approved',        label: catNameMap['enterprise-approved']        ?? 'Approved & Supported' },
          { value: 'approved-with-conditions',   label: catNameMap['approved-with-conditions']   ?? 'Approved with Conditions' },
          { value: 'permitted-with-restriction', label: catNameMap['permitted-with-restriction'] ?? 'Restricted / Unassessed' },
          { value: 'personal',                   label: 'Personal' },
          { value: 'unknown',                    label: 'Unknown' },
          { value: 'prohibited',                 label: catNameMap['prohibited']                 ?? 'Prohibited' },
        ]} />
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

      {evaluatedApp && !isPending && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-2">Evaluation Result</p>
          <Link href={`/genai-controls/apps/${evaluatedApp.app_id}`} className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-500/40 bg-card/50 hover:bg-card transition-all">
            <AppLogo domain={evaluatedApp.domain} letter={evaluatedApp.logo_letter} bg={evaluatedApp.logo_bg} size={32} radius="rounded-lg" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{evaluatedApp.app_name}</p>
              <p className="text-xs text-muted-foreground/60">{evaluatedApp.vendor} · {evaluatedApp.app_type}</p>
            </div>
            <span className={cn('text-sm font-bold tabular-nums', scoreColor(evaluatedApp.trustScore))}>{evaluatedApp.trustScore}/100</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20 flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" />Just evaluated</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
          </Link>
        </div>
      )}

      {showNotFound && (
        <div className="rounded-xl border border-border bg-card/30 px-6 py-8 text-center space-y-4">
          <p className="text-sm font-semibold text-foreground">&quot;{trimmed}&quot; is not in the catalog yet</p>
          <p className="text-xs text-muted-foreground/70 max-w-md mx-auto">Run an AI evaluation to assess this application&apos;s enterprise security posture, DLP activity support, and data governance controls.</p>
          <button onClick={handleEvaluate} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
            <Sparkles className="w-4 h-4" />Evaluate &quot;{trimmed}&quot;
          </button>
        </div>
      )}

      {/* ── Table view ── */}
      {!isPending && view === 'table' && sorted.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
          <div className="min-w-[600px]">
            <TableHeader
              sort={sort}
              onSort={toggleSort}
              visibleCols={visibleCols}
              onColsChange={setVisibleCols}
              colWidths={colWidths}
              onResizeStart={handleResizeStart}
              allSelected={allPageSelected}
              someSelected={someSelected}
              onSelectAll={handleSelectAll}
            />
            <div>
              {pagedEntries.map(entry => (
                <TableRow
                  key={entry.app.app_id}
                  {...entry}
                  visibleCols={visibleCols}
                  colWidths={colWidths}
                  selected={selectedIds.has(entry.app.app_id)}
                  onSelect={toggleSelect}
                />
              ))}
            </div>
            <TablePager page={page} total={totalFiltered} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
          </div>
        </div>
      )}

      {/* ── Grid view ── */}
      {!isPending && view === 'grid' && sorted.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pagedEntries.map(entry => <AppCard key={entry.app.app_id} {...entry} />)}
          </div>
          <TablePager page={page} total={totalFiltered} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
        </>
      )}

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

      {/* ── Eval error modal ── */}
      {evalErrorOpen && evalError && (() => {
        const { title, message, suggestions } = parseEvalError(evalError, evalErrorTerm)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEvalErrorOpen(false)} />
            <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
              {/* Header */}
              <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-border">
                <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">{message}</p>
                </div>
                <button
                  onClick={() => setEvalErrorOpen(false)}
                  className="flex-shrink-0 p-1 rounded-md hover:bg-muted/60 text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Suggestions */}
              <div className="px-5 py-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Lightbulb className="w-3.5 h-3.5 text-blue-400" />
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Try instead</p>
                </div>
                <ul className="space-y-2">
                  {suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground/80">
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 px-5 pb-5">
                <button
                  onClick={() => setEvalErrorOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => { setEvalErrorOpen(false); handleEvaluate() }}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors"
                >
                  {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
