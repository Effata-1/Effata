'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, GitCompare, Search, Zap, AlertTriangle, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role    = 'user' | 'assistant'
type Message = { role: Role; content: string }
interface Tool { id: string; label: string }

interface Props {
  orgToolLabels: string[]
  allTools: Tool[]
}

// ─── Suggestion cards ─────────────────────────────────────────────────────────

const CARDS = [
  {
    id:          'compare',
    Icon:        GitCompare,
    title:       'Compare two tools',
    description: 'Side-by-side channel coverage, pricing, and feature analysis',
    accent:      'text-violet-400',
    bg:          'bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/15',
    prompt:      null,
  },
  {
    id:          'evaluate',
    Icon:        Search,
    title:       'Evaluate any tool',
    description: 'Ask about tools outside the database',
    accent:      'text-blue-400',
    bg:          'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15',
    prompt:      'Tell me about Nightfall DLP — what channels it covers, its pricing model, key strengths, and when to choose it over alternatives.',
  },
  {
    id:          'genai',
    Icon:        Zap,
    title:       'Best GenAI coverage',
    description: 'Which platforms cover AI apps best?',
    accent:      'text-amber-400',
    bg:          'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15',
    prompt:      'Which DLP tool has the best GenAI and AI application coverage? Compare the top options for covering ChatGPT, Microsoft Copilot, Gemini, and other AI tools.',
  },
  {
    id:          'gaps',
    Icon:        AlertTriangle,
    title:       'Identify my gaps',
    description: 'What DLP channels am I missing?',
    accent:      'text-emerald-400',
    bg:          'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15',
    prompt:      null, // built at runtime from orgToolLabels
  },
]

