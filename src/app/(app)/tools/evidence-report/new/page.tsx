import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getDraft } from '../ai-actions'
import { AIReportBuilder } from '../_components/ai-report-builder'
import { NewReportClient } from './_components/new-report-client'

interface PageProps {
  searchParams: Promise<{ draft?: string }>
}

export default async function NewReportPage({ searchParams }: PageProps) {
  const params  = await searchParams
  const draftId = params?.draft

  // Resume flow — load existing draft and pre-populate the AI builder
  if (draftId) {
    const draft = await getDraft(draftId)

    // Draft not found: invalid ID, wrong org, or already finalized.
    // Show a clear error rather than silently opening an empty builder.
    if (!draft) {
      return (
        <div className="max-w-lg">
          <Link
            href="/tools/evidence-report"
            className="inline-flex items-center gap-1.5 text-muted-foreground/80 hover:text-foreground/70 text-xs mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to reports
          </Link>

          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-6 py-5 space-y-3">
            <p className="text-sm font-semibold text-amber-400">Draft not available</p>
            <p className="text-xs text-muted-foreground/70">
              This draft report could not be found. It may have already been completed,
              deleted, or the link may be incorrect.
            </p>
            <Link
              href="/tools/evidence-report/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
            >
              Start a new report
            </Link>
          </div>
        </div>
      )
    }

    return (
      <div className="w-full">
        <Link
          href="/tools/evidence-report"
          className="inline-flex items-center gap-1.5 text-muted-foreground/80 hover:text-foreground/70 text-xs mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to reports
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Continue Draft Report</h1>
          <p className="text-muted-foreground/80 text-sm">
            Pick up your conversation where you left off.
          </p>
        </div>

        <AIReportBuilder
          initialDraftId={draft.id}
          initialDraft={draft.fields}
          initialReady={draft.ready}
          initialApiMessages={draft.apiMessages}
          initialDisplayMessages={draft.displayMessages}
        />
      </div>
    )
  }

  // Normal new report — tabs: AI Assistant | Manual
  return <NewReportClient />
}
