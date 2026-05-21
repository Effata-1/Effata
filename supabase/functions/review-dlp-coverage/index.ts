import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

interface ReviewPayload {
  orgId?: string
  source?: 'cron' | 'manual'
}

async function runReviewForOrg(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  reviewType: 'scheduled' | 'manual',
) {
  // Load onboarding profile
  const { data: profile } = await supabase
    .from('onboarding_profiles')
    .select('tools, modules, coverage_areas, policy_presence, policy_mode, incident_review, data_categories, top_priorities')
    .eq('org_id', orgId)
    .maybeSingle()

  if (!profile) return

  // Load channel assessment answers
  const { data: channelRows } = await supabase
    .from('channel_coverage')
    .select('channel_slug, assessment_answers')
    .eq('org_id', orgId)

  const channelAnswers = Object.fromEntries(
    (channelRows ?? []).map(r => [r.channel_slug, r.assessment_answers]),
  )

  // Build prompt
  const prompt = `You are a senior DLP architect reviewing an organisation's DLP coverage posture.

## Their DLP Tool Stack
Tools: ${JSON.stringify(profile.tools ?? [])}
Modules per tool: ${JSON.stringify(profile.modules ?? {})}
Coverage areas configured: ${JSON.stringify(profile.coverage_areas ?? {})}

## Policy Maturity
Policy presence: ${profile.policy_presence ?? 'unknown'}
Policy mode: ${profile.policy_mode ?? 'unknown'}
Incident review: ${profile.incident_review ?? 'unknown'}

## Priority Data Categories
${JSON.stringify(profile.data_categories ?? [])}

## Channel Assessment Answers (per channel: question key → not_assessed | partial | covered)
${JSON.stringify(channelAnswers, null, 2)}

## DLP Channels to Assess
email, web, saas-inline, saas-api, endpoint, genai, network

Based on this data, identify:
1. Coverage gaps by DLP channel — channels with no tool coverage or primarily not_assessed answers
2. Mismatches between tool capability and actual assessment answers
3. Top 5 prioritised recommendations to improve DLP coverage

Respond ONLY with valid JSON in this exact shape:
{
  "coverageScore": <integer 0-100>,
  "gaps": [{ "channel": string, "severity": "critical"|"high"|"medium"|"low", "description": string }],
  "recommendations": [{ "priority": <1-5>, "title": string, "description": string }]
}`

  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: prompt }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

  let parsed: { coverageScore: number; gaps: unknown[]; recommendations: unknown[] }
  try {
    parsed = JSON.parse(rawText)
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { coverageScore: 0, gaps: [], recommendations: [] }
  }

  await supabase.from('dlp_coverage_ai_reviews').insert({
    org_id:          orgId,
    review_type:     reviewType,
    coverage_score:  parsed.coverageScore,
    gaps:            parsed.gaps,
    recommendations: parsed.recommendations,
    raw_response:    rawText,
    reviewed_at:     new Date().toISOString(),
  })
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const body: ReviewPayload = await req.json().catch(() => ({}))
  const source = body.source ?? 'manual'

  if (source === 'cron') {
    // Run for all orgs with completed onboarding
    const { data: orgs } = await supabase
      .from('onboarding_profiles')
      .select('org_id')
      .eq('completed', true)

    await Promise.allSettled(
      (orgs ?? []).map(row => runReviewForOrg(supabase, row.org_id, 'scheduled')),
    )
  } else {
    if (!body.orgId) {
      return new Response('orgId required', { status: 400 })
    }
    await runReviewForOrg(supabase, body.orgId, 'manual')
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
