'use client'

import { useOptimistic, useTransition, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AlertTriangle, X } from 'lucide-react'
import { DLP_CONTROLS, CONTROL_STATUS_OPTIONS, CONTROL_GDPR_FINE_WEIGHT, type ControlStatus } from '@/lib/compliance/controls'
import { upsertAssessment } from '../actions'

interface Assessment {
  control_key: string
  status: ControlStatus
  updated_at?: string
}

interface Regulation {
  id: string
  code: string
  short_name: string
  max_fine: string | null
  content_updated_at?: string | null
}

const STATUS_CYCLE: ControlStatus[] = ['not_assessed', 'implemented', 'partial', 'not_implemented']

function nextStatus(current: ControlStatus): ControlStatus {
  const idx = STATUS_CYCLE.indexOf(current)
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
}

function statusMeta(status: ControlStatus) {
  return CONTROL_STATUS_OPTIONS.find(o => o.value === status) ?? CONTROL_STATUS_OPTIONS[0]
}

function computeScore(assessments: Assessment[]): number {
  let score = 0
  for (const a of assessments) {
    if (a.status === 'implemented')     score += 1
    if (a.status === 'partial')         score += 0.5
  }
  return Math.round((score / DLP_CONTROLS.length) * 100)
}

function fineExposure(assessments: Assessment[], maxFine: string | null): string {
  if (!maxFine) return '—'
  let unprotectedWeight = 0
  for (const ctrl of DLP_CONTROLS) {
    const a = assessments.find(x => x.control_key === ctrl.key)
    const status = a?.status ?? 'not_assessed'
    const weight = CONTROL_GDPR_FINE_WEIGHT[ctrl.key] ?? 0.05
    if (status === 'not_implemented') unprotectedWeight += weight
    else if (status === 'partial' || status === 'not_assessed') unprotectedWeight += weight * 0.5
  }
  const pct = Math.round(unprotectedWeight * 100)
  return `~${pct}% of max (${maxFine})`
}

export function GapReportClient({
  regulations,
  initialAssessments,
  currentRegCode,
  needsReview,
  contentUpdatedAt,
}: {
  regulations: Regulation[]
  initialAssessments: Assessment[]
  currentRegCode: string
  needsReview: boolean
  contentUpdatedAt: string | null
}) {
  const router     = useRouter()
  const pathname   = usePathname()
  const params     = useSearchParams()
  const [, startT] = useTransition()
  const [reviewDismissed, setReviewDismissed] = useState(false)

  const currentReg = regulations.find(r => r.code === currentRegCode) ?? regulations[0]

  const [optimisticAssessments, updateOptimistic] = useOptimistic(
    initialAssessments,
    (state: Assessment[], { key, status }: { key: string; status: ControlStatus }) =>
      state.map(a => (a.control_key === key ? { ...a, status } : a))
  )

  function toggleStatus(controlKey: string) {
    const current = (optimisticAssessments.find(a => a.control_key === controlKey)?.status ?? 'not_assessed') as ControlStatus
    const next = nextStatus(current)
    startT(async () => {
      updateOptimistic({ key: controlKey, status: next })
      await upsertAssessment(controlKey, currentReg.id, next)
      router.refresh()
    })
  }

  function switchReg(code: string) {
    const p = new URLSearchParams(params.toString())
    p.set('reg', code)
    router.push(`${pathname}?${p.toString()}`)
  }

  const score     = computeScore(optimisticAssessments)
  const exposure  = fineExposure(optimisticAssessments, currentReg?.max_fine ?? null)
  const implemented = optimisticAssessments.filter(a => a.status === 'implemented').length
  const partial     = optimisticAssessments.filter(a => a.status === 'partial').length

  return (
    <div className="space-y-5">
      {/* Regulation tabs */}
      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 flex-wrap">
        {regulations.map(reg => (
          <button
            key={reg.code}
            onClick={() => switchReg(reg.code)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-md transition-colors',
              currentRegCode === reg.code
                ? 'bg-white/10 text-white font-medium'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {reg.short_name}
          </button>
        ))}
      </div>

      {/* Review required banner */}
      {needsReview && !reviewDismissed && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-300 flex-1">
            <span className="font-semibold">Regulation content was updated</span>
            {contentUpdatedAt && (
              <span className="font-normal text-amber-400/80"> on {new Date(contentUpdatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            )}
            {' '}— your assessments may no longer reflect the current requirements. Review each control below.
          </p>
          <button
            onClick={() => setReviewDismissed(true)}
            className="text-amber-500 hover:text-amber-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary banner */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
          <div className="text-2xl font-bold text-white tabular-nums">{score}%</div>
          <div className="text-xs text-zinc-500 mt-0.5">Compliance score</div>
          <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
              )}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
          <div className="text-2xl font-bold text-white tabular-nums">{implemented}<span className="text-zinc-600 text-base">/{DLP_CONTROLS.length}</span></div>
          <div className="text-xs text-zinc-500 mt-0.5">Controls implemented</div>
          {partial > 0 && <div className="text-xs text-amber-400 mt-1">{partial} partial</div>}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
          <div className="text-sm font-semibold text-red-400 leading-tight mt-0.5 break-words">{exposure}</div>
          <div className="text-xs text-zinc-500 mt-0.5">Fine exposure at risk</div>
          <div className="text-[10px] text-zinc-600 mt-1">Based on unimplemented controls</div>
        </div>
      </div>

      {/* Controls table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">{currentReg?.short_name} — DLP Control Assessment</span>
          <span className="text-xs text-zinc-600">Click a status badge to cycle through states</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-5 py-2.5">Control</th>
              <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5 hidden md:table-cell">GDPR Articles</th>
              <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5 hidden lg:table-cell">Channel</th>
              <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {DLP_CONTROLS.map(ctrl => {
              const assessment = optimisticAssessments.find(a => a.control_key === ctrl.key)
              const status = (assessment?.status ?? 'not_assessed') as ControlStatus
              const meta   = statusMeta(status)
              return (
                <tr key={ctrl.key} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="text-xs font-medium text-white">{ctrl.label}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 max-w-xs">{ctrl.description}</div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {ctrl.gdpr_articles.map(a => (
                        <span key={a} className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{a}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-xs text-zinc-500">{ctrl.channel}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => toggleStatus(ctrl.key)}
                      className={cn(
                        'text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors border',
                        meta.color,
                        meta.bg,
                        'border-transparent hover:border-current'
                      )}
                    >
                      {meta.label}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-600">
        Status is self-assessed. Changes are logged to your audit trail. Refresh to sync changes across sessions.
      </p>
    </div>
  )
}
