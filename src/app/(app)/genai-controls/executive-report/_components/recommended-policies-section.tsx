'use client'

import { useState } from 'react'
import { ChevronDown, User, ArrowDownToLine, Activity, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NetskopePolicy, NpjProfileType } from '@/lib/genai/netskope/types'

// ── Chips ─────────────────────────────────────────────────────────────────────

const ACTION_COLOR: Record<string, string> = {
  block:        'text-red-400',
  alert:        'text-amber-400',
  coach:        'text-orange-400',
  'coach-ack':  'text-orange-400',
  'coach-just': 'text-amber-300',
  monitor:      'text-blue-400',
  allow:        'text-emerald-400',
}

const PROFILE_TYPE_LABEL: Record<NpjProfileType, string> = {
  content_detection:    'Content Detection',
  classification_label: 'Classification Label',
  filename_detection:   'Filename Detection',
  filetype_detection:   'Filetype Detection',
}

function priorityBadgeClass(key: string) {
  if (key === 'netskope:prohibited_access_block')   return 'bg-red-500/15 text-red-400 border-red-500/25'
  if (key === 'netskope:always_block_global_dlp')   return 'bg-red-500/10 text-red-300/80 border-red-500/15'
  if (key.startsWith('netskope:scoped:'))            return 'bg-violet-500/10 text-violet-400 border-violet-500/20'
  if (key === 'netskope:approved_supported')         return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (key === 'netskope:approved_with_conditions')   return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  if (key.startsWith('netskope:custom:'))            return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  if (key === 'netskope:restricted_unassessed')      return 'bg-muted/60 text-muted-foreground/70 border-border/60'
  return 'bg-muted/60 text-muted-foreground/70 border-border/60'
}

function destSummary(policy: NetskopePolicy): string {
  const { strategy, tag_or_category, cci_app_tag } = policy.destination
  if (strategy === 'app_category')
    return cci_app_tag
      ? `${tag_or_category} + tag "${cci_app_tag}"`
      : tag_or_category
  if (strategy === 'app_instance')        return `Instance: ${tag_or_category}`
  if (strategy === 'destination_profile') return `Profile: ${tag_or_category}`
  if (strategy === 'cloud_app')           return `App: ${tag_or_category}`
  return tag_or_category
}

function sourceSummary(policy: NetskopePolicy): string {
  if (policy.source.type === 'all_users') return 'All Users'
  const typeLabel =
    policy.source.type === 'user_group'          ? 'User Group' :
    policy.source.type === 'ad_group'            ? 'AD Group'   :
    policy.source.type === 'organizational_unit' ? 'OU'         : 'User'
  return `${typeLabel}: ${policy.source.value ?? '—'}`
}

// ── Single policy row ─────────────────────────────────────────────────────────

function PolicyRow({ policy }: { policy: NetskopePolicy }) {
  const [open, setOpen] = useState(false)

  const typeLabel = policy.policy_type === 'access_control' ? 'Access Control' : 'Real-time Protection'
  const noMatchColor = ACTION_COLOR[policy.no_match_action ?? ''] ?? 'text-muted-foreground/60'

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/10 hover:bg-muted/20 transition-colors text-left"
      >
        {/* Priority + index */}
        <span className={cn(
          'shrink-0 inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold tabular-nums',
          priorityBadgeClass(policy.policy_key),
        )}>
          P{policy.priority}
        </span>

        {/* Name */}
        <span className="flex-1 text-sm font-semibold text-foreground/90 truncate">{policy.name}</span>

        {/* Destination summary */}
        <span className="hidden sm:block text-xs text-muted-foreground/50 truncate max-w-[200px]">
          {destSummary(policy)}
        </span>

        {/* Type chip */}
        <span className={cn(
          'shrink-0 hidden md:inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium',
          policy.policy_type === 'access_control'
            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            : 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        )}>
          {typeLabel}
        </span>

        {/* No-match action or access-control action */}
        {policy.policy_type === 'access_control' ? (
          <span className="shrink-0 text-[10px] font-bold text-red-400">Block</span>
        ) : policy.no_match_action ? (
          <span className={cn('shrink-0 text-[10px] font-bold capitalize', noMatchColor)}>
            {policy.no_match_action}
          </span>
        ) : null}

        <ChevronDown className={cn(
          'shrink-0 w-3.5 h-3.5 text-muted-foreground/40 transition-transform',
          open && 'rotate-180',
        )} />
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-border/40 divide-y divide-border/30">

          {/* Source */}
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="flex items-center gap-1.5 w-28 shrink-0 pt-0.5">
              <User className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wide">Source</span>
            </div>
            <span className="text-xs text-foreground/80">{sourceSummary(policy)}</span>
          </div>

          {/* Destination */}
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="flex items-center gap-1.5 w-28 shrink-0 pt-0.5">
              <ArrowDownToLine className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wide">Destination</span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-foreground/80">{destSummary(policy)}</p>
              {policy.destination.note && (
                <p className="text-[10px] text-muted-foreground/40 italic">{policy.destination.note}</p>
              )}
            </div>
          </div>

          {/* Activities */}
          {policy.activities.length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="flex items-center gap-1.5 w-28 shrink-0 pt-0.5">
                <Activity className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wide">Activities</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {policy.activities.map(a => (
                  <span key={a} className="text-[10px] px-2 py-0.5 rounded border border-border bg-muted/30 text-muted-foreground/70 capitalize">
                    {a.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* DLP Profiles (RT policies only) */}
          {policy.profiles.length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="flex items-center gap-1.5 w-28 shrink-0 pt-0.5">
                <Shield className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wide">Profiles</span>
              </div>
              <div className="space-y-1.5 flex-1">
                {policy.profiles.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded border border-border/50 bg-muted/20 px-3 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-muted-foreground/40 shrink-0">
                        {PROFILE_TYPE_LABEL[p.profile_type] ?? p.profile_type}
                      </span>
                      <span className="text-xs text-foreground/80 truncate">{p.profile}</span>
                    </div>
                    <span className={cn(
                      'shrink-0 text-[10px] font-bold capitalize',
                      ACTION_COLOR[p.profile_action] ?? 'text-muted-foreground/60',
                    )}>
                      {p.profile_action}
                    </span>
                  </div>
                ))}
                {policy.no_match_action && (
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-[10px] text-muted-foreground/40">No-match action</span>
                    <span className={cn('text-[10px] font-bold capitalize', noMatchColor)}>
                      {policy.no_match_action}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Access control note */}
          {policy.policy_type === 'access_control' && (
            <div className="px-4 py-3">
              <p className="text-[10px] text-muted-foreground/40 italic">
                Access control policy — blocks at the network layer before content inspection. No DLP profile required.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function RecommendedPoliciesSection({ policies }: { policies: NetskopePolicy[] }) {
  if (policies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground/50 italic">
        No recommended policies generated yet. Complete the setup wizard and configure your control matrix first.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {policies.map((policy, i) => (
        <PolicyRow key={policy.policy_key + '-' + policy.priority} policy={policy} />
      ))}
    </div>
  )
}
