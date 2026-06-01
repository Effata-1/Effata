import { Suspense } from 'react'
import { getDatasets } from './actions'
import { TestDataGenerator } from './_components/test-data-generator'

export default async function TestDataPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; prompt?: string; tab?: string; filePrompt?: string }>
}) {
  const { datasets } = await getDatasets()
  const { name, prompt, tab, filePrompt } = await searchParams

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Data Lab</h1>
        <p className="text-muted-foreground/80 text-sm">Generate synthetic DLP test data with AI or 44 ready-made templates across 7 categories — save to your library and export as CSV, TXT, or XML</p>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground/60 italic">Loading Data Lab...</div>}>
        <TestDataGenerator
          initialDatasets={datasets}
          prefill={name ? { name, prompt } : undefined}
          initialTab={tab === 'file' ? 'file' : 'data'}
          filePrompt={filePrompt}
        />
      </Suspense>
    </div>
  )
}
