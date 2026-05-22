'use client'

import { useRef, useState, useMemo, useLayoutEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Text } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { DistrictData, SimResult } from './types'
import { DistrictPanel } from './district-panel'

export type { DistrictData }

// ─── Camera ───────────────────────────────────────────────────────────────────
function CameraSetup() {
  const camera = useThree(s => s.camera)
  useLayoutEffect(() => { camera.lookAt(-3, 1, 0) }, [camera])
  return null
}

// ─── Coverage level config ────────────────────────────────────────────────────
const LEVEL_CFG = {
  full:    { glow: '#10b981', label: 'Full Inline',   ht: 3.8, ei: 0.45 },
  partial: { glow: '#f59e0b', label: 'Partial',       ht: 2.8, ei: 0.36 },
  addon:   { glow: '#3b82f6', label: 'API / At-rest', ht: 2.3, ei: 0.28 },
  none:    { glow: '#ef4444', label: 'Gap',           ht: 0.8, ei: 0.20 },
  unknown: { glow: '#475569', label: 'Not Assessed',  ht: 1.1, ei: 0.08 },
}
function lc(level: string) { return LEVEL_CFG[level as keyof typeof LEVEL_CFG] ?? LEVEL_CFG.unknown }

// ─── 8 DLP inspection rows (matches reference image) ─────────────────────────
const ROWS = [
  { key: 'endpoint',    label: 'Endpoint DLP',             srcLabel: 'Managed Endpoints',   dstLabel: 'Local / Physical Exfil'   },
  { key: 'email',       label: 'Email DLP',                srcLabel: 'Mail Infrastructure',  dstLabel: 'External Mail Destinations' },
  { key: 'web',         label: 'Web / SSE / CASB Inline',  srcLabel: 'Managed Endpoints',    dstLabel: 'Internet & Web Apps'      },
  { key: 'saas-inline', label: 'SaaS API DLP',             srcLabel: 'SaaS Users',           dstLabel: 'SaaS & Collaboration'     },
  { key: 'saas-api',    label: 'Cloud / DSPM',             srcLabel: 'SaaS Data Stores',     dstLabel: 'Cloud Storage & Data Stores' },
  { key: 'genai',       label: 'GenAI DLP',                srcLabel: 'Managed Endpoints',    dstLabel: 'GenAI Apps'               },
  { key: 'network',     label: 'Secrets / CI-CD Scanning', srcLabel: 'Developers / CI-CD',   dstLabel: 'Developer & API Ecosystems' },
  { key: 'm2m',         label: 'Machine-to-Machine',       srcLabel: 'Servers & Services',   dstLabel: 'External Hosts',
    staticGap: true },
] as const

const N = ROWS.length                            // 8
const rowZ = (ri: number) => (ri - (N - 1) / 2) * 3   // z: -10.5 … +10.5

const ROAD_X1  = -9.0
const ROAD_X2  =  9.0
const ROAD_LEN = ROAD_X2 - ROAD_X1
const SRC_X    = -14.0
const DST_X    =  14.0

// Varied building heights for visual interest
const SRC_H = [3.2, 4.4, 2.6, 3.8, 5.0, 2.9, 5.5, 2.0]
const DST_H = [4.0, 3.2, 4.6, 2.9, 5.2, 3.4, 2.6, 4.4]

// ─── PulseRing ────────────────────────────────────────────────────────────────
function PulseRing({ color, active }: { color: string; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current || !active) return
    const t = (clock.elapsedTime * 0.5) % 1
    ref.current.scale.setScalar(1 + t * 2.5)
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.55
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.52, 0.65, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

// ─── Inspection gate (Zone 3 checkpoint) ─────────────────────────────────────
function Gate({ level, tool }: { level: string; tool: string }) {
  const c   = lc(level)
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.9 })
  const active = level !== 'unknown' && level !== 'none'
  return (
    <group>
      {/* Left pillar */}
      <mesh position={[-0.65, 0.70, 0]}>
        <boxGeometry args={[0.22, 1.4, 0.22]} />
        <meshStandardMaterial color={c.glow} emissive={c.glow} emissiveIntensity={0.9} />
      </mesh>
      {/* Right pillar */}
      <mesh position={[+0.65, 0.70, 0]}>
        <boxGeometry args={[0.22, 1.4, 0.22]} />
        <meshStandardMaterial color={c.glow} emissive={c.glow} emissiveIntensity={0.9} />
      </mesh>
      {/* Cross bar */}
      <mesh position={[0, 1.42, 0]}>
        <boxGeometry args={[1.8, 0.13, 0.15]} />
        <meshStandardMaterial emissive={c.glow} emissiveIntensity={1.8} />
      </mesh>
      {/* Spinning diamond */}
      <mesh ref={ref} position={[0, 2.10, 0]}>
        <octahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial color={c.glow} emissive={c.glow} emissiveIntensity={active ? 3.2 : 0.5} metalness={0.4} roughness={0.3} />
      </mesh>
      <PulseRing color={c.glow} active={active} />
      {tool && (
        <Text position={[0, -0.32, 0]} fontSize={0.14} color={c.glow} anchorX="center" anchorY="middle">
          {tool}
        </Text>
      )}
    </group>
  )
}

