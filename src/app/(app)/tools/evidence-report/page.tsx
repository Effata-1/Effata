import { createClient } from '@/lib/supabase/server'
import { getReports } from './actions'
import { ReportsListClient } from './_components/reports-list-client'

export default async function EvidenceReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="text-zinc-500 text-sm p-8">Not authenticated</div>
  }

  const { reports, error } = await getReports()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Evidence Reports</h1>
        <p className="text-zinc-500 text-sm">
          Analyst-authored DLP test reports for audit, compliance, and CISO evidence packs
        </p>
      </div>
      <ReportsListClient reports={reports} error={error} />
    </div>
  )
}
