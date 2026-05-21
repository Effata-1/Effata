'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Send, ShieldCheck, GitCompare, Search, Zap, AlertTriangle,
  RotateCcw, X, History, Trash2, Clock, BookOpen, Network, Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  upsertAdvisorChat, deleteAdvisorChat,
  type SavedChat,
} from '../actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role    = 'user' | 'assistant'
type Message = { role: Role; content: string }
interface Tool { id: string; label: string }

interface Props {
  orgToolLabels: string[]
  allTools:      Tool[]
  initialChats:  SavedChat[]
}

// ─── Quick action cards ───────────────────────────────────────────────────────

const CARDS = [
  {
    id:          'compare',
    Icon:        GitCompare,
    title:       'Compare two tools',
    description: 'Pick any two platforms for a side-by-side breakdown',
    accent:      'text-violet-400',
    bg:          'bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/15',
    prompt:      null, // opens compare selector
  },
  {
    id:          'evaluate',
    Icon:        Search,
    title:       'Evaluate a tool',
    description: 'Any DLP platform — inside or outside the database',
    accent:      'text-blue-400',
    bg:          'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15',
    prompt:      'I want to evaluate a DLP tool.',
  },
  {
    id:          'genai',
    Icon:        Zap,
    title:       'GenAI coverage',
    description: 'Which platforms cover AI apps best?',
    accent:      'text-amber-400',
    bg:          'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15',
    prompt:      'Which DLP tools have the best GenAI coverage?',
  },
  {
    id:          'gaps',
    Icon:        AlertTriangle,
    title:       'Find my gaps',
    description: 'What DLP channels am I missing?',
    accent:      'text-emerald-400',
    bg:          'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15',
    prompt:      null, // built at runtime from org stack
  },
  {
    id:          'gdpr',
    Icon:        Lock,
    title:       'GDPR requirements',
    description: 'What controls does Article 32 actually need?',
    accent:      'text-rose-400',
    bg:          'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15',
    prompt:      'What DLP controls are needed for GDPR Article 32?',
  },
  {
    id:          'detection',
    Icon:        Network,
    title:       'Detection technologies',
    description: 'EDM, fingerprinting, ML — when to use each',
    accent:      'text-cyan-400',
    bg:          'bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/15',
    prompt:      'Help me understand DLP detection technologies and when to use each.',
  },
  {
    id:          'email',
    Icon:        BookOpen,
    title:       'Email DLP',
    description: 'Build a solid outbound email DLP programme',
    accent:      'text-orange-400',
    bg:          'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/15',
    prompt:      'I want to improve my email DLP.',
  },
  {
    id:          'endpoint-vs-casb',
    Icon:        ShieldCheck,
    title:       'Endpoint vs CASB',
    description: 'Which architecture fits your workforce?',
    accent:      'text-teal-400',
    bg:          'bg-teal-500/10 border-teal-500/20 hover:bg-teal-500/15',
    prompt:      'Should I use endpoint DLP or CASB DLP?',
  },
]

