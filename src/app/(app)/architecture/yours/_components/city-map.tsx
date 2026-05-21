'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { DistrictData } from './types'
import { DistrictPanel } from './district-panel'
import { MapLegend } from './map-legend'

export type { DistrictData }

// ─── Level colour palette (SVG-safe strings, no Tailwind) ───────────────────
const L: Record<string, {
  fill:      string; fillHover: string
  stroke:    string
  road:      string
  packet:    string
  label:     string
  text:      string
}> = {
  full:    { fill: 'rgba(16,185,129,0.13)',  fillHover: 'rgba(16,185,129,0.24)', stroke: 'rgba(16,185,129,0.65)', road: 'rgba(16,185,129,0.45)', packet: '#10b981', label: 'Full Coverage', text: '#6ee7b7' },
  partial: { fill: 'rgba(245,158,11,0.13)',  fillHover: 'rgba(245,158,11,0.24)', stroke: 'rgba(245,158,11,0.65)', road: 'rgba(245,158,11,0.45)', packet: '#f59e0b', label: 'Partial',       text: '#fcd34d' },
  addon:   { fill: 'rgba(59,130,246,0.13)',  fillHover: 'rgba(59,130,246,0.24)', stroke: 'rgba(59,130,246,0.65)', road: 'rgba(59,130,246,0.45)', packet: '#3b82f6', label: 'Add-on',        text: '#93c5fd' },
  none:    { fill: 'rgba(239,68,68,0.13)',   fillHover: 'rgba(239,68,68,0.24)',  stroke: 'rgba(239,68,68,0.65)',  road: 'rgba(239,68,68,0.42)',  packet: '#ef4444', label: 'Gap',           text: '#fca5a5' },
  unknown: { fill: 'rgba(148,163,184,0.07)', fillHover: 'rgba(148,163,184,0.14)',stroke: 'rgba(148,163,184,0.22)',road: 'rgba(148,163,184,0.12)',packet: '#64748b', label: 'Not Assessed',  text: '#94a3b8' },
}

function levelCfg(level: string) { return L[level] ?? L.unknown }

// ─── SVG geometry ─────────────────────────────────────────────────────────────
// viewBox 1200 × 720  ·  centre node at (600, 360)
interface Geo { channelKey: string; cx: number; cy: number; pathD: string; ckX: number; ckY: number }

const GEO: Geo[] = [
  { channelKey: 'email',       cx: 600,  cy:  72, pathD: 'M 600 360 Q 600 216 600 72',     ckX: 600, ckY: 202 },
  { channelKey: 'genai',       cx: 278,  cy: 158, pathD: 'M 600 360 Q 439 259 278 158',    ckX: 423, ckY: 249 },
  { channelKey: 'saas-inline', cx: 922,  cy: 158, pathD: 'M 600 360 Q 761 259 922 158',    ckX: 777, ckY: 249 },
  { channelKey: 'web',         cx: 172,  cy: 360, pathD: 'M 600 360 Q 386 320 172 360',    ckX: 365, ckY: 340 },
  { channelKey: 'saas-api',    cx: 1028, cy: 360, pathD: 'M 600 360 Q 814 320 1028 360',   ckX: 836, ckY: 340 },
  { channelKey: 'endpoint',    cx: 278,  cy: 562, pathD: 'M 600 360 Q 439 461 278 562',    ckX: 423, ckY: 471 },
  { channelKey: 'network',     cx: 922,  cy: 562, pathD: 'M 600 360 Q 761 461 922 562',    ckX: 777, ckY: 471 },
]

// ─── Animation variants ───────────────────────────────────────────────────────
const containerV = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.3 } },
}
const nodeV = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.5 } },
}

// ─── District node (SVG sub-tree) ─────────────────────────────────────────────
interface NodeProps {
  geo:          Geo
  data:         DistrictData
  isSelected:   boolean
  isHovered:    boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick:      () => void
}

