'use client'

import { useRef, useState, useMemo, useLayoutEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { DistrictData, SimResult } from './types'
import { DistrictPanel } from './district-panel'

export type { DistrictData }

// ─── Camera setup — forces lookAt after R3F positions it ─────────────────────
function CameraSetup() {
  const camera = useThree(s => s.camera)
  useLayoutEffect(() => {
    camera.lookAt(0, 1, 0)   // scene rows span z=-9..+9, centred at z=0; y=1 lifts gaze slightly
  }, [camera])
  return null
}

// ─── Level palette ────────────────────────────────────────────────────────────
const L = {
  full:    { glow: '#10b981', text: '#6ee7b7', emissive: 0.35, height: 2.8, hasGlow: true  },
  partial: { glow: '#f59e0b', text: '#fcd34d', emissive: 0.28, height: 2.0, hasGlow: true  },
  addon:   { glow: '#3b82f6', text: '#93c5fd', emissive: 0.22, height: 1.6, hasGlow: true  },
  none:    { glow: '#ef4444', text: '#fca5a5', emissive: 0.18, height: 0.5, hasGlow: true  },
  unknown: { glow: '#475569', text: '#94a3b8', emissive: 0.06, height: 0.8, hasGlow: false },
}
function cfg(level: string) { return L[level as keyof typeof L] ?? L.unknown }

// ─── Row layout ───────────────────────────────────────────────────────────────
const ROWS = [
  { key: 'email',       srcLabel: 'Mail Infrastructure',  dstLabel: 'External Mail'       },
  { key: 'web',         srcLabel: 'Managed Endpoints',    dstLabel: 'Internet & Web Apps'  },
  { key: 'saas-inline', srcLabel: 'SaaS Users',           dstLabel: 'SaaS & Collaboration' },
  { key: 'saas-api',    srcLabel: 'SaaS Data Stores',     dstLabel: 'Cloud Storage'        },
  { key: 'endpoint',    srcLabel: 'Managed Endpoints',    dstLabel: 'Local / Physical'     },
  { key: 'genai',       srcLabel: 'Managed Endpoints',    dstLabel: 'GenAI Apps'           },
  { key: 'network',     srcLabel: 'Servers & Services',   dstLabel: 'External Hosts'       },
]
const rowZ = (ri: number) => ri * 3 - 9   // centres scene at z=0 for 7 rows

const ROAD_X1 = -8.4
const ROAD_X2 =  8.4
const ROAD_LEN = ROAD_X2 - ROAD_X1
const BLD_X    = 12.2

// ─── PulseRing ────────────────────────────────────────────────────────────────
function PulseRing({ color, active }: { color: string; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current || !active) return
    const t = (clock.elapsedTime * 0.48) % 1
    ref.current.scale.setScalar(1 + t * 2.2)
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.6
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.40, 0.50, 36]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

// ─── Checkpoint ───────────────────────────────────────────────────────────────
function Checkpoint({ level, toolName }: { level: string; toolName: string }) {
  const c   = cfg(level)
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.9
  })
  return (
    <group>
      <mesh ref={ref} position={[0, 0.42, 0]}>
        <octahedronGeometry args={[0.40, 0]} />
        <meshStandardMaterial color={c.glow} emissive={c.glow}
          emissiveIntensity={c.hasGlow ? 2.8 : 0.4} metalness={0.5} roughness={0.3} />
      </mesh>
      <PulseRing color={c.glow} active={c.hasGlow} />
      <Text position={[0, -0.30, 0]} fontSize={0.18} color={c.text}
        anchorX="center" anchorY="middle">
        {toolName || 'No Coverage'}
      </Text>
    </group>
  )
}

// ─── Building ─────────────────────────────────────────────────────────────────
interface BuildingProps {
  x: number; level: string; label: string; sublabel: string
  isHighlighted: boolean; onClick: () => void
}