// ─── Building ─────────────────────────────────────────────────────────────────
function Building({ x, h, label, zoneColor, highlight, onClick }: {
  x: number; h: number; label: string; zoneColor: string
  highlight: boolean; onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  const ei = highlight ? 0.9 : hov ? 0.6 : 0.32
  return (
    <group position={[x, 0, 0]}
      onClick={e => { e.stopPropagation(); onClick() }}
      onPointerOver={e => { e.stopPropagation(); setHov(true) }}
      onPointerOut={() => setHov(false)}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[3.2, h, 2.0]} />
        <meshStandardMaterial color={zoneColor} emissive={zoneColor} emissiveIntensity={ei} metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[0, h + 0.06, 0]}>
        <boxGeometry args={[3.2, 0.16, 2.0]} />
        <meshStandardMaterial emissive={zoneColor} emissiveIntensity={highlight ? 4.5 : 2.0} />
      </mesh>
      {[0.3, 0.7, 1.1, 1.5, 2.0, 2.5].filter(wy => wy < h - 0.2).map((wy, i) => (
        <mesh key={i} position={[0, wy, 1.01]}>
          <planeGeometry args={[2.4, 0.14]} />
          <meshStandardMaterial emissive={zoneColor} emissiveIntensity={0.28} transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
      <Text position={[0, h + 0.52, 0]} fontSize={0.18} color={highlight ? '#ffffff' : '#cbd5e1'}
        anchorX="center" anchorY="middle" maxWidth={3} textAlign="center">
        {label}
      </Text>
    </group>
  )
}

// ─── Road + Londa wave ────────────────────────────────────────────────────────
const ORB_R = [0.12, 0.09, 0.07, 0.05, 0.03]

function Road({ level, isSimRow, simColor }: { level: string; isSimRow: boolean; simColor: string }) {
  const c       = lc(level)
  const color   = isSimRow ? simColor : c.glow
  const waveRef = useRef<THREE.InstancedMesh>(null)
  const simRef  = useRef<THREE.InstancedMesh>(null)
  const dummy   = useMemo(() => new THREE.Object3D(), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (waveRef.current) {
      for (let cl = 0; cl < 2; cl++) {
        const base = ((t * 0.36 + cl * 0.5) % 1)
        for (let orb = 0; orb < 5; orb++) {
          const p   = ((base - orb * 0.055) + 1) % 1
          const vis = p > 0.03 && p < 0.97
          dummy.position.set(ROAD_X1 + p * ROAD_LEN, 0.09, 0)
          dummy.scale.setScalar(vis ? ORB_R[orb] : 0)
          dummy.updateMatrix()
          waveRef.current.setMatrixAt(cl * 5 + orb, dummy.matrix)
        }
      }
      waveRef.current.instanceMatrix.needsUpdate = true
    }
    if (simRef.current && isSimRow) {
      const p   = ((t * 0.52) % 1)
      dummy.position.set(ROAD_X1 + p * ROAD_LEN, 0.14, 0)
      dummy.scale.setScalar(p > 0.02 && p < 0.98 ? 0.24 : 0)
      dummy.updateMatrix()
      simRef.current.setMatrixAt(0, dummy.matrix)
      simRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROAD_LEN, 0.62]} />
        <meshStandardMaterial color={color} emissive={color}
          emissiveIntensity={isSimRow ? 0.30 : 0.12}
          transparent opacity={level === 'unknown' ? 0.20 : 0.65} depthWrite={false} />
      </mesh>
      {level !== 'unknown' && (
        <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[ROAD_LEN, 0.022]} />
          <meshBasicMaterial color={color} transparent opacity={0.40} depthWrite={false} />
        </mesh>
      )}
      {level !== 'unknown' && level !== 'none' && (
        <instancedMesh ref={waveRef} args={[undefined, undefined, 10]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial color={c.glow} emissive={c.glow} emissiveIntensity={5.5} />
        </instancedMesh>
      )}
      {isSimRow && (
        <instancedMesh ref={simRef} args={[undefined, undefined, 1]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={simColor} emissive={simColor} emissiveIntensity={7.5} />
        </instancedMesh>
      )}
    </group>
  )
}

// ─── Gap pulse ────────────────────────────────────────────────────────────────
function GapPulse() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = 0.025 + Math.sin(clock.elapsedTime * 2.5) * 0.020
  })
  return (
    <mesh ref={ref} position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[ROAD_LEN + 14, 2.8]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.025} depthWrite={false} />
    </mesh>
  )
}

