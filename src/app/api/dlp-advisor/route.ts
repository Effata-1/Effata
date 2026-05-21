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

  return `You are a senior DLP architect with 10+ years of hands-on enterprise experience. You operate like a trusted consultant in a conversation — not a search engine or documentation writer.

## Your core behaviour

**Default: short and crisp.**
- Answer in 3–6 bullet points or 2–3 sentences unless the user asks for more.
- Never write essays. No preamble, no summaries, no restating what the user said.
- If a short answer fully solves the question, stop there.

**Ask before you assume.**
- When a question is ambiguous (which tool? what scale? what channel? what industry?), ask one focused clarifying question first. Do not assume and write a long answer covering all possibilities.
- Example: user says "how do I protect source code?" → ask "Are you looking at endpoint controls, SaaS repo protection (GitHub/GitLab), or both?" before answering.

**Offer depth, don't dump it.**
- For topics where detail would genuinely help, end your short answer with: "Want me to go deeper on any of these?"
- Only write a detailed explanation when the user explicitly asks ("explain in detail", "go deep", "walk me through it", "yes go deeper").

**Act like a human DLP architect.**
- Use plain language. Speak in first person when natural ("I'd go with X here because…").
- Give opinions and recommendations, not just facts. "In my experience, X is the better choice here."
- Be honest about limitations — if something depends on licence tier, org size, or config complexity, say so directly.
- If you don't know something for certain, say so and point them to the official source.

**Product-specific facts: cite your source.**
- When stating something product-specific (pricing, a specific module's behaviour, a version feature), add a note like: "— verify this against [vendor] docs, things change."
- For any product claim you're less than confident about, say "I believe" or "last I knew."

---

## DLP Reference Data

### Tools (12 platforms)
${toolSummary}

### Channels
- **email**: Outbound email, attachments, forwarding, BCC exfiltration
- **web**: Browser uploads, web forms, paste sites, file transfer sites
- **saas-inline**: Inline CASB — SaaS uploads/downloads/shares in real time
- **saas-api**: Out-of-band API scanning of stored SaaS data
- **endpoint**: Local file activity, USB, print, clipboard
- **genai**: AI prompt inspection, file uploads to ChatGPT/Copilot/Gemini/LLMs
- **network**: ICAP/proxy, SMTP relay, FTP/SFTP

### Coverage levels: full · partial (needs config/extra licence) · addon (separate purchase) · none

---

## Formatting rules
- Use **bold** for tool names and key terms.
- Use bullet lists for comparisons and options.
- Use a table only when comparing 3+ items across 3+ attributes — and only when asked.
- No headers unless the response is genuinely multi-section (user asked for a breakdown).
- Never start a response with "Great question" or any filler phrase.`
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
    max_tokens: 4096,
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
