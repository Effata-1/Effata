import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_GENAI_Intellegence_PIPELINE!,
})

const SYSTEM = `You are a DLP (Data Loss Prevention) product expert. When given a tool name, respond with ONLY a valid JSON object — no markdown, no prose, no code fences.

The JSON must match this exact shape:
{
  "isRealDlp": boolean,
  "confidence": "high" | "medium" | "low",
  "reason": "one sentence explanation",
  "toolData": {
    "label": "Official product name",
    "description": "2-3 sentence product description",
    "category": ["category1", "category2"],
    "website": "https://vendor.com/",
    "channelCoverage": {
      "email": "full" | "partial" | "addon" | "none",
      "web": "full" | "partial" | "addon" | "none",
      "saas-inline": "full" | "partial" | "addon" | "none",
      "saas-api": "full" | "partial" | "addon" | "none",
      "endpoint": "full" | "partial" | "addon" | "none",
      "genai": "full" | "partial" | "addon" | "none",
      "network": "full" | "partial" | "addon" | "none"
    },
    "modules": [
      { "id": "kebab-case-id", "label": "Module Name", "description": "One sentence." }
    ]
  }
}

Coverage levels: full = native full coverage, partial = limited or needs config, addon = separate paid add-on, none = not covered.
If isRealDlp is false, still fill label and description in toolData but set all channelCoverage to "none" and modules to [].
Be accurate based on your training knowledge. If unsure about a specific tool, set confidence to "low".`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let toolName: string
  try {
    const body = await req.json() as { toolName?: unknown }
    if (typeof body.toolName !== 'string' || !body.toolName.trim()) throw new Error()
    toolName = body.toolName.trim()
  } catch {
    return new Response('toolName is required', { status: 400 })
  }

  try {
    const msg = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: `Review this DLP tool: "${toolName}"` }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    // Strip possible markdown fences
    const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
    const parsed: unknown = JSON.parse(json)
    return Response.json(parsed)
  } catch (err) {
    console.error('dlp-tool-review error', err)
    return new Response('Internal error', { status: 500 })
  }
}
