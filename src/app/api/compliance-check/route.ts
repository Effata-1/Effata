import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: staleRegs, error } = await supabase
    .from('compliance_regulations')
    .select('id, code, short_name, last_verified_at')
    .eq('active', true)
    .lt('last_verified_at', sevenDaysAgo)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const regs = staleRegs ?? []

  // Log each stale regulation to audit_logs using service role (no org context — system event)
  for (const reg of regs) {
    const daysStale = Math.floor(
      (Date.now() - new Date(reg.last_verified_at).getTime()) / 86400000
    )
    await supabase.from('audit_logs').insert({
      org_id:      '00000000-0000-0000-0000-000000000000', // system sentinel
      user_id:     null,
      user_email:  null,
      action:      'compliance.regulation_stale',
      entity_type: 'compliance_regulation',
      entity_id:   reg.id,
      entity_name: reg.short_name,
      details:     { code: reg.code, days_stale: daysStale, last_verified_at: reg.last_verified_at },
    })
  }

  return Response.json({
    checked_at:   new Date().toISOString(),
    stale_count:  regs.length,
    stale_regs:   regs.map(r => r.code),
  })
}
