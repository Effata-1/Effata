'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { DistrictData, SimResult } from './types'
import { DistrictPanel } from './district-panel'

export type { DistrictData }

// ─── Level colour palette ─────────────────────────────────────────────────────
const L: Record<string, {
  fill: string; fillRoof: string; fillSide: string
  stroke: string; glow: string; filterId: string
  label: string; text: string; road: string
}> = {
  full:    { fill:'rgba(16,185,129,0.16)',  fillRoof:'rgba(16,185,129,0.26)',  fillSide:'rgba(16,185,129,0.07)',  stroke:'rgba(16,185,129,0.75)', glow:'#10b981', filterId:'neon-full',    label:'Full Coverage', text:'#6ee7b7', road:'#10b981' },
  partial: { fill:'rgba(245,158,11,0.16)',  fillRoof:'rgba(245,158,11,0.26)',  fillSide:'rgba(245,158,11,0.07)',  stroke:'rgba(245,158,11,0.75)', glow:'#f59e0b', filterId:'neon-partial', label:'Partial',       text:'#fcd34d', road:'#f59e0b' },
  addon:   { fill:'rgba(59,130,246,0.16)',  fillRoof:'rgba(59,130,246,0.26)',  fillSide:'rgba(59,130,246,0.07)',  stroke:'rgba(59,130,246,0.75)', glow:'#3b82f6', filterId:'neon-addon',   label:'Add-on',        text:'#93c5fd', road:'#3b82f6' },
  none:    { fill:'rgba(239,68,68,0.16)',   fillRoof:'rgba(239,68,68,0.26)',   fillSide:'rgba(239,68,68,0.07)',   stroke:'rgba(239,68,68,0.75)',  glow:'#ef4444', filterId:'neon-none',    label:'Gap',           text:'#fca5a5', road:'#ef4444' },
  unknown: { fill:'rgba(71,85,105,0.1)',    fillRoof:'rgba(71,85,105,0.16)',   fillSide:'rgba(71,85,105,0.04)',   stroke:'rgba(71,85,105,0.28)', glow:'#475569', filterId:'',             label:'Not Assessed',  text:'#94a3b8', road:'#475569' },
}
function cfg(level: string) { return L[level] ?? L.unknown }

// ─── Channel rows layout ──────────────────────────────────────────────────────
const ROWS = [
  { key: 'email',       y: 138, srcLabel:'Mail Infrastructure',   dstLabel:'External Mail Destinations' },
  { key: 'web',         y: 234, srcLabel:'Managed Endpoints',      dstLabel:'Internet & Web Apps'        },
  { key: 'saas-inline', y: 330, srcLabel:'SaaS Users',             dstLabel:'SaaS & Collaboration'       },
  { key: 'saas-api',    y: 426, srcLabel:'SaaS Data Stores',       dstLabel:'Cloud Storage & Data'       },
  { key: 'endpoint',    y: 522, srcLabel:'Managed Endpoints',      dstLabel:'Local / Physical Exfil'     },
  { key: 'genai',       y: 618, srcLabel:'Managed Endpoints',      dstLabel:'GenAI Apps & AI Agents'     },
  { key: 'network',     y: 714, srcLabel:'Servers & Services',     dstLabel:'External Hosts / APIs'      },
]

// ─── Node geometry ─────────────────────────────────────────────────────────────
const NW = 248  // node width
const NH = 62   // node height
const DX = 8    // isometric x offset
const DY = 8    // isometric y offset

const LEFT_X  = 20    // left building front-face left edge
const RIGHT_X = 1132  // right building front-face left edge
const ROAD_X1 = 276   // road start (just right of left building ISO)
const ROAD_X2 = 1126  // road end (just left of right building)
const CHKPT_X = 701   // checkpoint centre x

