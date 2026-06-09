'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Clock, Shield, ExternalLink, X, Search, ClipboardCheck } from 'lucide-react'
import type { RegulationRow } from '../page'
import { markRegulationVerified } from '../actions'
import { SearchableSelect } from '@/components/ui/searchable-select'

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
const PILL_DEFAULT = 'border-border-strong bg-card text-muted-foreground hover:border-border-strong hover:text-foreground/70'
const PILL_ACTIVE  = 'border-border-strong bg-muted text-foreground'

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

const TYPE_TABS = [
  { value: 'all',           label: 'All' },
  { value: 'privacy',       label: 'Privacy' },
  { value: 'security',      label: 'Security' },
  { value: 'sector',        label: 'Sector' },
  { value: 'framework',     label: 'Frameworks' },
  { value: 'standard',      label: 'Standards' },
  { value: 'ai_governance', label: 'AI Governance' },
]

const TYPE_DESCRIPTIONS: Record<string, string> = {
  all:           'Every DLP-relevant obligation in the current filter set.',
  privacy:       'Data protection and personal information obligations.',
  security:      'Cybersecurity, incident response, breach reporting, and resilience rules.',
  sector:        'Industry-specific obligations for finance, healthcare, government, critical infrastructure, and similar sectors.',
  framework:     'Implementation frameworks and control catalogs used to structure DLP programs.',
  standard:      'Auditable standards and certification-oriented requirements.',
  ai_governance: 'AI governance obligations that affect sensitive data use, monitoring, and control evidence.',
}

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
        className="text-[10px] font-medium px-2 py-1 rounded border border-border-strong text-muted-foreground hover:border-blue-600 hover:text-blue-400 transition-colors"
      >
        Mark verified
      </button>
    )
  }

  return (
    <div onClick={e => e.stopPropagation()} className="flex items-center gap-2 flex-wrap">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
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
        className="text-xs bg-muted border border-border-strong rounded px-2 py-1 text-foreground placeholder:text-muted-foreground/50 w-36"
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
        className="text-[10px] text-muted-foreground/80 hover:text-foreground/70"
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
  // eslint-disable-next-line react-hooks/purity
  const isNew = Date.now() - new Date(reg.created_at).getTime() < THIRTY_DAYS_MS
  /* eslint-disable react-hooks/purity */
  const isUpdated = !isNew && reg.content_updated_at &&
    Date.now() - new Date(reg.content_updated_at).getTime() < THIRTY_DAYS_MS
  /* eslint-enable react-hooks/purity */

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-opacity',
      isRelevant
        ? 'border-blue-800/50 bg-card/60'
        : 'border-border bg-card/40 opacity-60 hover:opacity-100'
    )}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(v => !v)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(v => !v)
          }
        }}
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-card/60 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-base font-semibold text-foreground">{reg.short_name}</span>
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase', TYPE_COLORS[reg.type] ?? 'bg-accent text-muted-foreground')}>
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
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/50 text-muted-foreground">
                {reg.industries.join(' · ')}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{reg.summary}</p>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="text-xs text-muted-foreground/60">{reg.jurisdiction}</span>
            {reg.max_fine && (
              <span className="text-xs font-medium text-red-400">Max: {reg.max_fine}</span>
            )}
            <span className="text-xs text-muted-foreground/60">{reg.requirements.length} requirements</span>
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
              className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border-strong hover:border-border-strong px-2 py-1 rounded transition-colors"
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
                className="flex items-center gap-1 text-[10px] text-muted-foreground/80 hover:text-blue-400 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Official source
              </a>
            )}
            <VerifyButton reg={reg} />
          </div>
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground/80 mt-1" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground/80 mt-1" />
          }
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-5 py-2.5">Article / Section</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-4 py-2.5">Requirement</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-4 py-2.5 hidden lg:table-cell">DLP Relevance</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-4 py-2.5">Severity</th>
                <th className="text-left text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide px-4 py-2.5 hidden xl:table-cell">Max Fine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {reg.requirements.map(req => (
                <tr key={req.id} className="hover:bg-card/40 transition-colors">
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className="text-xs font-mono text-muted-foreground">{req.article}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-foreground mb-0.5">{req.title}</div>
                    <div className="text-xs text-muted-foreground/80 leading-relaxed max-w-xs">{req.description}</div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-start gap-1.5">
                      <Shield className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                      <span className="text-xs text-muted-foreground leading-relaxed max-w-xs">{req.dlp_relevance}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase', SEVERITY_COLORS[req.severity] ?? 'bg-accent text-muted-foreground')}>
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
  const activeType = searchParams.get('type') ?? 'all'
  const relevantSet = useMemo(() => new Set(relevantCodes), [relevantCodes])

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`${pathname}?${params.toString()}`)
  }

  const q = searchQuery.toLowerCase().trim()
  const afterRegion = currentRegion === 'my-regions'
    ? regulations.filter(r => relevantSet.has(r.code))
    : regulations
  const searched = q
    ? afterRegion.filter(r =>
        r.short_name.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.jurisdiction.toLowerCase().includes(q)
      )
    : afterRegion

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>([['all', searched.length]])
    for (const reg of searched) {
      counts.set(reg.type, (counts.get(reg.type) ?? 0) + 1)
    }
    return counts
  }, [searched])

  const visible = activeType === 'all'
    ? searched
    : searched.filter(r => r.type === activeType)

  const visibleOrgCount = useMemo(
    () => visible.filter(r => relevantSet.has(r.code)).length,
    [visible, relevantSet]
  )

  const activeTypeLabel = TYPE_TABS.find(t => t.value === activeType)?.label ?? 'All'

  return (
    <div className="space-y-4">
      {staleCount > 0 && !bannerDismissed && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-500 flex-1">
            <span className="font-semibold">{staleCount} {staleCount === 1 ? "regulation hasn't" : "regulations haven't"} been AI-verified this month.</span>
            {' '}The monthly review runs on the 1st of each month — or verify manually using the official source links below.
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search regulations…"
          className="w-full bg-card border border-border rounded-lg pl-8 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-600"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
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
              ? 'border-blue-500 bg-blue-500/15 text-blue-500'
              : PILL_DEFAULT
            )}
          >
            For my org · {visibleOrgCount}
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

        <SearchableSelect
          options={INDUSTRY_OPTIONS}
          value={currentIndustry}
          onChange={v => updateFilter('industry', v)}
          align="right"
        />

        <span className="text-xs text-muted-foreground/60">
          {visible.length} of {allCount} regulations
        </span>
        {hasOrgProfile && relevantSet.size > 0 && (
          <span className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm bg-blue-500/40 border border-blue-800/50" />
            Highlighted = applies to your org
          </span>
        )}
      </div>

      <div className="border-b border-border">
        <div className="flex items-end gap-1 overflow-x-auto">
          {TYPE_TABS.filter(tab => tab.value === 'all' || (typeCounts.get(tab.value) ?? 0) > 0).map(tab => {
            const count = typeCounts.get(tab.value) ?? 0
            const active = activeType === tab.value

            return (
              <button
                key={tab.value}
                onClick={() => updateFilter('type', tab.value)}
                className={cn(
                  'shrink-0 px-4 py-3 text-xs font-semibold border-b-2 transition-colors',
                  active
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                <span className={cn(
                  'ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                  active ? 'bg-blue-500/15 text-blue-500' : 'bg-muted text-muted-foreground'
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{activeTypeLabel}</h2>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {TYPE_DESCRIPTIONS[activeType]}
          </p>
        </div>
        <div className="text-xs text-muted-foreground/60 shrink-0 pt-0.5">
          {visible.length} shown
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-border">
          <p className="text-sm text-muted-foreground/80">No {activeTypeLabel.toLowerCase()} items match your filters.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Try selecting another category, region, industry, or search term.</p>
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
