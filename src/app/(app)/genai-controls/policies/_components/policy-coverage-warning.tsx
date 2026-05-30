'use client'

import Link from 'next/link'
import { AlertTriangle, AlertOctagon, Info, ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CoverageMatch, CoverageResult } from '../actions'

// ── Severity ordering ─────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = {
  conflict:        4,
  duplicate:       3,
  already_covered: 2,
  draft_match:     1,
  inactive_match:  0,
}

const STATE_BADGE: Record<string, string> = {
  active:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  draft:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  inactive: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

// ── Per-type display config ───────────────────────────────────────────────────

function getTopCoverageType(matches: CoverageMatch[]): string {
  return matches.reduce((best, m) =>
    (SEVERITY_RANK[m.coverageType] ?? 0) > (SEVERITY_RANK[best] ?? 0) ? m.coverageType : best,
    matches[0]?.coverageType ?? 'already_covered',
  )
}

interface StyleConfig {
  border:  string
  bg:      string
  icon:    React.ReactNode
  heading: string
  subtext: string
}

function getStyle(topType: string, hasConflict: boolean): StyleConfig {
  if (hasConflict || topType === 'conflict') {
    return {
      border:  'border-red-500/25',
      bg:      'bg-red-500/5',
      icon:    <AlertOctagon className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />,
      heading: 'Conflict detected',
      subtext: 'An existing policy contradicts this one — same scope, opposite action.',
    }
  }
  if (topType === 'duplicate') {
    return {
      border:  'border-amber-500/25',
      bg:      'bg-amber-500/5',
      icon:    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />,
      heading: 'Exact duplicate',
      subtext: 'This policy already exists with identical intent, action, scope, and conditions.',
    }
  }
  if (topType === 'already_covered') {
    return {
      border:  'border-amber-500/25',
      bg:      'bg-amber-500/5',
      icon:    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />,
      heading: 'Already enforced',
      subtext: 'An active policy already covers this use case with the same or stricter controls.',
    }
  }
  return {
    border:  'border-blue-500/20',
    bg:      'bg-blue-500/5',
    icon:    <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />,
    heading: topType === 'draft_match' ? 'Similar draft exists' : 'Similar inactive policy exists',
    subtext: topType === 'draft_match'
      ? 'A draft with the same intent and scope is already in the library.'
      : 'A matching policy exists but is currently inactive.',
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  result:         CoverageResult
  loading:        boolean
  onCreateAnyway: () => void
  onDiscard:      () => void
  creating:       boolean
}

export function PolicyCoverageWarning({ result, loading, onCreateAnyway, onDiscard, creating }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
        <span className="text-[11px] text-muted-foreground/50">Checking policy library for coverage...</span>
      </div>
    )
  }

  if (!result.hasCoverage && !result.hasConflict) return null

  const sorted   = [...result.matches].sort((a, b) => (SEVERITY_RANK[b.coverageType] ?? 0) - (SEVERITY_RANK[a.coverageType] ?? 0))
  const topType  = getTopCoverageType(result.matches)
  const style    = getStyle(topType, result.hasConflict)

  return (
    <div className={cn('rounded-xl border px-5 py-4 space-y-3', style.border, style.bg)}>
      {/* Header */}
      <div className="flex items-start gap-2">
        {style.icon}
        <div>
          <p className="text-xs font-semibold text-foreground/90">{style.heading}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">{style.subtext}</p>
        </div>
      </div>

      {/* Match rows */}
      <div className="space-y-2">
        {sorted.map(m => (
          <div key={m.id} className="rounded-lg border border-border/50 bg-card px-3 py-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-xs font-medium text-foreground/90 truncate">{m.name}</p>
                <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-medium shrink-0', STATE_BADGE[m.policyState])}>
                  {m.policyState}
                </span>
              </div>
              <Link
                href={`/genai-controls/policies/${m.id}/edit`}
                className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 shrink-0 transition-colors"
              >
                View <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>
            <p className="text-[11px] text-muted-foreground/60">{m.explanation}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onDiscard}
          className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onCreateAnyway}
          disabled={creating}
          className={cn(
            'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40',
            result.hasConflict
              ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
          )}
        >
          Create Anyway
        </button>
      </div>
    </div>
  )
}