function Building({ x, level, label, sublabel, isHighlighted, onClick }: BuildingProps) {
  const c = cfg(level)
  const h = c.height
  const [hovered, setHov] = useState(false)
  const ei = isHighlighted ? 0.85 : hovered ? 0.55 : c.emissive

  return (
    <group position={[x, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={(e) => { e.stopPropagation(); setHov(true) }}
      onPointerOut={() => setHov(false)}>
      {/* Body */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[3.2, h, 1.8]} />
        <meshStandardMaterial color={c.glow} emissive={c.glow}
          emissiveIntensity={ei} metalness={0.35} roughness={0.65} />
      </mesh>
      {/* Roof cap */}
      <mesh position={[0, h + 0.06, 0]}>
        <boxGeometry args={[3.2, 0.12, 1.8]} />
        <meshStandardMaterial emissive={c.glow} emissiveIntensity={isHighlighted ? 4.5 : 2.2} />
      </mesh>
      {/* Window rows */}
      {[0.32, 0.72, 1.14, 1.56].filter(wy => wy < h - 0.22).map((wy, i) => (
        <mesh key={i} position={[0, wy, 0.92]}>
          <planeGeometry args={[2.4, 0.15]} />
          <meshStandardMaterial emissive={c.glow}
            emissiveIntensity={isHighlighted ? 0.9 : 0.32}
            transparent opacity={0.75} depthWrite={false} />
        </mesh>
      ))}
      {/* Label */}
      <Text position={[0, h + 0.50, 0]} fontSize={0.21}
        color={isHighlighted ? '#ffffff' : c.text} anchorX="center" anchorY="middle">
        {label}
      </Text>
      <Text position={[0, h + 0.22, 0]} fontSize={0.13}
        color={c.text} anchorX="center" anchorY="middle">
        {sublabel}
      </Text>
    </group>
  )
}

// ─── Road + Londa wave ────────────────────────────────────────────────────────
const ORB_R = [0.13, 0.10, 0.075, 0.05, 0.03]

function Road({ level, isSimRow, simColor }: { level: string; isSimRow: boolean; simColor: string }) {
  const c       = cfg(level)
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
      const vis = p > 0.02 && p < 0.98
      dummy.position.set(ROAD_X1 + p * ROAD_LEN, 0.14, 0)
      dummy.scale.setScalar(vis ? 0.25 : 0)
      dummy.updateMatrix()
      simRef.current.setMatrixAt(0, dummy.matrix)
      simRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {/* Surface */}
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROAD_LEN, 0.62]} />
        <meshStandardMaterial color={isSimRow ? simColor : c.glow}
          emissive={isSimRow ? simColor : c.glow}
          emissiveIntensity={isSimRow ? 0.32 : 0.14}
          transparent opacity={level === 'unknown' ? 0.22 : 0.68}
          depthWrite={false} />
      </mesh>
      {/* Lane dash */}
      {level !== 'unknown' && (
        <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[ROAD_LEN, 0.022]} />
          <meshBasicMaterial color={isSimRow ? simColor : c.glow}
            transparent opacity={0.42} depthWrite={false} />
        </mesh>
      )}
      {/* Londa orbs */}
      {level !== 'unknown' && level !== 'none' && (
        <instancedMesh ref={waveRef} args={[undefined, undefined, 10]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial color={c.glow} emissive={c.glow} emissiveIntensity={5.5} />
        </instancedMesh>
      )}
      {/* Sim comet */}
      {isSimRow && (
        <instancedMesh ref={simRef} args={[undefined, undefined, 1]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={simColor} emissive={simColor} emissiveIntensity={7.5} />
        </instancedMesh>
      )}
    </group>
  )
}

// ─── Simulation result badge (HTML overlay) ───────────────────────────────────
const SIM_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  block: { bg: 'rgba(239,68,68,0.25)',   border: 'rgba(239,68,68,0.7)',  color: '#fca5a5', label: 'BLOCK' },
  coach: { bg: 'rgba(245,158,11,0.25)',  border: 'rgba(245,158,11,0.7)', color: '#fcd34d', label: 'COACH' },
  allow: { bg: 'rgba(16,185,129,0.25)',  border: 'rgba(16,185,129,0.7)', color: '#6ee7b7', label: 'ALLOW' },
  gap:   { bg: 'rgba(71,85,105,0.25)',   border: 'rgba(71,85,105,0.6)',  color: '#94a3b8', label: 'GAP'   },
}

