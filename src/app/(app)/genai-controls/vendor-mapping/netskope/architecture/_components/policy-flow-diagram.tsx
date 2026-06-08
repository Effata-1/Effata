'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { NodeDetailPanel } from './node-detail-panel'
import { getSlotStatus }  from '@/lib/genai/netskope/architecture-utils'
import { TAG_ALIAS }      from '@/lib/genai/control-matrix-rows'
import type { NetskopeRecommendation, NetskopePolicy } from '@/lib/genai/netskope/types'
import type { OrgCategory } from '@/lib/genai/netskope/get-recommendation'

// ── Constants ─────────────────────────────────────────────────────────────────

const LANE_H    = 140   // px per lane
const X_SPINE   = 480   // horizontal center of spine
const X_ACTION  = 760   // left edge of action boxes
const ACTION_W  = 260   // width of action boxes
const DIAMOND_S = 110   // rotated square size (both w and h)

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
  badge?:   number | null
}

function DiamondNode({ laneIdx, label, badge }: DiamondNodeProps) {
  const cy = laneIdx * LANE_H + LANE_H / 2
  return (
    <div
      style={{
        position: 'absolute',
        left:  X_SPINE - DIAMOND_S / 2,
        top:   cy - DIAMOND_S / 2,
        width: DIAMOND_S,
        height: DIAMOND_S,
        transform: 'rotate(45deg)',
      }}
      className="border-2 border-indigo-500/40 bg-indigo-500/8 flex items-center justify-center"
    >
      <div style={{ transform: 'rotate(-45deg)' }} className="text-center px-2">
        <p className="text-[10px] leading-tight text-foreground/80 font-medium whitespace-normal max-w-[80px]">
          {label}
        </p>
        {badge != null && badge > 0 && (
          <span className="mt-1 inline-block text-[9px] bg-indigo-500/20 text-indigo-300 rounded-full px-1.5 py-0.5">
            {badge} apps
          </span>
        )}
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
      style={{ position: 'absolute', left, top: cy - 45, width: ACTION_W, minHeight: 90 }}
      className={`rounded-lg border-2 ${borderClass} ${colors.bg} overflow-hidden text-left cursor-pointer hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
      onClick={() => onClick(policyKey)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Top accent stripe */}
      <div className={`h-1 w-full ${colors.bar}`} />
      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-bold tracking-widest ${colors.text} uppercase`}>
            {priorityLabel(policyKey)}
          </span>
          <span className={`w-2 h-2 rounded-full ${statusDot} shrink-0`} />
        </div>
        {status === 'missing' ? (
          <p className="text-[11px] text-muted-foreground/60 italic">(Not configured)</p>
        ) : (
          <>
            <p className="text-[11px] font-medium text-foreground leading-snug line-clamp-2">
              {policy?.name ?? policyKey}
            </p>
            {policy && policy.profiles.length > 0 && (
              <p className="text-[10px] text-muted-foreground/70">
                {policy.profiles.length} profile{policy.profiles.length !== 1 ? 's' : ''}
              </p>
            )}
          </>
        )}
      </div>
    </motion.button>
  )
}

