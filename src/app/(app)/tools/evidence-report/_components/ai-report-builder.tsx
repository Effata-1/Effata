'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Send, Loader2, Sparkles, CheckCircle2, XCircle, AlertCircle,
  FileText, Plus, ArrowRight,
} from 'lucide-react'
import { chatWithAI, createReportFromDraft } from '../ai-actions'
import type { ChatMessage, AIDraft, AIDraftTest } from '../ai-actions'
import type { FinalStatus } from '../actions'

// ── Label helpers ─────────────────────────────────────────────────────────────

const ACTUAL_LABELS: Record<string, string> = {
  blocked:             'Blocked',
  allowed_with_alert:  'Allowed + Alert',
  allowed_with_coach:  'Allowed + Coach',
  allowed_no_alert:    'Allowed — No Alert',
  not_inspected:       'Not Inspected',
  test_failed:         'Test Failed',
  inconclusive:        'Inconclusive',
}

const STATUS_COLOURS: Record<FinalStatus, string> = {
  passed:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed:       'bg-red-500/15 text-red-400 border-red-500/30',
  inconclusive: 'bg-accent/50 text-muted-foreground border-border-strong/30',
}

const STATUS_ICON: Record<FinalStatus, React.ReactNode> = {
  passed:       <CheckCircle2 className="w-3 h-3" />,
  failed:       <XCircle className="w-3 h-3" />,
  inconclusive: <AlertCircle className="w-3 h-3" />,
}

// ── Draft preview panel ───────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-[10px] text-muted-foreground/60 w-24 shrink-0 pt-0.5">{label}</span>
      {value
        ? <span className="text-xs text-foreground/70 break-words">{value}</span>
        : <span className="text-[10px] text-muted-foreground/40 italic">not captured yet</span>
      }
    </div>
  )
}