function SimBadge({ action, bldH }: { action: string; bldH: number }) {
  const s = SIM_STYLES[action] ?? SIM_STYLES.gap
  return (
    <Html position={[BLD_X, bldH + 0.9, 0]} center transform={false}>
      <div style={{
        padding: '4px 10px', borderRadius: 6,
        background: s.bg, border: `1.5px solid ${s.border}`,
        color: s.color, fontSize: 11, fontWeight: 800,
        letterSpacing: '0.08em', pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>{s.label}</div>
    </Html>
  )
}

// ─── Gap pulse plane ──────────────────────────────────────────────────────────
function GapPulse() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity =
      0.028 + Math.sin(clock.elapsedTime * 2.6) * 0.022
  })
  return (
    <mesh ref={ref} position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[ROAD_LEN + 10, 2.5]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.03} depthWrite={false} />
    </mesh>
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────
interface SceneProps {
  districts:  DistrictData[]
  simulation: SimResult | null
  onSelect:   (d: DistrictData | null) => void
}

function CityScene({ districts, simulation, onSelect }: SceneProps) {
  const byKey = Object.fromEntries(districts.map(d => [d.channelKey, d]))

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.18} color="#1a2a4a" />
      <pointLight position={[0, 28, 0]} intensity={0.55} color="#3b82f6" decay={0} />
      <pointLight position={[-18, 8, 0]} intensity={0.30} color="#10b981" decay={0} />
      <pointLight position={[18, 8, 0]}  intensity={0.30} color="#6366f1" decay={0} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color="#020914" roughness={1} />
      </mesh>
      <gridHelper args={[80, 80, '#111827', '#0d1526']} position={[0, -0.05, 0]} />

      {/* Zone tints */}
      <mesh position={[-BLD_X, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.5, 26]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.035} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROAD_LEN + 1, 26]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.018} depthWrite={false} />
      </mesh>
      <mesh position={[BLD_X, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.5, 26]} />
        <meshBasicMaterial color="#94a3b8" transparent opacity={0.025} depthWrite={false} />
      </mesh>

      {/* Zone header text (flat on ground) */}
      <Text position={[-BLD_X, 0.15, -11.8]} rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.38} color="rgba(59,130,246,0.45)" anchorX="center" letterSpacing={0.14}>
        DATA ORIGINS
      </Text>
      <Text position={[0, 0.15, -11.8]} rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.36} color="rgba(16,185,129,0.45)" anchorX="center" letterSpacing={0.1}>
        DLP INSPECTION ZONE
      </Text>
      <Text position={[BLD_X, 0.15, -11.8]} rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.38} color="rgba(148,163,184,0.38)" anchorX="center" letterSpacing={0.14}>
        DESTINATIONS
      </Text>

      {/* Per-channel rows */}
      {ROWS.map((row, ri) => {
        const d        = byKey[row.key]
        const level    = d?.level ?? 'unknown'
        const c        = cfg(level)
        const z        = rowZ(ri)
        const isSimRow = simulation?.channelKey === row.key

        return (
          <group key={row.key} position={[0, 0, z]}>
            {level === 'none' && <GapPulse />}

            <Road level={level} isSimRow={isSimRow} simColor={c.glow} />

            <Checkpoint level={level} toolName={(d?.coveredBy ?? [])[0] ?? ''} />

            <Building x={-BLD_X} level={level}
              label={d?.shortName ?? row.key} sublabel={row.srcLabel}
              isHighlighted={isSimRow}
              onClick={() => onSelect(d ?? null)} />

            <Building x={BLD_X} level={level}
              label={row.dstLabel} sublabel="Exposure point"
              isHighlighted={isSimRow}
              onClick={() => {}} />

            {isSimRow && simulation && (
              <SimBadge action={simulation.action} bldH={c.height} />
            )}
          </group>
        )
      })}
    </>
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
      <Canvas
        flat
        orthographic
        camera={{ position: [28, 22, 28], zoom: 28, near: 0.1, far: 2000 }}
        style={{ width: '100%', height: '100%' }}
        onPointerMissed={() => setSelected(null)}
      >
        <CameraSetup />
        <CityScene districts={districts} simulation={simulation} onSelect={setSelected} />
        <EffectComposer>
          <Bloom intensity={1.5} luminanceThreshold={0.04}
            luminanceSmoothing={0.85} mipmapBlur />
        </EffectComposer>
      </Canvas>
      <DistrictPanel district={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