// ─── Inline markdown renderer ─────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="px-1 py-0.5 rounded bg-muted/60 text-[11px] font-mono text-violet-300">{part.slice(1, -1)}</code>
        return part
      })}
    </>
  )
}

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      out.push(<p key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{renderInline(line.slice(3))}</p>)
      i++; continue
    }
    if (line.startsWith('### ')) {
      out.push(<p key={i} className="text-xs font-bold text-foreground/70 uppercase tracking-wide mt-2.5 mb-1">{renderInline(line.slice(4))}</p>)
      i++; continue
    }
    if (line.startsWith('# ')) {
      out.push(<p key={i} className="text-sm font-bold text-foreground mt-2 mb-1">{renderInline(line.slice(2))}</p>)
      i++; continue
    }

    // Collect bullet list
    if (line.match(/^[-*]\s/) || line.match(/^\d+\.\s/)) {
      const items: string[] = []
      while (i < lines.length && (lines[i].match(/^[-*]\s/) || lines[i].match(/^\d+\.\s/))) {
        items.push(lines[i].replace(/^[-*]\s/, '').replace(/^\d+\.\s/, ''))
        i++
      }
      out.push(
        <ul key={`ul-${i}`} className="space-y-0.5 list-disc list-inside">
          {items.map((item, j) => (
            <li key={j} className="text-sm text-foreground/80 leading-relaxed">{renderInline(item)}</li>
          ))}
        </ul>,
      )
      continue
    }

    if (line.trim() === '') { i++; continue }

    out.push(<p key={i} className="text-sm text-foreground/80 leading-relaxed">{renderInline(line)}</p>)
    i++
  }

  return <div className="space-y-1.5">{out}</div>
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DlpAdvisorChat({ orgToolLabels, allTools }: Props) {
  const [messages,     setMessages]     = useState<Message[]>([])
  const [input,        setInput]        = useState('')
  const [isStreaming,  setIsStreaming]   = useState(false)
  const [streamText,   setStreamText]   = useState('')
  const [compareOpen,  setCompareOpen]  = useState(false)
  const [toolA,        setToolA]        = useState('')
  const [toolB,        setToolB]        = useState('')
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [input])

  async function send(text: string) {
    if (!text.trim() || isStreaming) return
    setInput('')
    setCompareOpen(false)

    const userMsg: Message = { role: 'user', content: text.trim() }
    const history = [...messages, userMsg]
    setMessages(history)
    setIsStreaming(true)
    setStreamText('')

    try {
      const res = await fetch('/api/dlp-advisor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history }),
      })
      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value)
        setStreamText(full)
      }

      setMessages(prev => [...prev, { role: 'assistant', content: full }])
    } catch {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: 'Something went wrong — please try again.',
      }])
    } finally {
      setIsStreaming(false)
      setStreamText('')
    }
  }

  function sendCompare() {
    if (!toolA || !toolB) return
    const la = allTools.find(t => t.id === toolA)?.label ?? toolA
    const lb = allTools.find(t => t.id === toolB)?.label ?? toolB
    send(
      `Compare ${la} vs ${lb} for enterprise DLP. Cover: channel coverage (email, web, SaaS inline, SaaS API, endpoint, GenAI, network), deployment model, pricing approach, key strengths, key limitations, and when to choose each one.`,
    )
    setToolA(''); setToolB('')
  }

  function getGapsPrompt() {
    return orgToolLabels.length > 0
      ? `My current DLP stack includes: ${orgToolLabels.join(', ')}. What DLP channel coverage gaps do I have, and what should I prioritise adding or configuring next?`
      : "I haven't configured my DLP stack yet. What DLP channels should I prioritise for a well-rounded programme covering email, web, endpoint, and cloud?"
  }

  function reset() {
    setMessages([]); setStreamText(''); setInput(''); setCompareOpen(false); setToolA(''); setToolB('')
  }

  const isEmpty = messages.length === 0 && !isStreaming

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] rounded-xl border border-border bg-card/20 overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">DLP AI Advisor</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">Powered by Claude · DLP domain expert</p>
          </div>
        </div>
        {!isEmpty && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            New chat
          </button>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (

          /* ── Welcome / empty state ── */
          <div className="flex flex-col items-center px-6 pt-10 pb-6">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center mb-5">
              <Bot className="w-7 h-7 text-violet-400" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">How can I help you?</h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-8 leading-relaxed">
              Ask about DLP tools, compare platforms, evaluate coverage gaps, or get expert guidance on data loss prevention.
            </p>

            {/* Suggestion cards */}
            <div className="w-full max-w-2xl grid grid-cols-2 gap-3 mb-5">
              {CARDS.map(card => (
                <button
                  key={card.id}
                  onClick={() => {
                    if (card.id === 'compare') { setCompareOpen(true); return }
                    if (card.id === 'gaps')     { send(getGapsPrompt()); return }
                    send(card.prompt!)
                  }}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border text-left transition-all group',
                    card.bg,
                    compareOpen && card.id === 'compare' && 'ring-2 ring-violet-500/30',
                  )}
                >
                  <card.Icon className={cn('w-4 h-4 mt-0.5 shrink-0', card.accent)} />
                  <div>
                    <p className="text-sm font-medium text-foreground leading-tight">{card.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{card.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Inline compare selector */}
            {compareOpen && (
              <div className="w-full max-w-2xl">
                <div className="flex items-center gap-2 p-4 rounded-xl border border-violet-500/20 bg-violet-500/5">
                  <select
                    value={toolA}
                    onChange={e => setToolA(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                  >
                    <option value="">Select first tool…</option>
                    {allTools.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">vs</span>
                  <select
                    value={toolB}
                    onChange={e => setToolB(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                  >
                    <option value="">Select second tool…</option>
                    {allTools.map(t => (
                      <option key={t.id} value={t.id} disabled={t.id === toolA}>{t.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={sendCompare}
                    disabled={!toolA || !toolB}
                    className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    Compare
                  </button>
                  <button
                    onClick={() => setCompareOpen(false)}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-muted/40 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

        ) : (

          /* ── Chat messages ── */
          <div className="px-5 py-4 space-y-5">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-3', msg.role === 'user' && 'justify-end')}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[84%] rounded-xl px-4 py-3',
                  msg.role === 'user'
                    ? 'bg-muted/30 border border-border/60'
                    : 'bg-card/50 border border-border',
                )}>
                  {msg.role === 'user'
                    ? <p className="text-sm text-foreground">{msg.content}</p>
                    : <MarkdownContent text={msg.content} />
                  }
                </div>
              </div>
            ))}

            {/* Streaming bubble */}
            {isStreaming && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div className="max-w-[84%] rounded-xl px-4 py-3 bg-card/50 border border-border">
                  {streamText
                    ? <>
                        <MarkdownContent text={streamText} />
                        <span className="inline-block w-1.5 h-3.5 bg-violet-400/70 ml-0.5 animate-pulse rounded-sm align-text-bottom" />
                      </>
                    : <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                      </span>
                  }
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-t border-border bg-card/30 shrink-0 space-y-2">

        {/* Inline compare selector (in chat mode) */}
        {compareOpen && !isEmpty && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-violet-500/20 bg-violet-500/5">
            <select
              value={toolA}
              onChange={e => setToolA(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            >
              <option value="">Select first tool…</option>
              {allTools.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <span className="text-xs font-semibold text-muted-foreground shrink-0">vs</span>
            <select
              value={toolB}
              onChange={e => setToolB(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            >
              <option value="">Select second tool…</option>
              {allTools.map(t => <option key={t.id} value={t.id} disabled={t.id === toolA}>{t.label}</option>)}
            </select>
            <button
              onClick={sendCompare}
              disabled={!toolA || !toolB}
              className="px-3 py-1.5 rounded-md bg-violet-500 text-white text-xs font-medium hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              Compare
            </button>
            <button onClick={() => setCompareOpen(false)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/40 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Textarea + send */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
            }}
            placeholder="Ask about DLP tools, comparisons, coverage gaps…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl bg-muted/20 border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/30 leading-relaxed disabled:opacity-60 min-h-[44px]"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isStreaming}
            className="w-11 h-11 rounded-xl bg-violet-500 flex items-center justify-center text-white hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCompareOpen(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
              compareOpen
                ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
                : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/30',
            )}
          >
            <GitCompare className="w-3.5 h-3.5" />
            Compare tools
          </button>
          <p className="text-[10px] text-muted-foreground/35">Shift+Enter for new line</p>
        </div>
      </div>

    </div>
  )
}