function TestPreviewCard({ test, num }: { test: Partial<AIDraftTest>; num: number }) {
  const status = (test.final_status ?? 'inconclusive') as FinalStatus
  return (
    <div className="bg-card/60 border border-border rounded p-3 mb-2">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="font-mono text-[10px] text-muted-foreground/80">{test.test_code ?? `DLP-${String(num).padStart(3,'0')}`}</span>
        {test.channel && <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded">{test.channel}</span>}
        {test.data_type && <span className="text-[10px] text-muted-foreground/80">{test.data_type}</span>}
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${STATUS_COLOURS[status]}`}>
          {STATUS_ICON[status]}
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
      {test.test_vector && <p className="text-[10px] text-muted-foreground mb-1">{test.test_vector}</p>}
      <div className="flex gap-2 text-[10px] text-muted-foreground/60 flex-wrap">
        {test.actual_result && <span>→ {ACTUAL_LABELS[test.actual_result] ?? test.actual_result}</span>}
        {test.gap_reason && <span className="text-red-500">Gap: {test.gap_reason.replace(/_/g, ' ')}</span>}
      </div>
      {(test.regulation_tags ?? []).length > 0 && (
        <div className="flex gap-1 flex-wrap mt-1.5">
          {test.regulation_tags!.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] rounded">{tag}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function DraftPreview({
  draft, ready, creating, onCreateReport,
}: {
  draft:          AIDraft
  ready:          boolean
  creating:       boolean
  onCreateReport: () => void
}) {
  const filledCount = [
    draft.name, draft.assessed_on, draft.tested_by,
    draft.environment, draft.report_type,
  ].filter(Boolean).length

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-muted-foreground/80" />
        <p className="text-xs font-semibold text-muted-foreground">Report Draft</p>
        <span className="ml-auto text-[10px] text-muted-foreground/60">{filledCount}/5 fields</span>
      </div>

      {/* Report header fields */}
      <div className="bg-card/40 border border-border rounded-lg px-3 py-1 mb-4">
        <Field label="Name"        value={draft.name} />
        <Field label="Date"        value={draft.assessed_on} />
        <Field label="Tested by"   value={draft.tested_by} />
        <Field label="Environment" value={draft.environment} />
        <Field label="Type"        value={draft.report_type?.replace(/_/g, ' ') ?? null} />
        {draft.notes && <Field label="Notes" value={draft.notes} />}
      </div>

      {/* Tests */}
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[10px] font-medium text-muted-foreground/80 uppercase tracking-wider">
          Tests ({draft.tests.length})
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {draft.tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Plus className="w-6 h-6 text-muted-foreground/20 mb-2" />
            <p className="text-[10px] text-muted-foreground/40">Tests will appear here as you describe them</p>
          </div>
        ) : (
          draft.tests.map((t, i) => (
            <TestPreviewCard key={i} test={t} num={i + 1} />
          ))
        )}
      </div>

      {/* Create report button */}
      <div className="pt-3 mt-3 border-t border-border">
        {ready ? (
          <button
            onClick={onCreateReport}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {creating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating report…</>
              : <><ArrowRight className="w-4 h-4" /> Create Report</>
            }
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-card/50 border border-border rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            <p className="text-[10px] text-muted-foreground/60">
              Keep describing your tests — the Create button will appear when there's enough to build the report.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Chat bubble ───────────────────────────────────────────────────────────────

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[80%] px-3.5 py-2.5 bg-blue-600/90 rounded-2xl rounded-tr-sm text-xs text-white">
          {text}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2 mb-3">
      <div className="w-6 h-6 rounded-full bg-muted border border-border-strong flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-3 h-3 text-muted-foreground" />
      </div>
      <div className="max-w-[85%] px-3.5 py-2.5 bg-muted/80 border border-border-strong/50 rounded-2xl rounded-tl-sm text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const INITIAL_MESSAGE =
  "Hi! Describe your DLP testing scenario and I'll build the evidence report for you.\n\nTell me what you tested — which data types (credit cards, SSNs, PHI, API keys…), which channels or tools you used, and what actually happened when you ran the tests. If any controls missed or fired unexpectedly, mention that too."

interface DisplayMessage {
  role: 'user' | 'assistant'
  text: string
}

export function AIReportBuilder() {
  const router = useRouter()

  const [input, setInput]         = useState('')
  const [isPending, startTransition] = useTransition()
  const [isCreating, startCreate] = useTransition()
  const [createError, setCreateError] = useState<string | null>(null)

  // Conversation state
  // apiMessages = what's sent to the API (assistant content = raw JSON strings)
  // displayMessages = what the user sees (assistant content = parsed .message field)
  const [apiMessages, setApiMessages]     = useState<ChatMessage[]>([])
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([
    { role: 'assistant', text: INITIAL_MESSAGE },
  ])
  const [draft, setDraft] = useState<AIDraft>({
    name: null, assessed_on: null, tested_by: null,
    environment: null, report_type: null, notes: null, tests: [],
  })
  const [ready, setReady] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages, isPending])

  function handleSend() {
    const text = input.trim()
    if (!text || isPending) return
    setInput('')

    const userMsg: ChatMessage   = { role: 'user', content: text }
    const newApiMessages         = [...apiMessages, userMsg]

    setDisplayMessages(prev => [...prev, { role: 'user', text }])
    setApiMessages(newApiMessages)

    startTransition(async () => {
      const res = await chatWithAI(newApiMessages)

      // Store the raw JSON response in API history so the AI has context
      const assistantRaw: ChatMessage = {
        role:    'assistant',
        content: JSON.stringify({ message: res.message, ready: res.ready, draft: res.draft }),
      }
      setApiMessages(prev => [...prev, assistantRaw])
      setDisplayMessages(prev => [...prev, { role: 'assistant', text: res.message }])
      setDraft(res.draft)
      setReady(res.ready)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleCreateReport() {
    setCreateError(null)
    startCreate(async () => {
      const result = await createReportFromDraft(draft)
      if (result.error) {
        setCreateError(result.error)
        return
      }
      router.push(`/tools/evidence-report/${result.id}`)
    })
  }

  return (
    <div className="flex gap-5 h-[calc(100vh-200px)] min-h-[520px]">

      {/* ── Chat panel ── */}
      <div className="flex flex-col flex-1 min-w-0 bg-background border border-border rounded-xl overflow-hidden">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {displayMessages.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.text} />
          ))}

          {/* Typing indicator */}
          {isPending && (
            <div className="flex items-start gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-muted border border-border-strong flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="px-3.5 py-3 bg-muted/80 border border-border-strong/50 rounded-2xl rounded-tl-sm">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isPending}
              rows={2}
              placeholder="Describe what you tested, what happened, any gaps…  (Enter to send)"
              className="flex-1 px-3 py-2 bg-card border border-border-strong rounded-lg text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
            <button
              onClick={handleSend}
              disabled={isPending || !input.trim()}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors shrink-0"
            >
              {isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5 ml-1">Shift+Enter for new line · Enter to send</p>
        </div>
      </div>

      {/* ── Draft preview panel ── */}
      <div className="w-72 shrink-0 bg-background border border-border rounded-xl p-4 overflow-hidden flex flex-col">
        {createError && (
          <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">{createError}</div>
        )}
        <DraftPreview
          draft={draft}
          ready={ready}
          creating={isCreating}
          onCreateReport={handleCreateReport}
        />
      </div>

    </div>
  )
}
