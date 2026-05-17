'use server'

import { runComplianceCheck } from '@/lib/compliance/run-check'

export async function triggerComplianceCheck(): Promise<{
  error?: string
  regs_checked?: number
  regs_updated?: number
}> {
  try {
    const result = await runComplianceCheck()
    return { regs_checked: result.regs_checked, regs_updated: result.regs_updated }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
