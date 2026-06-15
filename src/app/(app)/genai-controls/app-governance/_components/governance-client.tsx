'use client'

import { useState, useTransition, useOptimistic, useMemo, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { Plus, Pencil, X, Settings2, ChevronDown, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AddFilterButton } from '@/components/ui/add-filter-button'
import { colorClasses } from '@/lib/data-catalog/types'
import { CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import { computeTrustScore } from '@/lib/genai/scoring'
import { deleteGenAICategory, setAppGovernanceClassification } from '../actions'
import { EditCategoryModal } from './edit-category-modal'
import { AppLogo } from '../../apps/_components/app-logo'
import type { GenAIGovernanceCategory } from '../actions'
import type { GenAIApp, GenAIAppProfile, CustomerClassification, CustomerClass, DLPActivities } from '@/lib/genai/types'

// ── Static treatment & compliance per category ────────────────────────────────

const CATEGORY_DLP_TREATMENT: Record<string, string> = {
  'enterprise-approved':        'Allow by default. Full DLP inspection of prompts and file uploads. Alert on highly confidential and secret data submissions.',
  'approved-with-conditions':   'Allow for authorised AD groups only. Block highly confidential and secret labelled documents. Display coaching on policy violations.',
  'permitted-with-restriction': 'Allow public and internal data only. Block confidential, highly confidential, and secret content. Coach users before every upload.',
  'prohibited':                 'Block all access. Display acceptable-use coaching message (Level 2) on every access attempt. No exceptions without escalation.',
}

const CATEGORY_COMPLIANCE: Record<string, string[]> = {
  'enterprise-approved':        ['GDPR Art. 25', 'GDPR Art. 32', 'HIPAA §164.312'],
  'approved-with-conditions':   ['GDPR Art. 25', 'GDPR Art. 32', 'HIPAA §164.308', 'HIPAA §164.312'],
  'permitted-with-restriction': ['GDPR Art. 5(1)(f)', 'GDPR Art. 32', 'HIPAA §164.308'],
  'prohibited':                 ['GDPR Art. 5(1)(f)', 'GDPR Art. 32', 'HIPAA §164.312'],
}


// ── Types ────────────────────────────────────────────────────────────────────

export interface AppEntry {
  app: GenAIApp
  profile: GenAIAppProfile | null
  classification: CustomerClassification | null
}

interface Props {
  categories:        GenAIGovernanceCategory[]
  appsByCategoryTag: Record<string, AppEntry[]>
  userRole:          string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function RiskBadge({ score }: { score: number }) {
  if (score >= 85) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">Low Risk</span>
  if (score >= 70) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">Moderate</span>
  if (score >= 50) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Medium Risk</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">High Risk</span>
}

function getDLPCapabilities(dlp: DLPActivities | null): string[] {
  if (!dlp) return []
  const ok = ['enforcement', 'monitoring', 'partial']
  const caps: string[] = []
  if (ok.includes(dlp.post_prompt))   caps.push('Prompt inspection')
  if (ok.includes(dlp.upload))         caps.push('File upload control')
  if (ok.includes(dlp.login_instance)) caps.push('Login & instance detection')
  if (ok.includes(dlp.edit))           caps.push('Edit inspection')
  if (ok.includes(dlp.response))       caps.push('Response monitoring')
  if (ok.includes(dlp.download))       caps.push('Download control')
  if (ok.includes(dlp.attach))         caps.push('Attachment inspection')
  return caps
}

// ── Classification select ─────────────────────────────────────────────────────

const CLS_OPTIONS: { value: CustomerClass; label: string }[] = [
  { value: 'enterprise-approved',        label: 'Approved & Supported' },
  { value: 'approved-with-conditions',   label: 'Approved with Conditions' },
  { value: 'permitted-with-restriction', label: 'Restricted / Unassessed' },
  { value: 'prohibited',                 label: 'Prohibited' },
  { value: 'unknown',                    label: 'Not Set' },
]

const CLS_SELECT_STYLE: Record<string, string> = {
  green:  'border-emerald-500/40 text-emerald-400 bg-emerald-500/5',
  emerald:'border-emerald-500/40 text-emerald-400 bg-emerald-500/5',
  blue:   'border-blue-500/40 text-blue-400 bg-blue-500/5',
  amber:  'border-amber-500/40 text-amber-400 bg-amber-500/5',
  red:    'border-red-500/40 text-red-400 bg-red-500/5',
  purple: 'border-purple-500/40 text-purple-400 bg-purple-500/5',
  zinc:   'border-border-strong text-muted-foreground/70 bg-transparent',
}

function ClassificationSelect({
  value,
  onChange,
  disabled,
  options = CLS_OPTIONS,
}: {
  value: CustomerClass
  onChange: (v: string) => void
  disabled?: boolean
  options?: { value: string; label: string }[]
}) {
  const meta = CLASSIFICATION_LABELS[value] ?? CLASSIFICATION_LABELS.unknown
  const style = CLS_SELECT_STYLE[meta.color] ?? CLS_SELECT_STYLE.zinc

  return (
    <div className={cn('relative rounded-lg border px-2.5 py-1.5 w-[180px]', style)}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none bg-transparent text-xs font-semibold focus:outline-none cursor-pointer pr-5 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ color: 'inherit' }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-card text-foreground">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
    </div>
  )
}

// ── App row ───────────────────────────────────────────────────────────────────

function AppRow({
  entry,
  categorySystemTag,
  clsOptions,
}: {
  entry: AppEntry
  categorySystemTag: string | null
  clsOptions: { value: string; label: string }[]
}) {
  const { app, profile, classification } = entry
  const initialCls = (classification?.customer_classification ?? 'unknown') as CustomerClass
  const [localCls, setLocalCls] = useState(initialCls)
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()

  const inScope = localCls !== 'unknown'
  const score = profile ? computeTrustScore(profile.fields, profile.dlp, profile.breach_info) : null
  const dlpCaps = getDLPCapabilities(profile?.dlp ?? null)
  const dlpTreatment = CATEGORY_DLP_TREATMENT[categorySystemTag ?? ''] ?? 'Manage DLP treatment in your Netskope policy configuration.'
  const complianceTags = CATEGORY_COMPLIANCE[categorySystemTag ?? ''] ?? []

  function handleClassificationChange(newCls: string) {
    const prev = localCls
    setLocalCls(newCls as CustomerClass)
    startTransition(async () => {
      const result = await setAppGovernanceClassification(app.app_id, newCls)
      if (result.error) setLocalCls(prev)
    })
  }

  function handleInScopeToggle() {
    handleClassificationChange(inScope ? 'unknown' : (categorySystemTag ?? 'permitted-with-restriction'))
  }

  return (
    <div className="border-b border-border/50 last:border-0">
      {/* Main row */}
      <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-card/20 transition-colors">
        {/* App identity — click expands detail */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left group"
        >
          <AppLogo domain={app.domain} letter={app.logo_letter} bg={app.logo_bg} logoUrl={app.logo_url} size={36} radius="rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground group-hover:text-blue-300 transition-colors">{app.app_name}</span>
              {score && <RiskBadge score={score.final_score} />}
            </div>
            <p className="text-xs text-muted-foreground/60 truncate">{app.vendor} · {app.domain}</p>
            <span className="inline-block mt-1 text-[10px] font-medium bg-muted/80 text-muted-foreground/70 px-1.5 py-0.5 rounded border border-border-strong">
              {app.app_type}
            </span>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground/40 shrink-0 transition-transform mr-1', expanded && 'rotate-180')} />
        </button>

        {/* Classification + in-scope controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isPending ? (
            <div className="flex items-center gap-2 w-[248px] justify-end">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/60" />
              <span className="text-xs text-muted-foreground/60">Saving…</span>
            </div>
          ) : (
            <>
              <ClassificationSelect
                value={localCls}
                onChange={handleClassificationChange}
                disabled={isPending}
                options={clsOptions}
              />
              <button
                onClick={handleInScopeToggle}
                disabled={isPending}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap disabled:opacity-50',
                  inScope
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-transparent border-border-strong text-muted-foreground/60 hover:text-foreground/70',
                )}
              >
                {inScope ? 'In scope ✓' : 'Set in scope'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-16 pb-5 pt-3 bg-card/10 border-t border-border/40">
          {/* DLP Capabilities */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                DLP Capabilities
              </p>
              <Link
                href={`/genai-controls/apps/${app.app_id}`}
                className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
              >
                View full profile →
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {dlpCaps.length > 0 ? (
                dlpCaps.map(cap => (
                  <span key={cap} className="text-xs px-2.5 py-1 rounded-lg border border-border-strong bg-muted/60 text-muted-foreground">
                    {cap}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground/40 italic">No DLP profile available</span>
              )}
            </div>
          </div>

          {/* DLP Treatment + Compliance Relevance */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1.5">
                DLP Treatment
              </p>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">{dlpTreatment}</p>
            </div>
            <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1.5">
                Compliance Relevance
              </p>
              <div className="flex flex-wrap gap-1.5">
                {complianceTags.map(tag => (
                  <span key={tag} className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Category section (Layer 1) ────────────────────────────────────────────────

function CategorySection({
  category, apps, clsOptions, forceOpen = false,
}: {
  category:   GenAIGovernanceCategory
  apps:       AppEntry[]
  clsOptions: { value: string; label: string }[]
  forceOpen?: boolean
}) {
  const [open, setOpen] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  // Derived state during render — avoids calling setState synchronously in an effect
  if (forceOpen && !open) setOpen(true)
  const cc = colorClasses(category.color)

  const inScopeCount = apps.filter(e =>
    e.classification?.customer_classification &&
    e.classification.customer_classification !== 'unknown'
  ).length

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Category header */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn('w-full flex items-center gap-2.5 px-5 py-3.5 text-left transition-opacity select-none hover:opacity-90', cc.bg)}
      >
        <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', cc.dot)} />
        <span className={cn('text-sm font-bold uppercase tracking-wide', cc.text)}>{category.name}</span>
        {apps.length > 0 && (
          <>
            <span className="mx-1 text-muted-foreground/30">·</span>
            <span className="text-xs text-muted-foreground/60">{apps.length} {apps.length === 1 ? 'app' : 'apps'}</span>
          </>
        )}
        {inScopeCount > 0 && (
          <>
            <span className="mx-1 text-muted-foreground/30">·</span>
            <span className={cn('text-xs font-semibold', cc.text)}>{inScopeCount} in scope</span>
          </>
        )}
        <ChevronDown className={cn('ml-auto w-4 h-4 text-muted-foreground/40 transition-transform', !open && '-rotate-90')} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            {/* DB apps — flat list */}
            {apps.length > 0 && (
              <>
                <div className="flex items-center px-5 py-2 border-b border-border/60 bg-card/20">
                  <span className="flex-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">App</span>
                  <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Your Classification</span>
                </div>
                {apps.map(entry => (
                  <AppRow key={entry.app.app_id} entry={entry} categorySystemTag={category.system_tag} clsOptions={clsOptions} />
                ))}
              </>
            )}

            {/* Empty state */}
            {apps.length === 0 && (
              <div className="px-5 py-8 text-center bg-card/5">
                <p className="text-sm text-muted-foreground/40">No apps assigned to this category</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Manage panel ──────────────────────────────────────────────────────────────

type CatOptAction = { type: 'delete'; id: string }

function ManagePanel({
  categories,
  isAdmin,
  onClose,
}: {
  categories: GenAIGovernanceCategory[]
  isAdmin: boolean
  onClose: () => void
}) {
  const [editTarget, setEditTarget] = useState<GenAIGovernanceCategory | 'new' | null>(null)
  const [delError, setDelError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const [optimisticCats, setOptimisticCats] = useOptimistic(
    categories,
    (state: GenAIGovernanceCategory[], action: CatOptAction) => {
      if (action.type === 'delete') return state.filter(c => c.id !== action.id)
      return state
    },
  )

  function handleDelete(cat: GenAIGovernanceCategory) {
    setDelError(null)
    setOptimisticCats({ type: 'delete', id: cat.id })
    startTransition(async () => {
      const result = await deleteGenAICategory(cat.id)
      if (result.error) setDelError(result.error)
    })
  }

  const sorted = [...optimisticCats].sort((a, b) => a.priority - b.priority)

  return (
    <>
      {editTarget && (
        <EditCategoryModal
          category={editTarget === 'new' ? null : editTarget}
          categories={categories}
          onClose={() => setEditTarget(null)}
        />
      )}

      <div className="w-72 shrink-0 border-l border-border bg-card/50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Manage Categories</h3>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {delError && <p className="text-xs text-red-400 px-2 pb-1">{delError}</p>}
          {sorted.map(cat => {
            const cc = colorClasses(cat.color)
            return (
              <div
                key={cat.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
              >
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', cc.dot)} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', cc.text)}>{cat.name}</p>
                  {cat.is_system && (
                    <span className="text-[10px] text-muted-foreground/50">System default</span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isAdmin && (
                    <button
                      onClick={() => setEditTarget(cat)}
                      className="p-1 text-muted-foreground/60 hover:text-foreground/70 hover:bg-muted rounded transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isAdmin && !cat.is_system && (
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-1 text-muted-foreground/40 hover:text-red-400 hover:bg-muted rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {isAdmin && (
          <div className="px-3 py-3 border-t border-border">
            <button
              onClick={() => setEditTarget('new')}
              className="flex items-center gap-1.5 w-full px-3 py-2 bg-muted hover:bg-accent text-foreground/70 text-xs font-medium rounded-lg border border-border-strong transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add category
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

const RISK_OPTIONS = [
  { value: 'low',      label: 'Low Risk (≥85)'  },
  { value: 'moderate', label: 'Moderate (70–84)' },
  { value: 'medium',   label: 'Medium (50–69)'  },
  { value: 'high',     label: 'High Risk (<50)' },
]

const SCOPE_OPTIONS = [
  { value: 'in_scope', label: 'In Scope'  },
  { value: 'not_set',  label: 'Not Set'   },
]

export function GovernanceClient({ categories, appsByCategoryTag, userRole }: Props) {
  const [manageOpen,    setManageOpen]    = useState(false)
  const [search,        setSearch]        = useState('')
  const [filterRisk,    setFilterRisk]    = useState('')
  const [filterScope,   setFilterScope]   = useState('')
  const isAdmin = userRole === 'admin'
  const sorted = [...categories].sort((a, b) => a.priority - b.priority)

  // Build classification dropdown options from the org's category names (user may have renamed them).
  const clsOptions = useMemo(() => [
    ...categories
      .filter(c => c.system_tag && c.system_tag !== 'unknown')
      .sort((a, b) => a.priority - b.priority)
      .map(c => ({ value: c.system_tag as string, label: c.name })),
    { value: 'unknown', label: 'Not Set' },
  ], [categories])

  const isFiltering = !!(search.trim() || filterRisk || filterScope)

  const filteredAppsByTag = useMemo(() => {
    if (!search.trim() && !filterRisk && !filterScope) return appsByCategoryTag
    const q = search.toLowerCase().trim()
    const result: Record<string, AppEntry[]> = {}
    for (const [tag, entries] of Object.entries(appsByCategoryTag)) {
      result[tag] = entries.filter(({ app, profile, classification }) => {
        if (q && !app.app_name.toLowerCase().includes(q) && !app.vendor.toLowerCase().includes(q) && !app.domain.toLowerCase().includes(q)) return false
        if (filterRisk) {
          const s = profile ? computeTrustScore(profile.fields, profile.dlp, profile.breach_info).final_score : 0
          if (filterRisk === 'low'      && s < 85)              return false
          if (filterRisk === 'moderate' && (s < 70 || s >= 85)) return false
          if (filterRisk === 'medium'   && (s < 50 || s >= 70)) return false
          if (filterRisk === 'high'     && s >= 50)             return false
        }
        if (filterScope) {
          const cls = classification?.customer_classification ?? 'unknown'
          if (filterScope === 'in_scope' && cls === 'unknown') return false
          if (filterScope === 'not_set'  && cls !== 'unknown') return false
        }
        return true
      })
    }
    return result
  }, [appsByCategoryTag, search, filterRisk, filterScope])

  return (
    <div className="flex gap-0">
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">App Governance</h1>
            <p className="text-sm text-muted-foreground/80 mt-1">
              GenAI apps grouped by governance category. Set classification and scope per app inline.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setManageOpen(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors',
                manageOpen
                  ? 'bg-accent text-foreground border-border-strong'
                  : 'bg-muted text-foreground/70 border-border-strong hover:bg-accent hover:text-foreground',
              )}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Manage Categories
            </button>
          )}
        </div>

        {/* Search + filter toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search apps…"
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-card/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border-strong transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground/70">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <AddFilterButton
            defs={[
              { key: 'risk',  label: 'Risk',  type: 'single', options: RISK_OPTIONS  },
              { key: 'scope', label: 'Scope', type: 'single', options: SCOPE_OPTIONS },
            ]}
            value={{ risk: filterRisk, scope: filterScope }}
            onChange={(key, val) => {
              if (key === 'risk')  setFilterRisk(val as string)
              if (key === 'scope') setFilterScope(val as string)
            }}
          />

        </div>

        {/* Category sections */}
        <div className="space-y-3">
          {sorted
            .filter(cat => {
              const hasApps = (filteredAppsByTag[cat.system_tag ?? cat.id] ?? []).length > 0
              const isCustom = !cat.is_system
              return isFiltering ? hasApps : (hasApps || isCustom)
            })
            .map(cat => (
              <CategorySection
                key={cat.id}
                category={cat}
                apps={filteredAppsByTag[cat.system_tag ?? cat.id] ?? []}
                clsOptions={clsOptions}
                forceOpen={isFiltering}
              />
            ))}
        </div>
      </div>

      {/* Manage panel */}
      {manageOpen && (
        <ManagePanel
          categories={categories}
          isAdmin={isAdmin}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  )
}
