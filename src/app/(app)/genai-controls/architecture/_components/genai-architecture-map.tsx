'use client'

import { useState }                                              from 'react'
import { motion, AnimatePresence, useReducedMotion }             from 'framer-motion'
import Link                                                      from 'next/link'
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Circle,
  ArrowRight, Monitor, Laptop, Smartphone, Globe,
  Terminal, Bot, Users, Lock, Bell, FileText,
  LayoutGrid, Cpu,
} from 'lucide-react'
import { deriveChannelCoverage }                                 from '@/lib/genai/netskope/architecture-utils'
import type { ChannelCoverage }                                  from '@/lib/genai/netskope/architecture-utils'
import type { NetskopeRecommendation }                           from '@/lib/genai/netskope/types'
import type { OrgCategory }                                      from '@/lib/genai/netskope/get-recommendation'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgName:           string
  recommendation:    NetskopeRecommendation
  categories:        OrgCategory[]
  appCounts: {
    prohibited:             number
    approvedSupported:      number
    approvedWithConditions: number
    restricted:             number
  }
  counts: {
    coachingTemplates:       number
    activeCoachingTemplates: number
    manualPolicies:          number
    scopedPolicies:          number
    lintWarnings:            number
  }
  sensitivityLabels: Array<{ id: string; name: string; source: 'org' | 'default' }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALL_ACTIONS = ['Monitor', 'Coach', 'Justify', 'Block', 'Quarantine', 'Encrypt', 'Notify', 'Alert'] as const

function getActiveActions(rec: NetskopeRecommendation): Set<string> {
  const active = new Set<string>()
  for (const policy of rec.recommended_policies) {
    for (const profile of policy.profiles) {
      if (profile.profile_action) active.add(normaliseAction(profile.profile_action))
    }
    if (policy.no_match_action) active.add(normaliseAction(policy.no_match_action))
  }
  return active
}

function normaliseAction(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

// ── Coverage dot ──────────────────────────────────────────────────────────────

function CoverageDot({ level }: { level: ChannelCoverage['level'] }) {
  const cls =
    level === 'full'    ? 'bg-emerald-400' :
    level === 'partial' ? 'bg-amber-400'   :
    level === 'gap'     ? 'bg-red-400'     :
                          'bg-muted-foreground/40'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} />
}

// ── Static neutral channels (V1: no live data without Netskope view) ──────────

const NEUTRAL_CHANNELS: ChannelCoverage[] = [
  { label: 'Web / Inline GenAI Control',      level: 'partial' },
  { label: 'SaaS API Scan',                   level: 'partial' },
  { label: 'Endpoint DLP',                    level: 'partial' },
  { label: 'Browser Upload Control',          level: 'partial' },
  { label: 'Prompt / File Inspection',        level: 'partial' },
  { label: 'Response Inspection',             level: 'partial' },
  { label: 'Secrets / Source-Code Detection', level: 'partial' },
  { label: 'Classification-Label Checks',     level: 'partial' },
]

// ── Category card config ──────────────────────────────────────────────────────

interface CategoryCardConfig {
  posture:    string
  label:      string
  colorClass: string
  dotClass:   string
  knownApps:  string[]
  count:      (counts: Props['appCounts']) => number
}

const CATEGORY_CARDS: CategoryCardConfig[] = [
  {
    posture:    'prohibited',
    label:      'Prohibited',
    colorClass: 'border-red-500/30 bg-red-500/5',
    dotClass:   'bg-red-400',
    knownApps:  ['ChatGPT Personal', 'Gemini (personal)', 'Bing AI (personal)', 'Meta AI'],
    count:      c => c.prohibited,
  },
  {
    posture:    'enterprise-approved',
    label:      'Approved & Supported',
    colorClass: 'border-emerald-500/30 bg-emerald-500/5',
    dotClass:   'bg-emerald-400',
    knownApps:  ['ChatGPT Enterprise', 'Microsoft Copilot', 'Google Gemini (Workspace)', 'AWS Bedrock'],
    count:      c => c.approvedSupported,
  },
  {
    posture:    'approved-with-conditions',
    label:      'Approved with Conditions',
    colorClass: 'border-blue-500/30 bg-blue-500/5',
    dotClass:   'bg-blue-400',
    knownApps:  ['GitHub Copilot', 'Claude.ai (Business)', 'Cursor', 'Tabnine'],
    count:      c => c.approvedWithConditions,
  },
  {
    posture:    'permitted-with-restriction',
    label:      'Restricted',
    colorClass: 'border-amber-500/30 bg-amber-500/5',
    dotClass:   'bg-amber-400',
    knownApps:  ['Perplexity', 'Character.ai', 'Poe', 'Jasper'],
    count:      c => c.restricted,
  },
]

