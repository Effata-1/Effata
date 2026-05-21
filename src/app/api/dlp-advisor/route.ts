import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { DLP_TOOLS } from '@/lib/onboarding/data'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_GENAI_Intellegence_PIPELINE!,
})

function buildSystemPrompt(): string {
  const toolSummary = DLP_TOOLS
    .filter(t => t.channelCoverage && t.id !== 'no-tool' && t.id !== 'other-tool')
    .map(t => {
      const cov = t.channelCoverage!
      const channels = (Object.entries(cov) as [string, string][])
        .filter(([, v]) => v !== 'none')
        .map(([k, v]) => `${k}:${v}`)
        .join(', ')
      return `- **${t.label}** [${t.category?.join(', ') ?? ''}]: ${channels}`
    })
    .join('\n')

  return `You are a senior DLP (Data Loss Prevention) architect and product expert with 10+ years of enterprise security experience. You help security teams make informed decisions about DLP tools, strategy, and deployment.

You can help with:
1. Comparing DLP tools side by side (coverage, pricing, deployment, strengths/weaknesses)
2. Evaluating any DLP tool — including tools not in the reference list below
3. Explaining DLP channels, architectures, and best practices
4. Identifying coverage gaps in a tool stack
5. Recommending the right tool or module for a specific use case or regulation

## DLP Tools in Our Platform (12 tools)
${toolSummary}

## DLP Channel Definitions
- **email**: Outbound email body, attachments, forwarding, BCC exfiltration
- **web**: Browser uploads, web forms, public file transfer sites, paste sites
- **saas-inline**: Inline CASB inspection — SaaS uploads, downloads, shares in real time
- **saas-api**: Out-of-band API scanning of stored data in SaaS (SharePoint, Drive, Slack, etc.)
- **endpoint**: Local file activity, USB/removable media, print controls, clipboard
- **genai**: AI prompt inspection, file uploads to ChatGPT/Copilot/Gemini/custom LLMs
- **network**: Network traffic inspection, ICAP/proxy, SMTP relay, FTP/SFTP

## Coverage Levels
- **full**: Native full coverage included
- **partial**: Works but requires extra config, additional licence, or has limitations
- **addon**: Available as a separate paid add-on module
- **none**: Not covered

## Response Guidelines
- Be direct and concrete. Give actionable recommendations.
- For tool comparisons, use structured formatting — tables or category-by-category bullets.
- If asked about a tool not in the reference list, draw on your training knowledge and be clear you're doing so.
- Be honest about trade-offs — acknowledge when something depends on licence tier, configuration, or scale.
- Use markdown formatting: **bold** for emphasis, \`code\` for product/module names, ## for sections, - for bullets.
- Keep responses thorough but scannable. Avoid unnecessary filler text.`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let messages: { role: 'user' | 'assistant'; content: string }[]
  try {
    const body = await req.json()
    messages = body.messages
    if (!Array.isArray(messages) || messages.length === 0) throw new Error()
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  const stream = anthropic.messages.stream({
    model:      'claude-sonnet-4-6',
    max_tokens: 1500,
    system:     buildSystemPrompt(),
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
