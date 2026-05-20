import { createClient } from '@/lib/supabase/server'
import { DLP_CONTROLS } from '@/lib/compliance/controls'
import { AuditTrailClient } from './_components/audit-trail-client'

export interface AuditEntry {
  id: string
  created_at: string
  user_email: string | null
  entity_name: string          // control_key
  old_value: string | null
  new_value: string | null
  details: { regulation_id?: string; status?: string }
}

export interface RegulationRef {
  id: string
  code: string
  short_name: string
}

export default async function AuditTrailPage() {
  const supabase = await createClient()

  const [{ data: logs }, { data: regsData }] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, created_at, user_email, entity_name, old_value, new_value, details')
      .eq('action', 'compliance.assessment_updated')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('compliance_regulations')
      .select('id, code, short_name')
      .eq('active', true)
      .order('short_name'),
  ])

  const entries = (logs as AuditEntry[]) ?? []
  const regulations = (regsData as RegulationRef[]) ?? []
  const controls = DLP_CONTROLS.map(c => ({ key: c.key, label: c.label }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Audit Trail</h1>
        <p className="text-muted-foreground/80 text-sm">
          A complete log of all compliance assessment changes made by your team.
        </p>
      </div>

      <AuditTrailClient
        entries={entries}
        regulations={regulations}
        controls={controls}
      />
    </div>
  )
}