function ExitNode({ laneIdx }: { laneIdx: number }) {
  const cy = laneIdx * LANE_H + LANE_H / 2
  return (
    <div
      style={{ position: 'absolute', left: X_SPINE - 130, top: cy - 22, width: 260 }}
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
  // Gather diamond lane indices (not entry/exit)
  const diamondLanes = lanes
    .map((l, i) => ({ l, i }))
    .filter(({ l }) =>
      l.kind === 'diamond_prohibited' ||
      l.kind === 'diamond_secrets' ||
      l.kind === 'diamond_category'
    )

  const entryLane     = 0
  const exitLaneIdx   = lanes.length - 1
  const entryBottomY  = entryLane * LANE_H + LANE_H - 10
  const exitTopY      = exitLaneIdx * LANE_H + 10

  // Spine arrow tip offset
  const spineArrowStartX = X_SPINE

  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      width="100%"
      height={canvasH}
    >
      <defs>
        <marker id="arrow-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgb(99 102 241 / 0.5)" />
        </marker>
        <marker id="arrow-head-side" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgb(99 102 241 / 0.6)" />
        </marker>
      </defs>

      {/* Vertical spine */}
      <line
        x1={spineArrowStartX} y1={entryBottomY}
        x2={spineArrowStartX} y2={exitTopY}
        stroke="rgb(99 102 241 / 0.3)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        markerEnd="url(#arrow-head)"
      />

      {/* YES branches + labels */}
      {diamondLanes.map(({ i }) => {
        const cy = i * LANE_H + LANE_H / 2
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

      {/* Animated flow dots — skip when reduced motion */}
      {!prefersReduced && diamondLanes.map(({ i }, dotIdx) => {
        const cy    = i * LANE_H + LANE_H / 2
        const dur   = 1.8 + dotIdx * 0.3
        const begin = dotIdx * 0.4
        return (
          <circle key={`dot-${i}`} r="3.5" fill="rgb(99 102 241 / 0.7)">
            <animate
              attributeName="cx"
              from={X_SPINE + DIAMOND_S / 2 + 4}
              to={X_ACTION - 12}
              dur={`${dur}s`}
              begin={`${begin}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              from={cy}
              to={cy}
              dur={`${dur}s`}
              begin={`${begin}s`}
              repeatCount="indefinite"
            />
          </circle>
        )
      })}

      {/* Vertical spine dot */}
      {!prefersReduced && (
        <circle r="3.5" fill="rgb(99 102 241 / 0.5)">
          <animate
            attributeName="cy"
            from={entryBottomY + 10}
            to={exitTopY - 10}
            dur="3s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="cx"
            from={spineArrowStartX}
            to={spineArrowStartX}
            dur="3s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PolicyFlowDiagram({ orgName, recommendation, categories }: Props) {
  const [selectedPolicyKey, setSelectedPolicyKey] = useState<string | null>(null)
  const prefersReduced = useReducedMotion() ?? false

  // Compute lanes
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

  // Policy lookup helpers
  const findPolicy = (key: string): NetskopePolicy | undefined =>
    recommendation.recommended_policies.find(p => p.policy_key === key)

  // App badge counts from recommended_policies destination
  const prohibitedAppCount = useMemo(() => {
    const p = findPolicy('netskope:prohibited_access_block')
    return p?.destination?.tag_or_category ? null : null // counts come from recommendation context
  }, [recommendation])

  // Scoped + manual counts for footer
  const scopedCount  = recommendation.scoped_policies?.policies?.length ?? 0
  const manualCount  = recommendation.manual_policies?.length ?? 0

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
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

      {/* Partial recommendation banner */}
      {recommendation.is_partial && (
        <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-2.5 text-sm text-amber-300 shrink-0">
          <span aria-hidden>⚠</span>
          Recommendation is incomplete — some policies could not be generated
        </div>
      )}

      {/* Scrollable canvas */}
      <div className="flex-1 overflow-auto p-6">
        <div style={{ minWidth: 1200, height: canvasH, position: 'relative' }}>

          {/* Arrow layer (rendered behind nodes) */}
          <ArrowLayer
            lanes={lanes}
            canvasH={canvasH}
            prefersReduced={prefersReduced}
          />

          {/* Nodes */}
          {lanes.map((lane, idx) => {
            switch (lane.kind) {
              case 'entry': {
                return <EntryNode key="entry" laneIdx={idx} />
              }

              case 'diamond_prohibited': {
                const pKey   = 'netskope:prohibited_access_block'
                const policy = findPolicy(pKey)
                const status = getSlotStatus(pKey, recommendation)
                const appBadge = policy?.destination?.tag_or_category
                  ? null
                  : null
                return (
                  <div key="prohibited">
                    <DiamondNode
                      laneIdx={idx}
                      label={`Is app ${lane.cat.name}?`}
                      badge={appBadge}
                    />
                    <ActionNode
                      laneIdx={idx}
                      policyKey={pKey}
                      policy={policy}
                      status={status}
                      onClick={setSelectedPolicyKey}
                    />
                  </div>
                )
              }

              case 'diamond_secrets': {
                const pKey   = 'netskope:always_block_global_dlp'
                const policy = findPolicy(pKey)
                const status = getSlotStatus(pKey, recommendation)
                return (
                  <div key="secrets">
                    <DiamondNode
                      laneIdx={idx}
                      label="Secrets or Keys?"
                    />
                    <ActionNode
                      laneIdx={idx}
                      policyKey={pKey}
                      policy={policy}
                      status={status}
                      onClick={setSelectedPolicyKey}
                    />
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
                    <DiamondNode
                      laneIdx={idx}
                      label={`Is app ${cat.name}?`}
                    />
                    <ActionNode
                      laneIdx={idx}
                      policyKey={pKey}
                      policy={policy}
                      status={status}
                      onClick={setSelectedPolicyKey}
                    />
                  </div>
                )
              }

              case 'restricted': {
                const pKey   = 'netskope:restricted_unassessed'
                const policy = findPolicy(pKey)
                const status = getSlotStatus(pKey, recommendation)
                return (
                  <div key="restricted">
                    {/* Centered diamond for P900 fallback */}
                    <DiamondNode
                      laneIdx={idx}
                      label="Unclassified / Restricted?"
                    />
                    <ActionNode
                      laneIdx={idx}
                      policyKey={pKey}
                      policy={policy}
                      status={status}
                      centered
                      onClick={setSelectedPolicyKey}
                    />
                  </div>
                )
              }

              case 'exit': {
                return <ExitNode key="exit" laneIdx={idx} />
              }
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
