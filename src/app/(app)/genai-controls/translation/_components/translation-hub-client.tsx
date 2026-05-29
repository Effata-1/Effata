'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilterSelect } from '@/components/ui/filter-select'
import { triggerTranslation, getTranslationJobStatus } from '../actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Policy {
  id:                       string
  name:                     string
  policy_family:            string | null
  primary_action:           string | null
  approval_status:          string
  vendor_translation_status: string | null
  priority:                 number
}

interface Translation {
  id:        string
  policy_id: string
  vendor_id: string
  status:    string
}

interface Props {
  policies:        Policy[]
  translations:    Translation[]
  vendorTools:     string[]
  latestJobId:     string | null
  latestJobStatus: string | null
  userRole:        string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VENDOR_DISPLAY: Record<string, string> = {
  'netskope':          'Netskope',
  'microsoft-purview': 'Purview',
  'forcepoint-dlp':    'Forcepoint',
  'skyhigh-security':  'Skyhigh',
}

const TOOL_TO_VENDOR_ID: Record<string, string> = {
  'netskope':            'netskope',
  'microsoft-purview':   'microsoft-purview',
  'microsoft purview':   'microsoft-purview',
  'purview':             'microsoft-purview',
  'forcepoint-dlp':      'forcepoint-dlp',
  'forcepoint':          'forcepoint-dlp',
  'skyhigh-security':    'skyhigh-security',
  'skyhigh security':    'skyhigh-security',
  'skyhigh':             'skyhigh-security',
}

const FIRST_WAVE = new Set(['netskope', 'microsoft-purview', 'forcepoint-dlp', 'skyhigh-security'])

const TRANSLATION_CHIP: Record<string, string> = {
  'pending':        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'translating':    'bg-blue-500/15 text-blue-300 border-blue-500/20',
  'translated':     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'partial':        'bg-amber-500/15 text-amber-300 border-amber-500/25',
  'verified':       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'deferred':       'bg-muted/60 text-muted-foreground/60 border-border/50',
  'error':          'bg-red-500/10 text-red-400 border-red-500/20',
  'not-translated': 'bg-muted/30 text-muted-foreground/40 border-border/30',
}
const TRANSLATION_LABEL: Record<string, string> = {
  'pending':        'Pending',
  'translating':    'Running',
  'translated':     'Translated',
  'partial':        'Partial',
  'verified':       'Verified',
  'deferred':       'Deferred',
  'error':          'Error',
  'not-translated': '—',
}

const ACTION_CHIP: Record<string, string> = {
  'allow':      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'monitor':    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'alert':      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'coach':      'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'coach-ack':  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'coach-just': 'bg-amber-600/15 text-amber-300 border-amber-600/25',
  'block':      'bg-red-500/10 text-red-400 border-red-500/20',
}

const APPROVAL_STYLES: Record<string, string> = {
  'approved':       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'under-review':   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'draft':          'bg-muted/60 text-muted-foreground border-border',
  'rejected':       'bg-red-500/10 text-red-400 border-red-500/20',
  'expired':        'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const APPROVAL_OPTIONS = [
  { value: 'approved',     label: 'Approved'     },
  { value: 'under-review', label: 'Under Review' },
  { value: 'draft',        label: 'Draft'        },
  { value: 'rejected',     label: 'Rejected'     },
  { value: 'expired',      label: 'Expired'      },
]

type PollStatus = 'idle' | 'polling' | 'completed' | 'failed'

// ── Component ─────────────────────────────────────────────────────────────────

export function TranslationHubClient({
  policies,
  translations,
  vendorTools,
  latestJobId,
  latestJobStatus,
  userRole,
}: Props) {
  const router                       = useRouter()
  const [isPending, startTransition] = useTransition()
  const [jobError, setJobError]      = useState<string | null>(null)
  const [pollStatus, setPollStatus]  = useState<PollStatus>(
    latestJobStatus === 'running' || latestJobStatus === 'pending' ? 'polling' : 'idle'
  )
  const [activeJobId, setActiveJobId]         = useState<string | null>(latestJobId)
  const [processedItems, setProcessedItems]   = useState<number | null>(null)
  const [totalItems, setTotalItems]           = useState<number | null>(null)
  const [searchQuery, setSearchQuery]         = useState('')
  const [approvalFilter, setApprovalFilter]   = useState('')
  const intervalRef                           = useRef<ReturnType<typeof setInterval> | null>(null)
  const inflightRef                           = useRef(false)

  // Determine which vendor columns to show
  const vendorIds = vendorTools
    .map(t => TOOL_TO_VENDOR_ID[t.toLowerCase().trim()])
    .filter((v): v is string => !!v && FIRST_WAVE.has(v))
  const uniqueVendors = [...new Set(vendorIds)]

  // Build a map: policy_id → vendor_id → status
  const translationMap = new Map<string, Map<string, Translation>>()
  for (const t of translations) {
    if (!translationMap.has(t.policy_id)) translationMap.set(t.policy_id, new Map())
    translationMap.get(t.policy_id)!.set(t.vendor_id, t)
  }

  // Polling setup
  useEffect(() => {
    if (pollStatus === 'polling' && activeJobId) {
      startPolling(activeJobId)
    }
    return () => stopPolling()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function startPolling(jobId: string) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPollStatus('polling')
    intervalRef.current = setInterval(async () => {
      if (inflightRef.current) return
      inflightRef.current = true
      try {
        const job = await getTranslationJobStatus(jobId)
        if (job.totalItems !== null) setTotalItems(job.totalItems)
        if (job.processedItems !== null) setProcessedItems(job.processedItems)
        if (job.status === 'completed') {
          stopPolling()
          setPollStatus('completed')
          router.refresh()
        } else if (job.status === 'failed') {
          stopPolling()
          setPollStatus('failed')
          setJobError(job.error ?? 'Translation job failed. Please try again.')
        }
      } catch {
        stopPolling()
        setPollStatus('failed')
        setJobError('Could not check job status. Please refresh the page.')
      } finally {
        inflightRef.current = false
      }
    }, 3000)
  }

  function handleTranslate() {
    setJobError(null)
    setProcessedItems(null)
    setTotalItems(null)
    startTransition(async () => {
      const result = await triggerTranslation()
      if ('error' in result) {
        setJobError(result.error)
      } else {
        setActiveJobId(result.jobId)
        startPolling(result.jobId)
      }
    })
  }

  // Filtering
  const filtered = policies.filter(p => {
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchApproval = !approvalFilter || p.approval_status === approvalFilter
    return matchSearch && matchApproval
  })

  const isActive   = isPending || pollStatus === 'polling'
  const progressPct =
    totalItems && totalItems > 0 && processedItems !== null
      ? Math.round((processedItems / totalItems) * 100)
      : null

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search policies…"
              className="bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border-strong w-64"
            />
          </div>
          <FilterSelect
            options={APPROVAL_OPTIONS}
            value={approvalFilter}
            onChange={setApprovalFilter}
            placeholder="All approvals"
            searchable={false}
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleTranslate}
            disabled={isActive || policies.length === 0}
            className={cn(
              'px-3 py-1.5 text-xs rounded-md transition-colors',
              isActive
                ? 'bg-blue-600/50 text-white/70 cursor-not-allowed'
                : policies.length === 0
                  ? 'bg-muted/50 text-muted-foreground cursor-not-allowed border border-border'
                  : 'bg-blue-600 text-white hover:bg-blue-700',
            )}
          >
            {isActive && (
              <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white/40 border-t-white animate-spin mr-1.5 align-[-1px]" />
            )}
            {isPending ? 'Requesting…' : isActive ? 'Translating…' : 'Translate Policies'}
          </button>
          {jobError && <p className="text-xs text-red-400 max-w-xs text-right">{jobError}</p>}
        </div>
      </div>

      {/* Progress bar */}
      {pollStatus === 'polling' && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
          <p className="text-sm text-blue-400 font-medium text-center">Translating policies into vendor-native formats…</p>
          <p className="text-xs text-muted-foreground text-center">
            Running deterministic adapter mapping for each vendor. This usually takes under a minute.
          </p>
          {progressPct !== null && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-muted-foreground/60 mb-1">
                <span>{processedItems}/{totalItems} policies</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-blue-500/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* No vendors configured */}
      {uniqueVendors.length === 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No supported DLP tools configured. Add Netskope, Microsoft Purview, Forcepoint, or Skyhigh Security in your onboarding profile to see vendor columns.
          </p>
        </div>
      )}

      {/* No policies */}
      {policies.length === 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">No policies found. Generate policies from the Policy Library first.</p>
        </div>
      )}

