import { Suspense } from 'react'
import { getDatasets } from './actions'
import { TestDataGenerator } from './_components/test-data-generator'

export default async function TestDataPage() {
  const { datasets } = await getDatasets()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Data Lab</h1>
        <p className="text-zinc-500 text-sm">Generate synthetic DLP test data — AI-powered or instant templates — and download in any format</p>
      </div>
      <Suspense fallback={<div className="text-sm text-zinc-600 italic">Loading Data Lab...</div>}>
        <TestDataGenerator initialDatasets={datasets} />
      </Suspense>
    </div>
  )
}
