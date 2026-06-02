'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import type {
  NetskopeRecommendation, NetskopePolicy, NetskopeProfileEntry,
  NpjProfileType, LimitationEntry, ValidationItem, RecommendationIssue, SkippedPolicy,
} from '@/lib/genai/netskope/types'
import { FILE_SIZE_LIMIT_SOURCE } from '@/lib/genai/netskope/limitations'

// ── Chips ─────────────────────────────────────────────────────────────────────

const ACTION_CHIP: Record<string, string> = {
  allow:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  monitor:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  alert:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  coach:        'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'coach-ack':  'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'coach-just': 'bg-amber-600/15 text-amber-300 border-amber-600/25',
  block:        'bg-red-500/10 text-red-400 border-red-500/20',
}

const PROFILE_TYPE_LABEL: Record<NpjProfileType, string> = {
  content_detection:    'Content Detection',
  classification_label: 'Classification Label',
  filename_detection:   'Filename Detection',
  filetype_detection:   'Filetype Detection',
}

const PROFILE_TYPE_COLOR: Record<NpjProfileType, string> = {
  content_detection:    'text-blue-400',
  classification_label: 'text-amber-400',
  filename_detection:   'text-purple-400',
  filetype_detection:   'text-teal-400',
}

const PRIORITY_BADGE: Record<number, string> = {
  100: 'bg-red-500/10 text-red-400 border-red-500/20',
  200: 'bg-red-500/8 text-red-300/80 border-red-500/15',
  300: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  400: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  500: 'bg-muted/60 text-muted-foreground/70 border-border/60',
}

const CONFIDENCE_CHIP: Record<string, string> = {
  high:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low:    'bg-red-500/10 text-red-400 border-red-500/20',
}

const ISSUE_SEVERITY_ICON = {
  error:   <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />,
  info:    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />,
}

// ── Helper components ─────────────────────────────────────────────────────────

function ActionChip({ action }: { action: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold', ACTION_CHIP[action] ?? 'bg-muted/50 text-muted-foreground border-border')}>
      {action}
    </span>
  )
}

