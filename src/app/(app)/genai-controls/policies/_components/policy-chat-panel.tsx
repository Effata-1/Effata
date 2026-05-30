'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { applyPolicyDiff } from '../actions'
import type { GenAIPolicy } from '@/lib/genai/types'

interface Message {
  role:    'user' | 'assistant'
  content: string
}

interface PolicyDiff {
  policyId: string
  changes:  Record<string, unknown>
}

interface Props {
  policies:        GenAIPolicy[]
  initialPolicyId?: string
  onClose:         () => void
}

function parsePolicyDiff(text: string): PolicyDiff | null {
  const match = text.match(/<policyDiff>\s*([\s\S]*?)\s*<\/policyDiff>/)
  if (!match) return null
  try {
    return JSON.parse(match[1]) as PolicyDiff
  } catch {
    return null
  }
}

function renderText(text: string): string {
  return text.replace(/<policyDiff>[\s\S]*?<\/policyDiff>/g, '').trim()
}

function ApplyDiffCard({ diff, policies, onApplied }: { diff: PolicyDiff; policies: GenAIPolicy[]; onApplied: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const policy = policies.find(p => p.id === diff.policyId)

  if (!policy) return null

  const isApproved = policy.approval_status === 'approved'
  const changedFields = Object.keys(diff.changes)

  function handleApply() {
    setError(null)
    startTransition(async () => {
      const result = await applyPolicyDiff({ policyId: diff.policyId, changes: diff.changes })
      if (result.error) {
        setError(result.error)
      } else {
        onApplied()
      }
    })
  }

  return (
    <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-3 space-y-2 my-2">
      <p className="text-xs font-medium text-blue-400">Suggested change: {policy.name}</p>
      <div className="text-xs text-muted-foreground space-y-0.5">
        {changedFields.map(f => (
          <p key={f}><span className="text-foreground/60">{f}:</span> {String(diff.changes[f])}</p>
        ))}
      </div>
      {isApproved ? (
        <p className="text-xs text-amber-400">Cannot edit an approved policy. Create a new draft instead.</p>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleApply}
            disabled={isPending}
            className="px-2.5 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Applying…' : 'Apply change'}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg, policies, onDiffApplied }: { msg: Message; policies: GenAIPolicy[]; onDiffApplied: () => void }) {
  const diff = msg.role === 'assistant' ? parsePolicyDiff(msg.content) : null
  const text = msg.role === 'assistant' ? renderText(msg.content) : msg.content

  return (
    <div className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
        msg.role === 'user'
          ? 'bg-blue-600 text-white'
          : 'bg-card border border-border text-foreground/90',
      )}>
        {text && <p className="whitespace-pre-wrap">{text}</p>}
        {diff && (
          <ApplyDiffCard diff={diff} policies={policies} onApplied={onDiffApplied} />
        )}
      </div>
    </div>
  )
}

export function PolicyChatPanel({ policies, initialPolicyId, onClose }: Props) {
  const router                            = useRouter()
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | undefined>(initialPolicyId)
  const [messages, setMessages]           = useState<Message[]>([])
  const [input, setInput]                 = useState('')
  const [streaming, setStreaming]         = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const bottomRef                         = useRef<HTMLDivElement>(null)
  const inputRef                          = useRef<HTMLTextAreaElement>(null)
  const abortRef                          = useRef<AbortController | null>(null)

  const selectedPolicy = selectedPolicyId ? policies.find(p => p.id === selectedPolicyId) : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Abort any in-flight stream when the panel is closed/unmounted
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    setError(null)
    const userMsg: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/policy-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: nextMessages,
          policyId: selectedPolicyId,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        setError(await res.text() || 'Request failed.')
        setStreaming(false)
        return
      }

      if (!res.body) { setStreaming(false); return }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantText }
          return updated
        })
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Connection error. Please try again.')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  function handleDiffApplied() {
    router.refresh()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col bg-background border-l border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {selectedPolicy ? `Refine: ${selectedPolicy.name}` : 'Refine Policies with AI'}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              {selectedPolicy
                ? `${selectedPolicy.policy_type} · ${selectedPolicy.approval_status}`
                : `${policies.length} policies in scope`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedPolicyId && (
              <button
                type="button"
                onClick={() => setSelectedPolicyId(undefined)}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                All policies
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Policy selector (global mode) */}
        {!selectedPolicyId && policies.length > 0 && (
          <div className="px-3 py-2 border-b border-border shrink-0">
            <select
              value=""
              onChange={e => { if (e.target.value) setSelectedPolicyId(e.target.value) }}
              className="w-full text-xs bg-muted/40 border border-border rounded-md px-2 py-1.5 text-muted-foreground focus:outline-none focus:border-blue-500/50"
            >
              <option value="">Focus on a specific policy (optional)</option>
              {policies.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-1">
              <p className="text-sm text-muted-foreground">Ask Claude to review, improve, or explain your policies.</p>
              <p className="text-xs text-muted-foreground/50">Suggested: "Review my prohibited policies" or "Add a policy for source code protection"</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} policies={policies} onDiffApplied={handleDiffApplied} />
          ))}
          {streaming && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-xl px-3 py-2">
                <span className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-border shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your policies…"
              rows={2}
              disabled={streaming}
              className="flex-1 resize-none text-xs bg-muted/40 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!input.trim() || streaming}
              className="shrink-0 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
