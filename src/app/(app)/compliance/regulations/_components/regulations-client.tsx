'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Clock, Shield, ExternalLink, X, Pencil } from 'lucide-react'
import type { RegulationRow, RequirementRow } from '../page'
import { markRegulationVerified, updateRequirement, updateRegulation } from '../actions'
import type { RequirementFields, RegulationFields } from '../actions'

const REGION_OPTIONS = [
  { value: 'all',            label: 'All Regions' },
  { value: 'Europe',         label: 'Europe' },
  { value: 'India',          label: 'India' },
  { value: 'Americas',       label: 'Americas' },
  { value: 'Asia-Pacific',   label: 'Asia-Pacific' },
  { value: 'MENA & Africa',  label: 'MENA & Africa' },
]

const INDUSTRY_OPTIONS = [
  { value: 'all',                   label: 'All Industries' },
  { value: 'financial',             label: 'Financial Services' },
  { value: 'healthcare',            label: 'Healthcare' },
  { value: 'critical_infrastructure', label: 'Critical Infrastructure' },
  { value: 'defence',               label: 'Defence / Government' },
]

const TYPE_COLORS: Record<string, string> = {
  privacy:  'bg-blue-500/15 text-blue-400',
  security: 'bg-purple-500/15 text-purple-400',
  sector:   'bg-amber-500/15 text-amber-400',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400',
  high:     'bg-amber-500/15 text-amber-400',
  medium:   'bg-blue-500/15 text-blue-400',
}

function freshnessInfo(lastVerified: string): {
  icon: React.ReactNode
  label: string
  color: string
} {
  const days = Math.floor((Date.now() - new Date(lastVerified).getTime()) / 86400000)
  if (days <= 7)  return { icon: <CheckCircle className="h-3.5 w-3.5" />, label: `Verified ${days === 0 ? 'today' : `${days}d ago`}`, color: 'text-green-400' }
  if (days <= 30) return { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: `Needs review (${days}d)`, color: 'text-amber-400' }
  return { icon: <Clock className="h-3.5 w-3.5" />, label: `Overdue (${days}d)`, color: 'text-red-400' }
}