// ─── Cluster of buildings (Zone 1 HQ / Zone 5 Incident) ──────────────────────
const HQ_BLDGS     = [{ x: 0,    z: 0,   h: 6.2, w: 3.4 }, { x: 3.8,  z: 0.2, h: 4.0, w: 2.6 },
                      { x: -3.2, z: 0.4, h: 2.8, w: 2.2 }, { x: 1.5,  z: 2.6, h: 2.4, w: 2.0 }]
const INC_BLDGS    = [{ x: 0,    z: 0,   h: 3.8, w: 2.8 }, { x: 3.2,  z: 0.2, h: 2.6, w: 2.2 },
                      { x: -3.0, z: 0.4, h: 2.8, w: 2.0 }, { x: 1.2,  z: 2.4, h: 1.8, w: 1.8 }]

function Cluster({ pos, color, bldgs, label, num }: {
  pos: [number, number, number]; color: string
  bldgs: { x: number; z: number; h: number; w: number }[]
  label: string; num: string
}) {
  return (
    <group position={pos}>
      {bldgs.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          <mesh position={[0, b.h / 2, 0]}>
            <boxGeometry args={[b.w, b.h, 1.6]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.38} metalness={0.3} roughness={0.7} />
          </mesh>
          <mesh position={[0, b.h + 0.07, 0]}>
            <boxGeometry args={[b.w, 0.13, 1.6]} />
            <meshStandardMaterial emissive={color} emissiveIntensity={2.0} />
          </mesh>
        </group>
      ))}
      <Html position={[0, 0.1, -4]} center transform={false} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 17, height: 17, borderRadius: '50%', background: color, color: '#fff',
            fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {num}
          </div>
          <span style={{ color, fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' }}>{label}</span>
        </div>
      </Html>
    </group>
  )
}