// ─── Inline markdown ──────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="px-1 py-0.5 rounded bg-muted/60 text-[11px] font-mono text-violet-300">{part.slice(1, -1)}</code>
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
          return <em key={i} className="italic">{part.slice(1, -1)}</em>
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

    // Headings
    if (line.startsWith('# '))  { out.push(<p key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{renderInline(line.slice(2))}</p>);  i++; continue }
    if (line.startsWith('## ')) { out.push(<p key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{renderInline(line.slice(3))}</p>);  i++; continue }
    if (line.startsWith('### '))  { out.push(<p key={i} className="text-xs font-bold text-foreground/70 uppercase tracking-wide mt-2.5 mb-0.5">{renderInline(line.slice(4))}</p>); i++; continue }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/) && line.trim() !== '') {
      out.push(<hr key={i} className="border-border/40 my-2" />)
      i++; continue
    }

    // Table: line starts with | and next line is separator |---|
    if (
      line.startsWith('|') &&
      i + 1 < lines.length &&
      lines[i + 1].match(/^\|[\s\-:|]+\|$/)
    ) {
      const headerCells = line.split('|').slice(1, -1).map(c => c.trim())
      i += 2 // skip header + separator
      const bodyRows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        bodyRows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()))
        i++
      }
      out.push(
        <div key={`t-${i}`} className="overflow-x-auto rounded-lg border border-border/50 my-1">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/30">
                {headerCells.map((h, hi) => (
                  <th key={hi} className="text-left px-3 py-2 text-foreground/70 font-semibold border-b border-border/50 whitespace-nowrap">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className={cn('border-t border-border/20', ri % 2 === 1 && 'bg-muted/10')}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-foreground/80">{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // Bullet / numbered list — collect consecutive items
    if (line.match(/^[-*]\s/) || line.match(/^\d+\.\s/)) {
      const isOrdered = !!line.match(/^\d+\.\s/)
      const items: string[] = []
      while (i < lines.length && (lines[i].match(/^[-*]\s/) || lines[i].match(/^\d+\.\s/))) {
        items.push(lines[i].replace(/^[-*]\s/, '').replace(/^\d+\.\s/, ''))
        i++
      }
      const Tag = isOrdered ? 'ol' : 'ul'
      out.push(
        <Tag key={`l-${i}`} className={cn('space-y-0.5 pl-4', isOrdered ? 'list-decimal' : 'list-disc')}>
          {items.map((item, j) => (
            <li key={j} className="text-sm text-foreground/80 leading-relaxed">{renderInline(item)}</li>
          ))}
        </Tag>,
      )
      continue
    }

    if (line.trim() === '') { i++; continue }

    out.push(<p key={i} className="text-sm text-foreground/80 leading-relaxed">{renderInline(line)}</p>)
    i++
  }

  return <div className="space-y-1.5">{out}</div>
}

// ─── Date grouping helper ─────────────────────────────────────────────────────

function chatDateLabel(iso: string): string {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7)  return `${diff} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function daysUntilExpiry(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DlpAdvisorChat({ orgToolLabels, allTools, initialChats }: Props) {
  const [messages,    setMessages]    = useState<Message[]>([])
  const [input,       setInput]       = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamText,  setStreamText]  = useState('')
  const [compareOpen, setCompareOpen] = useState(false)
  const [toolA,       setToolA]       = useState('')
  const [toolB,       setToolB]       = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [savedChats,  setSavedChats]  = useState<SavedChat[]>(initialChats)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

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

    let full = ''
    try {
      const res = await fetch('/api/dlp-advisor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history }),
      })
      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value)
        setStreamText(full)
      }
    } catch {
      full = 'Something went wrong — please try again.'
    }

    const finalMessages: Message[] = [...history, { role: 'assistant', content: full }]
    setMessages(finalMessages)
    setIsStreaming(false)
    setStreamText('')

    // Auto-save to DB
    const title = userMsg.content.slice(0, 70) + (userMsg.content.length > 70 ? '…' : '')
    try {
      const savedId = await upsertAdvisorChat(currentChatId, title, finalMessages)
      if (savedId && !currentChatId) {
        setCurrentChatId(savedId)
        const expires = new Date(Date.now() + 30 * 86_400_000).toISOString()
        setSavedChats(prev => [
          { id: savedId, title, created_at: new Date().toISOString(), expires_at: expires },
          ...prev,
        ])
      }
    } catch { /* save failed silently */ }
  }

  function sendCompare() {
    if (!toolA || !toolB) return
    const la = allTools.find(t => t.id === toolA)?.label ?? toolA
    const lb = allTools.find(t => t.id === toolB)?.label ?? toolB
    send(
      `Compare ${la} vs ${lb} for enterprise DLP. Cover: channel coverage (email, web, SaaS inline, SaaS API, endpoint, GenAI, network), deployment model, pricing approach, key strengths, key limitations, and when to choose each one. Use a table for channel coverage.`,
    )
    setToolA(''); setToolB('')
  }

  function getGapsPrompt() {
    return orgToolLabels.length > 0
      ? `My current DLP stack includes: ${orgToolLabels.join(', ')}. What DLP channel coverage gaps do I have? What should I prioritise adding or configuring next?`
      : "I haven't set up a DLP stack yet. What channels should I prioritise first for a well-rounded DLP programme?"
  }

  async function handleDeleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSavedChats(prev => prev.filter(c => c.id !== id))
    if (currentChatId === id) reset()
    await deleteAdvisorChat(id)
  }

  function loadChat(chat: SavedChat & { messages?: Message[] }) {
    if (!chat.messages) return
    setMessages(chat.messages)
    setCurrentChatId(chat.id)
    setHistoryOpen(false)
    setStreamText('')
    setCompareOpen(false)
  }

  function reset() {
    setMessages([]); setStreamText(''); setInput('')
    setCompareOpen(false); setCurrentChatId(null)
    setToolA(''); setToolB('')
  }

  const isEmpty = messages.length === 0 && !isStreaming

  // Compare selector (shared between welcome state and chat toolbar)
  const CompareSelector = (
    <div className="flex items-center gap-2 p-3 rounded-lg border border-violet-500/20 bg-violet-500/5">
      <select value={toolA} onChange={e => setToolA(e.target.value)}
        className="flex-1 px-3 py-1.5 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40">
        <option value="">First tool…</option>
        {allTools.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <span className="text-xs font-semibold text-muted-foreground shrink-0">vs</span>
      <select value={toolB} onChange={e => setToolB(e.target.value)}
        className="flex-1 px-3 py-1.5 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40">
        <option value="">Second tool…</option>
        {allTools.map(t => <option key={t.id} value={t.id} disabled={t.id === toolA}>{t.label}</option>)}
      </select>
      <button onClick={sendCompare} disabled={!toolA || !toolB}
        className="px-3 py-1.5 rounded-md bg-violet-500 text-white text-xs font-semibold hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
        Compare
      </button>
      <button onClick={() => setCompareOpen(false)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/40 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )

  return (
    <div className="relative flex h-[calc(100vh-130px)] rounded-xl border border-border bg-card/20 overflow-hidden">

      {/* ── History slide-over ─────────────────────────────────────────────── */}
      {historyOpen && (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[2px]"
            onClick={() => setHistoryOpen(false)}
          />
          {/* Panel */}
          <div className="absolute right-0 top-0 bottom-0 z-20 w-72 flex flex-col border-l border-border bg-card shadow-xl">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
              <p className="text-xs font-semibold text-foreground">Saved Chats</p>
              <button onClick={() => setHistoryOpen(false)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Retention notice */}
            <div className="mx-3 mt-3 mb-1 flex items-start gap-2 px-2.5 py-2 rounded-lg bg-amber-500/8 border border-amber-500/15">
              <Clock className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-400/80 leading-snug">
                Chats auto-delete after <strong>30 days</strong>. Not stored beyond that.
              </p>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto py-1">
              {savedChats.length === 0 ? (
                <p className="px-4 py-8 text-[11px] text-muted-foreground/50 text-center">No saved chats yet</p>
              ) : (
                savedChats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={async () => {
                      const { loadAdvisorChat } = await import('../actions')
                      const data = await loadAdvisorChat(chat.id)
                      if (data) loadChat({ ...chat, messages: data.messages as Message[] })
                    }}
                    className={cn(
                      'group w-full text-left px-4 py-3 hover:bg-muted/20 transition-colors flex items-start gap-2 border-b border-border/40 last:border-0',
                      currentChatId === chat.id && 'bg-muted/30',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-foreground/80 leading-snug line-clamp-2">{chat.title}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">
                        {chatDateLabel(chat.created_at)} · {daysUntilExpiry(chat.expires_at)}d left
                      </p>
                    </div>
                    <button
                      onClick={e => handleDeleteChat(chat.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground/50 hover:text-rose-400 transition-all shrink-0 mt-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => { reset(); setHistoryOpen(false) }}
              className="m-3 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-border bg-muted/10 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              New chat
            </button>
          </div>
        </>
      )}

      {/* ── Chat column ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">DLP AI Advisor</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">DLP Architect · AI Expert</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setHistoryOpen(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] transition-colors',
                historyOpen
                  ? 'bg-muted/40 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
              )}
            >
              <History className="w-3.5 h-3.5" />
              History
              {savedChats.length > 0 && (
                <span className="px-1 py-0.5 rounded bg-muted text-[9px] font-semibold text-muted-foreground">{savedChats.length}</span>
              )}
            </button>
            {!isEmpty && (
              <button onClick={reset} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                <RotateCcw className="w-3 h-3" />
                New chat
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (

            /* Welcome state */
            <div className="flex flex-col items-center px-6 pt-8 pb-6">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center mb-4">
                <ShieldCheck className="w-7 h-7 text-violet-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">How can I help you?</h2>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-7 leading-relaxed">
                Ask about DLP tools, compare platforms, evaluate coverage gaps, or get expert guidance on any data loss prevention topic.
              </p>

              {/* 4-column quick action grid */}
              <div className="w-full max-w-3xl grid grid-cols-2 gap-2.5 mb-5 sm:grid-cols-4">
                {CARDS.slice(0, 4).map(card => (
                  <button key={card.id}
                    onClick={() => card.id === 'compare' ? setCompareOpen(true) : send(card.id === 'gaps' ? getGapsPrompt() : card.prompt!)}
                    className={cn('flex flex-col gap-2 p-3.5 rounded-xl border text-left transition-all', card.bg, compareOpen && card.id === 'compare' && 'ring-2 ring-violet-500/30')}>
                    <card.Icon className={cn('w-4 h-4', card.accent)} />
                    <div>
                      <p className="text-xs font-semibold text-foreground leading-tight">{card.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{card.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Secondary cards row */}
              <div className="w-full max-w-3xl grid grid-cols-2 gap-2.5 mb-5 sm:grid-cols-4">
                {CARDS.slice(4).map(card => (
                  <button key={card.id}
                    onClick={() => send(card.prompt!)}
                    className={cn('flex flex-col gap-2 p-3.5 rounded-xl border text-left transition-all', card.bg)}>
                    <card.Icon className={cn('w-4 h-4', card.accent)} />
                    <div>
                      <p className="text-xs font-semibold text-foreground leading-tight">{card.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{card.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              {compareOpen && (
                <div className="w-full max-w-3xl">{CompareSelector}</div>
              )}
            </div>

          ) : (

            /* Chat messages */
            <div className="px-5 py-4 space-y-5">
              {messages.map((msg, i) => (
                <div key={i} className={cn('flex gap-3', msg.role === 'user' && 'justify-end')}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
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
                    <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="max-w-[84%] rounded-xl px-4 py-3 bg-card/50 border border-border">
                    {streamText
                      ? <>
                          <MarkdownContent text={streamText} />
                          <span className="inline-block w-1.5 h-3.5 bg-violet-400/70 ml-0.5 animate-pulse rounded-sm align-text-bottom" />
                        </>
                      : <span className="flex items-center gap-1 text-sm text-muted-foreground">
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

        {/* Input area */}
        <div className="px-5 py-3.5 border-t border-border bg-card/30 shrink-0 space-y-2">
          {compareOpen && !isEmpty && CompareSelector}

          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
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
              {currentChatId && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                  <Clock className="w-3 h-3" />
                  Auto-saved · 30-day retention
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/35">Shift+Enter for new line</p>
          </div>
        </div>

      </div>
    </div>
  )
}
