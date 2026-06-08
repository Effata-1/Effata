'use client'

import { useEffect, useCallback } from 'react'
import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { FadeIn } from '@/components/ui/fade-in'
import {
  RF_KEY, RF_DEFAULTS, TAG_ALIAS, CONTENT_DETECTION_ROWS,
  UL_FN_DEFAULTS, FILENAME_DETECTION_LEVELS,
} from '@/lib/genai/control-matrix-rows'
import type { SlideData, CoachingSlide, AppCounts } from './presentation-container'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props extends SlideData {
  onClose:      () => void
  isSharedView?: boolean   // true on the public share page — hides the Esc close button
  sharedAt?:    string     // displayed in share view footer
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_SLIDES = 8

// Key rows to show in the matrix (most relevant for the CISO audience)
const MATRIX_ROWS: Array<typeof CONTENT_DETECTION_ROWS[number]> = [
  'Credentials, Keys & Secrets',
  'Regulated Data',
  'Source Code',
  'Intellectual Property',
  'Customer & Employee Data',
  'Financial & Commercial Data',
  'Security & Infrastructure Data',
  'Public & Low-Risk Data',
]

const ACTION_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  'allow':      { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/25', label: 'Allow' },
  'monitor':    { bg: 'bg-blue-500/15',    text: 'text-blue-300',    border: 'border-blue-500/25',    label: 'Monitor' },
  'alert':      { bg: 'bg-amber-500/15',   text: 'text-amber-300',   border: 'border-amber-500/25',   label: 'Alert' },
  'coach-ack':  { bg: 'bg-orange-500/15',  text: 'text-orange-300',  border: 'border-orange-500/25',  label: 'Coach' },
  'coach-just': { bg: 'bg-orange-600/15',  text: 'text-orange-200',  border: 'border-orange-600/25',  label: 'Coach+' },
  'block':      { bg: 'bg-red-500/15',     text: 'text-red-300',     border: 'border-red-500/25',     label: 'Block' },
  'not-set':    { bg: 'bg-white/5',        text: 'text-white/30',    border: 'border-white/10',       label: '—' },
}

const APPROVAL_STYLE: Record<string, string> = {
  'approved':      'text-emerald-400',
  'under-review':  'text-blue-400',
  'draft':         'text-white/40',
  'rejected':      'text-red-400',
}

const TEST_STYLE: Record<string, { dot: string; label: string }> = {
  'passed':      { dot: 'bg-emerald-400', label: 'Pass' },
  'failed':      { dot: 'bg-red-400',     label: 'Fail' },
  'in-progress': { dot: 'bg-amber-400',   label: 'WIP' },
  'untested':    { dot: 'bg-white/20',    label: '—' },
}

const ACCEPTED_RISKS = [
  {
    area: 'App Activity Coverage',
    limitation: 'Not every GenAI app exposes the same real-time activities for DLP inspection.',
    impact: 'Prompt and upload controls may not be consistently enforceable across all apps.',
    status: 'Accepted',
  },
  {
    area: 'App Instance / Tenant Separation',
    limitation: 'Enterprise and personal use of the same app may not always be clearly separable.',
    impact: 'Some user-level bypass risk exists for shared-domain apps.',
    status: 'Accepted',
  },
  {
    area: 'Keyword False Positives',
    limitation: 'Generic keywords (e.g. "confidential") may trigger on non-sensitive content.',
    impact: 'Alert or coach fatigue risk if thresholds are not tuned post-pilot.',
    status: 'Under Review',
  },
  {
    area: 'Response Inspection',
    limitation: 'DLP cannot inspect AI-generated responses for data leakage patterns.',
    impact: 'Exfiltration via the AI response channel is currently uncontrolled.',
    status: 'Accepted',
  },
  {
    area: 'Encrypted / Obfuscated Uploads',
    limitation: 'Base64-encoded or archived secrets may bypass content detection.',
    impact: 'Sophisticated exfiltration paths remain uncovered by keyword detection.',
    status: 'Accepted',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCellAction(
  dataType: string,          // full data_type key e.g. 'pp|rf:credentials_keys_secrets'
  categoryId: string,
  systemTag: string,
  overrides: Props['matrixOverrides'],
  defaultLookup: () => string,
): { action: string; coachingId: string | null } {
  const override = overrides.find(
    o => o.data_type === dataType && o.category_id === categoryId,
  )
  if (override) return { action: override.action_code, coachingId: override.coaching_notification_id }
  return { action: defaultLookup(), coachingId: null }
}

function resolveCoachLabel(coachingId: string | null, templates: CoachingSlide[]): string | null {
  if (!coachingId) return null
  return templates.find(t => t.id === coachingId)?.coach_label ?? null
}

function ActionChip({ action, coachLabel }: { action: string; coachLabel?: string | null }) {
  const s = ACTION_STYLE[action] ?? ACTION_STYLE['not-set']
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
        {s.label}
      </span>
      {coachLabel && (
        <span className="text-[9px] text-white/30 leading-none">{coachLabel}</span>
      )}
    </div>
  )
}

// ── Slide wrapper ─────────────────────────────────────────────────────────────

function SlideShell({
  section,
  title,
  slideNum,
  children,
}: {
  section?: string
  title?:   string
  slideNum: number
  children: React.ReactNode
}) {
  return (
    <div className="relative w-full h-full flex flex-col px-14 py-10">
      {/* Section label */}
      {section && (
        <FadeIn delay={0.05}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400 mb-2">{section}</p>
        </FadeIn>
      )}
      {/* Title */}
      {title && (
        <FadeIn delay={0.1}>
          <h2 className="text-2xl font-bold text-white mb-6 leading-tight">{title}</h2>
        </FadeIn>
      )}
      {/* Content */}
      <div className="flex-1 min-h-0">
        {children}
      </div>
      {/* Slide counter — bottom right */}
      <p className="absolute bottom-6 right-12 text-[11px] text-white/20 font-mono">
        {slideNum} / {TOTAL_SLIDES}
      </p>
    </div>
  )
}

// ── Slides ────────────────────────────────────────────────────────────────────

function SlideCover({ orgName, industry }: { orgName: string; industry: string }) {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="w-full h-full flex flex-col items-start justify-center px-14 py-10">
      <FadeIn delay={0}>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-400 mb-6">
          Confidential — Internal Use Only
        </p>
      </FadeIn>
      <FadeIn delay={0.1}>
        <h1 className="text-5xl font-extrabold text-white leading-tight mb-3">
          GenAI Control &<br />Data Exfiltration Protection
        </h1>
      </FadeIn>
      <FadeIn delay={0.2}>
        <p className="text-xl text-white/60 mb-10">DLP Enforcement Design</p>
      </FadeIn>
      <FadeIn delay={0.3}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60">{orgName}</span>
          <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 capitalize">{industry}</span>
          <span className="px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-300">GSOC</span>
          <span className="px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-300">AI Board</span>
          <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/40">{date}</span>
        </div>
      </FadeIn>
      {/* Decorative element */}
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-indigo-600/5 blur-3xl pointer-events-none" />
      <p className="absolute bottom-6 right-12 text-[11px] text-white/20 font-mono">1 / {TOTAL_SLIDES}</p>
    </div>
  )
}

function SlideAgenda() {
  const items = [
    { n: '01', title: 'GenAI App Categories',              sub: 'Governance tiers — approved, conditional, restricted, prohibited' },
    { n: '02', title: 'Control Matrix',                    sub: 'Enforcement decisions by category × data label' },
    { n: '03', title: 'Use Cases (from NPJ)',              sub: 'Policy intents derived from Neutral Policy JSON' },
    { n: '04', title: 'Netskope Recommended Policies',     sub: 'Generated policy set ready for deployment' },
    { n: '05', title: 'Key Limitations & Accepted Risks',  sub: 'Coverage gaps requiring leadership decisions' },
    { n: '06', title: 'Phased Rollout Plan',               sub: 'Pilot deployment through full organisation' },
  ]
  return (
    <SlideShell section="OVERVIEW" title="Agenda" slideNum={2}>
      <div className="space-y-3">
        {items.map((item, i) => (
          <FadeIn key={item.n} delay={0.1 + i * 0.07}>
            <div className="flex items-start gap-5 p-4 rounded-xl border border-white/8 bg-white/3">
              <span className="text-2xl font-extrabold text-indigo-500/50 font-mono shrink-0 w-10">{item.n}</span>
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs text-white/40 mt-0.5">{item.sub}</p>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </SlideShell>
  )
}

function SlideMatrix({
  categories,
  matrixOverrides,
  coachingTemplates,
}: Pick<Props, 'categories' | 'matrixOverrides' | 'coachingTemplates'>) {
  return (
    <SlideShell section="ENFORCEMENT DECISIONS" title="Proposed GenAI DLP Matrix" slideNum={4}>
      <FadeIn delay={0.15}>
        <div className="overflow-auto max-h-full">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-white/40 font-medium w-44 border-b border-white/8">
                  Data Type ↓ / Category →
                </th>
                {categories.map(cat => (
                  <th key={cat.id} className="py-2 px-2 text-center font-semibold text-white/70 border-b border-white/8 min-w-[110px]">
                    {cat.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* ── Content / Risk-Family rows ─────────────────────────────── */}
              {MATRIX_ROWS.map((rowName, ri) => {
                const rfKey = RF_KEY[rowName]
                if (!rfKey) return null
                return (
                  <tr key={rowName} className={ri % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                    <td className="py-2.5 px-3 text-white/60 font-medium border-b border-white/5 text-[11px]">
                      {rowName}
                    </td>
                    {categories.map(cat => {
                      const isBlocked = cat.access_posture === 'block'
                      if (isBlocked) {
                        return (
                          <td key={cat.id} className="py-2.5 px-2 text-center border-b border-white/5">
                            <ActionChip action="block" />
                          </td>
                        )
                      }
                      const alias = TAG_ALIAS[cat.system_tag] ?? cat.system_tag
                      const { action, coachingId } = getCellAction(
                        `pp|rf:${rfKey}`, cat.id, cat.system_tag, matrixOverrides,
                        () => RF_DEFAULTS[alias]?.[rfKey] ?? 'not-set',
                      )
                      const coachLabel = resolveCoachLabel(coachingId, coachingTemplates)
                      return (
                        <td key={cat.id} className="py-2.5 px-2 text-center border-b border-white/5">
                          <ActionChip action={action} coachLabel={coachLabel} />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              {/* ── Filename detection separator ───────────────────────────── */}
              <tr>
                <td colSpan={1 + categories.length} className="py-1.5 px-3 text-[9px] font-bold uppercase tracking-widest text-indigo-400/60 bg-indigo-500/5 border-y border-white/5">
                  Upload — Filename Detection
                </td>
              </tr>
              {FILENAME_DETECTION_LEVELS.map((level, ri) => {
                const label = level === 'highly_confidential' ? 'Highly Confidential filename' : 'Secret / Credential filename'
                return (
                  <tr key={level} className={ri % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                    <td className="py-2.5 px-3 text-white/50 font-medium border-b border-white/5 text-[11px]">
                      {label}
                    </td>
                    {categories.map(cat => {
                      const isBlocked = cat.access_posture === 'block'
                      if (isBlocked) {
                        return (
                          <td key={cat.id} className="py-2.5 px-2 text-center border-b border-white/5">
                            <ActionChip action="block" />
                          </td>
                        )
                      }
                      const alias = TAG_ALIAS[cat.system_tag] ?? cat.system_tag
                      const { action, coachingId } = getCellAction(
                        `ul|fn|${level}`, cat.id, cat.system_tag, matrixOverrides,
                        () => UL_FN_DEFAULTS[alias]?.[level] ?? 'not-set',
                      )
                      const coachLabel = resolveCoachLabel(coachingId, coachingTemplates)
                      return (
                        <td key={cat.id} className="py-2.5 px-2 text-center border-b border-white/5">
                          <ActionChip action={action} coachLabel={coachLabel} />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              {/* Prohibited note */}
              {categories.some(c => c.access_posture === 'block') && (
                <tr className="bg-red-500/5">
                  <td colSpan={1 + categories.length} className="py-2 px-3 text-[10px] text-red-400/60 italic">
                    * Prohibited apps are blocked at the network layer — content inspection does not apply.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </FadeIn>
    </SlideShell>
  )
}

function SlideUseCases({ policies }: Pick<Props, 'policies'>) {
  // Show policies that were created from NPJ (AI-assisted or generated from matrix)
  const npjPolicies = policies.filter(p => p.neutral_policy_json !== null)
  const rows = (npjPolicies.length > 0 ? npjPolicies : policies).slice(0, 14)
  return (
    <SlideShell section="USE CASES — NPJ DERIVED" title="Policy Use Cases from Neutral Policy JSON" slideNum={5}>
      <FadeIn delay={0.1}>
        <div className="overflow-auto max-h-full">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                {['#', 'Use Case', 'Family', 'Data Scope', 'Enforcement', 'Test', 'Status'].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-white/40 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const test = TEST_STYLE[p.test_status ?? 'untested'] ?? TEST_STYLE['untested']
                const approvalColor = APPROVAL_STYLE[p.approval_status] ?? 'text-white/40'
                return (
                  <tr key={p.id} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                    <td className="py-2 px-2 text-white/30 font-mono">{String(i + 1).padStart(2, '0')}</td>
                    <td className="py-2 px-2 text-white/80 font-medium max-w-[180px]">
                      <span className="block truncate" title={p.name}>{p.name}</span>
                    </td>
                    <td className="py-2 px-2 text-white/40 max-w-[120px]">
                      <span className="block truncate" title={p.policy_family ?? ''}>{p.policy_family ?? '—'}</span>
                    </td>
                    <td className="py-2 px-2 text-white/40">
                      {p.data_classification_label
                        ? <span className="capitalize">{p.data_classification_label === 'all' ? 'All data' : p.data_classification_label}</span>
                        : '—'}
                    </td>
                    <td className="py-2 px-2">
                      {p.primary_action ? <ActionChip action={p.primary_action} /> : <span className="text-white/20">—</span>}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${test.dot}`} />
                        <span className="text-white/50">{test.label}</span>
                      </div>
                    </td>
                    <td className={`py-2 px-2 font-semibold capitalize ${approvalColor}`}>
                      {p.approval_status.replace('-', ' ')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 14 && (npjPolicies.length > 14 || (npjPolicies.length === 0 && policies.length > 14)) && (
            <p className="text-[10px] text-white/25 mt-2 px-2">
              +{(npjPolicies.length > 0 ? npjPolicies.length : policies.length) - 14} more not shown
            </p>
          )}
        </div>
      </FadeIn>
    </SlideShell>
  )
}

function SlideAppCategories({ categories, appCounts }: { categories: Props['categories']; appCounts: AppCounts }) {
  // Map system_tag → appCounts bucket
  function getCount(cat: Props['categories'][number]): number {
    const alias = TAG_ALIAS[cat.system_tag] ?? cat.system_tag
    if (alias === 'approved_supported')       return appCounts.enterpriseApproved
    if (alias === 'approved_with_conditions') return appCounts.approvedWithConditions
    if (alias === 'restricted_unassessed')    return appCounts.permittedWithRestriction
    if (cat.system_tag === 'prohibited')      return appCounts.prohibited
    return 0
  }

  const postureLabel: Record<string, string> = {
    allow:     'Full access — traffic allowed through',
    allow_dlp: 'Access allowed with DLP inspection',
    block:     'Access blocked at network layer',
  }

  const categoryColor: Record<string, { text: string; border: string; bg: string; dot: string }> = {
    approved_supported:       { text: 'text-emerald-300', border: 'border-emerald-500/25', bg: 'bg-emerald-500/8',  dot: 'bg-emerald-400' },
    approved_with_conditions: { text: 'text-blue-300',    border: 'border-blue-500/25',    bg: 'bg-blue-500/8',     dot: 'bg-blue-400' },
    restricted_unassessed:    { text: 'text-amber-300',   border: 'border-amber-500/25',   bg: 'bg-amber-500/8',    dot: 'bg-amber-400' },
    prohibited:               { text: 'text-red-300',     border: 'border-red-500/25',     bg: 'bg-red-500/8',      dot: 'bg-red-400' },
  }

  const totalApps = Object.values(appCounts).reduce((a, b) => a + b, 0)

  return (
    <SlideShell section="APP GOVERNANCE" title="GenAI App Categories" slideNum={3}>
      <div className="space-y-5">
        <FadeIn delay={0.05}>
          <p className="text-sm text-white/40">
            {totalApps} GenAI apps classified across {categories.length} governance tier{categories.length !== 1 ? 's' : ''}.
            Category determines which enforcement actions apply.
          </p>
        </FadeIn>
        <div className="grid grid-cols-2 gap-4">
          {categories.map((cat, i) => {
            const alias  = TAG_ALIAS[cat.system_tag] ?? cat.system_tag
            const colors = categoryColor[alias] ?? categoryColor['restricted_unassessed']
            const count  = getCount(cat)
            const pct    = totalApps > 0 ? Math.round((count / totalApps) * 100) : 0
            return (
              <FadeIn key={cat.id} delay={0.1 + i * 0.08}>
                <div className={`rounded-xl border ${colors.border} ${colors.bg} p-5 flex flex-col gap-3`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} shrink-0`} />
                      <p className={`text-sm font-bold ${colors.text}`}>{cat.name}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-extrabold leading-none ${colors.text}`}>{count}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{pct}% of apps</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-white/50">
                      <span className="text-white/25 mr-1">Network:</span>
                      {postureLabel[cat.access_posture] ?? cat.access_posture}
                    </p>
                  </div>
                  {/* Mini progress bar */}
                  <div className="h-1 w-full rounded-full bg-white/8">
                    <div className={`h-full rounded-full ${colors.dot}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </FadeIn>
            )
          })}
        </div>
      </div>
    </SlideShell>
  )
}

function SlideLimitations({ lintCount }: Pick<Props, 'lintCount'>) {
  return (
    <SlideShell section="RISK ACCEPTANCE" title="Key Limitations & Accepted Risks" slideNum={7}>
      <FadeIn delay={0.1}>
        <div className="overflow-auto max-h-full">
          <table className="w-full text-[11px] border-collapse mb-4">
            <thead>
              <tr className="border-b border-white/10">
                {['Area', 'Limitation / Challenge', 'Practical Impact', 'Risk Acceptance'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-white/40 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACCEPTED_RISKS.map((r, i) => (
                <tr key={r.area} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="py-2.5 px-3 text-white/80 font-semibold whitespace-nowrap">{r.area}</td>
                  <td className="py-2.5 px-3 text-white/50 max-w-[200px]">{r.limitation}</td>
                  <td className="py-2.5 px-3 text-white/40 max-w-[200px]">{r.impact}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      r.status === 'Accepted'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lintCount > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[11px] text-amber-400/80">{lintCount} policy hygiene warning{lintCount !== 1 ? 's' : ''} detected — review in Policy Library</span>
            </div>
          )}
        </div>
      </FadeIn>
    </SlideShell>
  )
}

function SlideNetskopeRecommended({ policies }: Pick<Props, 'policies'>) {
  const recommended = policies.filter(p => p.policy_source === 'recommended')
  const rows        = recommended.slice(0, 14)

  const TRANSLATION_STYLE: Record<string, { dot: string; label: string }> = {
    'translated': { dot: 'bg-emerald-400', label: 'Ready' },
    'verified':   { dot: 'bg-blue-400',    label: 'Verified' },
    'pending':    { dot: 'bg-amber-400',   label: 'Pending' },
    'not-applicable': { dot: 'bg-white/20', label: 'N/A' },
  }

  return (
    <SlideShell section="NETSKOPE RECOMMENDED POLICIES" title="Generated Policy Set" slideNum={6}>
      <FadeIn delay={0.05}>
        <p className="text-xs text-white/40 mb-3">
          {recommended.length} recommended polic{recommended.length !== 1 ? 'ies' : 'y'} generated from the control matrix.
          {recommended.filter(p => p.is_active).length} active and enforcing.
        </p>
      </FadeIn>
      <FadeIn delay={0.1}>
        {rows.length === 0 ? (
          <p className="text-sm text-white/30 italic">No recommended policies generated yet. Configure the control matrix to generate policies.</p>
        ) : (
          <div className="overflow-auto max-h-full">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  {['#', 'Policy Name', 'Risk Family', 'Enforcement', 'Translation', 'Test', 'Active'].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-white/40 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => {
                  const test        = TEST_STYLE[p.test_status ?? 'untested'] ?? TEST_STYLE['untested']
                  const translation = TRANSLATION_STYLE[(p as unknown as Record<string, string>).vendor_translation_status ?? 'pending'] ?? TRANSLATION_STYLE['pending']
                  return (
                    <tr key={p.id} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                      <td className="py-2 px-2 text-white/30 font-mono">{String(i + 1).padStart(2, '0')}</td>
                      <td className="py-2 px-2 text-white/80 font-medium max-w-[200px]">
                        <span className="block truncate" title={p.name}>{p.name}</span>
                      </td>
                      <td className="py-2 px-2 text-white/40 max-w-[120px]">
                        <span className="block truncate text-[10px]" title={p.policy_family ?? ''}>{p.policy_family ?? '—'}</span>
                      </td>
                      <td className="py-2 px-2">
                        {p.primary_action ? <ActionChip action={p.primary_action} /> : <span className="text-white/20">—</span>}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${translation.dot}`} />
                          <span className="text-white/50">{translation.label}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${test.dot}`} />
                          <span className="text-white/50">{test.label}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <span className={p.is_active ? 'text-emerald-400 font-semibold' : 'text-white/25'}>
                          {p.is_active ? '✓' : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {recommended.length > 14 && (
              <p className="text-[10px] text-white/25 mt-2 px-2">+{recommended.length - 14} more not shown</p>
            )}
          </div>
        )}
      </FadeIn>
    </SlideShell>
  )
}

function SlideRollout() {
  const phases = [
    {
      n: '1',
      label: 'Pilot',
      scope: 'XDR team, DLP team & AI Board',
      responsibility: 'L3 team or Netskope owners and DLP team',
      objectives: [
        'Validate GenAI controls and policies',
        'Test DLP detection for GenAI interactions',
        'Identify gaps in policy enforcement and user behaviour',
      ],
    },
    {
      n: '2',
      label: 'Phase 1',
      scope: 'Security and key business units',
      responsibility: 'DLP team & tool owners',
      objectives: [
        'Controlled expansion across security teams',
        'Monitor policy effectiveness',
        'Collect feedback and operational insights',
      ],
    },
    {
      n: '3',
      label: 'Phase 2',
      scope: 'Broader technical teams and org-wide',
      responsibility: 'DLP team & tool owners',
      objectives: [
        'Broader adoption across technical teams',
        'Strengthen enforcement based on pilot learnings',
        'Full organisation rollout',
      ],
    },
  ]

  return (
    <SlideShell section="PHASED ROLLOUT" title="Next Step — Pilot Implementation" slideNum={8}>
      <div className="grid grid-cols-3 gap-4 h-full">
        {phases.map((ph, i) => (
          <FadeIn key={ph.n} delay={0.1 + i * 0.1}>
            <div className="rounded-xl border border-white/10 bg-white/3 p-5 flex flex-col gap-4 h-full">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-300">
                  {ph.n}
                </span>
                <span className="text-base font-bold text-white">{ph.label}</span>
              </div>

              <div className="space-y-3 flex-1">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1">Scope</p>
                  <p className="text-xs text-white/60">{ph.scope}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1">Responsibility</p>
                  <p className="text-xs text-white/60">{ph.responsibility}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-2">Objectives</p>
                  <ul className="space-y-1">
                    {ph.objectives.map(obj => (
                      <li key={obj} className="flex items-start gap-2 text-[11px] text-white/50">
                        <span className="w-1 h-1 rounded-full bg-indigo-400/60 mt-1.5 shrink-0" />
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </SlideShell>
  )
}

// ── Main slideshow component ───────────────────────────────────────────────────

export function PresentationSlideshow({
  onClose,
  orgName,
  industry,
  categories,
  matrixOverrides,
  coachingTemplates,
  policies,
  lintCount,
  appCounts,
  isSharedView = false,
  sharedAt,
}: Props) {
  const [current, setCurrent]     = useState(1)
  const [direction, setDirection] = useState(1)
  const shouldReduceMotion        = useReducedMotion()

  const goTo = useCallback((target: number) => {
    if (target < 1 || target > TOTAL_SLIDES) return
    setDirection(target > current ? 1 : -1)
    setCurrent(target)
  }, [current])

  const next = useCallback(() => goTo(current + 1), [current, goTo])
  const prev = useCallback(() => goTo(current - 1), [current, goTo])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')                    { e.preventDefault(); prev() }
      if (e.key === 'Escape' && !isSharedView)                              { onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose])

  const variants = {
    enter:  (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  }

  const renderSlide = () => {
    switch (current) {
      case 1: return <SlideCover              orgName={orgName} industry={industry} />
      case 2: return <SlideAgenda             />
      case 3: return <SlideAppCategories      categories={categories} appCounts={appCounts} />
      case 4: return <SlideMatrix             categories={categories} matrixOverrides={matrixOverrides} coachingTemplates={coachingTemplates} />
      case 5: return <SlideUseCases           policies={policies} />
      case 6: return <SlideNetskopeRecommended policies={policies} />
      case 7: return <SlideLimitations        lintCount={lintCount} />
      case 8: return <SlideRollout            />
      default: return null
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: '#0F1117' }}
    >
      {/* Top-left controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        {!isSharedView && (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-xs text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Esc
          </button>
        )}
        {/* Print / PDF — always visible */}
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-xs text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors print:hidden"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          PDF
        </button>
        {isSharedView && sharedAt && (
          <span className="text-[10px] text-white/20 ml-1">Shared {sharedAt}</span>
        )}
      </div>

      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={shouldReduceMotion ? {} : variants}
            initial={shouldReduceMotion ? false : 'enter'}
            animate="center"
            exit={shouldReduceMotion ? {} : 'exit'}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            {renderSlide()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom bar: prev / dots / next */}
      <div className="flex items-center justify-between px-12 py-4 border-t border-white/5">
        <button
          type="button"
          onClick={prev}
          disabled={current === 1}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-xs text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i + 1)}
              className={`rounded-full transition-all duration-200 ${
                i + 1 === current
                  ? 'w-4 h-2 bg-indigo-500'
                  : 'w-2 h-2 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          disabled={current === TOTAL_SLIDES}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-xs text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