function DistrictNode({ geo, data, isSelected, isHovered, onMouseEnter, onMouseLeave, onClick }: NodeProps) {
  const cfg    = levelCfg(data.level)
  const active = isSelected || isHovered

  return (
    <motion.g
      variants={nodeV}
      style={{ cursor: 'pointer' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      {/* Soft outer glow when active */}
      {active && (
        <rect
          x={geo.cx - 86} y={geo.cy - 42} width={172} height={84}
          rx="13" fill="none"
          stroke={cfg.stroke} strokeWidth="1"
          opacity="0.3"
        />
      )}

      {/* Node background */}
      <rect
        x={geo.cx - 80} y={geo.cy - 36} width={160} height={72}
        rx="10"
        fill={active ? cfg.fillHover : cfg.fill}
        stroke={isSelected ? cfg.stroke : active ? cfg.stroke.replace(/[\d.]+\)$/, '0.4)') : 'rgba(255,255,255,0.05)'}
        strokeWidth={isSelected ? 1.5 : 1}
      />

      {/* Coloured top accent strip */}
      <rect
        x={geo.cx - 72} y={geo.cy - 34} width={144} height={2.5}
        rx="1" fill={cfg.stroke}
        opacity={active ? 0.9 : 0.5}
      />

      {/* District name */}
      <text x={geo.cx} y={geo.cy - 7}
        textAnchor="middle" fontSize="11.5" fontWeight="600"
        fill="rgba(255,255,255,0.88)"
      >
        {data.shortName}
      </text>

      {/* Coverage level label */}
      <text x={geo.cx} y={geo.cy + 11}
        textAnchor="middle" fontSize="9.5"
        fill={cfg.text} letterSpacing="0.3"
      >
        {cfg.label}
      </text>

      {/* Pulse ring on gap districts */}
      {data.level === 'none' && (
        <rect
          x={geo.cx - 82} y={geo.cy - 38} width={164} height={76}
          rx="12" fill="none"
          stroke="rgba(239,68,68,0.35)" strokeWidth="1.5"
          className="dlp-pulse"
        />
      )}

      {/* Selected dot indicator */}
      {isSelected && (
        <circle cx={geo.cx} cy={geo.cy + 26} r="2.5" fill={cfg.stroke} opacity="0.9" />
      )}
    </motion.g>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
interface CityMapProps { districts: DistrictData[] }

export function CityMap({ districts }: CityMapProps) {
  const [selected, setSelected] = useState<DistrictData | null>(null)
  const [hovered,  setHovered]  = useState<string | null>(null)

  const byKey = Object.fromEntries(districts.map(d => [d.channelKey, d]))

  function handleDistrictClick(d: DistrictData) {
    setSelected(prev => prev?.channelKey === d.channelKey ? null : d)
  }

  return (
    <div className="relative w-full rounded-2xl border border-white/5" style={{ aspectRatio: '5 / 3' }}>

      {/* CSS keyframes — scoped animation names avoid collisions */}
      <style>{`
        @keyframes dlp-pkt {
          0%   { offset-distance: 5%;  opacity: 0;    }
          8%   { opacity: 0.65; }
          88%  { opacity: 0.65; }
          100% { offset-distance: 93%; opacity: 0; }
        }
        @keyframes dlp-pulse {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 0.7;  }
        }
        .dlp-pulse { animation: dlp-pulse 2.6s ease-in-out infinite; }
      `}</style>

      {/* Map (overflow clipped for rounded corners) */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        <svg
          viewBox="0 0 1200 720" width="100%" height="100%"
          onClick={() => setSelected(null)}
          style={{ display: 'block', fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}
        >
          <defs>
            <pattern id="dlp-dots" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="0.7" fill="rgba(255,255,255,0.022)" />
            </pattern>
            <radialGradient id="dlp-rglow" cx="50%" cy="50%" r="45%">
              <stop offset="0%"   stopColor="rgba(59,130,246,0.07)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>

          {/* Backgrounds */}
          <rect width="1200" height="720" fill="#020914" />
          <rect width="1200" height="720" fill="url(#dlp-dots)" />
          <rect width="1200" height="720" fill="url(#dlp-rglow)" />

          {/* Roads */}
          {GEO.map(geo => {
            const d = byKey[geo.channelKey]
            const cfg = levelCfg(d?.level ?? 'unknown')
            return (
              <path key={`road-${geo.channelKey}`} d={geo.pathD}
                fill="none" stroke={cfg.road} strokeWidth="1.5"
                strokeDasharray={!d || d.level === 'unknown' ? '5 5' : undefined}
              />
            )
          })}

          {/* Checkpoint diamonds */}
          {GEO.map(geo => {
            const d = byKey[geo.channelKey]
            const cfg = levelCfg(d?.level ?? 'unknown')
            return (
              <g key={`cp-${geo.channelKey}`} transform={`translate(${geo.ckX},${geo.ckY})`}>
                <rect x="-5" y="-5" width="10" height="10" rx="1"
                  transform="rotate(45)"
                  fill={cfg.fill} stroke={cfg.stroke} strokeWidth="1"
                />
              </g>
            )
          })}

          {/* Data packets — CSS motion-path */}
          {GEO.flatMap((geo, gi) => {
            const d = byKey[geo.channelKey]
            if (!d || d.level === 'unknown' || d.level === 'none') return []
            const cfg = levelCfg(d.level)
            return [0, 1, 2].map(i => (
              <circle key={`pkt-${geo.channelKey}-${i}`} r="2.8" fill={cfg.packet}
                style={{
                  offsetPath:      `path("${geo.pathD}")`,
                  animation:       'dlp-pkt 3.2s linear infinite',
                  animationDelay:  `${-((gi * 0.45 + i * 1.08) % 3.2)}s`,
                } as React.CSSProperties}
              />
            ))
          })}

          {/* Centre node — Policy Control Center */}
          <g>
            <rect x="496" y="314" width="208" height="92" rx="14"
              fill="rgba(15,23,42,0.9)" stroke="rgba(59,130,246,0.22)" strokeWidth="1.5" />
            <rect x="496" y="314" width="208" height="3" rx="1" fill="rgba(59,130,246,0.45)" />
            <text x="600" y="348" textAnchor="middle" fontSize="9" fontWeight="700"
              fill="rgba(148,163,184,0.5)" letterSpacing="2">POLICY CONTROL</text>
            <text x="600" y="367" textAnchor="middle" fontSize="11.5" fontWeight="600"
              fill="rgba(255,255,255,0.85)">Risk Assessment Engine</text>
            <text x="600" y="385" textAnchor="middle" fontSize="9" fill="rgba(99,102,241,0.55)">
              DLP Coverage Analysis
            </text>
            {[0, 1, 2].map(i => (
              <circle key={i} cx={582 + i * 18} cy={399} r="2.2"
                fill={i === 0 ? 'rgba(16,185,129,0.5)' : i === 1 ? 'rgba(245,158,11,0.5)' : 'rgba(239,68,68,0.5)'} />
            ))}
          </g>

          {/* District nodes (staggered fade-in) */}
          <motion.g variants={containerV} initial="hidden" animate="show">
            {GEO.map(geo => {
              const d = byKey[geo.channelKey]
              if (!d) return null
              return (
                <DistrictNode
                  key={geo.channelKey}
                  geo={geo}
                  data={d}
                  isSelected={selected?.channelKey === geo.channelKey}
                  isHovered={hovered === geo.channelKey}
                  onMouseEnter={() => setHovered(geo.channelKey)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleDistrictClick(d)}
                />
              )
            })}
          </motion.g>
        </svg>
      </div>

      {/* Top-left title overlay */}
      <div className="absolute top-4 left-5 z-10 pointer-events-none">
        <p className="text-[9.5px] text-slate-500 uppercase tracking-[0.2em] font-medium">Architecture Layer</p>
        <p className="text-[13px] font-semibold text-slate-200 mt-0.5">DLP City Map</p>
      </div>

      {/* Bottom-left legend */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <MapLegend />
      </div>

      {/* District detail panel */}
      <DistrictPanel district={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
