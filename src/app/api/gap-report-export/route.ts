import { createClient } from '@/lib/supabase/server'
import { DLP_CONTROLS, computeControlWeights } from '@/lib/compliance/controls'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const regId   = searchParams.get('reg_id')
  const regCode = searchParams.get('reg_code') ?? 'export'

  if (!regId) return new Response('Missing reg_id', { status: 400 })

  const [{ data: rows }, { data: reqs }] = await Promise.all([
    supabase
      .from('compliance_assessments')
      .select('control_key, status, notes')
      .eq('regulation_id', regId),
    supabase
      .from('compliance_requirements')
      .select('article, dlp_controls')
      .eq('regulation_id', regId),
  ])

  const assessmentMap = new Map(
    (rows ?? []).map(r => [r.control_key, r as { control_key: string; status: string; notes: string | null }])
  )

  const requirements = (reqs ?? []) as { article: string; dlp_controls: string[] | null }[]

  const controlWeights = computeControlWeights(requirements)

  const header = ['Control', 'Description', 'Channel', 'Articles / Sections', 'Status', 'Notes', 'Relevance Weight %']

  const bodyRows = DLP_CONTROLS.map(ctrl => {
    const a = assessmentMap.get(ctrl.key)
    const status = a?.status ?? 'not_assessed'
    const notes  = a?.notes ?? ''
    const weight = Math.round((controlWeights[ctrl.key] ?? 0) * 100)
    const articles = requirements
      .filter(r => r.dlp_controls?.includes(ctrl.key))
      .map(r => r.article)
    return [
      ctrl.label,
      ctrl.description,
      ctrl.channel,
      articles.length > 0 ? articles.join('; ') : ctrl.gdpr_articles.join('; '),
      status,
      notes,
      `${weight}%`,
    ]
  })

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [header, ...bodyRows].map(row => row.map(escape).join(','))
  const csv = lines.join('\r\n')

  const date = new Date().toISOString().slice(0, 10)
  const filename = `gap-report-${regCode}-${date}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