function VerifyButton({ reg }: { reg: RegulationRow }) {
  const [open, setOpen] = useState(false)
  const [changed, setChanged] = useState(false)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit() {
    startTransition(async () => {
      await markRegulationVerified(reg.id, reg.name, changed, notes || undefined)
      setOpen(false)
      setNotes('')
      setChanged(false)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        className="text-[10px] font-medium px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:border-blue-600 hover:text-blue-400 transition-colors"
      >
        Mark verified
      </button>
    )
  }

  return (
    <div onClick={e => e.stopPropagation()} className="flex items-center gap-2 flex-wrap">
      <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
        <input
          type="checkbox"
          checked={changed}
          onChange={e => setChanged(e.target.checked)}
          className="rounded"
        />
        Content changed
      </label>
      <input
        type="text"
        placeholder="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white placeholder:text-zinc-600 w-36"
      />
      <button
        onClick={submit}
        disabled={isPending}
        className="text-[10px] font-medium px-2 py-1 rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : 'Confirm'}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-[10px] text-zinc-500 hover:text-zinc-300"
      >
        Cancel
      </button>
    </div>
  )
}

function EditRequirementRow({
  req,
  reg,
  onDone,
}: {
  req: RequirementRow
  reg: RegulationRow
  onDone: () => void
}) {
  const [description, setDescription]   = useState(req.description)
  const [dlpRelevance, setDlpRelevance] = useState(req.dlp_relevance)
  const [fine, setFine]                 = useState(req.fine ?? '')
  const [severity, setSeverity]         = useState<string>(req.severity)
  const [isPending, startTransition]    = useTransition()
  const [error, setError]               = useState('')
  const router = useRouter()

  function save() {
    startTransition(async () => {
      const fields: RequirementFields = {
        description,
        dlp_relevance: dlpRelevance,
        fine: fine || null,
        severity: severity as RequirementFields['severity'],
      }
      const oldFields: RequirementFields = {
        description:   req.description,
        dlp_relevance: req.dlp_relevance,
        fine:          req.fine,
        severity:      req.severity as RequirementFields['severity'],
      }
      const result = await updateRequirement(req.id, reg.id, reg.name, fields, oldFields)
      if (result.error) {
        setError(result.error)
      } else {
        onDone()
        router.refresh()
      }
    })
  }

  return (
    <tr className="bg-zinc-900/70">
      <td className="px-5 py-3 whitespace-nowrap align-top">
        <span className="text-xs font-mono text-zinc-400">{req.article}</span>
        <div className="text-[10px] text-zinc-600 mt-1 font-medium">{req.title}</div>
      </td>
      <td className="px-4 py-3" colSpan={2}>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wide">DLP Relevance</label>
            <textarea
              value={dlpRelevance}
              onChange={e => setDlpRelevance(e.target.value)}
              rows={2}
              className="mt-1 w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Severity</label>
            <select
              value={severity}
              onChange={e => setSeverity(e.target.value)}
              className="mt-1 w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-600"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-top hidden xl:table-cell">
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Fine</label>
          <input
            type="text"
            value={fine}
            onChange={e => setFine(e.target.value)}
            placeholder="e.g. €20M or 4% ARR"
            className="mt-1 w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-600"
          />
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={save}
            disabled={isPending}
            className="text-[10px] font-medium px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onDone}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
      </td>
    </tr>
  )
}

function EditRegulationForm({
  reg,
  onDone,
}: {
  reg: RegulationRow
  onDone: (updated: { summary: string; max_fine: string | null }) => void
}) {
  const [summary, setSummary]   = useState(reg.summary)
  const [maxFine, setMaxFine]   = useState(reg.max_fine ?? '')
  const [isPending, startTransition] = useTransition()
  const [error, setError]       = useState('')
  const router = useRouter()

  function save() {
    startTransition(async () => {
      const fields: RegulationFields = { summary, max_fine: maxFine || null }
      const oldFields: RegulationFields = { summary: reg.summary, max_fine: reg.max_fine }
      const result = await updateRegulation(reg.id, reg.name, fields, oldFields)
      if (result.error) {
        setError(result.error)
      } else {
        onDone({ summary, max_fine: maxFine || null })
        router.refresh()
      }
    })
  }

  return (
    <div onClick={e => e.stopPropagation()} className="mt-2 space-y-2 p-3 rounded-lg bg-zinc-800/60 border border-zinc-700">
      <div>
        <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Summary</label>
        <textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          rows={3}
          className="mt-1 w-full text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:border-blue-600"
        />
      </div>
      <div>
        <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Max Fine</label>
        <input
          type="text"
          value={maxFine}
          onChange={e => setMaxFine(e.target.value)}
          placeholder="e.g. €20M or 4% global ARR"
          className="mt-1 w-full text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-600"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={isPending}
          className="text-[10px] font-medium px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          onClick={() => onDone({ summary: reg.summary, max_fine: reg.max_fine })}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
        {error && <span className="text-[10px] text-red-400">{error}</span>}
      </div>
    </div>
  )
}

function RegulationCard({ reg }: { reg: RegulationRow }) {
  const [expanded, setExpanded]         = useState(false)
  const [editingHeader, setEditingHeader] = useState(false)
  const [localSummary, setLocalSummary] = useState(reg.summary)
  const [localMaxFine, setLocalMaxFine] = useState(reg.max_fine)
  const [editingReqId, setEditingReqId] = useState<string | null>(null)
  const fresh = freshnessInfo(reg.last_verified_at)

  const criticalCount = reg.requirements.filter(r => r.severity === 'critical').length

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40">
      {/* Card header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-zinc-900/60 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-base font-semibold text-white">{reg.short_name}</span>
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase', TYPE_COLORS[reg.type] ?? 'bg-zinc-700 text-zinc-400')}>
              {reg.type}
            </span>
            {reg.industries && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">
                {reg.industries.join(' · ')}
              </span>
            )}
          </div>

          {editingHeader ? (
            <EditRegulationForm
              reg={{ ...reg, summary: localSummary, max_fine: localMaxFine }}
              onDone={({ summary, max_fine }) => {
                setLocalSummary(summary)
                setLocalMaxFine(max_fine)
                setEditingHeader(false)
              }}
            />
          ) : (
            <>
              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{localSummary}</p>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                <span className="text-xs text-zinc-600">{reg.jurisdiction}</span>
                {localMaxFine && (
                  <span className="text-xs font-medium text-red-400">Max: {localMaxFine}</span>
                )}
                <span className="text-xs text-zinc-600">{reg.requirements.length} requirements</span>
                {criticalCount > 0 && (
                  <span className="text-[10px] text-red-400">{criticalCount} critical</span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); setEditingHeader(true) }}
                  className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <Pencil className="h-2.5 w-2.5" />
                  Edit
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className={cn('flex items-center gap-1 text-[10px]', fresh.color)}>
            {fresh.icon}
            <span>{fresh.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {reg.source_url && (
              <a
                href={reg.source_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-blue-400 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Official source
              </a>
            )}
            <VerifyButton reg={reg} />
          </div>
          {expanded
            ? <ChevronDown className="h-4 w-4 text-zinc-500 mt-1" />
            : <ChevronRight className="h-4 w-4 text-zinc-500 mt-1" />
          }
        </div>
      </button>

      {/* Requirements accordion */}
      {expanded && (
        <div className="border-t border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-5 py-2.5">Article / Section</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Requirement</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5 hidden lg:table-cell">DLP Relevance</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5">Severity</th>
                <th className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-4 py-2.5 hidden xl:table-cell">Max Fine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {reg.requirements.map(req =>
                editingReqId === req.id ? (
                  <EditRequirementRow
                    key={req.id}
                    req={req}
                    reg={reg}
                    onDone={() => setEditingReqId(null)}
                  />
                ) : (
                  <tr key={req.id} className="hover:bg-zinc-900/40 transition-colors group">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-zinc-400">{req.article}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-white mb-0.5">{req.title}</div>
                      <div className="text-xs text-zinc-500 leading-relaxed max-w-xs">{req.description}</div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-start gap-1.5">
                        <Shield className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                        <span className="text-xs text-zinc-400 leading-relaxed max-w-xs">{req.dlp_relevance}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase', SEVERITY_COLORS[req.severity] ?? 'bg-zinc-700 text-zinc-400')}>
                        {req.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400/80">{req.fine ?? '—'}</span>
                        <button
                          onClick={() => setEditingReqId(req.id)}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-all"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function RegulationsClient({
  regulations,
  allCount,
  staleCount,
  currentRegion,
  currentIndustry,
}: {
  regulations: RegulationRow[]
  allCount: number
  staleCount: number
  currentRegion: string
  currentIndustry: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      {staleCount > 0 && !bannerDismissed && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-300 flex-1">
            <span className="font-semibold">{staleCount} {staleCount === 1 ? "regulation hasn’t" : "regulations haven’t"} been verified in over 7 days.</span>
            {' '}Check each one against its official source link below and mark it verified.
          </p>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-amber-500 hover:text-amber-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {REGION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => updateFilter('region', opt.value)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-md transition-colors',
                currentRegion === opt.value
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={currentIndustry}
          onChange={e => updateFilter('industry', e.target.value)}
          className="text-xs bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-400 focus:outline-none focus:border-blue-600"
        >
          {INDUSTRY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <span className="text-xs text-zinc-600">
          {regulations.length} of {allCount} regulations
        </span>
      </div>

      {/* Regulation cards */}
      {regulations.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-zinc-800">
          <p className="text-sm text-zinc-500">No regulations match your filters.</p>
          <p className="text-xs text-zinc-600 mt-1">Try selecting a different region or industry.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {regulations.map(reg => (
            <RegulationCard key={reg.id} reg={reg} />
          ))}
        </div>
      )}
    </div>
  )
}
