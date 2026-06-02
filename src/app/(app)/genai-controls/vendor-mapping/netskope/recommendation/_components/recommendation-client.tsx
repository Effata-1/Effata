'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import type {
  NetskopeRecommendation, NetskopePolicy, NetskopeProfileEntry,
  NpjProfileType, RecommendationIssue,
} from '@/lib/genai/netskope/types'
import { FILE_SIZE_LIMIT_SOURCE } from '@/lib/genai/netskope/limitations'

// ── Chips ─────────────────────────────────────────────────────────────────────

const ACTION_CHIP: Record<string, string> = {
  allow:        'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  monitor:      'bg-blue-500/15 text-blue-400 border-blue-500/25',
  alert:        'bg-amber-500/15 text-amber-400 border-amber-500/25',
  coach:        'bg-orange-500/15 text-orange-400 border-orange-500/25',
  'coach-ack':  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'coach-just': 'bg-amber-600/15 text-amber-300 border-amber-600/25',
  block:        'bg-red-500/15 text-red-400 border-red-500/25',
}

const PROFILE_TYPE_LABEL: Record<NpjProfileType, string> = {
  content_detection:    'Content Detection',
  classification_label: 'Classification Label',
  filename_detection:   'Filename Detection',
  filetype_detection:   'Filetype Detection',
}

const PROFILE_TYPE_DOT: Record<NpjProfileType, string> = {
  content_detection:    'bg-blue-400',
  classification_label: 'bg-amber-400',
  filename_detection:   'bg-purple-400',
  filetype_detection:   'bg-teal-400',
}

function priorityBadgeClass(p: number): string {
  if (p === 100) return 'bg-red-500/15 text-red-400 border-red-500/25'
  if (p === 200) return 'bg-red-500/10 text-red-300/80 border-red-500/15'
  if (p === 300) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (p === 400) return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  if (p >= 450 && p < 500) return 'bg-blue-500/10 text-blue-400 border-blue-500/20' // custom categories
  return 'bg-muted/60 text-muted-foreground/70 border-border/60' // 500 = R/U fallback
}

const CONFIDENCE_CHIP: Record<string, string> = {
  high:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low:    'bg-red-500/10 text-red-400 border-red-500/20',
}

const ISSUE_ICON = {
  error:   <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />,
  info:    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />,
}

function ActionChip({ action }: { action: string }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-md border text-[11px] font-semibold capitalize', ACTION_CHIP[action] ?? 'bg-muted/50 text-muted-foreground border-border')}>
      {action}
    </span>
  )
}

// ── Netskope-style field row ──────────────────────────────────────────────────

function PolicyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-6 py-3.5 border-b border-border/30 last:border-0">
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 pt-0.5">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function SubField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 mb-1.5 last:mb-0">
      <span className="text-xs text-muted-foreground/50 shrink-0 pt-px">{label} =</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

// ── Netskope-style native policy card ─────────────────────────────────────────