// ── Origin rows ───────────────────────────────────────────────────────────────

const ORIGIN_ROWS = [
  { icon: Laptop,   label: 'Managed Endpoints' },
  { icon: Smartphone, label: 'BYOD / Mobile' },
  { icon: Globe,    label: 'SaaS Users' },
  { icon: Terminal, label: 'Developers / CI-CD' },
  { icon: Bot,      label: 'Service Accounts' },
  { icon: Monitor,  label: 'Browser' },
]

// ── Sensitivity label colours ─────────────────────────────────────────────────

const LABEL_COLOURS: Record<string, string> = {
  public:              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  internal:            'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  confidential:        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  'highly confidential': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  secret:              'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

function labelColour(name: string): string {
  return LABEL_COLOURS[name.toLowerCase()] ?? 'bg-muted text-muted-foreground'
}

// ── SVG animated paths ────────────────────────────────────────────────────────

function ArchitecturePaths({ reduced }: { reduced: boolean }) {
  // Canvas min-w-[1200px]; columns: left 0-300, center 300-900, right 900-1200
  // Paths at y=240 (approximate mid-height for the 3 main zones)
  const pathColor   = 'hsl(var(--primary))'
  const pathColorRed = '#f87171'
  const duration    = 2.4

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
      aria-hidden="true"
    >
      {/* Origins → Inspection: left col right edge to center col left edge */}
      <path
        id="path-origins-inspect"
        d="M 300 240 L 320 240"
        fill="none"
        stroke={pathColor}
        strokeWidth="1.5"
        strokeOpacity="0.25"
      />
      <motion.circle
        r="4"
        fill={pathColor}
        fillOpacity="0.7"
        animate={reduced ? {} : {
          offsetDistance: ['0%', '100%'],
          opacity: [0, 1, 1, 0],
        }}
        style={{ offsetPath: 'path("M 300 240 L 320 240")' } as React.CSSProperties}
        transition={{ duration: duration * 0.3, repeat: Infinity, ease: 'linear', repeatDelay: 0.4 }}
      />

      {/* Main flow: left col (300) → center col entry (320) with elbow */}
      <path
        d="M 295 200 C 310 200, 310 240, 325 240"
        fill="none"
        stroke={pathColor}
        strokeWidth="1.5"
        strokeOpacity="0.3"
        strokeDasharray="4 3"
      />

      {/* Inspection → Destinations: center col right edge to right col left edge */}
      <path
        id="path-inspect-dest"
        d="M 875 240 L 900 240"
        fill="none"
        stroke={pathColor}
        strokeWidth="1.5"
        strokeOpacity="0.25"
      />
      <motion.circle
        r="4"
        fill={pathColor}
        fillOpacity="0.7"
        animate={reduced ? {} : {
          offsetDistance: ['0%', '100%'],
          opacity: [0, 1, 1, 0],
        }}
        style={{ offsetPath: 'path("M 875 240 L 900 240")' } as React.CSSProperties}
        transition={{ duration: duration * 0.3, repeat: Infinity, ease: 'linear', delay: 0.8, repeatDelay: 0.4 }}
      />

      {/* Prohibited path (red, goes back) */}
      <path
        d="M 900 280 C 920 280, 920 320, 875 320 L 340 320 C 310 320, 310 280, 325 280"
        fill="none"
        stroke={pathColorRed}
        strokeWidth="1.5"
        strokeOpacity="0.3"
        strokeDasharray="3 4"
      />
      {!reduced && (
        <motion.circle
          r="3.5"
          fill={pathColorRed}
          fillOpacity="0.8"
          animate={{
            offsetDistance: ['0%', '100%'],
            opacity: [0, 0.8, 0.8, 0],
          }}
          style={{ offsetPath: 'path("M 900 280 C 920 280, 920 320, 875 320 L 340 320 C 310 320, 310 280, 325 280")' } as React.CSSProperties}
          transition={{ duration: duration * 1.2, repeat: Infinity, ease: 'linear', delay: 1.6, repeatDelay: 0.6 }}
        />
      )}
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function GenAIArchitectureMap({
  orgName,
  recommendation,
  categories,
  appCounts,
  counts,
  sensitivityLabels,
}: Props) {
  const [netskopeView, setNetskopeView] = useState(false)
  const reduced = useReducedMotion() ?? false

  const activeActions  = getActiveActions(recommendation)
  const totalApps      = Object.values(appCounts).reduce((a, b) => a + b, 0)
  const channels       = netskopeView ? deriveChannelCoverage(recommendation) : NEUTRAL_CHANNELS

  // Sort categories: prohibited first, then by priority
  const sortedCategories = [...CATEGORY_CARDS].sort((a, b) => {
    if (a.posture === 'prohibited') return -1
    if (b.posture === 'prohibited') return 1
    return 0
  })

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">

      {/* ── Status Strip ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              GenAI Architecture Status
            </span>
            <span className="text-xs text-muted-foreground">—</span>
            <span className="text-sm font-medium text-foreground">{orgName}</span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">
              Coverage{' '}
              <span className="font-semibold text-foreground">{recommendation.score}%</span>
            </span>
            <span className="text-muted-foreground">
              Policies{' '}
              <span className="font-semibold text-foreground">
                {recommendation.recommended_policies.length}
              </span>{' '}
              generated
            </span>
            <span className="text-muted-foreground">
              Issues{' '}
              <span className="font-semibold text-foreground">
                {recommendation.issues.length}
              </span>
            </span>
            <span className="text-muted-foreground">
              Apps classified{' '}
              <span className="font-semibold text-foreground">{totalApps}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Partial warning ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {recommendation.is_partial && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Architecture is incomplete — some policies could not be generated.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Policy Actions Command Center ─────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Policy Actions Command Center
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_ACTIONS.map(action => {
            const active = activeActions.has(action)
            return (
              <span
                key={action}
                className={[
                  'rounded-md border px-2.5 py-1 text-xs font-medium',
                  active
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    : 'border-border bg-card text-muted-foreground/40',
                ].join(' ')}
              >
                {action}
              </span>
            )
          })}
        </div>
      </div>

      {/* ── Main canvas ───────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="relative min-w-[1200px]">

          {/* Animated SVG paths overlay */}
          <ArchitecturePaths reduced={reduced} />

          <div className="grid grid-cols-[300px_1fr_300px] gap-0 divide-x divide-border">

            {/* ── COLUMN 1 ──────────────────────────────────────────────── */}
            <div className="flex flex-col divide-y divide-border">

              {/* Zone 1 — Governance & Policy HQ */}
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Zone 1
                    </p>
                    <p className="text-sm font-semibold text-foreground leading-tight">
                      Governance &amp; Policy HQ
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Governance Tiers</span>
                    <span className="font-semibold text-foreground text-xs">{categories.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Coaching Templates</span>
                    <span className="font-semibold text-foreground text-xs">
                      {counts.coachingTemplates} total · {counts.activeCoachingTemplates} active
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                    Sensitivity Labels
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {sensitivityLabels.map(label => (
                      <span
                        key={label.id}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${labelColour(label.name)}`}
                      >
                        {label.name}
                        {label.source === 'default' && (
                          <span className="ml-0.5 opacity-60">(Default)</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1 pt-1">
                  <Link
                    href="/genai-controls/app-governance"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ArrowRight className="w-3 h-3" />
                    App Governance
                  </Link>
                  <Link
                    href="/genai-controls/control-matrix"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ArrowRight className="w-3 h-3" />
                    Control Matrix
                  </Link>
                </div>
              </div>

              {/* Zone 2 — User & Data Origins */}
              <div className="flex-1 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Zone 2
                    </p>
                    <p className="text-sm font-semibold text-foreground leading-tight">
                      User &amp; Data Origins
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {ORIGIN_ROWS.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />
                      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── COLUMN 2 — Inspection Zone ────────────────────────────── */}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Zone 3
                    </p>
                    <p className="text-sm font-semibold text-foreground leading-tight">
                      GenAI Inspection &amp; Enforcement Zone
                    </p>
                  </div>
                </div>

                {/* Neutral / Netskope toggle */}
                <div className="flex-shrink-0 flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                  <button
                    onClick={() => setNetskopeView(false)}
                    className={[
                      'px-3 py-1.5 transition-colors',
                      !netskopeView
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground hover:bg-muted',
                    ].join(' ')}
                    aria-pressed={!netskopeView}
                  >
                    Neutral
                  </button>
                  <button
                    onClick={() => setNetskopeView(true)}
                    className={[
                      'px-3 py-1.5 transition-colors',
                      netskopeView
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground hover:bg-muted',
                    ].join(' ')}
                    aria-pressed={netskopeView}
                  >
                    Netskope
                  </button>
                </div>
              </div>

              {/* Channel coverage rows */}
              <div className="space-y-1.5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={netskopeView ? 'netskope' : 'neutral'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.18 }}
                    className="space-y-1.5"
                  >
                    {channels.map((ch, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                      >
                        <CoverageDot level={ch.level} />
                        <span className="flex-1 text-xs text-foreground">{ch.label}</span>
                        {ch.note && (
                          <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {ch.note}
                          </span>
                        )}
                        {!ch.note && ch.level === 'gap' && (
                          <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-500">
                            Gap
                          </span>
                        )}
                        {ch.level === 'full' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        )}
                        {ch.level === 'partial' && !ch.note && (
                          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                            Partial
                          </span>
                        )}
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 pt-1">
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <CoverageDot level="full" /> Full coverage
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <CoverageDot level="partial" /> Partial
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <CoverageDot level="gap" /> Gap
                </span>
              </div>

              {/* Policy flow link */}
              <div className="pt-2">
                <Link
                  href="/genai-controls/vendor-mapping/netskope/architecture"
                  className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  View Netskope Policy Flow
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Policy counts summary */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {recommendation.recommended_policies.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Rec. Policies
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-foreground">{counts.scopedPolicies}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Scoped Policies
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-foreground">{counts.manualPolicies}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Manual Policies
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-center">
                  <p
                    className={[
                      'text-lg font-bold',
                      counts.lintWarnings > 0 ? 'text-amber-500' : 'text-foreground',
                    ].join(' ')}
                  >
                    {counts.lintWarnings}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Hygiene Warnings
                  </p>
                </div>
              </div>
            </div>

            {/* ── COLUMN 3 — App Destinations ───────────────────────────── */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Zone 4
                  </p>
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    GenAI App Destinations
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {sortedCategories.map(card => {
                  const count = card.count(appCounts)
                  return (
                    <div
                      key={card.posture}
                      className={`rounded-lg border p-2.5 ${card.colorClass}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${card.dotClass}`} />
                          <span className="text-xs font-semibold text-foreground">
                            {card.label}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-foreground">{count}</span>
                      </div>
                      {count === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic">
                          (none classified)
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          {card.knownApps.join(', ')}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

          </div>{/* /grid */}
        </div>{/* /min-w canvas */}
      </div>{/* /overflow-x-auto */}

      {/* ── Zone 5 — Incident, Evidence & Reporting Center ────────────── */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Zone 5 — Incident, Evidence &amp; Reporting Center
        </p>
        <div className="flex flex-wrap gap-2">

          <Link
            href="/genai-controls/notifications"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-foreground">
              {counts.activeCoachingTemplates}
            </span>
            <span className="text-muted-foreground">Active Coaching Templates</span>
          </Link>

          <Link
            href="/genai-controls/policies"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${counts.lintWarnings > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <span className={`font-semibold ${counts.lintWarnings > 0 ? 'text-amber-500' : 'text-foreground'}`}>
              {counts.lintWarnings}
            </span>
            <span className="text-muted-foreground">Policy Hygiene Warnings</span>
          </Link>

          <Link
            href="/genai-controls/vendor-mapping/netskope/recommendation"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-foreground">
              {recommendation.recommended_policies.length}
            </span>
            <span className="text-muted-foreground">Generated Policies</span>
          </Link>

          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">{counts.scopedPolicies}</span>
            <span className="text-muted-foreground">Scoped Policies</span>
          </div>

        </div>
      </div>

    </div>
  )
}
