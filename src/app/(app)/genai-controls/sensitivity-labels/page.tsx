import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { SensitivityLabelsClient } from './_components/sensitivity-labels-client'
import type { CustomerSensitivityLabel } from './_components/sensitivity-labels-client'

export default async function SensitivityLabelsPage() {
  const user     = await requireRole('analyst')
  const supabase = await createClient()

  const { data } = await supabase
    .from('org_customer_sensitivity_labels')
    .select('id, display_name, label_key, label_value, label_source, color, system_level, priority')
    .eq('org_id', user.orgId)
    .eq('active', true)
    .order('priority')

  const labels = (data ?? []) as CustomerSensitivityLabel[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Sensitivity Labels</h1>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Add your organisation&apos;s document sensitivity labels to enable label-based DLP detection.
          These are the labels applied to documents by tools like Microsoft Purview Information Protection (MIP),
          TITUS, Boldon James, or your own classification system — separate from Effata&apos;s content sensitivity model.
        </p>
      </div>

      <SensitivityLabelsClient initialLabels={labels} />
    </div>
  )
}
