'use client'

import { useState, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { NodeDetailPanel } from './node-detail-panel'
import { getSlotStatus }  from '@/lib/genai/netskope/architecture-utils'
import { TAG_ALIAS }      from '@/lib/genai/control-matrix-rows'
import type { NetskopeRecommendation, NetskopePolicy } from '@/lib/genai/netskope/types'
import type { OrgCategory } from '@/lib/genai/netskope/get-recommendation'

// ── Constants ─────────────────────────────────────────────────────────────────

const LANE_H    = 220   // px per lane — taller to fit profile list + no-match row
const X_SPINE   = 480   // horizontal center of spine (NO path)
const X_ACTION  = 760   // left edge of action boxes
const ACTION_W  = 290   // width of action boxes
const ACTION_H  = 192   // fixed height — overflow-hidden prevents lane bleed
const DIAMOND_S = 110   // rotated square size (both w and h)
const X_COLLECT = X_ACTION + ACTION_W + 32  // right-collection spine (YES paths terminate here)

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgName:        string
  recommendation: NetskopeRecommendation
  categories:     OrgCategory[]
}

// ── Lane descriptor ───────────────────────────────────────────────────────────

type LaneKind =
  | { kind: 'entry' }
  | { kind: 'diamond_prohibited'; cat: OrgCategory }
  | { kind: 'diamond_secrets' }
  | { kind: 'diamond_category'; cat: OrgCategory; index: number }
  | { kind: 'restricted' }
  | { kind: 'exit' }

// ── Color maps ────────────────────────────────────────────────────────────────

function accentForKey(policyKey: string): { bar: string; border: string; bg: string; text: string } {
  if (policyKey === 'netskope:prohibited_access_block')
    return { bar: 'bg-red-500',    border: 'border-red-500/40',    bg: 'bg-red-500/8',    text: 'text-red-400' }
  if (policyKey === 'netskope:always_block_global_dlp')
    return { bar: 'bg-rose-700',   border: 'border-rose-700/40',   bg: 'bg-rose-700/8',   text: 'text-rose-400' }
  if (policyKey === 'netskope:approved_supported')
    return { bar: 'bg-emerald-500',border: 'border-emerald-500/40',bg: 'bg-emerald-500/8',text: 'text-emerald-400' }
  if (policyKey === 'netskope:approved_with_conditions')
    return { bar: 'bg-blue-500',   border: 'border-blue-500/40',   bg: 'bg-blue-500/8',   text: 'text-blue-400' }
  if (policyKey === 'netskope:restricted_unassessed')
    return { bar: 'bg-amber-500',  border: 'border-amber-500/40',  bg: 'bg-amber-500/8',  text: 'text-amber-400' }
  // custom categories
  return { bar: 'bg-indigo-500', border: 'border-indigo-500/40', bg: 'bg-indigo-500/8', text: 'text-indigo-400' }
}

function priorityLabel(policyKey: string): string {
  if (policyKey === 'netskope:prohibited_access_block')   return 'P100'
  if (policyKey === 'netskope:always_block_global_dlp')   return 'P200'
  if (policyKey === 'netskope:restricted_unassessed')     return 'P900'
  if (policyKey === 'netskope:approved_supported')        return 'P300'
  if (policyKey === 'netskope:approved_with_conditions')  return 'P400'
  if (policyKey.startsWith('netskope:custom:'))           return 'P5xx'
  return 'Pxxx'
}

// ── Action helpers ────────────────────────────────────────────────────────────

// Module-level const so the map is built once, not on every render call.
// Must stay in sync with actionChipClass() in node-detail-panel.tsx.
const ACTION_LABEL: Record<string, string> = {
  'block':      'Block',
  'quarantine': 'Quarantine',
  'coach-ack':  'Coach',
  'coach-just': 'Justify',
  'alert':      'Alert',
  'monitor':    'Monitor',
  'allow':      'Allow',
}

// Map raw engine action codes to display-friendly labels.
// Raw values should never be shown to users.
function actionLabel(action: string): string {
  return ACTION_LABEL[action.toLowerCase()] ?? action
}

