'use client'

import { useState } from 'react'
import type { DistrictData, SimResult } from './types'
import { ScenarioBuilder } from './scenario-builder'
import { CityMap } from './city-map'
import { EnvironmentConfig } from './environment-config'

interface CityMapLayoutProps {
  districts: DistrictData[]
  orgTools:  string[]
}

export function CityMapLayout({ districts, orgTools }: CityMapLayoutProps) {
  const [simulation, setSimulation] = useState<SimResult | null>(null)

  return (
    <div className="flex h-full overflow-hidden">
      <ScenarioBuilder
        districts={districts}
        onSimulate={setSimulation}
        onClear={() => setSimulation(null)}
        lastResult={simulation}
      />
      <CityMap districts={districts} simulation={simulation} />
      <EnvironmentConfig districts={districts} orgTools={orgTools} />
    </div>
  )
}