// ─── Sim result badge ─────────────────────────────────────────────────────────
const SIM_COLORS: Record<string, { bg: string; border: string; color: string; label: string }> = {
  block: { bg: 'rgba(239,68,68,.25)',  border: 'rgba(239,68,68,.7)',  color: '#fca5a5', label: 'BLOCK'  },
  coach: { bg: 'rgba(245,158,11,.25)', border: 'rgba(245,158,11,.7)', color: '#fcd34d', label: 'COACH'  },
  allow: { bg: 'rgba(16,185,129,.25)', border: 'rgba(16,185,129,.7)', color: '#6ee7b7', label: 'ALLOW'  },
  gap:   { bg: 'rgba(71,85,105,.25)',  border: 'rgba(71,85,105,.6)',  color: '#94a3b8', label: 'GAP'    },
}
function SimBadge({ action, h }: { action: string; h: number }) {
  const s = SIM_COLORS[action] ?? SIM_COLORS.gap
  return (
    <Html position={[DST_X, h + 1.4, 0]} center transform={false}>
      <div style={{ padding: '4px 10px', borderRadius: 6, background: s.bg,
        border: `1.5px solid ${s.border}`, color: s.color, fontSize: 11,
        fontWeight: 800, letterSpacing: '0.08em', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        {s.label}
      </div>
    </Html>
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function CityScene({ districts, simulation, onSelect }: {
  districts: DistrictData[]
  simulation: SimResult | null
  onSelect: (d: DistrictData | null) => void
}) {
  const byKey = Object.fromEntries(districts.map(d => [d.channelKey, d]))
  const ZONE_D = (N - 1) * 3 + 5   // ~26 units

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.18} color="#1a2a4a" />
      <pointLight position={[0, 32, 0]} intensity={0.6} color="#3b82f6" decay={0} />
      <pointLight position={[-22, 10, 0]} intensity={0.35} color="#6366f1" decay={0} />
      <pointLight position={[22, 10, 0]} intensity={0.35} color="#f59e0b" decay={0} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <planeGeometry args={[110, 80]} />
        <meshStandardMaterial color="#020914" roughness={1} />
      </mesh>
      <gridHelper args={[110, 110, '#111827', '#0d1526']} position={[0, -0.05, 0]} />

      {/* ── Zone tint floors ── */}
      {/* Zone 2: Data Origins */}
      <mesh position={[-17, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, ZONE_D]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.055} depthWrite={false} />
      </mesh>
      {/* Zone 3: DLP Enforcement */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[22, ZONE_D]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.030} depthWrite={false} />
      </mesh>
      {/* Zone 4: Destinations */}
      <mesh position={[+17, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, ZONE_D]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.055} depthWrite={false} />
      </mesh>

      {/* ── Zone header labels ── */}
      <Html position={[-17, 0.1, -(ZONE_D / 2) - 1.2]} center transform={false} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#3b82f6', color: '#fff',
            fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</div>
          <span style={{ color: '#60a5fa', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Data Origins</span>
        </div>
      </Html>
      <Html position={[0, 0.1, -(ZONE_D / 2) - 1.2]} center transform={false} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#10b981', color: '#fff',
            fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</div>
          <span style={{ color: '#34d399', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>DLP Enforcement &amp; Inspection Zone</span>
        </div>
      </Html>
      <Html position={[+17, 0.1, -(ZONE_D / 2) - 1.2]} center transform={false} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#f59e0b', color: '#fff',
            fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>4</div>
          <span style={{ color: '#fbbf24', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Destinations / Exposure Points</span>
        </div>
      </Html>

      {/* ── Zone 1: Classification & Policy HQ ── */}
      <Cluster pos={[-22, 0, -(ZONE_D / 2) - 1]} color="#6366f1"
        bldgs={HQ_BLDGS} label="Classification & Policy HQ" num="1" />

      {/* ── Zone 5: Incident, Evidence & Response ── */}
      <Cluster pos={[-22, 0, (ZONE_D / 2) - 1]} color="#ef4444"
        bldgs={INC_BLDGS} label="Incident, Evidence & Response Center" num="5" />

      {/* ── Per-channel inspection rows ── */}
      {ROWS.map((row, ri) => {
        const d        = byKey[row.key]
        const level    = ('staticGap' in row && row.staticGap) ? 'none' : (d?.level ?? 'unknown')
        const c        = lc(level)
        const z        = rowZ(ri)
        const isSimRow = simulation?.channelKey === row.key
        const srcH     = SRC_H[ri] ?? 2.0
        const dstH     = DST_H[ri] ?? 2.0

        return (
          <group key={row.key} position={[0, 0, z]}>
            {level === 'none' && <GapPulse />}
            <Road level={level} isSimRow={isSimRow} simColor={c.glow} />
            <Gate level={level} tool={(d?.coveredBy ?? [])[0] ?? ''} />

            <Building x={SRC_X} h={srcH} label={row.srcLabel}
              zoneColor="#3b82f6" highlight={isSimRow}
              onClick={() => onSelect(d ?? null)} />

            <Building x={DST_X} h={dstH} label={row.dstLabel}
              zoneColor="#f59e0b" highlight={isSimRow}
              onClick={() => {}} />

            {/* Row channel label (centre of road, above gate) */}
            <Html position={[0, 2.5, 0]} center transform={false} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
              <div style={{
                background: isSimRow ? c.glow + '30' : 'rgba(2,9,20,0.78)',
                border: `1px solid ${c.glow}45`, color: c.glow,
                fontSize: 8.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                letterSpacing: '0.04em',
              }}>{row.label}</div>
            </Html>

            {/* Status badge (right of destination buildings) */}
            <Html position={[DST_X + 3.8, 1.4, 0]} center transform={false} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
              <div style={{
                background: c.glow + '1c', border: `1px solid ${c.glow}55`,
                color: c.glow, fontSize: 8, fontWeight: 800, padding: '2px 9px',
                borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {'staticGap' in row && row.staticGap && (
                  <span style={{ color: '#f59e0b' }}>⚠</span>
                )}
                {c.label}
              </div>
            </Html>

            {isSimRow && simulation && <SimBadge action={simulation.action} h={dstH} />}
          </group>
        )
      })}
    </>
  )
}

// ─── Policy Actions Command Center (absolute HTML overlay) ───────────────────
const POLICY_ACTIONS = [
  { label: 'Monitor',    color: '#3b82f6' },
  { label: 'Coach',      color: '#f59e0b' },
  { label: 'Justify',    color: '#8b5cf6' },
  { label: 'Block',      color: '#ef4444' },
  { label: 'Quarantine', color: '#f97316' },
  { label: 'Encrypt',    color: '#10b981' },
  { label: 'Notify',     color: '#64748b' },
]

function PolicyBar() {
  return (
    <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, pointerEvents: 'none' }}>
      <div style={{ background: 'rgba(2,9,20,0.88)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: '7px 14px', backdropFilter: 'blur(4px)' }}>
        <div style={{ textAlign: 'center', color: '#475569', fontSize: 8, letterSpacing: '0.18em',
          marginBottom: 6, textTransform: 'uppercase', fontWeight: 700 }}>
          Policy Actions Command Center
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {POLICY_ACTIONS.map(a => (
            <div key={a.label} style={{ background: a.color + '1a', border: `1px solid ${a.color}44`,
              color: a.color, fontSize: 8.5, fontWeight: 700, padding: '3px 8px',
              borderRadius: 5, letterSpacing: '0.05em' }}>{a.label}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────
const LEGEND_ITEMS = [
  { color: '#10b981', label: 'Full Inline'  },
  { color: '#f59e0b', label: 'Partial'      },
  { color: '#3b82f6', label: 'API / At-rest' },
  { color: '#8b5cf6', label: 'Metadata-only' },
  { color: '#ef4444', label: 'Gap'           },
  { color: '#475569', label: 'Not Assessed'  },
]

function MapLegend() {
  return (
    <div style={{ position: 'absolute', bottom: 14, right: 14, zIndex: 10, pointerEvents: 'none' }}>
      <div style={{ background: 'rgba(2,9,20,0.85)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8, padding: '8px 12px' }}>
        <div style={{ color: '#475569', fontSize: 7.5, letterSpacing: '0.15em', marginBottom: 6,
          textTransform: 'uppercase', fontWeight: 700 }}>Legend</div>
        {LEGEND_ITEMS.map(it => (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <div style={{ width: 22, height: 2, background: it.color, borderRadius: 1, flexShrink: 0 }} />
            <span style={{ color: '#94a3b8', fontSize: 8.5, fontWeight: 600 }}>{it.label}</span>
          </div>
        ))}
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 8, height: 1.5, background: '#60a5fa', borderRadius: 1 }} />
            <div style={{ width: 0, height: 0, borderTop: '3px solid transparent',
              borderBottom: '3px solid transparent', borderLeft: '5px solid #60a5fa' }} />
          </div>
          <span style={{ color: '#60a5fa', fontSize: 8, fontWeight: 600 }}>Data Flow</span>
        </div>
      </div>
    </div>
  )
}

// ─── CityMap (export) ─────────────────────────────────────────────────────────
interface CityMapProps {
  districts:  DistrictData[]
  simulation: SimResult | null
}

export function CityMap({ districts, simulation }: CityMapProps) {
  const [selected, setSelected] = useState<DistrictData | null>(null)

  return (
    <div className="relative flex-1 min-w-0 overflow-hidden bg-[#020914]">
      <PolicyBar />
      <Canvas
        flat orthographic
        camera={{ position: [34, 30, 34], zoom: 17, near: 0.1, far: 2000 }}
        style={{ width: '100%', height: '100%' }}
        onPointerMissed={() => setSelected(null)}
      >
        <CameraSetup />
        <CityScene districts={districts} simulation={simulation} onSelect={setSelected} />
        <EffectComposer>
          <Bloom intensity={1.4} luminanceThreshold={0.05} luminanceSmoothing={0.85} mipmapBlur />
        </EffectComposer>
      </Canvas>
      <MapLegend />
      <DistrictPanel district={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