function SectionCard({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className={cn('px-5 py-3.5 border-b border-border/50', accent ?? 'bg-muted/5')}>
        <span className="text-sm font-bold text-foreground">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

// ── Policy stack card ─────────────────────────────────────────────────────────

function PolicyCard({ policy }: { policy: NetskopePolicy }) {
  const [open, setOpen] = useState(false)

  const profilesByType: Partial<Record<NpjProfileType, NetskopeProfileEntry[]>> = {}
  for (const p of policy.profiles) {
    if (!profilesByType[p.profile_type]) profilesByType[p.profile_type] = []
    profilesByType[p.profile_type]!.push(p)
  }

  const typesPresent = (Object.keys(profilesByType) as NpjProfileType[])

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-card/50 hover:bg-card/80 transition-colors"
      >
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0', PRIORITY_BADGE[policy.priority] ?? 'bg-muted/50 text-muted-foreground border-border')}>
          P{policy.priority}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate block">{policy.name}</span>
          <span className="text-[10px] text-muted-foreground/50">
            {policy.policy_type === 'access_control' ? 'Access Control' : 'Real-time Protection'}
            {' · '}{policy.destination.tag_or_category}
          </span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground/60 shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border/50 divide-y divide-border/30">

          {/* Destination + activities */}
          <div className="px-5 py-3 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1">Destination</p>
              <p className="text-foreground/70">{policy.destination.tag_or_category}</p>
              <p className="text-muted-foreground/50">{policy.destination.strategy.replace(/_/g, ' ')}</p>
              {policy.destination.note && <p className="text-muted-foreground/40 mt-0.5 text-[10px]">{policy.destination.note}</p>}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1">Activities</p>
              <div className="flex flex-wrap gap-1">
                {policy.activities.map(a => (
                  <span key={a} className="px-1.5 py-0.5 rounded bg-muted/40 border border-border/50 text-[10px] text-muted-foreground/70 font-mono">{a}</span>
                ))}
              </div>
            </div>
          </div>

          {/* DLP profiles grouped by type */}
          {policy.profiles.length > 0 ? (
            <div className="px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">DLP Profiles</p>
              <div className="space-y-3">
                {typesPresent.map(pt => (
                  <div key={pt}>
                    <p className={cn('text-[10px] font-semibold mb-1', PROFILE_TYPE_COLOR[pt])}>
                      {PROFILE_TYPE_LABEL[pt]}
                    </p>
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-border/20">
                        {profilesByType[pt]!.map((p, i) => (
                          <tr key={i}>
                            <td className="py-1 pr-3 text-foreground/70 w-1/2">{p.profile}</td>
                            <td className="py-1 pr-3 w-28"><ActionChip action={p.profile_action} /></td>
                            <td className="py-1 text-muted-foreground/50 text-[10px]">{p.coaching_template ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-5 py-3">
              <p className="text-xs text-muted-foreground/40 italic">
                {policy.policy_type === 'access_control'
                  ? 'Access control policy — no content inspection profiles.'
                  : 'No enforcement profiles — all actions are Allow for this category.'}
              </p>
            </div>
          )}

          {/* No-match + continue policy eval */}
          {policy.no_match_action && (
            <div className="px-5 py-3 flex items-center gap-3 text-xs">
              <span className="text-muted-foreground/50 shrink-0">No DLP match:</span>
              <ActionChip action={policy.no_match_action} />
            </div>
          )}

          {policy.continue_policy_evaluation?.recommended && (
            <div className="px-5 py-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Continue Policy Evaluation</p>
              <p className="text-xs text-blue-400/80">Recommended — {policy.continue_policy_evaluation.applies_when}</p>
              <p className="text-[10px] text-muted-foreground/50">{policy.continue_policy_evaluation.limitation}</p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = ['Summary', 'Policy Stack', 'Required Objects', 'Limitations'] as const
type Tab = typeof TABS[number]

// ── Main export ───────────────────────────────────────────────────────────────

export function RecommendationClient({ recommendation: r }: { recommendation: NetskopeRecommendation }) {
  const [tab, setTab] = useState<Tab>('Summary')

  return (
    <div className="space-y-5 max-w-5xl">

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
            Hybrid category-based topology · Generated from {r.recommended_policies.length} policies
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

      {/* Issues + skipped policies banners */}
      {r.issues.length > 0 && (
        <div className="space-y-2">
          {r.issues.map(issue => (
            <div key={issue.code} className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-2.5">
              {ISSUE_SEVERITY_ICON[issue.severity]}
              <div className="space-y-0.5">
                <p className="text-xs text-foreground/80">{issue.description}</p>
                {issue.fix && <p className="text-[10px] text-muted-foreground/60">Fix: {issue.fix}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {r.skipped_policies.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/6 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-amber-400">{r.skipped_policies.length} {r.skipped_policies.length === 1 ? 'policy was' : 'policies were'} skipped — NPJ not ready</p>
          {r.skipped_policies.map(sp => (
            <div key={sp.policy_id} className="flex items-start justify-between gap-3 text-xs">
              <span className="text-foreground/70">{sp.policy_name}</span>
              <div className="text-right shrink-0">
                <span className="text-muted-foreground/50">{sp.reason}</span>
                <span className="text-muted-foreground/40"> · </span>
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

      {/* Tab: Summary */}
      {tab === 'Summary' && (
        <SectionCard title="Why this topology was selected">
          <ul className="px-5 py-4 space-y-2">
            {r.why_selected.map((w, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/70">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                {w}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Tab: Policy Stack */}
      {tab === 'Policy Stack' && (
        <div className="space-y-3">
          {r.recommended_policies.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground/60">No valid policies found. Resolve NPJ issues in the Policy Editor before generating a recommendation.</p>
            </div>
          ) : (
            r.recommended_policies.map(p => <PolicyCard key={p.policy_key} policy={p} />)
          )}
        </div>
      )}

      {/* Tab: Required Objects */}
      {tab === 'Required Objects' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ['DLP Profiles',          r.required_objects.dlp_profiles],
            ['Classification Labels', r.required_objects.classification_label_profiles],
            ['Filename Profiles',     r.required_objects.filename_profiles],
            ['Filetype Profiles',     r.required_objects.filetype_profiles],
            ['Notification Templates', r.required_objects.notification_templates],
            ['CCI App Tags',          r.required_objects.cci_app_tags],
            ['App Categories',        r.required_objects.app_categories],
            ['Policy Order',          r.required_objects.policy_order],
          ] as [string, string[]][]).map(([label, items]) => (
            items.length > 0 ? (
              <div key={label} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border/50 bg-muted/5">
                  <span className="text-xs font-semibold text-foreground/70">{label}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground/40">{items.length}</span>
                </div>
                <ul className="px-4 py-2 space-y-1">
                  {items.map((item, i) => (
                    <li key={i} className="text-xs text-foreground/60">{item}</li>
                  ))}
                </ul>
              </div>
            ) : null
          ))}
        </div>
      )}

      {/* Tab: Limitations */}
      {tab === 'Limitations' && (
        <div className="space-y-5">

          <SectionCard title="Known Limitations & Risk Acceptance">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Area', 'Limitation', 'Practical Impact', 'Risk'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {r.limitations.map((l, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium text-foreground/70 whitespace-nowrap">{l.area}</td>
                      <td className="px-4 py-3 text-muted-foreground/70">{l.limitation}</td>
                      <td className="px-4 py-3 text-muted-foreground/60">{l.practical_impact}</td>
                      <td className="px-4 py-3">
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
            <div className="px-4 py-3 border-t border-border/50 text-[10px] text-muted-foreground/50">
              Inline inspection file size limit: {r.inline_file_size_limit_mb} MB ({FILE_SIZE_LIMIT_SOURCE.replace(/_/g, ' ')}).
              Confirm in the customer Netskope tenant before enforcement.
            </div>
          </SectionCard>

          <SectionCard title="Validation Checklist">
            <ul className="px-5 py-4 space-y-2">
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
          </SectionCard>

        </div>
      )}

    </div>
  )
}
