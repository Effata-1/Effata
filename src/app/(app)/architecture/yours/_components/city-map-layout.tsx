'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import type { DistrictData, SimResult } from './types'
import { ScenarioBuilder } from './scenario-builder'
import { EnvironmentConfig } from './environment-config'

// Three.js cannot run on the server — lazy load with no SSR
const CityMap = dynamic(
  () => import('./city-map').then(m => ({ default: m.CityMap })),
  { ssr: false, loading: () => <div className="flex-1 bg-[#020914]" /> }
)

interface CityMapLayoutProps {
  districts: DistrictData[]
  orgTools:  string[]
}

export function CityMapLayout({ districts, orgTools }: CityMapLayoutProps) {
  const [simulation, setSimulation] = useState<SimResult | null>(null)
  const [leftOpen,   setLeftOpen]   = useState(false)
  const [rightOpen,  setRightOpen]  = useState(false)

  return (
    <div className="flex-1 flex h-full min-w-0 overflow-hidden">

      {/* ── Left toggle tab ── */}
      <button
        onClick={() => setLeftOpen(v => !v)}
        className="w-8 shrink-0 flex flex-col items-center justify-center gap-2 border-r border-white/6 bg-[#030c1a] hover:bg-white/[0.04] transition-colors z-10 select-none"
        title={leftOpen ? 'Close Scenario Builder' : 'Open Scenario Builder'}
      >
        {leftOpen
          ? <ChevronLeft  size={13} className="text-slate-500" />
          : <ChevronRight size={13} className="text-slate-500" />}
        <span
          className="text-[8px] text-slate-600 font-semibold tracking-widest uppercase"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          Scenario
        </span>
      </button>

      {/* ── Left panel (slides in) ── */}
      <AnimatePresence initial={false}>
        {leftOpen && (
          <motion.div
            key="left"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="shrink-0 overflow-hidden"
          >
            <ScenarioBuilder
              districts={districts}
              onSimulate={setSimulation}
              onClear={() => setSimulation(null)}
              lastResult={simulation}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Centre map (flex-1) ── */}
      <CityMap districts={districts} simulation={simulation} />

      {/* ── Right panel (slides in) ── */}
      <AnimatePresence initial={false}>
        {rightOpen && (
          <motion.div
            key="right"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="shrink-0 overflow-hidden"
          >
            <EnvironmentConfig districts={districts} orgTools={orgTools} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Right toggle tab ── */}
      <button
        onClick={() => setRightOpen(v => !v)}
        className="w-8 shrink-0 flex flex-col items-center justify-center gap-2 border-l border-white/6 bg-[#030c1a] hover:bg-white/[0.04] transition-colors z-10 select-none"
        title={rightOpen ? 'Close Environment Config' : 'Open Environment Config'}
      >
        {rightOpen
          ? <ChevronRight size={13} className="text-slate-500" />
          : <ChevronLeft  size={13} className="text-slate-500" />}
        <span
          className="text-[8px] text-slate-600 font-semibold tracking-widest uppercase"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          Environment
        </span>
      </button>

    </div>
  )
}
