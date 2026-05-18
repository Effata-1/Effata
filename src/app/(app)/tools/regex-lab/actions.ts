'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConfidenceReport {
  matchAccuracy:     'good' | 'fair' | 'poor'
  falsePositiveRisk: 'low' | 'medium' | 'high'
  anchoring:         'strong' | 'weak'
  contextRequired:   boolean
  dlpSeverity:       'critical' | 'high' | 'medium' | 'low'
  recommendation:    string
}

export interface AiRegexResult {
  title:            string
  pattern:          string
  flags:            string
  explanation:      string
  testExamples:     string[]
  nonMatchExamples: string[]
  confidence:       ConfidenceReport
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
  "title": "<short pattern name, 2-5 words, suitable as a library entry title>",
  "pattern": "<regex pattern string, no delimiters, no flags>",
  "flags": "<string containing only g, i, m characters — always include g>",
  "explanation": "<plain English explanation of how the pattern works, with each major component on its own line separated by \\n>",
  "testExamples": ["<string that WILL match>", ...],
  "nonMatchExamples": ["<string that will NOT match>", ...],
  "confidence": {
    "matchAccuracy": "good|fair|poor",
    "falsePositiveRisk": "low|medium|high",
    "anchoring": "strong|weak",
    "contextRequired": true|false,
    "dlpSeverity": "critical|high|medium|low",
    "recommendation": "<one sentence: how to deploy this pattern in a DLP tool>"
  }
}

DLP TOOL COMPATIBILITY — mandatory, non-negotiable:
- Use ONLY: character classes [0-9] [A-Za-z] [A-Z0-9], shorthand \\d \\w \\s and their negations, word boundaries \\b, simple quantifiers {n} {n,m} ? + *, non-capturing groups (?:...), capturing groups ()
- NEVER use non-capturing groups (?:...) — use regular capturing groups (...) instead
- NEVER use lookaheads: (?=...) or (?!...)
- NEVER use lookbehinds: (?<=...) or (?<!...)
- NEVER use backreferences: \\1 or named groups (?<name>...) or (?P<name>...)
- NEVER use atomic groups (?>...) or possessive quantifiers *+ ++ ?+
- NEVER use conditional patterns (?(condition)...)
- If precision requires excluding edge cases (e.g. SSN 000-xx-xxxx), accept those edge cases and note them in the explanation rather than using lookaheads
- Patterns must work in Netskope, Symantec DLP, Microsoft Purview, and standard regex engines

General rules:
- flags must only contain g, i, m — always include g
- Prefer \\b word boundaries for anchoring — avoids partial matches
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

    const title = typeof parsed.title === 'string' && parsed.title.trim()
      ? parsed.title.trim()
      : 'Custom Pattern'

    // Validate the pattern is a legal RegExp before returning
    const safeFlags = (parsed.flags as string).replace(/[^gim]/g, '') || 'g'
    new RegExp(parsed.pattern, safeFlags)

    // Normalise confidence — tolerate missing/malformed fields gracefully
    const c = (parsed.confidence ?? {}) as Partial<ConfidenceReport>
    const confidence: ConfidenceReport = {
      matchAccuracy:     (['good','fair','poor'] as const).includes(c.matchAccuracy as 'good') ? c.matchAccuracy! : 'fair',
      falsePositiveRisk: (['low','medium','high'] as const).includes(c.falsePositiveRisk as 'low') ? c.falsePositiveRisk! : 'medium',
      anchoring:         (['strong','weak'] as const).includes(c.anchoring as 'strong') ? c.anchoring! : 'weak',
      contextRequired:   !!c.contextRequired,
      dlpSeverity:       (['critical','high','medium','low'] as const).includes(c.dlpSeverity as 'low') ? c.dlpSeverity! : 'medium',
      recommendation:    typeof c.recommendation === 'string' ? c.recommendation : 'Test thoroughly before deploying in production.',
    }

    return {
      result: {
        title,
        pattern: parsed.pattern,
        flags: safeFlags,
        explanation: parsed.explanation,
        testExamples: (parsed.testExamples as unknown[])
          .filter((s): s is string => typeof s === 'string')
          .slice(0, 5),
        nonMatchExamples: (parsed.nonMatchExamples as unknown[])
          .filter((s): s is string => typeof s === 'string')
          .slice(0, 3),
        confidence,
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
