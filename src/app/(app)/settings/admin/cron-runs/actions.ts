'use server'

import { revalidatePath } from 'next/cache'

export async function triggerComplianceCheck(): Promise<{
  error?: string
  regs_checked?: number
  regs_updated?: number
}> {
  try {
    const res = await fetch(`${process.env.RAILWAY_API_BASE_URL}/api/internal/compliance-check`, {
      method:  'POST',
      headers: { 'x-cron-key': process.env.CRON_API_KEY! },
    })
    const body = await res.json() as { regs_checked?: number; regs_updated?: number; error?: string }
    if (!res.ok) return { error: body.error ?? `Railway returned ${res.status}` }
    revalidatePath('/settings/admin/cron-runs')
    return { regs_checked: body.regs_checked, regs_updated: body.regs_updated }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
