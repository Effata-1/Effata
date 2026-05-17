import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'

interface RegRow {
  id: string
  code: string
  short_name: string
  name: string
  summary: string
  max_fine: string | null
  last_verified_at: string
  requirements: ReqRow[]
}

interface ReqRow {
  id: string
  article: string
  title: string
  description: string
  dlp_relevance: string
  fine: string | null
  severity: string
}

interface AIUpdate {
  changed: boolean
  reason?: string
  updates?: {
    summary?: string
    max_fine?: string | null
    requirements?: Array<{
      article: string
      field: 'description' | 'dlp_relevance' | 'fine' | 'severity'
      new_value: string | null
    }>
  }
}

export interface ChangeRecord {
  regulation_code: string
  regulation_name: string
  reason: string
  fields_updated: string[]
}

export interface ErrorRecord {
  regulation_code?: string
  error: string
}

export interface RunResult {
  run_id: string
  regs_checked: number
  regs_updated: number
  changes: ChangeRecord[]
  errors: ErrorRecord[]
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY_GENAI_Intellegence_PIPELINE!,
})

async function reviewRegulation(reg: RegRow): Promise<AIUpdate> {
  const reqList = reg.requirements
    .map(r => `  • ${r.article} — ${r.title} | Fine: ${r.fine ?? 'not specified'} | Severity: ${r.severity}`)
    .join('\n')

  const prompt = `You are auditing stored compliance regulation data for factual errors only.

Regulation: ${reg.short_name} (${reg.code})
Max fine stored: ${reg.max_fine ?? 'not specified'}

Requirements stored:
${reqList}

Your ONLY job is to check whether specific numeric/legal facts are objectively wrong:
- Fine amounts (wrong currency, wrong number)
- Article numbers (clearly wrong reference)
- Enforcement dates that have provably shifted

STRICT RULES — you MUST follow these or you will corrupt production data:
1. Return changed=false unless you are 100% certain a stored fact is objectively incorrect.
2. NEVER change wording, summaries, descriptions, or DLP relevance text — ever.
3. NEVER change severity labels.
4. NEVER flag something as changed just because you would phrase it differently.
5. When in doubt, return changed=false. Stability is more important than perfection.
6. Only update the "fine" field on requirements — no other fields.

Respond ONLY with valid JSON:

{"changed": false}

OR only if a fine amount is provably wrong:
{
  "changed": true,
  "reason": "one sentence — the exact fact that is wrong",
  "updates": {
    "max_fine": "corrected value (only if max_fine is wrong, otherwise omit)",
    "requirements": [
      {"article": "Article X", "field": "fine", "new_value": "corrected amount"}
    ]
  }
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { changed: false }

  try {
    return JSON.parse(jsonMatch[0]) as AIUpdate
  } catch {
    return { changed: false }
  }
}

export async function runComplianceCheck(): Promise<RunResult> {
  const supabase = createServiceClient()

  const { data: run, error: runError } = await supabase
    .from('compliance_check_runs')
    .insert({ status: 'running' })
    .select('id')
    .single()

  if (runError || !run) throw new Error('Failed to create run record')
  const runId: string = run.id

  const changes: ChangeRecord[] = []
  const errors: ErrorRecord[]   = []
  let regsUpdated = 0

  try {
    const { data: regsData } = await supabase
      .from('compliance_regulations')
      .select('*, requirements:compliance_requirements(*)')
      .eq('active', true)

    const regs = (regsData as RegRow[]) ?? []

    const BATCH = 5
    for (let i = 0; i < regs.length; i += BATCH) {
      const batch = regs.slice(i, i + BATCH)
      await Promise.all(batch.map(async reg => {
        try {
          const result = await reviewRegulation(reg)

          if (!result.changed || !result.updates) {
            await supabase
              .from('compliance_regulations')
              .update({ last_verified_at: new Date().toISOString() })
              .eq('id', reg.id)
            return
          }

          const fieldsUpdated: string[] = []
          const regUpdate: Record<string, unknown> = { last_verified_at: new Date().toISOString() }

          if (result.updates.summary !== undefined) {
            regUpdate.summary = result.updates.summary
            fieldsUpdated.push('summary')
          }
          if ('max_fine' in result.updates) {
            regUpdate.max_fine = result.updates.max_fine
            fieldsUpdated.push('max_fine')
          }

          await supabase.from('compliance_regulations').update(regUpdate).eq('id', reg.id)

          if (result.updates.requirements?.length) {
            for (const reqUpdate of result.updates.requirements) {
              const matchedReq = reg.requirements.find(r => r.article === reqUpdate.article)
              if (!matchedReq) continue
              await supabase
                .from('compliance_requirements')
                .update({ [reqUpdate.field]: reqUpdate.new_value })
                .eq('id', matchedReq.id)
              fieldsUpdated.push(`${reqUpdate.article}.${reqUpdate.field}`)
            }
          }

          await supabase.from('compliance_verification_log').insert({
            regulation_id: reg.id,
            org_id:        '00000000-0000-0000-0000-000000000000',
            verified_by:   null,
            changed:       true,
            notes:         `AI review: ${result.reason}`,
            changes:       { source: 'ai_cron', run_id: runId, updates: result.updates },
          })

          changes.push({
            regulation_code: reg.code,
            regulation_name: reg.short_name,
            reason:          result.reason ?? '',
            fields_updated:  fieldsUpdated,
          })
          regsUpdated++
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push({ regulation_code: reg.code, error: msg })
        }
      }))
    }

    await supabase
      .from('compliance_check_runs')
      .update({
        completed_at: new Date().toISOString(),
        status:       errors.length > 0 && regsUpdated === 0 ? 'failed' : 'completed',
        regs_checked: regs.length,
        regs_updated: regsUpdated,
        changes,
        errors,
      })
      .eq('id', runId)

    return { run_id: runId, regs_checked: regs.length, regs_updated: regsUpdated, changes, errors }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase
      .from('compliance_check_runs')
      .update({ completed_at: new Date().toISOString(), status: 'failed', errors: [{ error: msg }] })
      .eq('id', runId)
    throw err
  }
}