      {/* Table */}
      {policies.length > 0 && uniqueVendors.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-8">#</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Policy</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Family</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Action</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Approval</th>
                  {uniqueVendors.map(v => (
                    <th key={v} className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">
                      {VENDOR_DISPLAY[v] ?? v}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5 + uniqueVendors.length} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No policies match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map(policy => {
                  const policyTranslations = translationMap.get(policy.id)
                  return (
                    <tr
                      key={policy.id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground/60">{policy.priority}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/genai-controls/translation/${policy.id}`}
                          className="font-medium text-foreground hover:text-blue-400 transition-colors line-clamp-1"
                        >
                          {policy.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground/70">{policy.policy_family ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {policy.primary_action ? (
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
                            ACTION_CHIP[policy.primary_action] ?? 'bg-muted/30 text-muted-foreground/50 border-border/50',
                          )}>
                            {policy.primary_action}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
                          APPROVAL_STYLES[policy.approval_status] ?? 'bg-muted/60 text-muted-foreground border-border',
                        )}>
                          {policy.approval_status}
                        </span>
                      </td>
                      {uniqueVendors.map(vendorId => {
                        const t = policyTranslations?.get(vendorId)
                        const status = t?.status ?? 'not-translated'
                        return (
                          <td key={vendorId} className="px-4 py-3">
                            <Link href={`/genai-controls/translation/${policy.id}`}>
                              <span className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium cursor-pointer',
                                TRANSLATION_CHIP[status] ?? TRANSLATION_CHIP['not-translated'],
                              )}>
                                {TRANSLATION_LABEL[status] ?? status}
                              </span>
                            </Link>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