// ─── Channel icons (16×16 SVG paths, centred at origin) ──────────────────────
const ICONS: Record<string, React.ReactNode> = {
  email: <>
    <rect x="-8" y="-5" width="16" height="11" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/>
    <polyline points="-8,-5 0,2 8,-5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
  </>,
  web: <>
    <circle cx="0" cy="0" r="7" fill="none" stroke="currentColor" strokeWidth="1.2"/>
    <ellipse cx="0" cy="0" rx="3" ry="7" fill="none" stroke="currentColor" strokeWidth="1.2"/>
    <line x1="-7" y1="0" x2="7" y2="0" stroke="currentColor" strokeWidth="1.2"/>
  </>,
  'saas-inline': <>
    <path d="M-5,3 a5,5 0 1,1 4,-6 a3.5,3.5 0 0,1 6,1 a3.5,3.5 0 1,1 0,5 z" fill="none" stroke="currentColor" strokeWidth="1.2"/>
  </>,
  'saas-api': <>
    <ellipse cx="0" cy="-5" rx="6" ry="2.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
    <line x1="-6" y1="-5" x2="-6" y2="5" stroke="currentColor" strokeWidth="1.2"/>
    <line x1="6" y1="-5" x2="6" y2="5" stroke="currentColor" strokeWidth="1.2"/>
    <ellipse cx="0" cy="5" rx="6" ry="2.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
  </>,
  endpoint: <>
    <rect x="-7" y="-5" width="14" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/>
    <line x1="-4" y1="5" x2="-4" y2="7" stroke="currentColor" strokeWidth="1.2"/>
    <line x1="4" y1="5" x2="4" y2="7" stroke="currentColor" strokeWidth="1.2"/>
    <line x1="-6" y1="7" x2="6" y2="7" stroke="currentColor" strokeWidth="1.2"/>
  </>,
  genai: <>
    <rect x="-6" y="-4" width="12" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2"/>
    <circle cx="-2.5" cy="1" r="1.5" fill="currentColor"/>
    <circle cx="2.5" cy="1" r="1.5" fill="currentColor"/>
    <line x1="-3" y1="-4" x2="-3" y2="-7" stroke="currentColor" strokeWidth="1.2"/>
    <line x1="3" y1="-4" x2="3" y2="-7" stroke="currentColor" strokeWidth="1.2"/>
  </>,
  network: <>
    <path d="M-7,2 a9,9 0 0,1 14,0" fill="none" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M-4,5 a6,6 0 0,1 8,0" fill="none" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M-1,8 a2,2 0 0,1 2,0" fill="none" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="0" cy="8" r="1.2" fill="currentColor"/>
  </>,
}

// ─── Policy action items ──────────────────────────────────────────────────────
const POLICY_ACTIONS = ['Monitor','Coach','Justify','Block','Quarantine','Encrypt','Notify']
const POLICY_COLORS  = ['#94a3b8','#f59e0b','#a78bfa','#ef4444','#f97316','#3b82f6','#10b981']

