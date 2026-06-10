'use client'

import { useState, useMemo, useEffect, useRef, memo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronRight, ExternalLink, User, ArrowDownToLine, Wrench, FileText, ToggleRight, GripVertical, Download, FileJson, Loader2 } from 'lucide-react'
import { dlBlob, dlText, isoDate } from './export-utils'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type {
  NetskopeRecommendation, NetskopePolicy, NetskopeProfileEntry,
  NpjProfileType, RecommendationIssue, TopologyMode, TopologyOptionSummary,
  NetskopeCategory, StrategyOverrides, CategoryStrategyOverride, RequiredObjects, DestinationStrategyType,
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

// Semantic badge class derived from policy_key — safe after drag renumbering.
function policyKeyBadgeClass(key: string): string {
  if (key === 'netskope:prohibited_access_block')   return 'bg-red-500/15 text-red-400 border-red-500/25'
  if (key === 'netskope:always_block_global_dlp')   return 'bg-red-500/10 text-red-300/80 border-red-500/15'
  if (key.startsWith('netskope:scoped:'))            return 'bg-violet-500/10 text-violet-400 border-violet-500/20'
  if (key === 'netskope:approved_supported')         return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (key === 'netskope:approved_with_conditions')   return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  if (key.startsWith('netskope:custom:'))            return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  if (key === 'netskope:restricted_unassessed')      return 'bg-muted/60 text-muted-foreground/70 border-border/60'
  return 'bg-muted/60 text-muted-foreground/70 border-border/60'
}

// Source section badge for unified policy list (Scoped / Category / Manual).
function sourceBadge(key: string): { label: string; className: string } {
  if (key.startsWith('netskope:scoped:')) return { label: 'Scoped',   className: 'bg-violet-500/10 text-violet-400 border-violet-500/20' }
  if (key.startsWith('manual:'))          return { label: 'Manual',   className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' }
  return                                           { label: 'Category', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
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

// ── Netskope RT policy form UI primitives ────────────────────────────────────

function NtsSection({ icon: Icon, label, children }: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2 px-5 py-4">
        <Icon className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        <span className="text-xs font-bold text-foreground/70 uppercase tracking-wide">{label}</span>
      </div>
      <div className="py-3 pr-5 pl-1 space-y-2">
        {children}
      </div>
    </div>
  )
}

function NtsField({ label, value, removable = false, mono = false }: {
  label: string
  value?: React.ReactNode
  removable?: boolean
  mono?: boolean
}) {
  return (
    <div className="relative flex items-center rounded border border-border/60 bg-muted/15 px-3 py-2 pr-8">
      <span className="text-xs text-muted-foreground/60 shrink-0">{label} =</span>
      <span className={cn(
        'ml-1.5 text-xs',
        mono ? 'font-mono text-foreground/80' : 'text-foreground/80',
        !value && 'text-muted-foreground/40 italic',
      )}>
        {value ?? 'Not configured'}
      </span>
      {removable && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 text-xs">×</span>
      )}
    </div>
  )
}

function NtsActionRow({ label, value, dimmed = false }: { label: string; value: string; dimmed?: boolean }) {
  const colorClass =
    value.toLowerCase() === 'block'     ? 'text-red-400'     :
    value.toLowerCase() === 'alert'     ? 'text-amber-400'   :
    value.toLowerCase() === 'coach'     ? 'text-orange-400'  :
    value.toLowerCase() === 'allow'     ? 'text-emerald-400' :
    value.toLowerCase() === 'monitor'   ? 'text-blue-400'    :
    'text-foreground/80'
  return (
    <div className={cn('flex items-center gap-2', dimmed && 'opacity-60')}>
      <span className="text-xs text-muted-foreground/60">{label}:</span>
      <div className="flex items-center gap-1.5 rounded border border-border/60 bg-muted/15 px-2.5 py-1.5">
        <span className={cn('text-xs font-semibold capitalize', colorClass)}>{value}</span>
        <span className="text-muted-foreground/30 text-[10px]">▼</span>
      </div>
    </div>
  )
}

function NtsGreenDot() {
  return <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-1 shrink-0" />
}

// ── Netskope RT policy card — mirrors the actual Netskope policy form ─────────

const NativePolicyCard = memo(function NativePolicyCard({ policy }: { policy: NetskopePolicy }) {
  const [implOpen, setImplOpen] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)

  const profilesByType = useMemo(() => {
    const map: Partial<Record<NpjProfileType, NetskopeProfileEntry[]>> = {}
    for (const p of policy.profiles) {
      if (!map[p.profile_type]) map[p.profile_type] = []
      map[p.profile_type]!.push(p)
    }
    return map
  }, [policy.profiles])
  const typesPresent = Object.keys(profilesByType) as NpjProfileType[]

  const policyGroupLabel = (() => {
    if (policy.policy_key === 'netskope:prohibited_access_block')  return '1. Header Policies'
    if (policy.policy_key === 'netskope:always_block_global_dlp')  return '2. Global DLP Block'
    if (policy.policy_key.startsWith('netskope:scoped:'))          return 'Scoped — Pre-Category (P210–P290)'
    if (policy.policy_key === 'netskope:approved_supported')       return '3. Approved Category Policies'
    if (policy.policy_key === 'netskope:approved_with_conditions') return '4. Conditional Category Policies'
    if (policy.policy_key.startsWith('netskope:custom:'))          return 'Custom Category Policies'
    if (policy.policy_key === 'netskope:restricted_unassessed')    return '9. Fallback Policies'
    if (policy.policy_key.startsWith('manual:'))                   return 'Custom / Manual Policy'
    return 'Category Policy'
  })()

  const noMatchText = policy.no_match_action
    ? policy.no_match_action.charAt(0).toUpperCase() + policy.no_match_action.slice(1)
    : 'Not configured'

  // P200 and scoped: pass-through — no config needed.
  // Custom/unconfigured categories: admin must set no-match before deploying.
  const noMatchImplNote = policy.no_match_action === null
    ? policy.policy_key === 'netskope:always_block_global_dlp'
      ? 'No DLP profile match = no decision — standard Netskope DLP pass-through to the next category policy. No additional configuration required for this behaviour.'
      : policy.policy_key.startsWith('netskope:scoped:')
        ? 'Source/destination criteria not met or no DLP profile match = no decision — traffic passes through to the next policy. This is correct behaviour for a scoped policy.'
        : 'No-match action is not configured. Decide the no-match behaviour (Allow / Alert / Block) for this category before deploying.'
    : ''

  const dest =
    policy.destination.strategy === 'app_category'
      ? policy.destination.cci_app_tag
        ? `Category: "Generative AI" + CCI App Tag: "${policy.destination.cci_app_tag}"`
        : `Category: "${policy.destination.tag_or_category}"`
      : policy.destination.strategy === 'app_instance'
        ? `App Instance: "${policy.destination.tag_or_category}"`
        : policy.destination.strategy === 'destination_profile'
          ? `Destination Profile: "${policy.destination.tag_or_category}"`
          : policy.destination.strategy === 'cloud_app'
            ? `Cloud App: "${policy.destination.tag_or_category}"`
            : `Destination: "${policy.destination.tag_or_category}"`

  const implementNote = policy.policy_type === 'access_control'
    ? `Create a Real-time Protection policy in Netskope. Set destination to ${dest}. Set action to Block. No DLP profile required.`
    : `Create a Real-time Protection policy in Netskope. Set destination to ${dest}. Add the listed DLP profiles with their respective per-profile actions. No-match action: ${noMatchText}.${noMatchImplNote ? ` ${noMatchImplNote}` : ''}`

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

  const destLabel = dest

  const autoDescription = policy.policy_type === 'access_control'
    ? `Blocks access to ${policy.destination.tag_or_category} apps at the network layer before content inspection runs.`
    : `Enforces DLP controls for ${policy.destination.tag_or_category} GenAI apps. No-match: ${
        policy.no_match_action ?? (policy.policy_key === 'netskope:always_block_global_dlp' ? 'no decision — pass-through to category policies' : 'not configured')
      }.`

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">

      {/* Title bar — priority badge + policy type chip */}
      <div className="flex items-center justify-between px-5 py-3 bg-muted/10 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold', policyKeyBadgeClass(policy.policy_key))}>
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

      {/* Subtitle */}
      <div className="px-5 py-2 border-b border-border/30 bg-muted/5">
        <p className="text-[11px] text-muted-foreground/50">
          Activities and actions available are dependent on the type of profile and applications you selected.
        </p>
      </div>

      {/* ── Source ────────────────────────────────────────────────────── */}
      <NtsSection icon={User} label="Source">
        {/* Source criterion — mirrors Netskope's "[Type] = [Value]  ×" row */}
        <NtsField
          removable
          label={
            policy.source.type === 'user_group'          ? 'User Group' :
            policy.source.type === 'ad_group'            ? 'AD Group' :
            policy.source.type === 'organizational_unit' ? 'Organizational Unit' :
            policy.source.type === 'user'                ? 'User' :
                                                           'User'
          }
          value={policy.source.type === 'all_users' ? 'All Users' : (policy.source.value ?? '')}
        />
        {/* ADD CRITERIA — read-only visual reference matching Netskope's button */}
        <div className="flex items-center gap-0.5 px-1 pt-0.5">
          <span className="text-xs font-semibold text-primary/50 tracking-wide">ADD CRITERIA</span>
          <span className="text-[10px] text-primary/50">▾</span>
        </div>
        {/* Exclusions — mirrors Netskope's "+ EXCLUSIONS" subsection */}
        {policy.source.exclusions && policy.source.exclusions.length > 0 && (
          <div className="mt-1 space-y-1.5 border-t border-border/30 pt-2">
            <span className="block px-1 text-[10px] font-semibold text-primary/60 tracking-wide uppercase">
              + Exclusions
            </span>
            {policy.source.exclusions.map((ex, i) => (
              <NtsField
                key={i}
                removable
                label={
                  ex.type === 'user_group'          ? 'User Group' :
                  ex.type === 'organizational_unit' ? 'Organizational Unit' :
                                                      'User'
                }
                value={ex.value}
              />
            ))}
          </div>
        )}
      </NtsSection>

      {/* ── Destination ───────────────────────────────────────────────── */}
      <NtsSection icon={ArrowDownToLine} label="Destination">
        {/* Type selector */}
        <div className="flex items-center gap-2 mb-1">
          <div className="flex items-center rounded border border-border/60 bg-muted/15 px-2.5 py-1.5 gap-1.5">
            <span className="text-xs text-foreground/80 capitalize">
              {policy.destination.strategy === 'app_category'        ? 'Category'           :
               policy.destination.strategy === 'app_instance'        ? 'App Instance'       :
               policy.destination.strategy === 'destination_profile' ? 'Destination Profile':
               policy.destination.strategy === 'cloud_app'           ? 'Cloud App'          :
                                                                        policy.destination.strategy}
            </span>
            <span className="text-muted-foreground/30 text-[10px]">▼</span>
          </div>
          <NtsGreenDot />
        </div>
        {/* Category strategies: primary Category row, optional CCI App Tag constraint below */}
        {policy.destination.strategy === 'app_category' && (
          <>
            <NtsField
              label="Category"
              value={
                <>
                  {policy.destination.tag_or_category}
                  {policy.destination.note && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground/40">({policy.destination.note})</span>
                  )}
                </>
              }
            />
            {policy.destination.cci_app_tag && (
              <NtsField label="CCI App Tag" value={policy.destination.cci_app_tag} />
            )}
          </>
        )}
        {/* Non-category strategies: single row, no Category prefix */}
        {policy.destination.strategy === 'app_instance' && (
          <NtsField label="App Instance" value={policy.destination.tag_or_category} />
        )}
        {policy.destination.strategy === 'destination_profile' && (
          <NtsField label="Destination Profile" value={policy.destination.tag_or_category} />
        )}
        {policy.destination.strategy === 'cloud_app' && (
          <NtsField label="Cloud App" value={policy.destination.tag_or_category} />
        )}
        {policy.activities.length > 0 && (
          <NtsField
            label="Activities"
            value={
              <div className="flex flex-wrap gap-1 ml-1">
                {policy.activities.map(a => (
                  <span key={a} className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 text-[10px] text-foreground/60 capitalize">
                    {a.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            }
          />
        )}
      </NtsSection>

      {/* ── Profile & Action ──────────────────────────────────────────── */}
      <NtsSection icon={Wrench} label="Profile &amp; Action">
        {policy.profiles.length === 0 ? (
          // ── No DLP profiles (access control or catch-all) ────────────
          <>
            <p className="text-[11px] text-muted-foreground/40 italic px-1">
              {policy.policy_type === 'access_control'
                ? 'No DLP profile — access blocked at app/category level.'
                : 'No DLP profile — action applies to all content matching activities.'}
            </p>
            <NtsActionRow
              label="Action"
              value={policy.policy_type === 'access_control'
                ? 'Block'
                : (policy.no_match_action
                    ? policy.no_match_action.charAt(0).toUpperCase() + policy.no_match_action.slice(1)
                    : 'Allow')}
            />
          </>
        ) : (() => {
          // ── Compute per-profile vs single-action mode ─────────────────
          const uniqueActions = [...new Set(policy.profiles.map(p => p.profile_action))]
          const perProfileMode = uniqueActions.length > 1
          const singleAction   = uniqueActions.length === 1 ? uniqueActions[0] : null

          // "Continue policy evaluation" is Netskope-valid ONLY for Alert action
          const continuePeRecommended = policy.continue_policy_evaluation?.recommended
          const actionIsAlert = singleAction === 'alert' || (!perProfileMode && singleAction?.toLowerCase() === 'alert')

          // DLP Profile chips row — all profiles shown flat, + N more if > 3
          const CHIP_MAX = 3
          const visibleProfiles = policy.profiles.slice(0, CHIP_MAX)
          const extraCount = policy.profiles.length - CHIP_MAX

          return (
            <>
              {/* DLP Profile chips row */}
              <div className="relative rounded border border-border/60 bg-muted/15 px-3 py-2.5 pr-16">
                <span className="text-xs text-muted-foreground/60 shrink-0">DLP Profile =</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {visibleProfiles.map((p, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded border border-border/60 bg-muted/30 text-[11px] font-mono text-foreground/80">
                      {p.profile}
                    </span>
                  ))}
                  {extraCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded border border-border/40 bg-muted/20 text-[11px] text-muted-foreground/50">
                      + {extraCount} more
                    </span>
                  )}
                </div>
                <div className="absolute right-2 top-2.5 flex items-center gap-1.5 text-muted-foreground/30">
                  <span className="text-[11px]">ℹ</span>
                  <span className="text-xs">×</span>
                </div>
              </div>

              {perProfileMode ? (
                // ── Per-profile action table (Set action for each profile = ✓) ──
                <>
                  <div className="rounded border border-border/50 bg-muted/10 overflow-hidden">
                    {/* Table header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/40">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Profile Action</span>
                      <span className="text-[10px] text-muted-foreground/30">ℹ</span>
                    </div>
                    {/* Profile rows */}
                    {policy.profiles.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-border/30 last:border-0">
                        <span className="text-xs text-foreground/70 flex-1 min-w-0 truncate">{p.profile}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <NtsActionRow label="" value={p.profile_action.charAt(0).toUpperCase() + p.profile_action.slice(1)} />
                          {p.coaching_template && (
                            <span className="text-[10px] text-muted-foreground/50 font-mono bg-muted/30 border border-border/40 px-1.5 py-0.5 rounded max-w-[160px] truncate">
                              {p.coaching_template}
                            </span>
                          )}
                          <span className="text-muted-foreground/25 text-xs">•••</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Checked checkbox */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-3.5 h-3.5 rounded-sm border border-blue-500/60 bg-blue-500/80 flex items-center justify-center shrink-0">
                      <span className="text-white text-[9px] font-bold">✓</span>
                    </div>
                    <span className="text-xs text-foreground/70">Set action for each profile</span>
                    <NtsGreenDot />
                  </div>
                </>
              ) : (
                // ── Single action for all profiles (Set action for each profile = □) ──
                <>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <NtsActionRow
                      label="Action"
                      value={singleAction ? singleAction.charAt(0).toUpperCase() + singleAction.slice(1) : 'Alert'}
                    />
                    {policy.profiles[0]?.coaching_template && (
                      <div className="flex items-center gap-1.5 rounded border border-border/60 bg-muted/15 px-2.5 py-1.5">
                        <span className="text-xs text-muted-foreground/60">Template:</span>
                        <span className="text-xs text-foreground/80 font-mono">{policy.profiles[0].coaching_template}</span>
                        <span className="text-muted-foreground/30 text-[10px]">▼</span>
                      </div>
                    )}
                  </div>
                  {/* Unchecked checkbox */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-3.5 h-3.5 rounded-sm border border-border/60 bg-muted/20 shrink-0" />
                    <span className="text-xs text-foreground/70">Set action for each profile</span>
                    <NtsGreenDot />
                  </div>
                </>
              )}

              {/* Continue policy evaluation — only valid when action is Alert */}
              {actionIsAlert && (
                <div className="flex items-center gap-2 px-1">
                  <div className={cn(
                    'w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center',
                    continuePeRecommended
                      ? 'border-blue-500/60 bg-blue-500/80'
                      : 'border-border/60 bg-muted/20',
                  )}>
                    {continuePeRecommended && <span className="text-white text-[9px] font-bold">✓</span>}
                  </div>
                  <span className="text-xs text-foreground/70">Continue policy evaluation after match</span>
                  <span className="text-amber-400/60 text-[11px]" title={policy.continue_policy_evaluation?.limitation ?? 'When checked, Netskope continues evaluating subsequent policies even after this one matches.'}>⚠</span>
                </div>
              )}

              {/* Traffic action / no-match section */}
              {policy.no_match_action ? (
                // Explicit no-match action configured — show the section
                <div className="space-y-2">
                  <div className="border-t border-dashed border-border/50 pt-2" />
                  <div className="relative flex items-center rounded border border-border/40 bg-muted/10 px-3 py-2 pr-8">
                    <span className="text-xs text-muted-foreground/50">If none of the specified profiles matches</span>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 text-xs">×</span>
                  </div>
                  <NtsActionRow
                    label="Action"
                    value={policy.no_match_action.charAt(0).toUpperCase() + policy.no_match_action.slice(1)}
                  />
                </div>
              ) : (
                // null → Netskope default pass-through; show + ADD TRAFFIC ACTION
                <div className="space-y-1 px-1">
                  <p className="text-[11px] font-semibold text-blue-400/70">+ ADD TRAFFIC ACTION</p>
                  <p className="text-[10px] text-muted-foreground/40">
                    {policy.policy_key === 'netskope:always_block_global_dlp' || policy.policy_key.startsWith('netskope:scoped:')
                      ? 'No profile match = pass-through to next policy (correct Netskope default — no action needed).'
                      : policy.policy_key.startsWith('netskope:rf:')
                        ? 'No profile match = continue to next risk-family policy (Netskope default — no action needed).'
                        : 'Not configured — click Add Traffic Action in Netskope to set Allow / Alert / Block on no-match.'}
                  </p>
                </div>
              )}
            </>
          )
        })()}
      </NtsSection>

      {/* ── Policy Name ───────────────────────────────────────────────── */}
      <NtsSection icon={FileText} label="Policy Name">
        <div className="rounded border border-border/60 bg-muted/15 px-3 py-2">
          <span className="text-xs text-foreground/80">{policy.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded border border-border/60 bg-muted/15 px-2.5 py-1.5 gap-1.5">
            <span className="text-xs text-muted-foreground/60">Group:</span>
            <span className="text-xs text-foreground/80">{policyGroupLabel}</span>
            <span className="text-muted-foreground/30 text-[10px]">▼</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider px-1">Policy Description</p>
          <div className="rounded border border-border/60 bg-muted/15 px-3 py-2">
            <span className="text-xs text-foreground/70 leading-relaxed">{autoDescription}</span>
          </div>
        </div>
      </NtsSection>

      {/* ── Status ────────────────────────────────────────────────────── */}
      <NtsSection icon={ToggleRight} label="Status">
        <div className="flex items-center gap-2.5">
          <div className="relative w-10 h-5 rounded-full bg-blue-500 flex items-center px-0.5 shrink-0">
            <div className="w-4 h-4 rounded-full bg-white shadow-sm ml-auto" />
          </div>
          <span className="text-xs font-semibold text-foreground/80">Enabled</span>
        </div>
        <p className="text-[10px] text-muted-foreground/40">
          Set priority to <span className="font-mono">{policy.priority}</span> when deploying in Netskope console.
        </p>
      </NtsSection>

      {/* ── Implementation note (collapsible) ─────────────────────────── */}
      <div className="border-t border-border/40 px-5 py-3">
        <button
          onClick={() => setImplOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <span>{implOpen ? '▼' : '▶'}</span>
          How to implement in Netskope
        </button>
        {implOpen && (
          <div className="mt-3 space-y-2">
            <div className="border-l-2 border-blue-500/20 pl-3">
              <p className="text-[10px] font-bold text-blue-400/60 uppercase tracking-wider mb-1">Step 1</p>
              <p className="text-xs font-semibold text-foreground/80 mb-0.5">Create the Real-time Protection Policy</p>
              <p className="text-[10px] font-mono text-muted-foreground/45 mb-1">Netskope Console → Policies → Real-time Protection → New Policy</p>
              <p className="text-xs text-muted-foreground/70 leading-relaxed">{implementNote}</p>
            </div>
            {policy.continue_policy_evaluation && (
              <div className="border-l-2 border-amber-500/20 pl-3">
                <p className="text-[10px] font-bold text-amber-400/60 uppercase tracking-wider mb-1">Limitation</p>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">{policy.continue_policy_evaluation.limitation}</p>
              </div>
            )}
            <p className="text-[10px] font-mono text-muted-foreground/40">
              Destination: {destLabel}
            </p>
          </div>
        )}
      </div>

      {/* ── Raw JSON ──────────────────────────────────────────────────── */}
      <div className="border-t border-border/30 px-5 py-3">
        <button
          onClick={() => setJsonOpen(o => !o)}
          className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          {jsonOpen ? '▲ Hide raw JSON' : '▼ View raw JSON'}
        </button>
        {jsonOpen && (
          <pre className="mt-2 text-[11px] text-muted-foreground/70 bg-muted/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono border border-border/40">
            {JSON.stringify(rawJson, null, 2)}
          </pre>
        )}
      </div>

    </div>
  )
})

// ── Sortable policy card wrapper (drag handle + NativePolicyCard) ─────────────

function SortablePolicyCard({ policy }: { policy: NetskopePolicy }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: policy.policy_key,
  })
  const badge = sourceBadge(policy.policy_key)
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-start gap-1.5"
    >
      <div
        {...attributes}
        {...listeners}
        className="mt-4 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 shrink-0 p-0.5"
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium', badge.className)}>
            {badge.label}
          </span>
        </div>
        <NativePolicyCard policy={policy} />
      </div>
    </div>
  )
}

// ── Static why-selected copy for non-hybrid options ──────────────────────────

const WHY_SELECTED: Record<TopologyMode, string[]> = {
  hybrid_category_based: [], // populated from server-computed r.why_selected
  consolidated: [
    'All DLP risk families are merged into a single Real-time Protection policy covering every GenAI app category.',
    'The strictest action for each risk family is applied globally — no per-category differentiation.',
    'Minimises the number of Netskope policies to configure and maintain.',
    'Best suited for organisations that want the simplest possible policy structure and are comfortable with uniform enforcement.',
  ],
  per_risk_family: [
    'One Real-time Protection policy is created per risk family, each covering all GenAI app categories.',
    'Each policy passes traffic with no decision when the risk family profile does not match, continuing to the next policy.',
    'A P900 Fallback Visibility policy catches any traffic not matched by any risk-family policy and alerts for monitoring.',
    'Best suited for organisations that prioritise granular incident reporting over simplified policy management.',
  ],
}

// ── Topology option card ──────────────────────────────────────────────────────

function TopologyOptionCard({
  option,
  selected,
  onSelect,
}: {
  option: TopologyOptionSummary
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start gap-3 p-4 rounded-xl border bg-card text-left transition-all w-full',
        selected
          ? 'border-blue-500/40 ring-1 ring-blue-500/20 bg-blue-500/3'
          : 'border-border hover:border-border/80 hover:bg-muted/20',
      )}
    >
      <div className="flex items-center justify-between w-full gap-2">
        <span className="text-sm font-bold text-foreground">{option.label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {option.recommended && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold text-emerald-400">
              Recommended
            </span>
          )}
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold', CONFIDENCE_CHIP[option.confidence])}>
            {option.score}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground/50">{option.policy_count} {option.policy_count === 1 ? 'policy' : 'policies'} · {option.confidence} confidence</p>
      <div className="space-y-1 w-full">
        {option.trade_offs.map((t, i) => (
          <div key={i} className="space-y-0.5">
            <p className="text-[11px] text-emerald-400/80">✓ {t.pro}</p>
            <p className="text-[11px] text-amber-400/70">✗ {t.con}</p>
          </div>
        ))}
      </div>
    </button>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = ['Native Policies', 'Required Objects', 'Limitations'] as const
type Tab = typeof TABS[number]

// ── Phase 3: Strategy override helpers ───────────────────────────────────────

const OVERRIDEABLE_KEYS: Record<NetskopeCategory, string> = {
  approved_supported:       'netskope:approved_supported',
  approved_with_conditions: 'netskope:approved_with_conditions',
  restricted_unassessed:    'netskope:restricted_unassessed',
}

function applyStrategyOverrides(
  policies:  NetskopePolicy[],
  overrides: StrategyOverrides,
): NetskopePolicy[] {
  if (Object.keys(overrides).length === 0) return policies
  return policies.map(policy => {
    const cat = (Object.entries(OVERRIDEABLE_KEYS) as [NetskopeCategory, string][])
      .find(([, key]) => key === policy.policy_key)?.[0]
    if (!cat) return policy
    const override = overrides[cat]
    if (!override) return policy

    let patched = { ...policy }
    if (override.source_type === 'ad_group' && override.source_value) {
      patched = { ...patched, source: { type: 'ad_group', value: override.source_value } }
    }
    if (override.destination_type === 'app_instance' && override.destination_value) {
      patched = {
        ...patched,
        destination: {
          strategy:        'app_instance',
          tag_or_category: override.destination_value,
          cci_app_tag:     null,
          note:            null,
        },
      }
    }
    return patched
  })
}

// ── Required object collector for manual/custom policies ─────────────────────
// The topology and scoped engines collect their own required objects. Manual policies
// go through neither, so their DLP profiles, source identities, and destinations
// must be collected separately and merged before the Required Objects tab renders.

function collectManualRequiredObjects(policies: NetskopePolicy[]) {
  const dlp                  = new Set<string>()
  const classLabel           = new Set<string>()
  const filename             = new Set<string>()
  const filetype             = new Set<string>()
  const notifications        = new Set<string>()
  const cciTags              = new Set<string>()
  const appCategories        = new Set<string>()
  const appInstances         = new Set<string>()
  const destProfiles         = new Set<string>()
  const cloudApps            = new Set<string>()
  const userGroups           = new Set<string>()
  const adGroups             = new Set<string>()
  const users                = new Set<string>()
  const orgUnits             = new Set<string>()

  for (const policy of policies) {
    for (const prof of policy.profiles) {
      if      (prof.profile_type === 'content_detection')    dlp.add(prof.profile)
      else if (prof.profile_type === 'classification_label') classLabel.add(prof.profile)
      else if (prof.profile_type === 'filename_detection')   filename.add(prof.profile)
      else if (prof.profile_type === 'filetype_detection')   filetype.add(prof.profile)
      if (prof.coaching_template) notifications.add(prof.coaching_template)
    }
    const src = policy.source
    if      (src.type === 'user_group'          && src.value) userGroups.add(src.value)
    else if (src.type === 'ad_group'            && src.value) adGroups.add(src.value)
    else if (src.type === 'user'                && src.value) users.add(src.value)
    else if (src.type === 'organizational_unit' && src.value) orgUnits.add(src.value)
    const dst = policy.destination
    if (dst.strategy === 'app_category') {
      appCategories.add(dst.tag_or_category)
      if (dst.cci_app_tag) cciTags.add(dst.cci_app_tag)
    } else if (dst.strategy === 'app_instance')        appInstances.add(dst.tag_or_category)
    else if   (dst.strategy === 'destination_profile') destProfiles.add(dst.tag_or_category)
    else if   (dst.strategy === 'cloud_app')           cloudApps.add(dst.tag_or_category)
  }

  return {
    dlp_profiles:                  [...dlp],
    classification_label_profiles: [...classLabel],
    filename_profiles:             [...filename],
    filetype_profiles:             [...filetype],
    notification_templates:        [...notifications],
    cci_app_tags:                  [...cciTags],
    app_categories:                [...appCategories],
    app_instances:                 [...appInstances],
    destination_profiles:          [...destProfiles],
    cloud_apps:                    [...cloudApps],
    user_groups:                   [...userGroups],
    ad_groups:                     [...adGroups],
    users:                         [...users],
    organizational_units:          [...orgUnits],
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export function RecommendationClient({ recommendation: r, orgCategories = [] }: { recommendation: NetskopeRecommendation; orgCategories?: { system_tag: string | null; name: string }[] }) {
  const [tab, setTab]               = useState<Tab>('Native Policies')
  const [selectedMode, setSelectedMode] = useState<TopologyMode>(
    () => r.topology_options.find(o => o.recommended)?.mode ?? 'hybrid_category_based'
  )
  const [strategyOverrides, setStrategyOverrides] = useState<StrategyOverrides>({})
  const [strategyPanelOpen, setStrategyPanelOpen] = useState(false)
  const [exportOpen,  setExportOpen]  = useState(false)
  const [exporting,   setExporting]   = useState<'pdf' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // generateTopologyOptions always returns [hybrid, consolidated, per_risk_family] — never empty
  const activeOption = (
    r.topology_options.find(o => o.mode === selectedMode)
    ?? r.topology_options.find(o => o.recommended)
    ?? r.topology_options[0]
  )!

  const whySelected = selectedMode === 'hybrid_category_based'
    ? r.why_selected
    : WHY_SELECTED[selectedMode]

  // Unified policy list — all sections merged and sorted by priority.
  // Uses activeOption.policies (not r.recommended_policies) so topology selection is respected.
  const allPolicies = useMemo<NetskopePolicy[]>(() => {
    const combined = [
      ...(r.scoped_policies?.policies ?? []),
      ...activeOption.policies,
      ...r.manual_policies,
    ]
    return combined.sort((a, b) => a.priority - b.priority)
  }, [r, activeOption])

  // Drag-reorder state — null means "use allPolicies order" (no custom order applied).
  // Storing only keys (not the full policy objects) means allPolicies changes (topology switch)
  // automatically reset the order without needing a useEffect setState-in-effect.
  const [orderKeys, setOrderKeys] = useState<string[] | null>(null)

  const orderedPolicies = useMemo<NetskopePolicy[]>(() => {
    if (!orderKeys) return allPolicies
    const byKey = new Map(allPolicies.map(p => [p.policy_key, p]))
    const ordered = orderKeys.map(k => byKey.get(k)).filter(Boolean) as NetskopePolicy[]
    // Renumber priorities sequentially so policy cards show the correct deployment order.
    // Semantics (labels, notes) derive from policy_key, not priority, so this is safe.
    return ordered.map((p, i) => ({ ...p, priority: 100 + i * 10 }))
  }, [allPolicies, orderKeys])

  const patchedPolicies = useMemo(
    () => applyStrategyOverrides(orderedPolicies, strategyOverrides),
    [orderedPolicies, strategyOverrides],
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    // orderedPolicies is a stable memo value — safe to read directly here.
    const currentKeys = orderedPolicies.map(p => p.policy_key)
    const oldIdx = currentKeys.indexOf(active.id as string)
    const newIdx = currentKeys.indexOf(over.id as string)
    if (oldIdx === -1 || newIdx === -1) return
    setOrderKeys(arrayMove(currentKeys, oldIdx, newIdx))
  }

  // ── Export ────────────────────────────────────────────────────────────────

  // Close export dropdown on outside click.
  useEffect(() => {
    if (!exportOpen) return
    function handleOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [exportOpen])

  const allIssues = useMemo(
    () => [...r.issues, ...(r.scoped_policies?.issues ?? [])],
    [r.issues, r.scoped_policies],
  )

  const combinedRequiredObjects = useMemo((): RequiredObjects => {
    const base   = activeOption.required_objects
    const scoped = r.scoped_policies?.required_objects
    const manual = collectManualRequiredObjects(r.manual_policies)

    const adGroupsFromOverrides = (Object.values(strategyOverrides) as (CategoryStrategyOverride | undefined)[])
      .filter((o): o is CategoryStrategyOverride => !!o && o.source_type === 'ad_group' && !!o.source_value)
      .map(o => o.source_value!)
    const appInstancesFromOverrides = (Object.values(strategyOverrides) as (CategoryStrategyOverride | undefined)[])
      .filter((o): o is CategoryStrategyOverride => !!o && o.destination_type === 'app_instance' && !!o.destination_value)
      .map(o => o.destination_value!)

    if (!scoped) {
      return {
        ...base,
        dlp_profiles:                  [...new Set([...base.dlp_profiles,                  ...manual.dlp_profiles])],
        classification_label_profiles: [...new Set([...base.classification_label_profiles, ...manual.classification_label_profiles])],
        filename_profiles:             [...new Set([...base.filename_profiles,             ...manual.filename_profiles])],
        filetype_profiles:             [...new Set([...base.filetype_profiles,             ...manual.filetype_profiles])],
        notification_templates:        [...new Set([...base.notification_templates,        ...manual.notification_templates])],
        cci_app_tags:                  [...new Set([...(base.cci_app_tags ?? []),           ...manual.cci_app_tags])],
        app_categories:                [...new Set([...(base.app_categories ?? []),         ...manual.app_categories])],
        ad_groups:                     [...new Set([...(base.ad_groups ?? []),              ...adGroupsFromOverrides, ...manual.ad_groups])],
        app_instances:                 [...new Set([...(base.app_instances ?? []),          ...appInstancesFromOverrides, ...manual.app_instances])],
        destination_profiles:          [...new Set([...(base.destination_profiles ?? []),   ...manual.destination_profiles])],
        cloud_apps:                    [...new Set([...(base.cloud_apps ?? []),             ...manual.cloud_apps])],
        user_groups:                   [...new Set([...(base.user_groups ?? []),            ...manual.user_groups])],
        users:                         [...new Set([...(base.users ?? []),                  ...manual.users])],
        organizational_units:          [...new Set([...(base.organizational_units ?? []),   ...manual.organizational_units])],
        policy_order:                  orderedPolicies.map(p => p.name),
      }
    }
    return {
      dlp_profiles:                  [...new Set([...base.dlp_profiles,                  ...scoped.dlp_profiles,  ...manual.dlp_profiles])],
      classification_label_profiles: [...new Set([...base.classification_label_profiles, ...scoped.classification_label_profiles, ...manual.classification_label_profiles])],
      filename_profiles:             [...new Set([...base.filename_profiles,             ...scoped.filename_profiles, ...manual.filename_profiles])],
      filetype_profiles:             [...new Set([...base.filetype_profiles,             ...scoped.filetype_profiles, ...manual.filetype_profiles])],
      notification_templates:        [...new Set([...base.notification_templates,        ...scoped.notification_templates, ...manual.notification_templates])],
      cci_app_tags:                  [...new Set([...base.cci_app_tags,                  ...scoped.cci_app_tags,  ...manual.cci_app_tags])],
      app_categories:                [...new Set([...base.app_categories,                ...scoped.app_categories, ...manual.app_categories])],
      app_instances:                 [...new Set([...scoped.app_instances,               ...appInstancesFromOverrides, ...manual.app_instances])],
      app_instance_tags:             [...base.app_instance_tags],
      destination_profiles:          [...new Set([...scoped.destination_profiles,        ...manual.destination_profiles])],
      cloud_apps:                    [...new Set([...scoped.cloud_apps,                  ...manual.cloud_apps])],
      user_groups:                   [...new Set([...scoped.user_groups,                 ...manual.user_groups])],
      ad_groups:                     [...new Set([...scoped.ad_groups,                   ...adGroupsFromOverrides, ...manual.ad_groups])],
      users:                         [...new Set([...scoped.users,                       ...manual.users])],
      organizational_units:          [...new Set([...scoped.organizational_units,        ...manual.organizational_units])],
      policy_order:                  orderedPolicies.map(p => p.name),
    }
  }, [activeOption.required_objects, r.scoped_policies, r.manual_policies, strategyOverrides, orderedPolicies])

  const activeLimitations = useMemo(() => {
    const hasAppInstanceOverride = (Object.values(strategyOverrides) as (CategoryStrategyOverride | undefined)[])
      .some(o => o?.destination_type === 'app_instance' && !!o.destination_value)
    if (!hasAppInstanceOverride) return r.limitations
    return [
      ...r.limitations,
      {
        area:             'App instance destination override',
        limitation:       'Policy destination has been overridden to target a specific app instance instead of Category + CCI App Tag.',
        practical_impact: 'The app instance must exist in Netskope and be correctly mapped before deployment. Category-based catch-all coverage (Category = Generative AI) no longer applies for this category.',
        risk_acceptance:  'Accepted' as const,
      },
    ]
  }, [r.limitations, strategyOverrides])

  // Export handlers declared after combinedRequiredObjects + activeLimitations
  // so React Compiler can safely memoize those values (lint: no forward-ref closures).
  function handleExportJson() {
    setExportError(null)
    const pkg = {
      meta: {
        generated_at: new Date().toISOString(),
        topology:     selectedMode,
        confidence:   activeOption.confidence,
        score:        activeOption.score,
        is_partial:   r.is_partial,
      },
      policies:             patchedPolicies,
      required_objects:     combinedRequiredObjects,
      limitations:          activeLimitations,
      validation_checklist: r.validation_checklist,
      skipped_policies:     r.skipped_policies,
    }
    dlText(JSON.stringify(pkg, null, 2), `netskope-policy-pack-${isoDate()}.json`, 'application/json')
    setExportOpen(false)
  }

  async function handleExportPdf() {
    setExporting('pdf')
    setExportError(null)
    setExportOpen(false)
    try {
      const [{ pdf }, { RecommendationPdf }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./recommendation-pdf'),
      ])
      const blob = await pdf(
        <RecommendationPdf
          policies={patchedPolicies}
          required_objects={combinedRequiredObjects}
          limitations={activeLimitations}
          validation_checklist={r.validation_checklist}
          why_selected={whySelected}
          topology={selectedMode}
          confidence={activeOption.confidence}
          score={activeOption.score}
          generated_at={new Date().toISOString()}
        />
      ).toBlob()
      dlBlob(blob, `netskope-policy-pack-${isoDate()}.pdf`)
    } catch (err) {
      console.error('PDF export failed', err)
      setExportError('PDF export failed. Try JSON.')
    } finally {
      setExporting(null)
    }
  }

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
          <h1 className="text-xl font-bold text-foreground">Netskope Policy Pack</h1>
          <p className="text-sm text-muted-foreground/60 mt-0.5">
            {activeOption.label} · {allPolicies.length} {allPolicies.length === 1 ? 'policy' : 'policies'} total
            {r.scoped_policies && r.scoped_policies.policies.length > 0 && (
              <span className="ml-1 text-violet-400/80">· {r.scoped_policies.policies.length} scoped</span>
            )}
            {r.manual_policies.length > 0 && (
              <span className="ml-1 text-zinc-400/80">· {r.manual_policies.length} manual</span>
            )}
            {r.is_partial && <span className="ml-2 text-amber-400/80">· Partial</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-bold', CONFIDENCE_CHIP[activeOption.confidence])}>
            {activeOption.score} / 100
          </span>
          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium capitalize', CONFIDENCE_CHIP[activeOption.confidence])}>
            {activeOption.confidence} confidence
          </span>

          {/* Export button + dropdown */}
          <div ref={exportMenuRef} className="relative">
            <button
              type="button"
              disabled={exporting === 'pdf'}
              onClick={() => setExportOpen(o => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground/80 hover:bg-muted/30 transition-colors disabled:opacity-60"
            >
              {exporting === 'pdf'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />}
              {exporting === 'pdf' ? 'Generating…' : 'Export'}
              {exporting !== 'pdf' && <ChevronDown className="w-3 h-3 text-muted-foreground/50" />}
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-10 rounded-lg border border-border bg-card shadow-lg py-1 min-w-[160px]">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="w-full text-left px-3 py-2 text-xs text-foreground/80 hover:bg-muted/30 transition-colors flex items-center gap-2"
                >
                  <FileJson className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  Download JSON
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="w-full text-left px-3 py-2 text-xs text-foreground/80 hover:bg-muted/30 transition-colors flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  Download PDF
                </button>
              </div>
            )}

            {exportError && (
              <p className="absolute right-0 top-full mt-1 text-[11px] text-red-400 whitespace-nowrap bg-card border border-red-500/20 rounded px-2 py-1">
                {exportError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Scoped overflow warning — still shown above tabs when relevant */}
      {r.scoped_policies && r.scoped_policies.overflow_count > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-[11px] text-amber-400/80">
            {r.scoped_policies.overflow_count} scoped {r.scoped_policies.overflow_count === 1 ? 'policy group' : 'policy groups'} exceeded the 8-policy slot limit and were not generated. Reduce scoped NPJs or adjust priorities manually in Netskope.
          </p>
        </div>
      )}

      {/* Topology option selector */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-border/50 bg-muted/5 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">Choose Topology</span>
          <span className="text-[11px] text-muted-foreground/40">{r.topology_options.length} options</span>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {r.topology_options.map(option => (
            <TopologyOptionCard
              key={option.mode}
              option={option}
              selected={option.mode === selectedMode}
              onSelect={() => { setSelectedMode(option.mode); setOrderKeys(null) }}
            />
          ))}
        </div>
      </div>

      {/* Strategy Override Panel — collapsible */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setStrategyPanelOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">Strategy Overrides · Source / Destination</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/40 text-muted-foreground/60 border border-border/40">Optional</span>
          </div>
          {strategyPanelOpen
            ? <ChevronDown className="w-4 h-4 text-muted-foreground/50" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          }
        </button>
        {strategyPanelOpen && (
          <div className="border-t border-border/30 px-5 py-4 space-y-4">
            {selectedMode !== 'hybrid_category_based' && (
              <p className="text-[11px] text-amber-400/80 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Source / Destination overrides apply to Hybrid Category-Based topology only. Inputs are disabled for other topologies.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/50">
              Override the default source (All Users) or destination (Category + CCI App Tag) per governance category. Scoped policies above are not affected.
            </p>
            {(
              [
                ['approved_supported',      ['enterprise-approved',        'approved_supported'],      'Approved & Supported'],
                ['approved_with_conditions', ['approved-with-conditions',   'approved_with_conditions'], 'Approved with Conditions'],
                ['restricted_unassessed',   ['permitted-with-restriction', 'restricted_unassessed'],   'Restricted / Unassessed'],
              ] as [NetskopeCategory, string[], string][]
            ).map(([cat, dbTags, fallback]) => {
              const label = orgCategories.find(c => dbTags.includes(c.system_tag ?? ''))?.name ?? fallback
              const override = strategyOverrides[cat]
              const disabled = selectedMode !== 'hybrid_category_based'
              return (
                <div key={cat} className="grid grid-cols-[160px_1fr_1fr_auto] gap-3 items-start">
                  <span className="text-xs font-medium text-foreground/70 pt-2">{label}</span>
                  {/* Source */}
                  <div className="space-y-1">
                    <select
                      disabled={disabled}
                      value={override?.source_type ?? 'all_users'}
                      onChange={e => {
                        const v = e.target.value as 'all_users' | 'ad_group'
                        setStrategyOverrides(prev => {
                          const currentDest    = prev[cat]?.destination_type  ?? 'app_category'
                          const currentDestVal = prev[cat]?.destination_value ?? null
                          // Both at defaults → remove entry entirely (no phantom state)
                          if (v === 'all_users' && currentDest === 'app_category') {
                            const next = { ...prev }; delete next[cat]; return next
                          }
                          return {
                            ...prev,
                            [cat]: {
                              source_type:       v,
                              source_value:      v === 'all_users' ? null : (prev[cat]?.source_value ?? ''),
                              destination_type:  currentDest,
                              destination_value: currentDestVal,
                            },
                          }
                        })
                      }}
                      className="w-full text-xs bg-muted border border-border/50 rounded px-2 py-1.5 text-foreground/70 focus:outline-none disabled:opacity-40"
                    >
                      <option value="all_users">All Users (Default)</option>
                      <option value="ad_group">AD Group</option>
                    </select>
                    {override?.source_type === 'ad_group' && (
                      <input
                        type="text"
                        disabled={disabled}
                        placeholder="Group name…"
                        value={override.source_value ?? ''}
                        onChange={e => setStrategyOverrides(prev => ({
                          ...prev,
                          [cat]: { ...prev[cat]!, source_value: e.target.value || null },
                        }))}
                        className={cn(
                          'w-full text-xs bg-muted border rounded px-2 py-1.5 text-foreground/70 focus:outline-none disabled:opacity-40',
                          !override.source_value ? 'border-red-500/40' : 'border-border/50',
                        )}
                      />
                    )}
                  </div>
                  {/* Destination */}
                  <div className="space-y-1">
                    <select
                      disabled={disabled}
                      value={override?.destination_type ?? 'app_category'}
                      onChange={e => {
                        const v = e.target.value as DestinationStrategyType
                        setStrategyOverrides(prev => {
                          const currentSrc    = prev[cat]?.source_type  ?? 'all_users'
                          const currentSrcVal = prev[cat]?.source_value ?? null
                          // Both at defaults → remove entry entirely (no phantom state)
                          if (v === 'app_category' && currentSrc === 'all_users') {
                            const next = { ...prev }; delete next[cat]; return next
                          }
                          return {
                            ...prev,
                            [cat]: {
                              source_type:       currentSrc,
                              source_value:      currentSrcVal,
                              destination_type:  v,
                              destination_value: v === 'app_category' ? null : (prev[cat]?.destination_value ?? ''),
                            },
                          }
                        })
                      }}
                      className="w-full text-xs bg-muted border border-border/50 rounded px-2 py-1.5 text-foreground/70 focus:outline-none disabled:opacity-40"
                    >
                      <option value="app_category">Category + CCI App Tag (Default)</option>
                      <option value="app_instance">App Instance</option>
                    </select>
                    {override?.destination_type === 'app_instance' && (
                      <input
                        type="text"
                        disabled={disabled}
                        placeholder="Instance name…"
                        value={override.destination_value ?? ''}
                        onChange={e => setStrategyOverrides(prev => ({
                          ...prev,
                          [cat]: { ...prev[cat]!, destination_value: e.target.value || null },
                        }))}
                        className={cn(
                          'w-full text-xs bg-muted border rounded px-2 py-1.5 text-foreground/70 focus:outline-none disabled:opacity-40',
                          !override.destination_value ? 'border-red-500/40' : 'border-border/50',
                        )}
                      />
                    )}
                  </div>
                  {/* Reset */}
                  <button
                    type="button"
                    disabled={disabled || !override}
                    onClick={() => setStrategyOverrides(prev => {
                      const next = { ...prev }
                      delete next[cat]
                      return next
                    })}
                    className="mt-2 text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 disabled:opacity-0 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Topology Rationale — updates with selected option */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border/50 bg-muted/5">
          <span className="text-sm font-bold text-foreground">Why this topology was selected</span>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            {activeOption.label} · {r.recommendation_mode === 'default' ? 'Default recommendation' : r.recommendation_mode}
          </p>
        </div>
        <ul className="px-5 py-4 space-y-2.5">
          {whySelected.map((w, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/70">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              {w}
            </li>
          ))}
        </ul>
      </div>

      {/* Issues */}
      {allIssues.length > 0 && (
        <div className="space-y-2">
          {allIssues.map((issue, i) => (
            <div key={`${issue.code}-${i}`} className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-2.5">
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
          {patchedPolicies.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground/60">No valid policies found. Resolve NPJ issues in the Policy Editor before generating a recommendation.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground/40">
                  {patchedPolicies.length} {patchedPolicies.length === 1 ? 'policy' : 'policies'} · drag to reorder before export
                </p>
                {orderKeys && (
                  <button
                    type="button"
                    onClick={() => setOrderKeys(null)}
                    className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                  >
                    Reset order
                  </button>
                )}
              </div>
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={patchedPolicies.map(p => p.policy_key)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {patchedPolicies.map(p => (
                      <SortablePolicyCard key={p.policy_key} policy={p} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>
      )}

      {/* Tab: Required Objects */}
      {tab === 'Required Objects' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ['DLP Profiles',             combinedRequiredObjects.dlp_profiles],
            ['Classification Labels',    combinedRequiredObjects.classification_label_profiles],
            ['Filename Profiles',        combinedRequiredObjects.filename_profiles],
            ['Filetype Profiles',        combinedRequiredObjects.filetype_profiles],
            ['Notification Templates',   combinedRequiredObjects.notification_templates],
            ['CCI App Tags',             combinedRequiredObjects.cci_app_tags],
            ['App Categories',           combinedRequiredObjects.app_categories],
            ['App Instances',            combinedRequiredObjects.app_instances],
            ['Destination Profiles',     combinedRequiredObjects.destination_profiles],
            ['Cloud Apps',               combinedRequiredObjects.cloud_apps],
            ['User Groups',              combinedRequiredObjects.user_groups],
            ['AD Groups',                combinedRequiredObjects.ad_groups],
            ['Users',                    combinedRequiredObjects.users],
            ['Organizational Units',     combinedRequiredObjects.organizational_units],
            ['Policy Order',             combinedRequiredObjects.policy_order],
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
                  {activeLimitations.map((l, i) => (
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
