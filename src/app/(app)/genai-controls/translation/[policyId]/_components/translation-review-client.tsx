'use client'

import { useState, useOptimistic, useTransition, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  markTranslationVerified,
  markTranslationDeferred,
  retranslatePolicy,
  getTranslationJobStatus,
} from '../../actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PolicyRule {
  data_type:   string
  post_prompt: string
  upload:      string
  download:    string
  response:    string
}

interface Policy {
  id:                        string
  name:                      string
  description:               string | null
  policy_type:               string
  policy_family:             string | null
  primary_action:            string | null
  approval_status:           string
  vendor_translation_status: string | null
  priority:                  number
  scope_all_apps:            boolean
  scope_app_ids:             string[]
  rules:                     PolicyRule[]
  data_classification_label: string | null
}

interface MappingReport {
  exact_mappings:        string[]
  lossy_mappings:        string[]
  unsupported_intent:    string[]
  unverified_vendor_areas: string[]
  tests_required:        string[]
}

interface Translation {
  id:                        string
  vendor_id:                 string
  status:                    string
  native_policies:           object[]
  mapping_report:            MappingReport
  adapter_version:           string | null
  capability_registry_version: string | null
  neutral_policy_hash:       string | null
  reviewed_by:               string | null
  reviewed_at:               string | null
  exported_at:               string | null
  created_at:                string
  updated_at:                string
}

