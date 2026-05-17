import { createClient } from '@/lib/supabase/server'
import { DLP_CONTROLS } from '@/lib/compliance/controls'
import { GapReportClient } from './_components/gap-report-client'

interface RegulationMeta {
  id: string
  code: string
  short_name: string
  max_fine: string | null
}

interface AssessmentRow {
  control_key: string
  status: 'not_assessed' | 'implemented' | 'partial' | 'not_implemented'
}

export default async function GapReportPage({
  searchParams,
}: {
  searchParams: Promise<{ reg?: string }>
}) {
  const { reg = 'gdpr' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: regsData } = await supabase
    .from('compliance_regulations')
    .select('id, code, short_name, max_fine')
    .eq('active', true)
    .order('short_name')

  const regulations = (regsData as RegulationMeta[]) ?? []
  const currentReg = regulations.find(r => r.code === reg) ?? regulations[0]

  let assessments: AssessmentRow[] = DLP_CONTROLS.map(c => ({
    control_key: c.key,
    status: 'not_assessed',
  }))

  if (user && currentReg) {
    const { data: existing } = await supabase
      .from('compliance_assessments')
      .select('control_key, status')
      .eq('regulation_id', currentReg.id)

    if (existing) {
      const map = new Map((existing as AssessmentRow[]).map(a => [a.control_key, a.status]))
      assessments = DLP_CONTROLS.map(c => ({
        control_key: c.key,
        status: map.get(c.key) ?? 'not_assessed',
      }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Gap Report</h1>
        <p className="text-zinc-500 text-sm">
          Self-assess your 10 core DLP controls against any regulation — see your compliance score and fine exposure at risk
        </p>
      </div>

      {regulations.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-zinc-800">
          <p className="text-sm text-zinc-500">Regulation data not loaded yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Run the database migration to seed regulation data.</p>
        </div>
      ) : (
        <GapReportClient
          regulations={regulations}
          initialAssessments={assessments}
          currentRegCode={currentReg?.code ?? reg}
        />
      )}
    </div>
  )
}