// ─── Glow filters ─────────────────────────────────────────────────────────────
function GlowFilter({ id, color }: { id: string; color: string }) {
  return (
    <filter id={id} x="-60%" y="-400%" width="220%" height="900%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur1"/>
      <feGaussianBlur in="SourceAlpha" stdDeviation="14" result="blur2"/>
      <feFlood floodColor={color} floodOpacity="0.9" result="c1"/>
      <feFlood floodColor={color} floodOpacity="0.45" result="c2"/>
      <feComposite in="c1" in2="blur1" operator="in" result="glow1"/>
      <feComposite in="c2" in2="blur2" operator="in" result="glow2"/>
      <feMerge>
        <feMergeNode in="glow2"/>
        <feMergeNode in="glow1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  )
}

// ─── Building node ────────────────────────────────────────────────────────────
interface BuildingProps {
  x: number; y: number
  channelKey: string
  label:     string
  sublabel:  string
  level:     string
  isHighlighted: boolean
  isSelected:    boolean
  onClick:       () => void
}
function BuildingNode({ x, y, channelKey, label, sublabel, level, isHighlighted, isSelected, onClick }: BuildingProps) {
  const c = cfg(level)
  const ny = y - NH / 2  // top edge of front face

  const roofPts  = `${x},${ny} ${x+NW},${ny} ${x+NW+DX},${ny-DY} ${x+DX},${ny-DY}`
  const sidePts  = `${x+NW},${ny} ${x+NW},${ny+NH} ${x+NW+DX},${ny+NH-DY} ${x+NW+DX},${ny-DY}`
  const shadowPts= `${x+2},${ny+NH} ${x+NW+2},${ny+NH} ${x+NW+DX+2},${ny+NH-DY} ${x+DX+2},${ny+NH-DY}`
  const icon     = ICONS[channelKey]

  return (
    <g onClick={onClick} style={{ cursor:'pointer' }}>
      {/* Ground shadow */}
      <polygon points={shadowPts} fill="rgba(0,0,0,0.25)" />
      {/* Right side face */}
      <polygon points={sidePts} fill={c.fillSide} />
      {/* Roof top face */}
      <polygon points={roofPts} fill={c.fillRoof} />
      {/* Front face */}
      <rect x={x} y={ny} width={NW} height={NH} rx="2"
        fill={c.fill}
        stroke={isSelected || isHighlighted ? c.stroke : 'rgba(255,255,255,0.06)'}
        strokeWidth={isSelected ? 1.5 : 1}
      />
      {/* Top accent line */}
      <rect x={x} y={ny} width={NW} height={2.5} rx="1" fill={c.stroke} opacity={isHighlighted ? 1 : 0.55} />
      {/* Window grid (decorative) */}
      <rect x={x+8} y={ny+8} width={10} height={8} rx="1" fill="rgba(255,255,255,0.05)" />
      <rect x={x+24} y={ny+8} width={10} height={8} rx="1" fill="rgba(255,255,255,0.05)" />
      <rect x={x+8} y={ny+24} width={10} height={8} rx="1" fill="rgba(255,255,255,0.05)" />
      <rect x={x+24} y={ny+24} width={10} height={8} rx="1" fill="rgba(255,255,255,0.05)" />
      {/* Channel icon */}
      <g transform={`translate(${x+NW-30},${ny+NH/2})`} color={c.glow} opacity="0.75">
        {icon}
      </g>
      {/* Label text */}
      <text x={x+46} y={ny+25} fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.88)">{label}</text>
      <text x={x+46} y={ny+42} fontSize="8.5" fill={c.text}>{sublabel}</text>
      {/* Coverage badge */}
      <rect x={x+46} y={ny+46} width={58} height={12} rx="2.5" fill={c.fill} stroke={c.stroke} strokeWidth="0.6" />
      <text x={x+75} y={ny+55} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={c.text}>{c.label}</text>
    </g>
  )
}

// ─── Checkpoint diamond ───────────────────────────────────────────────────────
function Checkpoint({ cx, cy, level, toolName }: { cx: number; cy: number; level: string; toolName: string }) {
  const c = cfg(level)
  return (
    <g>
      {/* Pulse rings (behind diamond) */}
      {c.filterId && <>
        <circle cx={cx} cy={cy} r={16} fill="none"
          stroke={c.glow} strokeWidth="1.2"
          style={{
            animation: 'chkpt-pulse 2.2s ease-out infinite',
            transformOrigin: `${cx}px ${cy}px`,
          } as React.CSSProperties}
        />
        <circle cx={cx} cy={cy} r={16} fill="none"
          stroke={c.glow} strokeWidth="1.2"
          style={{
            animation: 'chkpt-pulse 2.2s ease-out infinite',
            animationDelay: '-1.1s',
            transformOrigin: `${cx}px ${cy}px`,
          } as React.CSSProperties}
        />
      </>}
      {/* Diamond */}
      <rect x={cx-14} y={cy-14} width={28} height={28} rx="2"
        transform={`rotate(45,${cx},${cy})`}
        fill={c.fill} stroke={c.stroke} strokeWidth="1"
        filter={c.filterId ? `url(#${c.filterId})` : undefined}
      />
      {/* Inner dot */}
      <circle cx={cx} cy={cy} r="4" fill={c.glow} opacity="0.85" />
      {/* Tool label below */}
      <text x={cx} y={cy+30} textAnchor="middle" fontSize="8" fill={c.text}>{toolName || 'No Coverage'}</text>
    </g>
  )
}