interface Props {
  policy:       Policy
  translations: Translation[]
  vendorTools:  string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VENDOR_DISPLAY: Record<string, string> = {
  'netskope':          'Netskope',
  'microsoft-purview': 'Microsoft Purview',
  'forcepoint-dlp':    'Forcepoint DLP',
  'skyhigh-security':  'Skyhigh Security',
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
}
const TRANSLATION_LABEL: Record<string, string> = {
  'pending':        'Pending',
  'translating':    'Running',
  'translated':     'Translated',
  'partial':        'Partial',
  'verified':       'Verified',
  'deferred':       'Deferred',
  'error':          'Error',
}

const READINESS_LABEL: Record<string, string> = {
  'pending':     'Not translated',
  'translating': 'Translating…',
  'translated':  'Verify before deploying',
  'partial':     'Review required',
  'verified':    'Ready to deploy',
  'deferred':    'Deferred — revisit later',
  'error':       'Translation error',
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

// ── Component ─────────────────────────────────────────────────────────────────

export function TranslationReviewClient({ policy, translations, vendorTools }: Props) {
  const vendorIds = vendorTools
    .map(t => TOOL_TO_VENDOR_ID[t.toLowerCase().trim()])
    .filter((v): v is string => !!v && FIRST_WAVE.has(v))
  const uniqueVendors = [...new Set(vendorIds)]

  const translationByVendor = new Map(translations.map(t => [t.vendor_id, t]))

  const [activeTab, setActiveTab] = useState<string>(uniqueVendors[0] ?? '')

  const activeTranslation = activeTab ? translationByVendor.get(activeTab) : undefined

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-start gap-4">
        <Link
          href="/genai-controls/translation"
          className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Translation Hub
        </Link>
      </div>

      {/* Policy summary card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground/60 mb-1">Priority {policy.priority}</p>
            <h1 className="text-lg font-bold text-foreground">{policy.name}</h1>
            {policy.description && (
              <p className="text-sm text-muted-foreground/70 mt-1">{policy.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {policy.primary_action && (
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
                ACTION_CHIP[policy.primary_action] ?? 'bg-muted/30 text-muted-foreground/50 border-border/50',
              )}>
                {policy.primary_action}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/60">
          {policy.policy_family && <span>{policy.policy_family}</span>}
          {policy.policy_family && policy.data_classification_label && <span>·</span>}
          {policy.data_classification_label && <span>{policy.data_classification_label}</span>}
          {policy.scope_all_apps ? (
            <><span>·</span><span>All GenAI apps</span></>
          ) : policy.scope_app_ids.length > 0 ? (
            <><span>·</span><span>{policy.scope_app_ids.length} apps scoped</span></>
          ) : null}
          {policy.rules.length > 0 && (
            <><span>·</span><span>{policy.rules.length} rule{policy.rules.length !== 1 ? 's' : ''}</span></>
          )}
        </div>
      </div>

      {uniqueVendors.length === 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No supported DLP tools configured. Add vendors in your onboarding profile.
          </p>
        </div>
      )}

      {uniqueVendors.length > 0 && (
        <div className="space-y-4">
          {/* Vendor tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            {uniqueVendors.map(vendorId => {
              const t = translationByVendor.get(vendorId)
              const status = t?.status ?? 'pending'
              return (
                <button
                  key={vendorId}
                  onClick={() => setActiveTab(vendorId)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                    activeTab === vendorId
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {VENDOR_DISPLAY[vendorId] ?? vendorId}
                  <span className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium',
                    TRANSLATION_CHIP[status] ?? TRANSLATION_CHIP['pending'],
                  )}>
                    {TRANSLATION_LABEL[status] ?? status}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          {activeTab && (
            <VendorTabContent
              vendorId={activeTab}
              translation={activeTranslation ?? null}
              policyId={policy.id}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Vendor Tab Content ─────────────────────────────────────────────────────────

interface VendorTabProps {
  vendorId:    string
  translation: Translation | null
  policyId:    string
}

function VendorTabContent({ vendorId, translation, policyId }: VendorTabProps) {
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [retranslateJobId, setRetranslateJobId] = useState<string | null>(null)
  const [retranslating, setRetranslating] = useState(false)
  const [expandedPolicies, setExpandedPolicies] = useState<Set<number>>(new Set([0]))
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inflightRef = useRef(false)

  const [optimisticStatus, applyOptimistic] = useOptimistic(
    translation?.status ?? 'pending',
    (_: string, next: string) => next,
  )

  function handleVerify() {
    if (!translation) return
    setActionError(null)
    applyOptimistic('verified')
    startTransition(async () => {
      const result = await markTranslationVerified(translation.id)
      if (result.error) setActionError(result.error)
    })
  }

  function handleDefer() {
    if (!translation) return
    setActionError(null)
    applyOptimistic('deferred')
    startTransition(async () => {
      const result = await markTranslationDeferred(translation.id)
      if (result.error) setActionError(result.error)
    })
  }

  function handleRetranslate() {
    setActionError(null)
    setRetranslating(true)
    startTransition(async () => {
      const result = await retranslatePolicy(policyId)
      if ('error' in result) {
        setActionError(result.error)
        setRetranslating(false)
      } else {
        setRetranslateJobId(result.jobId)
        startPollingRetranslate(result.jobId)
      }
    })
  }

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function startPollingRetranslate(jobId: string) {
    intervalRef.current = setInterval(async () => {
      if (inflightRef.current) return
      inflightRef.current = true
      try {
        const job = await getTranslationJobStatus(jobId)
        if (job.status === 'completed') {
          stopPolling()
          setRetranslating(false)
          window.location.reload()
        } else if (job.status === 'failed') {
          stopPolling()
          setRetranslating(false)
          setActionError(job.error ?? 'Re-translation failed.')
        }
      } catch {
        stopPolling()
        setRetranslating(false)
        setActionError('Could not check retranslation status. Please refresh.')
      } finally {
        inflightRef.current = false
      }
    }, 3000)
  }

  const canVerify = translation && ['translated', 'partial'].includes(optimisticStatus)
  const canDefer  = translation && ['translated', 'partial'].includes(optimisticStatus)
  const isVerified = optimisticStatus === 'verified'
  const isDeferred = optimisticStatus === 'deferred'

  const report = translation?.mapping_report

  if (!translation || translation.status === 'pending') {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Not translated yet for {VENDOR_DISPLAY[vendorId] ?? vendorId}.</p>
        <button
          type="button"
          onClick={handleRetranslate}
          disabled={retranslating || isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {retranslating && <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
          Translate Now
        </button>
        {actionError && <p className="text-xs text-red-400">{actionError}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Status bar + actions */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <span className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium',
              TRANSLATION_CHIP[optimisticStatus] ?? TRANSLATION_CHIP['pending'],
            )}>
              {TRANSLATION_LABEL[optimisticStatus] ?? optimisticStatus}
            </span>
            {optimisticStatus === 'partial' && report && (
              <span className="text-[10px] text-amber-400/70 px-0.5">
                {report.lossy_mappings.length > 0 && `${report.lossy_mappings.length} lossy`}
                {report.lossy_mappings.length > 0 && report.tests_required.length > 0 && ' · '}
                {report.tests_required.length > 0 && `${report.tests_required.length} test${report.tests_required.length !== 1 ? 's' : ''} required`}
              </span>
            )}
          </div>
          {translation.adapter_version && (
            <span className="text-xs text-muted-foreground/50">v{translation.adapter_version}</span>
          )}
          {translation.reviewed_at && (
            <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Reviewed {new Date(translation.reviewed_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRetranslate}
            disabled={retranslating || isPending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={cn('w-3 h-3', retranslating && 'animate-spin')} />
            Re-translate
          </button>
          {canDefer && !isDeferred && (
            <button
              type="button"
              onClick={handleDefer}
              disabled={isPending}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Clock className="w-3 h-3" />
              Defer
            </button>
          )}
          {canVerify && !isVerified && (
            <button
              type="button"
              onClick={handleVerify}
              disabled={isPending}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-emerald-600/80 text-white hover:bg-emerald-600 border border-emerald-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-3 h-3" />
              Mark Verified
            </button>
          )}
          {isVerified && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Verified
            </span>
          )}
        </div>
      </div>
      {actionError && <p className="text-xs text-red-400">{actionError}</p>}

      {/* Mapping quality chips */}
      {report && (
        <div className="flex flex-wrap items-center gap-2">
          {report.exact_mappings.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-xs text-emerald-400">
              <span className="font-semibold">{report.exact_mappings.length}</span> exact
            </span>
          )}
          {report.lossy_mappings.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-500/25 bg-amber-500/10 text-xs text-amber-400">
              <span className="font-semibold">{report.lossy_mappings.length}</span> lossy
            </span>
          )}
          {report.unsupported_intent.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-red-500/25 bg-red-500/10 text-xs text-red-400">
              <span className="font-semibold">{report.unsupported_intent.length}</span> unsupported
            </span>
          )}
          {report.unverified_vendor_areas.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-blue-500/25 bg-blue-500/10 text-xs text-blue-400">
              <span className="font-semibold">{report.unverified_vendor_areas.length}</span> unverified
            </span>
          )}
          {report.tests_required.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-orange-500/25 bg-orange-500/10 text-xs text-orange-400">
              <span className="font-semibold">{report.tests_required.length}</span> tests required
            </span>
          )}
        </div>
      )}

      {/* Implementation readiness summary */}
      {report && (
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">Translation Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5 text-xs">
            <SummaryRow label="Vendor" value={VENDOR_DISPLAY[vendorId] ?? vendorId} />
            <SummaryRow
              label="Status"
              value={READINESS_LABEL[optimisticStatus] ?? optimisticStatus}
              valueClass={
                optimisticStatus === 'verified'   ? 'text-emerald-400' :
                optimisticStatus === 'partial'     ? 'text-amber-400'   :
                optimisticStatus === 'translated'  ? 'text-blue-400'    :
                'text-muted-foreground/70'
              }
            />
            <SummaryRow label="Native Policies" value={String(translation.native_policies.length)} />
            <SummaryRow label="Exact Mappings"  value={String(report.exact_mappings.length)}   valueClass="text-emerald-400" />
            <SummaryRow label="Lossy Mappings"  value={String(report.lossy_mappings.length)}   valueClass={report.lossy_mappings.length > 0 ? 'text-amber-400' : 'text-muted-foreground/70'} />
            <SummaryRow label="Tests Required"  value={String(report.tests_required.length)}   valueClass={report.tests_required.length > 0 ? 'text-orange-400' : 'text-muted-foreground/70'} />
          </div>
        </div>
      )}

      {/* Native Policies */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">Native Policies</h2>
        {translation.native_policies.length === 0 && (
          <p className="text-sm text-muted-foreground/60">No native policies generated.</p>
        )}
        {translation.native_policies.map((np, i) => {
          const isExpanded = expandedPolicies.has(i)
          const npRecord = np as Record<string, unknown>
          const policyName = (npRecord.name ?? npRecord.policy_name ?? `Policy ${i + 1}`) as string
          return (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setExpandedPolicies(prev => {
                    const next = new Set(prev)
                    if (next.has(i)) next.delete(i)
                    else next.add(i)
                    return next
                  })
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors text-left"
              >
                <span>{policyName}</span>
                <span className="text-muted-foreground/50 text-xs">{isExpanded ? '▲' : '▼'}</span>
              </button>
              {isExpanded && (
                <div className="border-t border-border">
                  <NativePolicyCard policy={npRecord} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mapping Report */}
      {report && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">Mapping Report</h2>

          <MappingList
            title="Exact Mappings"
            items={report.exact_mappings}
            chipClass="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          />
          <MappingList
            title="Lossy Mappings"
            items={report.lossy_mappings}
            chipClass="bg-amber-500/10 text-amber-400 border-amber-500/20"
          />
          <MappingList
            title="Unsupported Intent"
            items={report.unsupported_intent}
            chipClass="bg-red-500/10 text-red-400 border-red-500/20"
          />
          <MappingList
            title="Unverified Vendor Areas"
            items={report.unverified_vendor_areas}
            chipClass="bg-blue-500/10 text-blue-400 border-blue-500/20"
          />
          {report.tests_required.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground/70">Tests Required</p>
              <div className="rounded-lg border border-orange-500/25 bg-orange-500/5 p-3 space-y-2.5">
                {report.tests_required.map((item, i) => (
                  <label key={i} className="flex items-start gap-2.5 cursor-pointer group">
                    <input type="checkbox" className="mt-0.5 rounded border-orange-500/40 accent-orange-500 shrink-0" />
                    <span className="text-xs text-foreground/75 leading-relaxed">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Native Policy Card ─────────────────────────────────────────────────────────

const ACTION_CHIP_MAP: Record<string, string> = {
  'Block':  'bg-red-500/10 text-red-400 border-red-500/20',
  'Alert':  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Coach':  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Allow':  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Monitor':'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'UserNotification': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'GenerateIncidentReport': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

const SEVERITY_CHIP_MAP: Record<string, string> = {
  'Critical': 'bg-red-500/10 text-red-400 border-red-500/20',
  'High':     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Medium':   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Low':      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

// Fields rendered explicitly — excluded from the generic extra-entries table
const HEADER_FIELDS = new Set([
  'name', 'policy_name', 'status', 'action', 'severity',
  'source', 'destination', 'activities', 'dlp_profile',
  'alert', 'save_evidence', 'notification_template',
  'policy_type', 'policy_family',
  // Netskope v2
  'profile_action', 'fallback_action', 'group',
  // Skyhigh / Purview
  'mode', 'location', 'scope', 'rule_groups', 'content_conditions',
  // Forcepoint
  'source_resources', 'destination_resources', 'classifiers',
])

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2.5 border-b border-border/40 last:border-0 items-start">
      <span className="text-xs text-muted-foreground/60 pt-0.5 uppercase tracking-wide font-medium">{label}</span>
      <div>{children}</div>
    </div>
  )
}

function SummaryRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground/60">{label}</span>
      <span className={cn('font-medium', valueClass ?? 'text-foreground/80')}>{value}</span>
    </div>
  )
}

function StringChips({ values, colorClass }: { values: string[]; colorClass?: string }) {
  const cls = colorClass ?? 'bg-muted/50 text-foreground/70 border-border/50'
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v, i) => (
        <span key={i} className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium', cls)}>
          {v}
        </span>
      ))}
    </div>
  )
}

function renderValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-xs text-muted-foreground/40 italic">Not configured</span>
  }
  if (typeof value === 'boolean') {
    return (
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
        value ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-muted/50 text-muted-foreground/60 border-border/50',
      )}>
        {value ? 'Yes' : 'No'}
      </span>
    )
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-xs text-muted-foreground/40 italic">None</span>
    return <StringChips values={value.map(v => String(v))} />
  }
  if (typeof value === 'object') {
    // Render object as nested key-value rows
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span className="text-xs text-muted-foreground/40 italic">—</span>
    return (
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground/50 min-w-[80px]">{k}:</span>
            <div className="text-xs">{renderValue(k, v)}</div>
          </div>
        ))}
      </div>
    )
  }
  // For action/severity use color chips
  if (key === 'action') {
    return (
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
        ACTION_CHIP_MAP[String(value)] ?? 'bg-muted/50 text-foreground/70 border-border/50',
      )}>
        {String(value)}
      </span>
    )
  }
  if (key === 'severity') {
    return (
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
        SEVERITY_CHIP_MAP[String(value)] ?? 'bg-muted/50 text-foreground/70 border-border/50',
      )}>
        {String(value)}
      </span>
    )
  }
  return <span className="text-xs text-foreground/80">{String(value)}</span>
}

