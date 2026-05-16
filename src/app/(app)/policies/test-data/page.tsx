import { Suspense } from 'react'
import { getDatasets } from './actions'
import { TestDataGenerator } from './_components/test-data-generator'

export default async function TestDataPage() {
  const { datasets } = await getDatasets()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Data Lab</h1>
        <p className="text-zinc-500 text-sm">Generate synthetic DLP test data with AI or 44 ready-made templates across 7 categories — save to your library and export as CSV, TXT, or XML</p>
      </div>
      <Suspense fallback={<div className="text-sm text-zinc-600 italic">Loading Data Lab...</div>}>
        <TestDataGenerator initialDatasets={datasets} />
      </Suspense>
    </div>
  )
}
