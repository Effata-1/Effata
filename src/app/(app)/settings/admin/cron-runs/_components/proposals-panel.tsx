'use client'

import { useTransition, useState } from 'react'
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { approveProposal, rejectProposal } from '../actions'

export interface ProposedChange {
  id:            string
  run_id:        string | null
  regulation_id: string | null
  change_type:   'update_regulation' | 'new_regulation'
  proposed_data: Record<string, unknown>
  current_data:  Record<string, unknown> | null
  ai_reason:     string | null
  status:        string
  created_at:    string
}

function DiffRow({ label, current, proposed }: { label: string; current?: unknown; proposed?: unknown }) {
  if (proposed === undefined) return null
  const cur = current !== undefined && current !== null ? String(current) : '—'
  const prop = proposed !== null ? String(proposed) : '—'
  const changed = cur !== prop
  return (
    <div className="grid grid-cols-[120px_1fr_1fr] gap-2 py-1.5 border-b border-border/40 last:border-0 text-xs">
      <span className="text-muted-foreground/70 font-medium self-start pt-0.5">{label}</span>
      <span className={cn('text-foreground/60 line-through', !changed && 'no-underline')}>{cur}</span>
      <span className={cn('font-medium', changed ? 'text-amber-400' : 'text-foreground/60')}>{prop}</span>
    </div>
  )
}

function ProposalCard({ proposal, onDone }: { proposal: ProposedChange; onDone: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [approving, startApprove] = useTransition()
  const [rejecting, startReject] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  const proposed = proposal.proposed_data
  const current  = proposal.current_data

  const isNew = proposal.change_type === 'new_regulation'
  const regCode = isNew
    ? (proposed.code as string ?? '—')
    : (current?.regulation_code as string | undefined) ?? '—'
  const regName = isNew
    ? (proposed.short_name as string ?? proposed.name as string ?? '—')
    : (current?.regulation_name as string | undefined) ?? '—'

  function handleApprove() {
    setActionError(null)
    startApprove(async () => {
      const result = await approveProposal(proposal.id)
      if (result.error) setActionError(result.error)
      else onDone(proposal.id)
    })
  }

  function handleReject() {
    setActionError(null)
    startReject(async () => {
      const result = await rejectProposal(proposal.id)
      if (result.error) setActionError(result.error)
      else onDone(proposal.id)
    })
  }

  const busy = approving || rejecting

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-semibold bg-muted px-1.5 py-0.5 rounded uppercase text-muted-foreground">
              {regCode}
            </span>
            <span className="text-xs font-semibold text-foreground">{regName}</span>
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase',
              isNew ? 'bg-purple-500/10 text-purple-400' : 'bg-amber-500/10 text-amber-400',
            )}>
              {isNew ? 'New regulation' : 'Update'}
            </span>
          </div>
          {proposal.ai_reason && (
            <p className="text-xs text-muted-foreground/80 mt-1 leading-relaxed">{proposal.ai_reason}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md border border-border hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors disabled:opacity-40"
            >
              <XCircle className="h-3 w-3" />
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-40"
            >
              <CheckCircle2 className="h-3 w-3" />
              {approving ? 'Applying…' : 'Approve'}
            </button>
          </div>
          {actionError && (
            <p className="text-[10px] text-red-400 max-w-[200px] text-right leading-tight">{actionError}</p>
          )}
        </div>
      </div>

      {/* Diff toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-1.5 px-4 py-2 border-t border-border/60 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide hover:bg-muted/20 transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Hide diff' : 'Show diff'}
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-border/60 bg-card/30">
          {isNew ? (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-2">
                Proposed new regulation
              </p>
              {(['code','short_name','name','jurisdiction','type','max_fine','summary'] as const).map(f => (
                <div key={f} className="flex gap-2 py-1 border-b border-border/40 last:border-0 text-xs">
                  <span className="text-muted-foreground/70 font-medium w-28 shrink-0">{f}</span>
                  <span className="text-amber-400">{proposed[f] !== undefined && proposed[f] !== null ? String(proposed[f]) : '—'}</span>
                </div>
              ))}
              {Array.isArray(proposed.requirements) && (
                <p className="text-[10px] text-muted-foreground/60 mt-2">
                  + {(proposed.requirements as unknown[]).length} requirement{(proposed.requirements as unknown[]).length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[120px_1fr_1fr] gap-2 pb-1 mb-1 border-b border-border">
                <span />
                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase">Current</span>
                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase">Proposed</span>
              </div>
              <DiffRow label="summary"  current={current?.summary}  proposed={proposed.summary} />
              <DiffRow label="max_fine" current={current?.max_fine} proposed={proposed.max_fine} />
              {Array.isArray(proposed.requirements) && proposed.requirements.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1.5">
                    Requirement changes
                  </p>
                  {(proposed.requirements as Array<{ article: string; field: string; new_value: unknown }>).map((req, i) => {
                    const currentReqs = (current?.requirements ?? []) as Array<{ article: string; [k: string]: unknown }>
                    const matched = currentReqs.find(r => r.article === req.article)
                    return (
                      <DiffRow
                        key={i}
                        label={`${req.article} · ${req.field}`}
                        current={matched ? matched[req.field] : undefined}
                        proposed={req.new_value}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ProposalsPanel({ proposals: initial }: { proposals: ProposedChange[] }) {
  const [visible, setVisible] = useState(initial.map(p => p.id))

  function dismiss(id: string) {
    setVisible(v => v.filter(x => x !== id))
  }

  const shown = initial.filter(p => visible.includes(p.id))

  if (shown.length === 0) return null

  return (
    <div className="space-y-2">
      {shown.map(p => (
        <ProposalCard key={p.id} proposal={p} onDone={dismiss} />
      ))}
    </div>
  )
}
