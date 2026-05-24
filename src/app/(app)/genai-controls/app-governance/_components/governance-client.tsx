'use client'

import { useState, useTransition, useOptimistic } from 'react'
import Link from 'next/link'
import { Plus, Pencil, X, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import { CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import { computeTrustScore } from '@/lib/genai/scoring'
import { deleteGenAICategory } from '../actions'
import { EditCategoryModal } from './edit-category-modal'
import type { GenAIGovernanceCategory } from '../actions'
import type { GenAIApp, GenAIAppProfile, CustomerClassification } from '@/lib/genai/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface AppEntry {
  app: GenAIApp
  profile: GenAIAppProfile | null
  classification: CustomerClassification | null
}

interface Props {
  categories: GenAIGovernanceCategory[]
  appsByCategoryTag: Record<string, AppEntry[]>
  userRole: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function RiskBadge({ score }: { score: number }) {
  if (score >= 85) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">Low Risk</span>
  if (score >= 70) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">Moderate</span>
  if (score >= 50) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Medium Risk</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">High Risk</span>
}

// ── App mini-card ─────────────────────────────────────────────────────────────

function AppCard({ entry }: { entry: AppEntry }) {
  const { app, profile, classification } = entry
  const score = profile ? computeTrustScore(profile.fields, profile.dlp, profile.breach_info) : null
  const cls = classification?.customer_classification ?? 'unknown'
  const clsMeta = CLASSIFICATION_LABELS[cls]

  return (
    <Link
      href={`/genai-controls/apps/${app.app_id}`}
      className="group flex items-start gap-3 p-3 rounded-lg border border-border bg-card/40 hover:border-border-strong hover:bg-card/70 transition-all"
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground font-bold text-sm flex-shrink-0"
        style={{ backgroundColor: app.logo_bg }}
      >
        {app.logo_letter}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground group-hover:text-blue-300 transition-colors truncate">{app.app_name}</p>
        <p className="text-xs text-muted-foreground/70 truncate">{app.vendor}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {score ? (
            <>
              <span className={cn(
                'text-xs font-bold tabular-nums',
                score.final_score >= 85 ? 'text-green-400' :
                score.final_score >= 70 ? 'text-blue-400' :
                score.final_score >= 50 ? 'text-yellow-400' : 'text-red-400'
              )}>
                {score.final_score}
              </span>
              <RiskBadge score={score.final_score} />
            </>
          ) : (
            <span className="text-xs text-muted-foreground/50">Not scored</span>
          )}
          {cls !== 'unknown' && (
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded',
              clsMeta.color === 'green'  ? 'bg-green-500/15 text-green-400' :
              clsMeta.color === 'red'    ? 'bg-red-500/15 text-red-400' :
              clsMeta.color === 'amber'  ? 'bg-yellow-500/15 text-yellow-400' :
              clsMeta.color === 'blue'   ? 'bg-blue-500/15 text-blue-400' :
              clsMeta.color === 'purple' ? 'bg-purple-500/15 text-purple-400' :
              'bg-accent/50 text-muted-foreground'
            )}>
              {clsMeta.label}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({
  category,
  apps,
}: {
  category: GenAIGovernanceCategory
  apps: AppEntry[]
}) {
  const cc = colorClasses(category.color)

  return (
    <div className="rounded-xl border border-border bg-card/30 overflow-hidden">
      <div className={cn('px-5 py-4 border-b border-border flex items-start gap-3', cc.bg)}>
        <div className={cn('w-3 h-3 rounded-full shrink-0 mt-0.5', cc.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cn('text-sm font-semibold', cc.text)}>{category.name}</h2>
            <span className="text-[10px] bg-background/40 text-muted-foreground/70 px-2 py-0.5 rounded-full border border-border/50">
              {apps.length} {apps.length === 1 ? 'app' : 'apps'}
            </span>
          </div>
          {category.description && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">{category.description}</p>
          )}
        </div>
      </div>
      <div className="p-4">
        {apps.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 text-center py-3">No apps assigned to this category</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {apps.map(entry => (
              <AppCard key={entry.app.app_id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Manage panel ──────────────────────────────────────────────────────────────

type CatOptAction =
  | { type: 'delete'; id: string }

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

export function GovernanceClient({ categories, appsByCategoryTag, userRole }: Props) {
  const [manageOpen, setManageOpen] = useState(false)
  const isAdmin = userRole === 'admin'

  const sorted = [...categories].sort((a, b) => a.priority - b.priority)

  return (
    <div className="flex gap-0 h-full">
      <div className="flex-1 min-w-0 space-y-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">App Governance</h1>
            <p className="text-sm text-muted-foreground/80 mt-1">
              GenAI apps grouped by governance category. Assign and classify apps from the App Catalog.
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

        {/* Category sections */}
        <div className="space-y-4">
          {sorted.map(cat => (
            <CategorySection
              key={cat.id}
              category={cat}
              apps={appsByCategoryTag[cat.system_tag ?? cat.id] ?? []}
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
