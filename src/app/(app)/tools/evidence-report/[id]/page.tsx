import { createClient } from '@/lib/supabase/server'
import { getReport, getAttachments } from '../actions'
import { ReportDetailClient } from '../_components/report-detail-client'
import { notFound } from 'next/navigation'

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ mode?: string }>
}) {
  const { id }   = await params
  const { mode } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div className="text-muted-foreground/80 text-sm p-8">Not authenticated</div>
  }

  const [{ report, tests, error }, attachments] = await Promise.all([
    getReport(id),
    getAttachments(id),
  ])

  if (error || !report) {
    notFound()
  }

  return (
    <ReportDetailClient
      report={report}
      tests={tests}
      initialMode={mode === 'edit' ? 'edit' : 'view'}
      initialAttachments={attachments}
    />
  )
}