function ActionChip({ action }: { action: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
      ACTION_CHIP_MAP[action] ?? 'bg-muted/50 text-foreground/70 border-border/50',
    )}>
      {action}
    </span>
  )
}

// ── Netskope-specific card — mirrors the Netskope RT policy UI exactly ─────────

function NetskopeCard({ policy }: { policy: Record<string, unknown> }) {
  const [showRaw, setShowRaw] = useState(false)

  const source        = policy.source as Record<string, string[]> | undefined
  const destination   = policy.destination as Record<string, unknown> | undefined
  const profileAction = policy.profile_action as Array<Record<string, unknown>> | undefined
  const fallbackAction= policy.fallback_action as string | undefined
  const group         = policy.group as string | undefined
  const status        = policy.status as string | undefined

  const activities    = (destination?.activities ?? []) as string[]
  const usersOrGroups = source?.users_or_groups ?? ['All Users']
  const dlpProfiles   = profileAction?.map(pa => String(pa.dlp_profile ?? '—')) ?? []

  return (
    <div className="divide-y divide-border/40">

      {/* Source */}
      <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3.5 items-start">
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide pt-0.5">Source</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/50">User =</span>
          <StringChips values={usersOrGroups} />
        </div>
      </div>

      {/* Destination */}
      <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3.5 items-start">
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide pt-0.5">Destination</span>
        <div className="space-y-2">
          {destination?.category ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground/50">Category =</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-muted/40 text-xs text-foreground/80">
                {String(destination.category)}
              </span>
            </div>
          ) : destination?.specific_apps ? (
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground/50 pt-0.5 shrink-0">Apps =</span>
              <StringChips values={destination.specific_apps as string[]} />
            </div>
          ) : null}
          {activities.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground/50">Activities =</span>
              <StringChips values={activities} colorClass="bg-blue-500/10 text-blue-400 border-blue-500/20" />
            </div>
          )}
        </div>
      </div>

      {/* Profile & Action */}
      <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3.5 items-start">
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide pt-0.5">Profile &amp; Action</span>
        <div className="space-y-3">

          {/* DLP Profile chips row — mirrors Netskope "DLP Profile =" row above the table */}
          {dlpProfiles.length > 0 && (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground/50 shrink-0 pt-0.5">DLP Profile =</span>
              <div className="flex flex-wrap gap-1.5">
                {dlpProfiles.map((name, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-muted/40 text-xs font-mono text-foreground/80">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* PROFILE ACTION table */}
          {profileAction && profileAction.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr] bg-muted/40 px-3 py-2 border-b border-border">
                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Profile Action</span>
                <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Action</span>
              </div>
              {profileAction.map((pa, i) => {
                const actionStr = String(pa.action ?? '—')
                const template  = pa.notification_template ? String(pa.notification_template) : null
                const combined  = template ? `${actionStr} : ${template}` : actionStr
                return (
                  <div key={i} className="grid grid-cols-[1fr_1fr] items-center px-3 py-2.5 border-b border-border/40 last:border-0 gap-4">
                    <span className="text-xs text-foreground/80">{String(pa.dlp_profile ?? '—')}</span>
                    <span className="text-xs text-foreground/80">{combined}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">No DLP profile — action applies to all content</p>
          )}

          {/* Fallback: "If none of the specified profiles matches" */}
          {fallbackAction && (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] text-muted-foreground/50">If none of the specified profiles matches</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground/60">Action:</span>
                <ActionChip action={fallbackAction} />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Policy Name + Group */}
      <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3.5 items-start">
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide pt-0.5">Policy Name</span>
        <div className="space-y-1.5">
          <span className="text-xs text-foreground/80">{String(policy.name ?? '—')}</span>
          {group && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground/50">Group =</span>
              <span className="text-xs text-muted-foreground/70">{group}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3.5 items-start">
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide pt-0.5">Status</span>
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-400/70" />
            Draft — Not Deployed
          </span>
          <p className="text-[10px] text-muted-foreground/50">
            Configure in Netskope console. Set to{' '}
            <span className="font-mono">{status ?? 'enabled'}</span> when deploying.
          </p>
        </div>
      </div>

      {/* Raw JSON toggle */}
      <div className="px-5 py-3">
        <button
          type="button"
          onClick={() => setShowRaw(r => !r)}
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {showRaw ? '▲ Hide raw JSON' : '▼ View raw JSON'}
        </button>
        {showRaw && (
          <pre className="mt-2 text-xs text-muted-foreground/70 bg-muted/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono border border-border/40">
            {JSON.stringify(policy, null, 2)}
          </pre>
        )}
      </div>

    </div>
  )
}

// ── Generic card — fallback for Purview / Forcepoint / Skyhigh ─────────────────

function NativePolicyCard({ policy }: { policy: Record<string, unknown> }) {
  // Detect Netskope v2 format by presence of profile_action
  if ('profile_action' in policy) return <NetskopeCard policy={policy} />

  const [showRaw, setShowRaw] = useState(false)

  const action      = policy.action as string | undefined
  const severity    = policy.severity as string | undefined
  const status      = policy.status as string | undefined
  const activities  = policy.activities as string[] | undefined
  const source      = policy.source as Record<string, unknown> | undefined
  const destination = policy.destination as Record<string, unknown> | undefined
  const dlpProfile  = 'dlp_profile' in policy ? policy.dlp_profile : undefined
  const notification= policy.notification_template as string | null | undefined
  const mode        = policy.mode as string | undefined
  const location         = policy.location as string | undefined
  const scope            = policy.scope as Record<string, unknown> | undefined
  const ruleGroups       = policy.rule_groups as unknown[] | undefined
  const contentConditions= policy.content_conditions as string[] | undefined
  const sourceResources  = policy.source_resources as string[] | undefined
  const destResources    = policy.destination_resources as string[] | undefined
  const classifiers      = policy.classifiers as string[] | undefined
  const extraEntries = Object.entries(policy).filter(([k]) => !HEADER_FIELDS.has(k) && k !== 'name' && k !== 'policy_name')

  return (
    <div className="p-4">
      {status && (
        <div className="pb-3 mb-1 border-b border-border/40">
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
            status === 'enabled' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-muted/50 text-muted-foreground border-border',
          )}>{status}</span>
        </div>
      )}
      <div>
        {source          && <FieldRow label="Source">{renderValue('source', source)}</FieldRow>}
        {sourceResources && sourceResources.length > 0 && <FieldRow label="Source"><StringChips values={sourceResources} /></FieldRow>}
        {destination     && <FieldRow label="Destination">{renderValue('destination', destination)}</FieldRow>}
        {destResources   && destResources.length > 0 && <FieldRow label="Destination"><StringChips values={destResources} /></FieldRow>}
        {location        && <FieldRow label="Location"><span className="text-xs text-foreground/80">{location}</span></FieldRow>}
        {activities      && <FieldRow label="Activities"><StringChips values={activities} colorClass="bg-blue-500/10 text-blue-400 border-blue-500/20" /></FieldRow>}
        {action          && <FieldRow label="Action"><ActionChip action={action} /></FieldRow>}
        {severity        && <FieldRow label="Severity"><span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium', SEVERITY_CHIP_MAP[severity] ?? 'bg-muted/50 text-foreground/70 border-border/50')}>{severity}</span></FieldRow>}
        {mode            && <FieldRow label="Mode"><ActionChip action={mode} /></FieldRow>}
        {scope           && <FieldRow label="Scope">{renderValue('scope', scope)}</FieldRow>}
        {'dlp_profile' in policy && (
          <FieldRow label="DLP Profile">
            {dlpProfile
              ? <span className="text-xs font-mono text-foreground/80 bg-muted/50 px-2 py-0.5 rounded border border-border">{String(dlpProfile)}</span>
              : <span className="text-xs text-amber-400/80 italic">None — matches all content</span>}
          </FieldRow>
        )}
        {classifiers     && classifiers.length > 0 && <FieldRow label="Classifiers"><StringChips values={classifiers} colorClass="bg-purple-500/10 text-purple-400 border-purple-500/20" /></FieldRow>}
        {contentConditions && contentConditions.length > 0 && <FieldRow label="Content Conditions"><StringChips values={contentConditions} colorClass="bg-purple-500/10 text-purple-400 border-purple-500/20" /></FieldRow>}
        {ruleGroups && ruleGroups.length > 0 && (
          <FieldRow label="Rule Groups">
            <div className="space-y-2">
              {ruleGroups.map((rg, i) => (
                <div key={i} className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs space-y-1">
                  {Object.entries(rg as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2">
                      <span className="text-muted-foreground/50 min-w-[80px]">{k}:</span>
                      <div>{renderValue(k, v)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </FieldRow>
        )}
        {notification !== undefined && (
          <FieldRow label="Notification">
            {notification ? <span className="text-xs font-mono text-foreground/80">{notification}</span> : <span className="text-xs text-muted-foreground/40 italic">None</span>}
          </FieldRow>
        )}
        {extraEntries.map(([k, v]) => <FieldRow key={k} label={k.replace(/_/g, ' ')}>{renderValue(k, v)}</FieldRow>)}
        {!!(policy.policy_type || policy.policy_family) && (
          <FieldRow label="Type / Family">
            <span className="text-xs text-muted-foreground/60">
              {[policy.policy_type as string | undefined, policy.policy_family as string | undefined].filter(Boolean).join(' · ')}
            </span>
          </FieldRow>
        )}
      </div>
      <div className="pt-3">
        <button type="button" onClick={() => setShowRaw(r => !r)} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          {showRaw ? '▲ Hide raw JSON' : '▼ View raw JSON'}
        </button>
        {showRaw && (
          <pre className="mt-2 text-xs text-muted-foreground/70 bg-muted/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono border border-border/40">
            {JSON.stringify(policy, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

// ── Mapping List ───────────────────────────────────────────────────────────────

function MappingList({ title, items, chipClass }: { title: string; items: string[]; chipClass: string }) {
  if (items.length === 0) return null
  // Extract the left-border color from chipClass to use as the dot/bar accent
  const accentBorder = chipClass.split(' ').find(c => c.startsWith('border-')) ?? 'border-border'
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground/70">{title}</p>
      <div className={cn('rounded-lg border p-3 space-y-2', accentBorder, 'bg-muted/10')}>
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', chipClass.split(' ').find(c => c.startsWith('bg-')) ?? 'bg-muted')} />
            <span className="text-xs text-foreground/75 leading-relaxed">{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