function NativePolicyCard({ policy }: { policy: NetskopePolicy }) {
  const [implOpen, setImplOpen] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)

  const profilesByType: Partial<Record<NpjProfileType, NetskopeProfileEntry[]>> = {}
  for (const p of policy.profiles) {
    if (!profilesByType[p.profile_type]) profilesByType[p.profile_type] = []
    profilesByType[p.profile_type]!.push(p)
  }
  const typesPresent = Object.keys(profilesByType) as NpjProfileType[]

  const policyGroupLabel = (() => {
    if (policy.priority === 100) return '1. Header Policies'
    if (policy.priority === 200) return '2. Global DLP Block'
    if (policy.priority === 300) return '3. Approved Category Policies'
    if (policy.priority === 400) return '4. Conditional Category Policies'
    if (policy.priority >= 450 && policy.priority < 500) return `${policy.priority}. Custom Category Policies`
    return '5. Fallback Policies'
  })()

  const noMatchText = policy.no_match_action
    ? policy.no_match_action.charAt(0).toUpperCase() + policy.no_match_action.slice(1)
    : 'Continue Policy Evaluation (no terminal no-match action — downstream policies must evaluate)'

  const implementNote = policy.policy_type === 'access_control'
    ? `Create a Real-time Protection policy in Netskope. Set destination to ${policy.destination.strategy === 'app_tag' ? `App Tag: "${policy.destination.tag_or_category}"` : `Category: "${policy.destination.tag_or_category}"`}. Set action to Block. No DLP profile required.`
    : `Create a Real-time Protection policy in Netskope. Set destination to ${policy.destination.strategy === 'app_tag' ? `App Tag: "${policy.destination.tag_or_category}"` : `Category: "${policy.destination.tag_or_category}"`}. Add the listed DLP profiles with their respective per-profile actions. No-match action: ${noMatchText}.${policy.no_match_action === null ? ' CRITICAL: Enable "Continue Policy Evaluation" on this policy in the Netskope console so that traffic not matching a DLP profile continues to the category policies below.' : ''}`

  const rawJson = {
    policy_key:     policy.policy_key,
    name:           policy.name,
    priority:       policy.priority,
    policy_type:    policy.policy_type,
    destination:    policy.destination,
    source:         policy.source,
    activities:     policy.activities,
    profiles:       policy.profiles,
    no_match_action: policy.no_match_action,
    continue_policy_evaluation: policy.continue_policy_evaluation,
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">

      {/* Title bar */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-muted/10 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold', priorityBadgeClass(policy.priority))}>
            P{policy.priority}
          </span>
          <span className="text-sm font-bold text-foreground">{policy.name}</span>
        </div>
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium',
          policy.policy_type === 'access_control'
            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            : 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        )}>
          {policy.policy_type === 'access_control' ? 'Access Control' : 'Real-time Protection'}
        </span>
      </div>

      {/* Field rows */}
      <div className="divide-y divide-border/20">

        <PolicyRow label="Source">
          <SubField label="User">
            <span className="text-xs text-foreground/70">{policy.source.value ?? 'All Users'}</span>
          </SubField>
        </PolicyRow>

        <PolicyRow label="Destination">
          <SubField label="Category">
            <span className="text-xs text-foreground/70">{policy.destination.tag_or_category}</span>
            {policy.destination.note && (
              <span className="text-[10px] text-muted-foreground/40 ml-1">({policy.destination.note})</span>
            )}
          </SubField>
          {policy.activities.length > 0 && (
            <SubField label="Activities">
              {policy.activities.map(a => (
                <span key={a} className="px-2 py-0.5 rounded bg-muted/50 border border-border/50 text-[11px] text-foreground/60 font-medium capitalize">
                  {a.replace(/_/g, ' ')}
                </span>
              ))}
            </SubField>
          )}
        </PolicyRow>

        <PolicyRow label="Profile &amp; Action">
          {policy.profiles.length === 0 ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground/50">Action:</span>
                <ActionChip action={policy.policy_type === 'access_control' ? 'block' : (policy.no_match_action ?? 'allow')} />
              </div>
              <p className="text-[11px] text-muted-foreground/40 italic">
                {policy.policy_type === 'access_control'
                  ? 'No DLP profile — access blocked at app/category level.'
                  : 'No DLP profile — action applies to all content.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {typesPresent.map(pt => (
                <div key={pt}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', PROFILE_TYPE_DOT[pt])} />
                    <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                      {PROFILE_TYPE_LABEL[pt]}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border/40 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/20 border-b border-border/30">
                          <th className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Profile</th>
                          <th className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 w-32">Action</th>
                          <th className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Coaching</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {profilesByType[pt]!.map((p, i) => (
                          <tr key={i} className="hover:bg-muted/10">
                            <td className="px-3 py-2 text-foreground/70">{p.profile}</td>
                            <td className="px-3 py-2"><ActionChip action={p.profile_action} /></td>
                            <td className="px-3 py-2 text-muted-foreground/50">{p.coaching_template ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {/* No-match row — always shown when profiles exist */}
              <div className="flex items-center gap-2 text-xs pt-1">
                <span className="text-muted-foreground/40">No DLP profile match:</span>
                {policy.no_match_action
                  ? <ActionChip action={policy.no_match_action} />
                  : <span className="text-[11px] text-blue-400/70 italic">Continue to category policies</span>
                }
              </div>
            </div>
          )}
          {/* Continue policy evaluation */}
          {policy.continue_policy_evaluation?.recommended && (
            <div className="mt-2 rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-[11px] text-blue-400/80">
              Continue Policy Evaluation recommended — {policy.continue_policy_evaluation.applies_when}
            </div>
          )}
        </PolicyRow>

        <PolicyRow label="Policy Name">
          <p className="text-sm font-semibold text-foreground/80 mb-0.5">{policy.name}</p>
          <p className="text-[11px] text-muted-foreground/50 mb-1">Group = {policyGroupLabel}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-0.5">Policy Description</p>
          <p className="text-xs text-muted-foreground/60">
            {policy.policy_type === 'access_control'
              ? `Blocks access to ${policy.destination.tag_or_category} apps at the network layer before content inspection.`
              : `Enforces DLP controls for ${policy.destination.tag_or_category} GenAI apps. No-match: ${policy.no_match_action ?? 'continue to category policies — Continue Policy Evaluation required'}.`
            }
          </p>
        </PolicyRow>

        <PolicyRow label="Status">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400/80 shrink-0" />
            <span className="text-xs font-medium text-amber-400/80">Draft — Not Deployed</span>
          </div>
          <p className="text-[11px] text-muted-foreground/50">
            Configure in Netskope console. Set priority to <span className="font-mono">{policy.priority}</span> when deploying.
          </p>
        </PolicyRow>

      </div>

      {/* Expandable sections */}
      <div className="border-t border-border/30">
        <button
          onClick={() => setImplOpen(o => !o)}
          className="w-full flex items-center gap-2 px-6 py-3 text-left hover:bg-muted/20 transition-colors"
        >
          {implOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />}
          <span className="text-xs text-muted-foreground/60">How to implement in Netskope</span>
        </button>
        {implOpen && (
          <div className="px-6 pb-4 text-xs text-foreground/60 leading-relaxed border-t border-border/20 pt-3">
            {implementNote}
            {policy.continue_policy_evaluation && (
              <p className="mt-2 text-muted-foreground/50">
                <strong>Limitation:</strong> {policy.continue_policy_evaluation.limitation}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border/30">
        <button
          onClick={() => setJsonOpen(o => !o)}
          className="w-full flex items-center gap-2 px-6 py-3 text-left hover:bg-muted/20 transition-colors"
        >
          {jsonOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />}
          <span className="text-xs text-muted-foreground/60">View raw JSON</span>
        </button>
        {jsonOpen && (
          <div className="px-6 pb-4 border-t border-border/20 pt-3">
            <pre className="text-[11px] text-muted-foreground/70 bg-muted/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono border border-border/40">
              {JSON.stringify(rawJson, null, 2)}
            </pre>
          </div>
        )}
      </div>

    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = ['Native Policies', 'Required Objects', 'Limitations'] as const
type Tab = typeof TABS[number]

// ── Main export ───────────────────────────────────────────────────────────────

export function RecommendationClient({ recommendation: r }: { recommendation: NetskopeRecommendation }) {
  const [tab, setTab] = useState<Tab>('Native Policies')

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/genai-controls/vendor-mapping/netskope"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-foreground/70 transition-colors mb-2"
          >
            ← Netskope Mapping
          </Link>
          <h1 className="text-xl font-bold text-foreground">Netskope Policy Recommendation</h1>
          <p className="text-sm text-muted-foreground/60 mt-0.5">
            Hybrid category-based topology · {r.recommended_policies.length} native {r.recommended_policies.length === 1 ? 'policy' : 'policies'}
            {r.is_partial && <span className="ml-2 text-amber-400/80">· Partial</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-bold', CONFIDENCE_CHIP[r.confidence])}>
            {r.score} / 100
          </span>
          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium capitalize', CONFIDENCE_CHIP[r.confidence])}>
            {r.confidence} confidence
          </span>
        </div>
      </div>

      {/* Topology Rationale — dedicated section */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border/50 bg-muted/5">
          <span className="text-sm font-bold text-foreground">Why this topology was selected</span>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            Hybrid category-based · {r.recommendation_mode === 'default' ? 'Default recommendation' : r.recommendation_mode}
          </p>
        </div>
        <ul className="px-5 py-4 space-y-2.5">
          {r.why_selected.map((w, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/70">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              {w}
            </li>
          ))}
        </ul>
      </div>

      {/* Issues */}
      {r.issues.length > 0 && (
        <div className="space-y-2">
          {r.issues.map(issue => (
            <div key={issue.code} className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-2.5">
              {ISSUE_ICON[issue.severity]}
              <div className="space-y-0.5">
                <p className="text-xs text-foreground/80">{issue.description}</p>
                {issue.fix && <p className="text-[10px] text-muted-foreground/60">Fix: {issue.fix}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skipped policies */}
      {r.skipped_policies.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/6 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-amber-400">
            {r.skipped_policies.length} {r.skipped_policies.length === 1 ? 'policy was' : 'policies were'} skipped — NPJ not ready
          </p>
          {r.skipped_policies.map(sp => (
            <div key={sp.policy_id} className="flex items-start justify-between gap-3 text-xs">
              <span className="text-foreground/70">{sp.policy_name}</span>
              <div className="text-right shrink-0 space-x-1">
                <span className="text-muted-foreground/50">{sp.reason}</span>
                <span className="text-muted-foreground/30">·</span>
                <Link
                  href={`/genai-controls/policies/${sp.policy_id}/edit`}
                  className="text-blue-400/70 hover:text-blue-400 transition-colors inline-flex items-center gap-0.5"
                >
                  Fix <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'text-foreground border-b-2 border-foreground -mb-px'
                : 'text-muted-foreground/60 hover:text-muted-foreground/90',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Native Policies */}
      {tab === 'Native Policies' && (
        <div className="space-y-4">
          {r.recommended_policies.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground/60">No valid policies found. Resolve NPJ issues in the Policy Editor before generating a recommendation.</p>
            </div>
          ) : (
            r.recommended_policies.map(p => <NativePolicyCard key={p.policy_key} policy={p} />)
          )}
        </div>
      )}

      {/* Tab: Required Objects */}
      {tab === 'Required Objects' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ['DLP Profiles',             r.required_objects.dlp_profiles],
            ['Classification Labels',    r.required_objects.classification_label_profiles],
            ['Filename Profiles',        r.required_objects.filename_profiles],
            ['Filetype Profiles',        r.required_objects.filetype_profiles],
            ['Notification Templates',   r.required_objects.notification_templates],
            ['CCI App Tags',             r.required_objects.cci_app_tags],
            ['App Categories',           r.required_objects.app_categories],
            ['Policy Order',             r.required_objects.policy_order],
          ] as [string, string[]][]).filter(([, items]) => items.length > 0).map(([label, items]) => (
            <div key={label} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/50 bg-muted/5 flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground/70">{label}</span>
                <span className="text-[10px] text-muted-foreground/40">{items.length}</span>
              </div>
              <ul className="px-4 py-3 space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="text-xs text-foreground/60 flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Limitations */}
      {tab === 'Limitations' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-border/50 bg-muted/5">
              <span className="text-sm font-bold text-foreground">Known Limitations &amp; Risk Acceptance</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/10">
                    {['Area', 'Limitation', 'Practical Impact', 'Risk'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {r.limitations.map((l, i) => (
                    <tr key={i} className="hover:bg-muted/5">
                      <td className="px-4 py-3 font-medium text-foreground/70 whitespace-nowrap align-top">{l.area}</td>
                      <td className="px-4 py-3 text-muted-foreground/70 align-top">{l.limitation}</td>
                      <td className="px-4 py-3 text-muted-foreground/60 align-top">{l.practical_impact}</td>
                      <td className="px-4 py-3 align-top">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium',
                          l.risk_acceptance === 'Known'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-muted/50 text-muted-foreground/70 border-border/50',
                        )}>
                          {l.risk_acceptance}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border/30 text-[11px] text-muted-foreground/50">
              Inline inspection file size limit: <strong>{r.inline_file_size_limit_mb} MB</strong> ({FILE_SIZE_LIMIT_SOURCE.replace(/_/g, ' ')}).
              Confirm in the customer Netskope tenant before enforcement.
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-border/50 bg-muted/5">
              <span className="text-sm font-bold text-foreground">Validation Checklist</span>
            </div>
            <ul className="px-5 py-4 space-y-2.5">
              {r.validation_checklist.map(item => (
                <li key={item.id} className="flex items-start gap-2.5 text-xs">
                  <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 mt-0.5',
                    item.critical
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-muted/40 text-muted-foreground/50',
                  )}>
                    {item.critical ? 'CRITICAL' : 'CHECK'}
                  </span>
                  <span className="text-foreground/70">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

    </div>
  )
}
