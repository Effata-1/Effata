import { createClient } from '@/lib/supabase/server'
import { TriggerButton } from './_components/trigger-button'
import { RunsList } from './_components/runs-list'

export const dynamic = 'force-dynamic'

export interface CronRun {
  id: string
  started_at: string
  completed_at: string | null
  status: string
  regs_checked: number
  regs_updated: number
  changes: Array<{
    regulation_code: string
    regulation_name: string
    reason: string
    fields_updated: string[]
  }>
  errors: Array<{
    regulation_code?: string
    error: string
  }>
}

export default async function CronRunsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('compliance_check_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)

  const runs = (data as CronRun[]) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Compliance Check Runs</h2>
          <p className="text-sm text-zinc-500">
            Weekly AI review — every Monday at 3 AM UTC. Claude checks each regulation for factual
            changes and auto-updates the database. Manual runs here do not replace the weekly schedule.
          </p>
        </div>
        <TriggerButton />
      </div>

      <RunsList runs={runs} />
    </div>
  )
}
