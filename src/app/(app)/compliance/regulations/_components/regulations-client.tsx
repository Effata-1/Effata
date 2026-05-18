'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Clock, Shield, ExternalLink, X, Search, ClipboardCheck } from 'lucide-react'
import type { RegulationRow } from '../page'
import { markRegulationVerified } from '../actions'

const REGION_OPTIONS = [
  { value: 'all',          label: 'All' },
  { value: 'Global',       label: 'Global' },
  { value: 'Europe',       label: 'Europe' },
  { value: 'Americas',     label: 'Americas' },
  { value: 'Asia-Pacific', label: 'Asia-Pacific' },
  { value: 'Middle East',  label: 'Middle East' },
  { value: 'Africa',       label: 'Africa' },
  { value: 'India',        label: 'India' },
]

const PILL_BASE = 'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors'
const PILL_DEFAULT = 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300'
const PILL_ACTIVE  = 'border-zinc-400 bg-zinc-800 text-white'

const INDUSTRY_OPTIONS = [
  { value: 'all',                     label: 'All Industries' },
  { value: 'financial',               label: 'Financial Services' },
  { value: 'healthcare',              label: 'Healthcare' },
  { value: 'technology',              label: 'Technology / SaaS' },
  { value: 'retail',                  label: 'Retail / E-commerce' },
  { value: 'critical_infrastructure', label: 'Critical Infrastructure' },
  { value: 'government',              label: 'Government' },
  { value: 'defence',                 label: 'Defence' },
  { value: 'education',               label: 'Education' },
  { value: 'telecom',                 label: 'Telecom' },
  { value: 'automotive',              label: 'Automotive' },
  { value: 'legal',                   label: 'Legal' },
  { value: 'media',                   label: 'Media & Entertainment' },
  { value: 'transport',               label: 'Transport / Logistics' },
]

const TYPE_COLORS: Record<string, string> = {
  privacy:      'bg-blue-500/15 text-blue-400',
  security:     'bg-purple-500/15 text-purple-400',
  sector:       'bg-amber-500/15 text-amber-400',
  framework:    'bg-teal-500/15 text-teal-400',
  standard:     'bg-sky-500/15 text-sky-400',
  ai_governance:'bg-rose-500/15 text-rose-400',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400',
  high:     'bg-amber-500/15 text-amber-400',
  medium:   'bg-blue-500/15 text-blue-400',
}

function freshnessInfo(lastVerified: string): { icon: React.ReactNode; label: string; color: string } {
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

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function RegulationCard({ reg, isRelevant }: { reg: RegulationRow; isRelevant: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const fresh = freshnessInfo(reg.last_verified_at)
  const criticalCount = reg.requirements.filter(r => r.severity === 'critical').length
  const isNew = Date.now() - new Date(reg.created_at).getTime() < THIRTY_DAYS_MS
  const isUpdated = !isNew && reg.content_updated_at &&
    Date.now() - new Date(reg.content_updated_at).getTime() < THIRTY_DAYS_MS

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-opacity',
      isRelevant
        ? 'border-blue-800/50 bg-zinc-900/60'
        : 'border-zinc-800 bg-zinc-900/40 opacity-60 hover:opacity-100'
    )}>
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
            {isNew && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 uppercase">
                New
              </span>
            )}
            {isUpdated && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 uppercase">
                Updated
              </span>
            )}
            {isRelevant && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">
                For your org
              </span>
            )}
            {reg.industries && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">
                {reg.industries.join(' · ')}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{reg.summary}</p>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="text-xs text-zinc-600">{reg.jurisdiction}</span>
            {reg.max_fine && (
              <span className="text-xs font-medium text-red-400">Max: {reg.max_fine}</span>
            )}
            <span className="text-xs text-zinc-600">{reg.requirements.length} requirements</span>
            {criticalCount > 0 && (
              <span className="text-[10px] text-red-400">{criticalCount} critical</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className={cn('flex items-center gap-1 text-[10px]', fresh.color)}>
            {fresh.icon}
            <span>{fresh.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/compliance/gap-report?reg=${reg.code}`}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-2 py-1 rounded transition-colors"
            >
              <ClipboardCheck className="h-3 w-3" />
              Assess
            </a>
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
              {reg.requirements.map(req => (
                <tr key={req.id} className="hover:bg-zinc-900/40 transition-colors">
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
                    <span className="text-xs text-red-400/80">{req.fine ?? '—'}</span>
                  </td>
                </tr>
              ))}
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
  relevantCodes,
  hasOrgProfile,
  currentRegion,
  currentIndustry,
}: {
  regulations: RegulationRow[]
  allCount: number
  staleCount: number
  relevantCodes: string[]
  hasOrgProfile: boolean
  currentRegion: string
  currentIndustry: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const relevantSet = new Set(relevantCodes)

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`${pathname}?${params.toString()}`)
  }

  const q = searchQuery.toLowerCase().trim()
  const afterRegion = currentRegion === 'my-regions'
    ? regulations.filter(r => relevantSet.has(r.code))
    : regulations
  const visible = q
    ? afterRegion.filter(r =>
        r.short_name.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.jurisdiction.toLowerCase().includes(q)
      )
    : afterRegion

  return (
    <div className="space-y-4">
      {staleCount > 0 && !bannerDismissed && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-300 flex-1">
            <span className="font-semibold">{staleCount} {staleCount === 1 ? "regulation hasn't" : "regulations haven't"} been verified in over 7 days.</span>
            {' '}The weekly AI review runs every Monday — or check each one manually using the official source links below.
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search regulations…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-600"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {hasOrgProfile && relevantCodes.length > 0 && (
          <button
            onClick={() => updateFilter('region', 'my-regions')}
            className={cn(PILL_BASE, currentRegion === 'my-regions'
              ? 'border-blue-500 bg-blue-500/15 text-blue-300'
              : PILL_DEFAULT
            )}
          >
            For my org · {relevantCodes.length}
          </button>
        )}

        {REGION_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => updateFilter('region', opt.value)}
            className={cn(PILL_BASE, currentRegion === opt.value ? PILL_ACTIVE : PILL_DEFAULT)}
          >
            {opt.label}
          </button>
        ))}

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
          {visible.length} of {allCount} regulations
        </span>
        {hasOrgProfile && relevantSet.size > 0 && (
          <span className="text-xs text-zinc-600 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm bg-blue-500/40 border border-blue-800/50" />
            Highlighted = applies to your org
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-zinc-800">
          <p className="text-sm text-zinc-500">No regulations match your filters.</p>
          <p className="text-xs text-zinc-600 mt-1">Try selecting a different region, industry, or search term.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(reg => (
            <RegulationCard key={reg.id} reg={reg} isRelevant={relevantSet.has(reg.code)} />
          ))}
        </div>
      )}
    </div>
  )
}
