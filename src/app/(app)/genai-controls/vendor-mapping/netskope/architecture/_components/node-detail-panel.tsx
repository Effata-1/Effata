'use client'

import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { getSlotStatus } from '@/lib/genai/netskope/architecture-utils'
import type { NetskopeRecommendation, NetskopePolicy, NetskopeProfileEntry } from '@/lib/genai/netskope/types'

// ── Props ─────────────────────────────────────────────────────────────────────

interface PanelProps {
  policyKey:      string | null
  recommendation: NetskopeRecommendation
  onClose:        () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function priorityFromKey(policyKey: string): string {
  if (policyKey === 'netskope:prohibited_access_block')   return 'P100'
  if (policyKey === 'netskope:always_block_global_dlp')   return 'P200'
  if (policyKey === 'netskope:approved_supported')        return 'P300'
  if (policyKey === 'netskope:approved_with_conditions')  return 'P400'
  if (policyKey === 'netskope:restricted_unassessed')     return 'P900'
  if (policyKey.startsWith('netskope:custom:'))           return 'P5xx'
  return 'Pxxx'
}

function badgeClassForKey(policyKey: string): string {
  if (policyKey === 'netskope:prohibited_access_block')   return 'bg-red-500/15 text-red-400 border-red-500/25'
  if (policyKey === 'netskope:always_block_global_dlp')   return 'bg-rose-700/15 text-rose-400 border-rose-700/25'
  if (policyKey === 'netskope:approved_supported')        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (policyKey === 'netskope:approved_with_conditions')  return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  if (policyKey === 'netskope:restricted_unassessed')     return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
}

function policyTypeBadge(type: NetskopePolicy['policy_type']): { label: string; className: string } {
  return type === 'access_control'
    ? { label: 'Access Control',    className: 'bg-violet-500/10 text-violet-400 border-violet-500/20' }
    : { label: 'Realtime Protection', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' }
}

function actionChipClass(action: string): string {
  const map: Record<string, string> = {
    allow:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    monitor: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    alert:   'bg-amber-500/15 text-amber-400 border-amber-500/25',
    coach:   'bg-orange-500/15 text-orange-400 border-orange-500/25',
    block:   'bg-red-500/15 text-red-400 border-red-500/25',
  }
  return map[action.toLowerCase()] ?? 'bg-muted/50 text-muted-foreground border-border'
}

const PROFILE_TYPE_LABEL: Record<string, string> = {
  content_detection:    'Content Detection',
  classification_label: 'Classification Label',
  filename_detection:   'Filename Detection',
  filetype_detection:   'Filetype Detection',
}

// ── Label row helper ──────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label}
      </span>
      <div className="text-xs text-foreground/85">{children}</div>
    </div>
  )
}

// ── Profile table ─────────────────────────────────────────────────────────────

function ProfileTable({ profiles }: { profiles: NetskopeProfileEntry[] }) {
  if (profiles.length === 0) {
    return <p className="text-xs text-muted-foreground/60 italic">No profiles</p>
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border/50">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border/50 bg-muted/20">
            <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground/70">Profile</th>
            <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground/70">Type</th>
            <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground/70">Action</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((pr, i) => (
            <tr
              key={i}
              className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors"
            >
              <td className="px-2 py-1.5 text-foreground/80 leading-snug">{pr.profile}</td>
              <td className="px-2 py-1.5 text-muted-foreground/70 whitespace-nowrap">
                {PROFILE_TYPE_LABEL[pr.profile_type] ?? pr.profile_type}
              </td>
              <td className="px-2 py-1.5">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold capitalize ${actionChipClass(pr.profile_action)}`}>
                  {pr.profile_action}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function NodeDetailPanel({ policyKey, recommendation, onClose }: PanelProps) {
  const isOpen = policyKey !== null

  // Escape key closes
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) onClose()
  }, [isOpen, onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const policy = policyKey
    ? recommendation.recommended_policies.find(p => p.policy_key === policyKey)
    : undefined

  const status = policyKey ? getSlotStatus(policyKey, recommendation) : 'missing'

  const typeBadge = policy ? policyTypeBadge(policy.policy_type) : null

  // App scope label
  const appScopeLabel = policy
    ? (policy.destination.cci_app_tag ?? policy.destination.tag_or_category ?? 'All GenAI Apps')
    : '—'

  // Activities display
  const activitiesLabel = policy?.activities?.length
    ? policy.activities.join(', ')
    : '—'

  // No-match fallback
  const noMatchLabel = policy?.no_match_action
    ? policy.no_match_action.charAt(0).toUpperCase() + policy.no_match_action.slice(1)
    : '—'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/20"
            onClick={onClose}
            aria-hidden
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            className="fixed top-0 right-0 h-screen w-80 z-40 bg-card border-l border-border shadow-2xl flex flex-col"
            role="dialog"
            aria-label="Policy details"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-4 py-4 border-b border-border/50 shrink-0">
              <div className="flex-1 min-w-0">
                {policyKey && (
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold tracking-widest uppercase ${badgeClassForKey(policyKey)}`}>
                      {priorityFromKey(policyKey)}
                    </span>
                    {typeBadge && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium ${typeBadge.className}`}>
                        {typeBadge.label}
                      </span>
                    )}
                  </div>
                )}
                <h2 className="text-sm font-semibold text-foreground leading-snug line-clamp-3">
                  {policy?.name ?? (policyKey ?? 'Policy')}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 mt-0.5 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {status === 'missing' || !policy ? (
                <div className="rounded-lg border border-dashed border-border/40 bg-muted/10 px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground/60 italic">(Not yet configured)</p>
                  <p className="text-xs text-muted-foreground/40 mt-1">
                    This policy slot has not been generated for your organisation.
                  </p>
                </div>
              ) : (
                <>
                  {/* App Scope */}
                  <FieldRow label="App Scope">
                    <span className="inline-flex items-center px-2 py-0.5 rounded border border-border/50 bg-muted/20 text-[11px] font-medium">
                      {appScopeLabel}
                    </span>
                  </FieldRow>

                  {/* Monitored Activities */}
                  <FieldRow label="Monitored Activities">
                    <span className="text-muted-foreground/80 leading-relaxed">
                      {activitiesLabel}
                    </span>
                  </FieldRow>

                  {/* Profiles table */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Profiles ({policy.profiles.length})
                    </span>
                    <ProfileTable profiles={policy.profiles} />
                  </div>

                  {/* No-Match Fallback */}
                  <FieldRow label="No-Match Fallback">
                    {policy.no_match_action ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold capitalize ${actionChipClass(policy.no_match_action)}`}>
                        {noMatchLabel}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </FieldRow>

                  {/* Notification */}
                  {policy.notification && (
                    <FieldRow label="Notification">
                      <span className="text-muted-foreground/80">{policy.notification}</span>
                    </FieldRow>
                  )}

                  {/* Warning badge for issues */}
                  {status === 'warning' && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-300">
                      <span className="font-semibold">Issue detected</span> — this policy has a configuration warning.
                      Review the full recommendation for details.
                    </div>
                  )}

                  {/* Destination note */}
                  {policy.destination.note && (
                    <FieldRow label="Destination Note">
                      <span className="text-muted-foreground/70 italic">{policy.destination.note}</span>
                    </FieldRow>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