// ─── Simulation action badge ──────────────────────────────────────────────────
const SIM_BADGE: Record<string, { fill: string; stroke: string; text: string; label: string }> = {
  block: { fill:'rgba(239,68,68,0.2)',   stroke:'rgba(239,68,68,0.6)',  text:'#fca5a5', label:'BLOCK'  },
  coach: { fill:'rgba(245,158,11,0.2)',  stroke:'rgba(245,158,11,0.6)', text:'#fcd34d', label:'COACH'  },
  allow: { fill:'rgba(16,185,129,0.2)',  stroke:'rgba(16,185,129,0.6)', text:'#6ee7b7', label:'ALLOW'  },
  gap:   { fill:'rgba(71,85,105,0.2)',   stroke:'rgba(71,85,105,0.5)',  text:'#94a3b8', label:'GAP'    },
}

// ─── Main CityMap ─────────────────────────────────────────────────────────────
interface CityMapProps {
  districts:  DistrictData[]
  simulation: SimResult | null
}

export function CityMap({ districts, simulation }: CityMapProps) {
  const [selected, setSelected] = useState<DistrictData | null>(null)
  const byKey = Object.fromEntries(districts.map(d => [d.channelKey, d]))

  // Contiguous gap rows → one warning band
  const gapRows = ROWS.filter(r => byKey[r.key]?.level === 'none')

  return (
    <div className="relative flex-1 overflow-hidden bg-[#020914]">
      {/* CSS keyframes */}
      <style>{`
        @keyframes dlp-londa {
          0%   { offset-distance:2%;  opacity:0; }
          5%   { opacity:1; }
          88%  { opacity:1; }
          96%  { opacity:0; }
          100% { offset-distance:96%; opacity:0; }
        }
        @keyframes sim-flow {
          0%   { offset-distance:0%;   opacity:0; transform:scale(0.4); }
          4%   { opacity:1; transform:scale(1); }
          94%  { opacity:1; }
          100% { offset-distance:100%; opacity:0; transform:scale(0.4); }
        }
        @keyframes sim-appear {
          from { opacity:0; transform:scale(0.6); }
          to   { opacity:1; transform:scale(1); }
        }
        @keyframes dlp-pulse-gap {
          0%,100% { opacity:0.2; }
          50%     { opacity:0.55; }
        }
        @keyframes road-breath {
          0%,100% { opacity:0.06; }
          50%     { opacity:0.18; }
        }
        @keyframes chkpt-pulse {
          0%   { transform:scale(1);   opacity:0.6; }
          100% { transform:scale(2.4); opacity:0; }
        }
        .gap-pulse  { animation: dlp-pulse-gap 2.4s ease-in-out infinite; }
        .sim-badge  { animation: sim-appear 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .road-breath { animation: road-breath 3.8s ease-in-out infinite; }
      `}</style>

      <svg
        viewBox="0 0 1400 780" width="100%" height="100%"
        onClick={() => setSelected(null)}
        style={{ display:'block', fontFamily:"system-ui,-apple-system,'Segoe UI',sans-serif" }}
      >
        {/* ── Defs ─────────────────────────────────────────────────────── */}
        <defs>
          <pattern id="cm-dots" width="36" height="36" patternUnits="userSpaceOnUse">
            <circle cx="18" cy="18" r="0.6" fill="rgba(255,255,255,0.02)" />
          </pattern>
          <radialGradient id="cm-glow" cx="50%" cy="50%" r="45%">
            <stop offset="0%" stopColor="rgba(59,130,246,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <GlowFilter id="neon-full"    color="#10b981" />
          <GlowFilter id="neon-partial" color="#f59e0b" />
          <GlowFilter id="neon-addon"   color="#3b82f6" />
          <GlowFilter id="neon-none"    color="#ef4444" />
        </defs>

        {/* ── Backgrounds ──────────────────────────────────────────────── */}
        <rect width="1400" height="780" fill="#020914" />
        <rect width="1400" height="780" fill="url(#cm-dots)" />
        <rect width="1400" height="780" fill="url(#cm-glow)" />

        {/* ── Zone background rects ─────────────────────────────────────── */}
        {/* Data Origins */}
        <rect x="14" y="90" width="276" height="658" rx="6"
          fill="rgba(59,130,246,0.02)" stroke="rgba(59,130,246,0.08)" strokeWidth="1" />
        <text x="152" y="84" textAnchor="middle" fontSize="9" fontWeight="600"
          fill="rgba(59,130,246,0.45)" letterSpacing="1.2">DATA ORIGINS</text>

        {/* DLP Inspection */}
        <rect x="305" y="90" width="794" height="658" rx="6"
          fill="rgba(16,185,129,0.015)" stroke="rgba(16,185,129,0.07)" strokeWidth="1" />
        <text x="702" y="84" textAnchor="middle" fontSize="9" fontWeight="600"
          fill="rgba(16,185,129,0.5)" letterSpacing="1.2">DLP ENFORCEMENT &amp; INSPECTION ZONE</text>

        {/* Destinations */}
        <rect x="1116" y="90" width="272" height="658" rx="6"
          fill="rgba(148,163,184,0.02)" stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
        <text x="1252" y="84" textAnchor="middle" fontSize="9" fontWeight="600"
          fill="rgba(148,163,184,0.4)" letterSpacing="1.2">DESTINATIONS / EXPOSURE POINTS</text>

        {/* ── Policy Action Command Center banner ───────────────────────── */}
        <rect x="305" y="14" width="794" height="62" rx="6"
          fill="rgba(15,23,42,0.8)" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
        <text x="425" y="33" fontSize="8" fontWeight="700" fill="rgba(148,163,184,0.5)" letterSpacing="1.5">POLICY ACTION COMMAND CENTER</text>
        {POLICY_ACTIONS.map((action, i) => {
          const bx = 310 + i * 113 + 10
          return (
            <g key={action}>
              <rect x={bx} y="40" width="95" height="26" rx="4"
                fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
              <circle cx={bx + 12} cy={52} r="4" fill={POLICY_COLORS[i]} opacity="0.7" />
              <text x={bx + 22} y="56" fontSize="8.5" fontWeight="600" fill="rgba(255,255,255,0.7)">{action}</text>
            </g>
          )
        })}

        {/* ── Per-channel rows ──────────────────────────────────────────── */}
        {ROWS.map((row, ri) => {
          const d = byKey[row.key]
          const level    = d?.level ?? 'unknown'
          const c        = cfg(level)
          const hasGlow  = level !== 'unknown'
          const roadPath = `M ${ROAD_X1} ${row.y} L ${ROAD_X2} ${row.y}`
          const isSimRow = simulation?.channelKey === row.key

          return (
            <g key={row.key}>
              {/* Row separator (subtle) */}
              {ri > 0 && <line x1="14" y1={row.y - 48} x2="1386" y2={row.y - 48}
                stroke="rgba(255,255,255,0.02)" strokeWidth="1" />}

              {/* Gap row red tint */}
              {level === 'none' && (
                <rect x="305" y={row.y - 44} width="794" height="88"
                  fill="rgba(239,68,68,0.04)" className="gap-pulse" />
              )}

              {/* ── Roads (4 layers) ─── */}
              {/* 1. Road surface band — filled rect, breathes */}
              <rect
                x={ROAD_X1} y={row.y - 11}
                width={ROAD_X2 - ROAD_X1} height={22} rx="3"
                fill={c.road} fillOpacity={level === 'unknown' ? 0 : 0.09}
                stroke={c.road} strokeOpacity={level === 'unknown' ? 0.12 : 0.28} strokeWidth="0.8"
                strokeDasharray={level === 'unknown' ? '8 6' : undefined}
                className={level !== 'unknown' ? 'road-breath' : undefined}
                style={{ animationDelay: `${-ri * 0.55}s` } as React.CSSProperties}
              />
              {/* 2. Center lane dash (covered channels only) */}
              {level !== 'unknown' && (
                <line
                  x1={ROAD_X1} y1={row.y} x2={ROAD_X2} y2={row.y}
                  stroke={c.road} strokeWidth="0.9" opacity="0.32"
                  strokeDasharray="12 8"
                />
              )}
              {/* 3. Mid bloom */}
              <path d={roadPath} fill="none"
                stroke={c.road} strokeWidth="2.5" opacity="0.3"
                filter={hasGlow ? `url(#${c.filterId})` : undefined} />
              {/* 4. Core bright centerline */}
              <path d={roadPath} fill="none"
                stroke={c.road} strokeWidth={isSimRow ? 2.5 : 1.8} opacity={isSimRow ? 1 : 0.82}
                filter={hasGlow ? `url(#${c.filterId})` : undefined}
                strokeDasharray={level === 'unknown' ? '6 5' : undefined}
              />

              {/* Simulation route highlight */}
              {isSimRow && (
                <path d={roadPath} fill="none"
                  stroke={c.road} strokeWidth="4" opacity="0.35"
                  filter={c.filterId ? `url(#${c.filterId})` : undefined} />
              )}

              {/* ── Londa wave packets (2 clusters × 5 circles) ─── */}
              {level !== 'unknown' && level !== 'none' && [0, 1].map(clusterIdx => {
                const clusterBase = -(ri * 0.6 + clusterIdx * 1.7)
                const ORBS: { r: number; op: number }[] = [
                  { r: 5.5, op: 1.00 },
                  { r: 4.5, op: 0.72 },
                  { r: 3.5, op: 0.45 },
                  { r: 2.5, op: 0.27 },
                  { r: 1.5, op: 0.14 },
                ]
                return ORBS.map((orb, orbIdx) => (
                  <circle
                    key={`${clusterIdx}-${orbIdx}`}
                    r={orb.r}
                    fill={c.road}
                    opacity={orb.op}
                    filter={orbIdx === 0 && c.filterId ? `url(#${c.filterId})` : undefined}
                    style={{
                      offsetPath: `path("${roadPath}")`,
                      animation:  'dlp-londa 3.4s linear infinite',
                      animationDelay: `${clusterBase - (0.4 - orbIdx * 0.1)}s`,
                    } as React.CSSProperties}
                  />
                ))
              })}

              {/* ── Simulation comet (halo + core) ─── */}
              {isSimRow && <>
                <circle r="13" fill={c.road} opacity="0.22"
                  style={{
                    offsetPath: `path("${roadPath}")`,
                    animation:  'sim-flow 2.2s ease-in-out infinite',
                  } as React.CSSProperties}
                />
                <circle r="6" fill={c.road} opacity="0.95"
                  filter={c.filterId ? `url(#${c.filterId})` : undefined}
                  style={{
                    offsetPath: `path("${roadPath}")`,
                    animation:  'sim-flow 2.2s ease-in-out infinite',
                  } as React.CSSProperties}
                />
              </>}

              {/* ── Checkpoint ─── */}
              <Checkpoint
                cx={CHKPT_X}
                cy={row.y}
                level={level}
                toolName={(d?.coveredBy ?? [])[0] ?? ''}
              />

              {/* ── Source building (left) ─── */}
              <BuildingNode
                x={LEFT_X} y={row.y}
                channelKey={row.key}
                label={d?.shortName ?? row.key}
                sublabel={row.srcLabel}
                level={level}
                isHighlighted={isSimRow}
                isSelected={selected?.channelKey === row.key}
                onClick={(e?: React.MouseEvent) => { e?.stopPropagation?.(); setSelected(d ?? null) }}
              />

              {/* ── Destination building (right) ─── */}
              <BuildingNode
                x={RIGHT_X} y={row.y}
                channelKey={row.key}
                label={row.dstLabel}
                sublabel="Exposure point"
                level={level}
                isHighlighted={isSimRow}
                isSelected={false}
                onClick={() => {}}
              />

              {/* ── Simulation result badge on destination ─── */}
              {isSimRow && simulation && (() => {
                const sb = SIM_BADGE[simulation.action] ?? SIM_BADGE.gap
                return (
                  <g className="sim-badge" style={{ transformOrigin: `${RIGHT_X + NW / 2}px ${row.y}px` }}>
                    <rect x={RIGHT_X + NW/2 - 36} y={row.y - 14} width={72} height={28} rx="5"
                      fill={sb.fill} stroke={sb.stroke} strokeWidth="1.5" />
                    <text x={RIGHT_X + NW/2} y={row.y + 5} textAnchor="middle"
                      fontSize="10.5" fontWeight="800" fill={sb.text}>{sb.label}</text>
                  </g>
                )
              })()}
            </g>
          )
        })}

        {/* ── GAP AREA warning strip ────────────────────────────────────── */}
        {gapRows.length > 0 && (() => {
          const gy1 = Math.min(...gapRows.map(r => r.y)) - 42
          const gy2 = Math.max(...gapRows.map(r => r.y)) + 42
          return (
            <g>
              <rect x="307" y={gy1} width="790" height={gy2 - gy1} rx="4"
                fill="none" stroke="rgba(239,68,68,0.3)" strokeWidth="1"
                strokeDasharray="5 4" />
              <rect x="420" y={gy1 + (gy2-gy1)/2 - 11} width="232" height="22" rx="4"
                fill="rgba(239,68,68,0.12)" stroke="rgba(239,68,68,0.3)" strokeWidth="0.8" />
              <text x="536" y={gy1 + (gy2-gy1)/2 + 5} textAnchor="middle"
                fontSize="9" fontWeight="700" fill="rgba(239,68,68,0.8)" letterSpacing="0.5">
                ⚠ GAP AREA — LIMITED OR NO INSPECTION
              </text>
            </g>
          )
        })()}

        {/* ── District count badge (top-left) ──────────────────────────── */}
        <rect x="14" y="14" width="276" height="62" rx="6"
          fill="rgba(15,23,42,0.7)" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <text x="26" y="40" fontSize="9" fontWeight="700" fill="rgba(148,163,184,0.5)" letterSpacing="1.5">DLP CITY MAP</text>
        {[
          { label: `${districts.filter(d => d.level === 'full').length} Full`, color: '#10b981' },
          { label: `${districts.filter(d => d.level === 'partial' || d.level === 'addon').length} Partial`, color: '#f59e0b' },
          { label: `${districts.filter(d => d.level === 'none').length} Gap`, color: '#ef4444' },
        ].map((item, i) => (
          <g key={i} transform={`translate(${26 + i * 88},52)`}>
            <circle cx="4" cy="0" r="3" fill={item.color} opacity="0.8" />
            <text x="11" y="4" fontSize="8.5" fill="rgba(255,255,255,0.55)">{item.label}</text>
          </g>
        ))}
      </svg>

      {/* District detail panel */}
      <DistrictPanel district={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
