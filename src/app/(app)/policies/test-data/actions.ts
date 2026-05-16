'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeneratedData {
  columns: string[]
  records: Record<string, string>[]
  description: string
}

export interface SavedDataset {
  id: string
  name: string
  description: string | null
  columns: string[]
  records: Record<string, string>[]
  row_count: number
  ai_generated: boolean
  ai_prompt: string | null
  created_at: string
}

// ── AI Generation ─────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_GENAI_Intellegence_PIPELINE!,
})

const SYSTEM_PROMPT = `You are a DLP test data generator. Produce realistic but entirely synthetic (fake) data for testing Data Loss Prevention policies. Respond ONLY with raw JSON — no markdown, no prose, no code blocks.

Required JSON structure:
{
  "columns": ["col_name", ...],
  "records": [{"col_name": "value", ...}, ...],
  "description": "One-line summary of what was generated"
}

Rules:
- CRITICAL: Generate ONLY the exact columns the user asks for. If the user asks for "credit card, cvv, expiry" generate exactly those 3 columns — do NOT add name, email, address, record_id, or any other column unless explicitly requested. Strict column matching.
- All data is synthetic — no real people, no real account numbers, no real credentials
- Vary values across every record — no two rows should be identical
- Column names: snake_case, no spaces
- Dates: MM/DD/YYYY format
- US SSN: ###-##-#### format (e.g. 523-45-6789)
- Phone (US): (###) ###-#### format
- Credit cards: generate a realistic mix of card types and numbers — Visa (16 digits, starts with 4), Mastercard (16 digits, starts with 51-55), Amex (15 digits, starts with 34 or 37), Discover (16 digits, starts with 6011) — vary card types across records, use realistic-looking but synthetic numbers (not sequential like 0001, 0002)
- API keys / secrets: always prefix with SYNTHETIC_ (e.g. sk_test_SYNTHETIC_KEY_001)
- AWS access keys: start with AKIAIOSFODNN followed by synthetic chars
- Passwords: obviously fake patterns like P@ssw0rd_TEST_001
- JWTs: eyJhbGciOiJIUzI1NiJ9.SYNTHETIC_PAYLOAD_N.SYNTHETIC_SIG
- Database URLs: use db.example.com with synthetic credentials
- Focus on DLP-relevant data types: PII, credentials, financial data, healthcare, identity documents
- Generate exactly the requested number of records`

export async function generateTestData(
  prompt: string,
  rowCount: number
): Promise<{ result?: GeneratedData; error?: string }> {
  if (!prompt.trim()) return { error: 'Prompt is required' }

  const safeRowCount = Math.min(Math.max(1, rowCount), 50)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Generate DLP test data for: ${prompt}\n\nGenerate exactly ${safeRowCount} records.`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    if (!text) return { error: 'No response from AI' }
    if (response.stop_reason === 'max_tokens') {
      return { error: 'Response was too long — try fewer rows or a simpler description' }
    }

    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(clean)

    if (
      !Array.isArray(parsed.columns) ||
      !parsed.columns.every((c: unknown) => typeof c === 'string') ||
      !Array.isArray(parsed.records) ||
      typeof parsed.description !== 'string'
    ) {
      return { error: 'AI returned an unexpected response format' }
    }

    return {
      result: {
        columns:     parsed.columns as string[],
        records:     (parsed.records as unknown[]).filter(
          (r): r is Record<string, string> => typeof r === 'object' && r !== null
        ),
        description: parsed.description,
      },
    }
  } catch (e) {
    if (e instanceof SyntaxError) return { error: 'AI returned invalid JSON — please try again' }
    if (e instanceof Error) return { error: e.message }
    return { error: 'Unexpected error during AI generation' }
  }
}

// ── Save Dataset ──────────────────────────────────────────────────────────────

export async function saveDataset(data: {
  name: string
  description: string
  columns: string[]
  records: Record<string, string>[]
  aiGenerated: boolean
  aiPrompt: string
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null
  if (!orgId) return { error: 'Organisation not found' }

  const { data: inserted, error } = await supabase
    .from('test_datasets')
    .insert({
      org_id:       orgId,
      name:         data.name.trim(),
      description:  data.description.trim() || null,
      columns:      data.columns,
      records:      data.records,
      row_count:    data.records.length,
      ai_generated: data.aiGenerated,
      ai_prompt:    data.aiPrompt || null,
      created_by:   user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await logAuditEvent({
    action:      'test_data.dataset_saved',
    entity_type: 'test_dataset',
    entity_id:   inserted.id,
    entity_name: data.name.trim(),
    details:     { row_count: data.records.length, ai_generated: data.aiGenerated },
    user_id:     user.id,
    user_email:  user.email ?? undefined,
    org_id:      orgId,
  })

  return { id: inserted.id }
}

// ── Get Datasets ──────────────────────────────────────────────────────────────

export async function getDatasets(): Promise<{ datasets: SavedDataset[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { datasets: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('test_datasets')
    .select('id, name, description, columns, records, row_count, ai_generated, ai_prompt, created_at')
    .order('created_at', { ascending: false })

  if (error) return { datasets: [], error: error.message }
  return { datasets: (data as SavedDataset[]) ?? [] }
}

// ── Delete Dataset ────────────────────────────────────────────────────────────

export async function deleteDataset(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null

  const { data: existing } = await supabase
    .from('test_datasets')
    .select('name')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('test_datasets').delete().eq('id', id)
  if (error) return { error: error.message }

  await logAuditEvent({
    action:      'test_data.dataset_deleted',
    entity_type: 'test_dataset',
    entity_id:   id,
    entity_name: existing?.name ?? id,
    user_id:     user.id,
    user_email:  user.email ?? undefined,
    org_id:      orgId ?? undefined,
  })

  return {}
}
