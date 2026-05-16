'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AiRegexResult {
  pattern: string
  flags: string
  explanation: string
  testExamples: string[]
  nonMatchExamples: string[]
}

export interface SavedPattern {
  id: string
  name: string
  description: string | null
  pattern: string
  flags: string
  test_data: string | null
  ai_generated: boolean
  ai_explanation: string | null
  created_at: string
}

// ── AI Generation ─────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_GENAI_Intellegence_PIPELINE!,
})

const SYSTEM_PROMPT = `You are a DLP (Data Loss Prevention) regex expert.
When given a description of what to match, respond ONLY with a valid JSON object.
No markdown, no prose, no code blocks — raw JSON only.

The JSON must have exactly this structure:
{
  "pattern": "<regex pattern string, no delimiters, no flags>",
  "flags": "<string containing only g, i, m characters — always include g>",
  "explanation": "<plain English explanation of how the pattern works, with each major component on its own line separated by \\n>",
  "testExamples": ["<string that WILL match>", ...],
  "nonMatchExamples": ["<string that will NOT match>", ...]
}

Rules:
- pattern must be a valid JavaScript RegExp (no PCRE-only syntax)
- flags must only contain g, i, m — always include g
- Prefer precise patterns with word boundaries (\\b) over broad ones
- Avoid catastrophic backtracking — no nested quantifiers on overlapping character classes
- testExamples: 3–5 realistic strings that match the pattern
- nonMatchExamples: 2–3 strings that should NOT match, to verify precision
- Focus on DLP use cases: PII, credentials, financial data, identity documents`

export async function generateRegex(
  prompt: string
): Promise<{ result?: AiRegexResult; error?: string }> {
  if (!prompt.trim()) return { error: 'Prompt is required' }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Generate a DLP regex pattern for: ${prompt}` }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    if (!text) return { error: 'No response from AI' }

    // Strip accidental markdown fences
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(clean)

    if (
      typeof parsed.pattern !== 'string' ||
      typeof parsed.flags !== 'string' ||
      typeof parsed.explanation !== 'string' ||
      !Array.isArray(parsed.testExamples) ||
      !Array.isArray(parsed.nonMatchExamples)
    ) {
      return { error: 'AI returned an unexpected response format' }
    }

    // Validate the pattern is a legal RegExp before returning
    const safeFlags = (parsed.flags as string).replace(/[^gim]/g, '') || 'g'
    new RegExp(parsed.pattern, safeFlags)

    return {
      result: {
        pattern: parsed.pattern,
        flags: safeFlags,
        explanation: parsed.explanation,
        testExamples: (parsed.testExamples as unknown[])
          .filter((s): s is string => typeof s === 'string')
          .slice(0, 5),
        nonMatchExamples: (parsed.nonMatchExamples as unknown[])
          .filter((s): s is string => typeof s === 'string')
          .slice(0, 3),
      },
    }
  } catch (e) {
    if (e instanceof SyntaxError) return { error: 'AI returned invalid JSON — please try again' }
    if (e instanceof Error) return { error: e.message }
    return { error: 'Unexpected error during AI generation' }
  }
}

// ── Save Pattern ──────────────────────────────────────────────────────────────

export async function savePattern(data: {
  name: string
  description: string
  pattern: string
  flags: string
  testData: string
  aiGenerated: boolean
  aiExplanation: string
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
    .from('regex_patterns')
    .insert({
      org_id:         orgId,
      name:           data.name.trim(),
      description:    data.description.trim() || null,
      pattern:        data.pattern,
      flags:          data.flags,
      test_data:      data.testData || null,
      ai_generated:   data.aiGenerated,
      ai_explanation: data.aiExplanation || null,
      created_by:     user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await logAuditEvent({
    action:      'regex.pattern_saved',
    entity_type: 'regex_pattern',
    entity_id:   inserted.id,
    entity_name: data.name.trim(),
    details:     { pattern: data.pattern, flags: data.flags, ai_generated: data.aiGenerated },
    user_id:     user.id,
    user_email:  user.email ?? undefined,
    org_id:      orgId,
  })

  return { id: inserted.id }
}

// ── Get Patterns ──────────────────────────────────────────────────────────────

export async function getPatterns(): Promise<{ patterns: SavedPattern[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { patterns: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('regex_patterns')
    .select('id, name, description, pattern, flags, test_data, ai_generated, ai_explanation, created_at')
    .order('created_at', { ascending: false })

  if (error) return { patterns: [], error: error.message }
  return { patterns: (data as SavedPattern[]) ?? [] }
}

// ── Delete Pattern ────────────────────────────────────────────────────────────

export async function deletePattern(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null

  const { data: existing } = await supabase
    .from('regex_patterns')
    .select('name')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('regex_patterns').delete().eq('id', id)
  if (error) return { error: error.message }

  await logAuditEvent({
    action:      'regex.pattern_deleted',
    entity_type: 'regex_pattern',
    entity_id:   id,
    entity_name: existing?.name ?? id,
    user_id:     user.id,
    user_email:  user.email ?? undefined,
    org_id:      orgId ?? undefined,
  })

  return {}
}