// Color-code chips by action severity.
// coach-just (Justify) is amber — same coaching family, different intent.
function actionChipStyle(action: string): { bg: string; text: string; border: string } {
  const a = action.toLowerCase()
  if (a === 'block' || a === 'quarantine')
    return { bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30' }
  if (a === 'coach-ack' || a === 'coach-just' || a.startsWith('coach'))
    return { bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/30' }
  if (a === 'alert')
    return { bg: 'bg-orange-500/20',  text: 'text-orange-400',  border: 'border-orange-500/30' }
  if (a === 'monitor')
    return { bg: 'bg-slate-500/20',   text: 'text-slate-400',   border: 'border-slate-500/30' }
  // allow / allow_cts / anything unrecognised → green
  return { bg: 'bg-emerald-500/20',   text: 'text-emerald-400', border: 'border-emerald-500/30' }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EntryNode({ laneIdx }: { laneIdx: number }) {
  const cy = laneIdx * LANE_H + LANE_H / 2
  return (
    <div
      style={{ position: 'absolute', left: X_SPINE - 110, top: cy - 54, width: 220 }}
      className="flex flex-col gap-1.5 select-none"
    >
      <div className="rounded-lg border border-border/60 bg-card px-3 py-2 text-center text-xs font-medium text-muted-foreground">
        User on Managed Device
      </div>
      <div className="rounded-lg border-2 border-indigo-500/50 bg-indigo-500/8 px-3 py-2 text-center text-xs font-semibold text-indigo-300">
        Netskope Inline Proxy
        <span className="block text-[10px] font-normal text-indigo-400/70 mt-0.5">Policy Engine</span>
      </div>
    </div>
  )
}

interface DiamondNodeProps {
  laneIdx:  number
  label:    string
}

function DiamondNode({ laneIdx, label }: DiamondNodeProps) {
  const cy = laneIdx * LANE_H + LANE_H / 2
  return (
    <div
      style={{
        position: 'absolute',
        left:   X_SPINE - DIAMOND_S / 2,
        top:    cy - DIAMOND_S / 2,
        width:  DIAMOND_S,
        height: DIAMOND_S,
        transform: 'rotate(45deg)',
      }}
      className="border-2 border-indigo-500/40 bg-indigo-500/8 flex items-center justify-center"
    >
      <div style={{ transform: 'rotate(-45deg)' }} className="text-center px-2">
        <p className="text-[10px] leading-tight text-foreground/80 font-medium whitespace-normal max-w-[80px]">
          {label}
        </p>
      </div>
    </div>
  )
}

interface ActionNodeProps {
  laneIdx:    number
  policyKey:  string
  policy:     NetskopePolicy | undefined
  status:     'configured' | 'warning' | 'missing'
  centered?:  boolean
  onClick:    (key: string) => void
}

function ActionNode({ laneIdx, policyKey, policy, status, centered, onClick }: ActionNodeProps) {
  const cy     = laneIdx * LANE_H + LANE_H / 2
  const left   = centered ? X_SPINE - ACTION_W / 2 : X_ACTION
  const colors = accentForKey(policyKey)

  const borderClass =
    status === 'missing'  ? 'border-dashed border-border/40' :
    status === 'warning'  ? `border-amber-500/50 ${colors.border}` :
                            colors.border

  const statusDot =
    status === 'configured' ? 'bg-emerald-400' :
    status === 'warning'    ? 'bg-amber-400' :
                              'bg-red-400'

  return (
    <motion.button
      style={{ position: 'absolute', left, top: cy - ACTION_H / 2, width: ACTION_W, height: ACTION_H }}
      className={`rounded-lg border-2 ${borderClass} ${colors.bg} overflow-hidden text-left cursor-pointer hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
      onClick={() => onClick(policyKey)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Top accent stripe */}
      <div className={`h-1 w-full shrink-0 ${colors.bar}`} />

      {/* Content — flex-col so mt-auto pushes no-match to bottom */}
      <div className="px-3 py-2 flex flex-col h-[calc(100%-4px)]">

        {/* Header: priority + status dot */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <span className={`text-[10px] font-bold tracking-widest ${colors.text} uppercase`}>
            {priorityLabel(policyKey)}
          </span>
          <span className={`w-2 h-2 rounded-full ${statusDot} shrink-0`} />
        </div>

        {/* Policy name / missing state */}
        {status === 'missing' ? (
          <p className="text-[11px] text-muted-foreground/60 italic mt-1 shrink-0">(Not configured)</p>
        ) : (
          <>
            <p className="text-[11px] font-medium text-foreground leading-snug line-clamp-2 mt-0.5 shrink-0">
              {policy?.name ?? policyKey}
            </p>

            {/* Profile list — cap at 3 when there's a no-match row (needs ~28px), 4 otherwise.
                This prevents the no-match row being clipped by overflow-hidden when coaching
                labels wrap to a second line and the combined content exceeds the fixed height. */}
            {policy && policy.profiles.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/30 space-y-1 overflow-hidden">
                {(() => {
                  const cap = policy.no_match_action ? 3 : 4
                  return (
                    <>
                      {policy.profiles.slice(0, cap).map((pr, i) => {
                        const chip = actionChipStyle(pr.profile_action)
                        return (
                          <div key={`${pr.profile_type}-${i}`} className="flex items-start justify-between gap-2">
                            <p className="text-[10px] text-muted-foreground/70 leading-snug flex-1 truncate">
                              {pr.profile}
                              {pr.coaching_template && (
                                <span className="text-muted-foreground/40"> · {pr.coaching_template}</span>
                              )}
                            </p>
                            <span className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${chip.bg} ${chip.text} ${chip.border}`}>
                              {actionLabel(pr.profile_action)}
                            </span>
                          </div>
                        )
                      })}
                      {policy.profiles.length > cap && (
                        <p className="text-[10px] text-muted-foreground/40">
                          +{policy.profiles.length - cap} more
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
            )}

            {/* No-match row — pushed to bottom */}
            {policy?.no_match_action && (
              <div className="mt-auto pt-2 border-t border-border/30 flex items-center justify-between gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground/50">No Match</span>
                {(() => {
                  const chip = actionChipStyle(policy.no_match_action)
                  return (
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${chip.bg} ${chip.text} ${chip.border}`}>
                      {actionLabel(policy.no_match_action)}
                    </span>
                  )
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </motion.button>
  )
}

function ExitNode({ laneIdx }: { laneIdx: number }) {
  const cy    = laneIdx * LANE_H + LANE_H / 2
  // Width spans from left of spine area all the way to the collection spine
  // so both the NO-path spine and the YES-path collection arrow land visibly on this node.
  const left  = X_SPINE - 140
  const width = X_COLLECT - left + 10
  return (
    <div
      style={{ position: 'absolute', left, top: cy - 22, width }}
      className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-center select-none"
    >
      <p className="text-xs font-medium text-muted-foreground">Netskope Events / Alerts / Incidents</p>
    </div>
  )
}

// ── SVG Arrow Layer ───────────────────────────────────────────────────────────

interface ArrowLayerProps {
  lanes:          LaneKind[]
  canvasH:        number
  prefersReduced: boolean
}

function ArrowLayer({ lanes, canvasH, prefersReduced }: ArrowLayerProps) {
  // Include 'restricted' so P900 gets a YES branch arrow like all other policy slots.
  const diamondLanes = lanes
    .map((l, i) => ({ l, i }))
    .filter(({ l }) =>
      l.kind === 'diamond_prohibited' ||
      l.kind === 'diamond_secrets'    ||
      l.kind === 'diamond_category'   ||
      l.kind === 'restricted'
    )

  const entryLane    = 0
  const exitLaneIdx  = lanes.length - 1
  const entryBottomY = entryLane * LANE_H + LANE_H - 10
  const exitTopY     = exitLaneIdx * LANE_H + 10
  const exitCy       = exitLaneIdx * LANE_H + LANE_H / 2

  // Right-collection spine: all YES-action paths feed into this vertical line
  // then converge into the exit (events) node at the bottom.
  const collectFirstCy = diamondLanes.length > 0
    ? diamondLanes[0].i * LANE_H + LANE_H / 2
    : exitCy

  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      width="100%"
      height={canvasH}
    >
      <defs>
        {/* Down-pointing arrowhead for spine */}
        <marker id="arrow-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgb(99 102 241 / 0.5)" />
        </marker>
        {/* Right-pointing arrowhead for YES branches */}
        <marker id="arrow-head-side" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgb(99 102 241 / 0.6)" />
        </marker>
        {/* Left-pointing arrowhead for collection spine → exit node */}
        <marker id="arrow-head-left" markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto">
          <path d="M8,0 L8,6 L0,3 z" fill="rgb(99 102 241 / 0.45)" />
        </marker>
      </defs>

      {/* ── Left spine (NO path) ──────────────────────────────────────────── */}
      <line
        x1={X_SPINE} y1={entryBottomY}
        x2={X_SPINE} y2={exitTopY}
        stroke="rgb(99 102 241 / 0.3)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        markerEnd="url(#arrow-head)"
      />

      {/* ── YES branches (diamond → action box) ─────────────────────────── */}
      {diamondLanes.map(({ i }) => {
        const cy           = i * LANE_H + LANE_H / 2
        const branchStartX = X_SPINE + DIAMOND_S / 2 - 2
        const branchEndX   = X_ACTION - 8
        return (
          <g key={`branch-${i}`}>
            <line
              x1={branchStartX} y1={cy}
              x2={branchEndX}   y2={cy}
              stroke="rgb(99 102 241 / 0.45)"
              strokeWidth="1.5"
              markerEnd="url(#arrow-head-side)"
            />
            <text x={branchStartX + 8} y={cy - 5} fontSize="9" fill="rgb(99 102 241 / 0.7)" fontWeight="600">
              YES
            </text>
            <text x={X_SPINE - 18} y={i * LANE_H + LANE_H - 6} fontSize="9" fill="rgb(148 163 184 / 0.7)" fontWeight="500">
              NO
            </text>
          </g>
        )
      })}

      {/* ── Right-collection spine (action box → events) ─────────────────── */}
      {/* Horizontal tail from right edge of each ActionNode to the collection spine */}
      {diamondLanes.map(({ i }) => {
        const cy = i * LANE_H + LANE_H / 2
        return (
          <line key={`tail-${i}`}
            x1={X_ACTION + ACTION_W + 2} y1={cy}
            x2={X_COLLECT}               y2={cy}
            stroke="rgb(99 102 241 / 0.2)"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
        )
      })}

      {/* Vertical collection spine from first action lane down to exit level */}
      {diamondLanes.length > 0 && (
        <line
          x1={X_COLLECT} y1={collectFirstCy}
          x2={X_COLLECT} y2={exitCy}
          stroke="rgb(99 102 241 / 0.2)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      )}

      {/* Horizontal arrow from collection spine into exit node (right → left) */}
      {diamondLanes.length > 0 && (
        <line
          x1={X_COLLECT}  y1={exitCy}
          x2={X_COLLECT - 5} y2={exitCy}
          stroke="rgb(99 102 241 / 0.35)"
          strokeWidth="1.5"
          markerEnd="url(#arrow-head-left)"
        />
      )}

      {/* ── Animated dots ────────────────────────────────────────────────── */}
      {/* YES-branch dots (diamond → action box) */}
      {!prefersReduced && diamondLanes.map(({ i }, dotIdx) => {
        const cy    = i * LANE_H + LANE_H / 2
        const dur   = 1.8 + dotIdx * 0.3
        const begin = dotIdx * 0.4
        return (
          <circle key={`dot-${i}`} r="3.5" fill="rgb(99 102 241 / 0.7)">
            <animate attributeName="cx" from={X_SPINE + DIAMOND_S / 2 + 4} to={X_ACTION - 12}
              dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
            <animate attributeName="cy" from={cy} to={cy}
              dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
          </circle>
        )
      })}

      {/* NO-path spine dot (entry → exit) */}
      {!prefersReduced && (
        <circle r="3.5" fill="rgb(99 102 241 / 0.5)">
          <animate attributeName="cy" from={entryBottomY + 10} to={exitTopY - 10}
            dur="3s" repeatCount="indefinite" />
          <animate attributeName="cx" from={X_SPINE} to={X_SPINE}
            dur="3s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Collection spine dot (first action → exit) */}
      {!prefersReduced && diamondLanes.length > 0 && (
        <circle r="3" fill="rgb(99 102 241 / 0.4)">
          <animate attributeName="cy" from={collectFirstCy} to={exitCy}
            dur="2.5s" begin="0.8s" repeatCount="indefinite" />
          <animate attributeName="cx" from={X_COLLECT} to={X_COLLECT}
            dur="2.5s" begin="0.8s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PolicyFlowDiagram({ orgName, recommendation, categories }: Props) {
  const [selectedPolicyKey, setSelectedPolicyKey] = useState<string | null>(null)
  const prefersReduced = useReducedMotion() ?? false

  // ── Lanes ──────────────────────────────────────────────────────────────────
  const lanes = useMemo<LaneKind[]>(() => {
    const prohibitedCat = categories.find(c => c.access_posture === 'block')
    const allowedCats   = categories
      .filter(c => {
        // Normalize system_tag before comparing — the DB may use either the legacy
        // hyphenated form ('permitted-with-restriction') or the internal underscore
        // form ('restricted_unassessed'). TAG_ALIAS resolves both to 'restricted_unassessed'.
        const normalized = TAG_ALIAS[c.system_tag ?? ''] ?? c.system_tag ?? ''
        return c.access_posture !== 'block' && normalized !== 'restricted_unassessed'
      })
      .sort((a, b) => a.priority - b.priority)

    const result: LaneKind[] = [{ kind: 'entry' }]
    if (prohibitedCat) result.push({ kind: 'diamond_prohibited', cat: prohibitedCat })
    result.push({ kind: 'diamond_secrets' })
    allowedCats.forEach((cat, index) => result.push({ kind: 'diamond_category', cat, index }))
    result.push({ kind: 'restricted' })
    result.push({ kind: 'exit' })
    return result
  }, [categories])

  const canvasH = lanes.length * LANE_H + 40

  // Build a Map once so per-lane findPolicy() is O(1), not O(n) × 7 lanes.
  const policyMap = useMemo(
    () => new Map(recommendation.recommended_policies.map(p => [p.policy_key, p])),
    [recommendation.recommended_policies],
  )

  const findPolicy = (key: string): NetskopePolicy | undefined => policyMap.get(key)

  // Sorted policies for sequence strip — memoized to avoid re-sorting every render.
  const sortedPolicies = useMemo(
    () => recommendation.recommended_policies.slice().sort((a, b) => a.priority - b.priority),
    [recommendation.recommended_policies],
  )

  const scopedCount = recommendation.scoped_policies?.policies.length ?? 0
  const manualCount = recommendation.manual_policies?.length ?? 0

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border/50 shrink-0">
        <Link
          href="/genai-controls/architecture"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
        >
          <span aria-hidden>←</span> GenAI Architecture
        </Link>
        <div className="h-4 w-px bg-border/60" />
        <h1 className="text-sm font-semibold text-foreground">
          Netskope Policy Flow — <span className="text-muted-foreground font-normal">{orgName}</span>
        </h1>
      </div>

      {/* ── Partial recommendation banner ──────────────────────────────────── */}
      {recommendation.is_partial && (
        <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-2.5 text-sm text-amber-300 shrink-0">
          <span aria-hidden>⚠</span>
          Recommendation is incomplete — some policies could not be generated
        </div>
      )}

      {/* ── Policy evaluation sequence strip ───────────────────────────────── */}
      {sortedPolicies.length > 0 && (
        <div className="px-6 py-2.5 border-b border-border/40 bg-muted/5 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mr-2 shrink-0">
              Evaluation Order
            </span>
            {sortedPolicies.map((p, i) => {
              const colors    = accentForKey(p.policy_key)
              const label     = priorityLabel(p.policy_key)
              // Strip "GenAI — " prefix and trailing " — <word>" suffix for compact display
              // Strip "GenAI — " prefix then everything from the last " — " onwards.
              // Using .* (not \S+) so multi-word suffixes like "Content Protection" are also removed.
              const shortName = p.name
                .replace(/^GenAI\s*[—–-]\s*/i, '')
                .replace(/\s*[—–-]\s*.*$/, '')
              return (
                <Fragment key={p.policy_key}>
                  <button
                    onClick={() => setSelectedPolicyKey(p.policy_key)}
                    title={p.name}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-medium ${colors.border} ${colors.bg} ${colors.text} hover:brightness-110 transition-all whitespace-nowrap`}
                  >
                    <span className="font-bold">{label}</span>
                    <span className="text-foreground/60 font-normal max-w-[90px] truncate">
                      {shortName}
                    </span>
                  </button>
                  {i < sortedPolicies.length - 1 && (
                    <span className="text-muted-foreground/30 text-xs">→</span>
                  )}
                </Fragment>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Action legend ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 px-6 py-1.5 border-b border-border/30 bg-muted/5 shrink-0">
        {(
          [
            { label: 'Block',   dot: 'bg-red-400'     },
            { label: 'Coach',   dot: 'bg-amber-400'   },
            { label: 'Justify', dot: 'bg-amber-400'   },
            { label: 'Alert',   dot: 'bg-orange-400'  },
            { label: 'Monitor', dot: 'bg-slate-400'   },
            { label: 'Allow',   dot: 'bg-emerald-400' },
          ] as const
        ).map(({ label, dot }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            <span className="text-[10px] text-muted-foreground/60">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Scrollable canvas ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        <div style={{ minWidth: 1200, height: canvasH, position: 'relative' }}>

          {/* Arrow layer (behind nodes) */}
          <ArrowLayer lanes={lanes} canvasH={canvasH} prefersReduced={prefersReduced} />

          {/* Nodes */}
          {lanes.map((lane, idx) => {
            switch (lane.kind) {

              case 'entry':
                return <EntryNode key="entry" laneIdx={idx} />

              case 'diamond_prohibited': {
                const pKey   = 'netskope:prohibited_access_block'
                const policy = findPolicy(pKey)
                const status = getSlotStatus(pKey, recommendation)
                return (
                  <div key="prohibited">
                    <DiamondNode laneIdx={idx} label={`Is app ${lane.cat.name}?`} />
                    <ActionNode laneIdx={idx} policyKey={pKey} policy={policy} status={status} onClick={setSelectedPolicyKey} />
                  </div>
                )
              }

              case 'diamond_secrets': {
                const pKey   = 'netskope:always_block_global_dlp'
                const policy = findPolicy(pKey)
                const status = getSlotStatus(pKey, recommendation)
                return (
                  <div key="secrets">
                    <DiamondNode laneIdx={idx} label="Secrets or Keys?" />
                    <ActionNode laneIdx={idx} policyKey={pKey} policy={policy} status={status} onClick={setSelectedPolicyKey} />
                  </div>
                )
              }

              case 'diamond_category': {
                const cat = lane.cat
                // Normalize system_tag — DB may use legacy hyphenated tags
                // ('enterprise-approved') or internal underscore keys ('approved_supported').
                // TAG_ALIAS maps both forms to the canonical internal key.
                const normalizedTag = TAG_ALIAS[cat.system_tag ?? ''] ?? cat.system_tag ?? ''
                const pKey =
                  normalizedTag === 'approved_supported'
                    ? 'netskope:approved_supported'
                    : normalizedTag === 'approved_with_conditions'
                    ? 'netskope:approved_with_conditions'
                    : `netskope:custom:${normalizedTag || cat.id}`
                const policy = findPolicy(pKey)
                const status = getSlotStatus(pKey, recommendation)
                return (
                  <div key={`cat-${cat.id}`}>
                    <DiamondNode laneIdx={idx} label={`Is app ${cat.name}?`} />
                    <ActionNode laneIdx={idx} policyKey={pKey} policy={policy} status={status} onClick={setSelectedPolicyKey} />
                  </div>
                )
              }

              case 'restricted': {
                const pKey   = 'netskope:restricted_unassessed'
                const policy = findPolicy(pKey)
                const status = getSlotStatus(pKey, recommendation)
                return (
                  <div key="restricted">
                    <DiamondNode laneIdx={idx} label="Unclassified / Restricted?" />
                    <ActionNode laneIdx={idx} policyKey={pKey} policy={policy} status={status} onClick={setSelectedPolicyKey} />
                  </div>
                )
              }

              case 'exit':
                return <ExitNode key="exit" laneIdx={idx} />
            }
          })}
        </div>

        {/* Summary line */}
        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            +{scopedCount} scoped {scopedCount === 1 ? 'policy' : 'policies'} · {manualCount} manual
          </span>
          <span>→</span>
          <Link
            href="/genai-controls/vendor-mapping/netskope/recommendation"
            className="text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
          >
            Netskope Policies <span aria-hidden>↗</span>
          </Link>
        </div>
      </div>

      {/* Detail panel */}
      <NodeDetailPanel
        policyKey={selectedPolicyKey}
        recommendation={recommendation}
        onClose={() => setSelectedPolicyKey(null)}
      />
    </div>
  )
}
