import { Suspense } from 'react'
import { getTestHistory } from './actions'
import { DlpTestRunner } from './_components/dlp-test-runner'

export default async function DlpTestPage() {
  const { results } = await getTestHistory()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">DLP Testing</h1>
        <p className="text-zinc-500 text-sm">Run live exfiltration tests across 6 web-channel vectors and 5 protocol scripts — verify your DLP controls actually intercept sensitive data</p>
      </div>
      <Suspense fallback={<div className="text-sm text-zinc-600 italic">Loading DLP Testing...</div>}>
        <DlpTestRunner initialHistory={results} />
      </Suspense>
    </div>
  )
}
