'use client'

import { useState, useRef, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Pencil, Trash2, Plus, X, Download, Eye,
  Copy, EyeOff, ChevronDown, Sparkles, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  upsertNotification,
  deleteNotification,
  duplicateNotification,
  toggleNotificationActive,
} from '../actions'
import type { CoachingNotification, ControlType } from '@/lib/genai/types'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOKENS = [
  '{{APP}}', '{{USER}}', '{{POLICY_NAME}}', '{{ACTIVITY}}',
  '{{HOST}}', '{{URL}}', '{{CATEGORY}}', '{{FILENAME}}',
  '{{LABEL}}', '{{DATA_TYPE}}', '{{DETECTION_SOURCE}}', '{{DATE_TIME}}',
  '{{BUSINESS_JUSTIFICATION}}', '{{SUPPORT_CONTACT}}', '{{EXCEPTION_URL}}',
]

const MOCK: Record<string, string> = {
  '{{APP}}':                    'Microsoft Copilot',
  '{{USER}}':                   'user@company.com',
  '{{POLICY_NAME}}':            'GenAI – Highly Confidential Upload Control',
  '{{ACTIVITY}}':               'Upload',
  '{{HOST}}':                   'LAPTOP-1024',
  '{{URL}}':                    'https://copilot.microsoft.com',
  '{{CATEGORY}}':               'Approved & Supported GenAI',
  '{{FILENAME}}':               'customer-contract.xlsx',
  '{{LABEL}}':                  'Highly Confidential',
  '{{DATA_TYPE}}':              'Customer Contract Data',
  '{{DETECTION_SOURCE}}':       'Classification Label Detection',
  '{{DATE_TIME}}':              '2026-05-31 10:30 AM',
  '{{BUSINESS_JUSTIFICATION}}': '[user justification]',
  '{{SUPPORT_CONTACT}}':        'security@company.com',
  '{{EXCEPTION_URL}}':          'https://company.com/security-exception',
}

const CONTROL_TYPE_META: Record<ControlType, { label: string; cls: string; buttons: string[] }> = {
  block:               { label: 'Block',           cls: 'bg-red-500/10 text-red-400 border-red-500/20',       buttons: ['OK'] },
  coach_acknowledge:   { label: 'Coach + Ack',     cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20', buttons: ['Stop', 'Proceed'] },
  coach_justification: { label: 'Coach + Justify', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   buttons: ['Stop', 'Proceed'] },
  monitor:             { label: 'Monitor',          cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',     buttons: [] },
  allow:               { label: 'Allow',            cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', buttons: [] },
}

const CONTROL_TYPE_OPTIONS: { value: ControlType; label: string; description: string }[] = [
  { value: 'block',               label: 'Block',           description: 'User cannot proceed — action is blocked' },
  { value: 'coach_acknowledge',   label: 'Coach + Ack',     description: 'User sees message, can stop or proceed' },
  { value: 'coach_justification', label: 'Coach + Justify', description: 'User must enter a justification to proceed' },
  { value: 'monitor',             label: 'Monitor',         description: 'No message shown — event logged silently' },
  { value: 'allow',               label: 'Allow',           description: 'No message, activity is permitted' },
]

const EXCEPTION_LINE = 'If this action is required for an approved business purpose, submit an exception request: {{EXCEPTION_URL}}'

const DETAILS_FIELDS = [
  ['App', '{{APP}}'], ['Category', '{{CATEGORY}}'], ['Activity', '{{ACTIVITY}}'],
  ['Policy', '{{POLICY_NAME}}'], ['Detection', '{{DETECTION_SOURCE}}'], ['Data Type', '{{DATA_TYPE}}'],
  ['Label', '{{LABEL}}'], ['File', '{{FILENAME}}'], ['URL', '{{URL}}'],
  ['Device', '{{HOST}}'], ['User', '{{USER}}'], ['Time', '{{DATE_TIME}}'],
]

const AI_ACTIONS = [
  { value: 'rewrite_existing',                   label: 'Rewrite existing' },
  { value: 'draft_new',                          label: 'Draft new message' },
  { value: 'make_shorter',                       label: 'Make shorter' },
  { value: 'make_clearer',                       label: 'Make clearer' },
  { value: 'make_stricter',                      label: 'Make stricter' },
  { value: 'make_softer',                        label: 'Make softer / friendlier' },
  { value: 'make_executive_friendly',            label: 'Executive-friendly' },
  { value: 'make_employee_friendly',             label: 'Employee-friendly' },
  { value: 'add_business_justification_language', label: 'Add justification language' },
  { value: 'convert_for_block',                  label: 'Convert to Block' },
  { value: 'convert_for_acknowledgement',        label: 'Convert to Coach + Ack' },
  { value: 'convert_for_justification',          label: 'Convert to Coach + Justify' },
]

const AI_TONES = [
  { value: 'professional',       label: 'Professional' },
  { value: 'neutral',            label: 'Neutral' },
  { value: 'strict',             label: 'Strict' },
  { value: 'friendly',           label: 'Friendly' },
  { value: 'executive',          label: 'Executive' },
  { value: 'legal',              label: 'Legal' },
  { value: 'security_awareness', label: 'Security Awareness' },
]

const AI_LENGTHS = [
  { value: 'medium',   label: 'Medium' },
  { value: 'short',    label: 'Short' },
  { value: 'detailed', label: 'Detailed' },
]

interface AiSuggestion {
  name:            string
  description:     string
  control_type?:   ControlType
  title:           string
  subtitle:        string
  message:         string
  recommended_for: string[]
  tokens_used:     string[]
  warnings:        string[]
}

interface AiApplyFields {
  name:            boolean
  description:     boolean
  title:           boolean
  subtitle:        boolean
  message:         boolean
  recommended_for: boolean
  control_type:    boolean
}

const DEFAULT_APPLY_FIELDS: AiApplyFields = {
  name: true, description: true, title: true, subtitle: true,
  message: true, recommended_for: true, control_type: true,
}

function sub(text: string): string {
  return TOKENS.reduce((t, v) => t.replaceAll(v, MOCK[v] ?? v), text)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({ n, onClose }: { n: CoachingNotification; onClose: () => void }) {
  const meta = CONTROL_TYPE_META[n.control_type] ?? CONTROL_TYPE_META.coach_acknowledge
  const showJustify = n.control_type === 'coach_justification'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <p className="text-sm font-semibold text-foreground">{n.name}</p>
          <button onClick={onClose} className="text-muted-foreground/40 hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <div className="rounded-xl border border-border bg-background p-4 space-y-3">
            {/* Title */}
            <p className="text-sm font-bold text-foreground leading-snug">{sub(n.title)}</p>

            {/* Subtitle */}
            {n.subtitle && (
              <p className="text-xs text-muted-foreground/70 leading-relaxed">{sub(n.subtitle)}</p>
            )}

            {/* Message */}
            <p className="text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-wrap">{sub(n.message)}</p>

            {/* Exception line */}
            {n.show_exception_line && (
              <p className="text-xs text-blue-400/80 leading-relaxed">{sub(EXCEPTION_LINE)}</p>
            )}

            {/* Details block */}
            {n.show_details && (
              <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 space-y-0.5">
                {DETAILS_FIELDS.map(([label, token]) => (
                  <div key={label} className="flex gap-2 text-[10px]">
                    <span className="text-muted-foreground/50 w-20 shrink-0">{label}:</span>
                    <span className="text-muted-foreground/70">{MOCK[token] ?? token}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Justification textarea */}
            {showJustify && (
              <textarea
                readOnly
                placeholder="Enter your business justification…"
                className="w-full text-xs border border-border rounded-lg bg-muted/20 px-3 py-2 h-16 resize-none text-muted-foreground/50"
              />
            )}

            {/* Buttons */}
            {meta.buttons.length > 0 && (
              <div className="flex justify-end gap-2 pt-1">
                {meta.buttons.length > 1 && (
                  <button className="px-3 py-1.5 text-xs rounded-lg bg-muted/40 text-muted-foreground/70 border border-border cursor-default">
                    {meta.buttons[0]}
                  </button>
                )}
                <button className="px-3 py-1.5 text-xs rounded-lg bg-primary/10 text-primary border border-primary/20 cursor-default">
                  {meta.buttons[meta.buttons.length - 1]}
                </button>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground/30 text-center mt-3">
            Preview uses sample data — actual values are substituted at runtime
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Live Preview Card (inside editor) ────────────────────────────────────────

function LivePreviewCard({
  controlType, title, subtitle, message, showExceptionLine, showDetails,
}: {
  controlType:        ControlType
  title:              string
  subtitle:           string
  message:            string
  showExceptionLine:  boolean
  showDetails:        boolean
}) {
  const meta = CONTROL_TYPE_META[controlType] ?? CONTROL_TYPE_META.coach_acknowledge
  const showJustify = controlType === 'coach_justification'

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3 text-left">
      {title && <p className="text-sm font-bold text-foreground leading-snug">{sub(title)}</p>}
      {subtitle && <p className="text-xs text-muted-foreground/70">{sub(subtitle)}</p>}
      {message && <p className="text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-wrap">{sub(message)}</p>}
      {showExceptionLine && (
        <p className="text-xs text-blue-400/80 leading-relaxed">{sub(EXCEPTION_LINE)}</p>
      )}
      {showDetails && (
        <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 space-y-0.5">
          {DETAILS_FIELDS.slice(0, 4).map(([label, token]) => (
            <div key={label} className="flex gap-2 text-[10px]">
              <span className="text-muted-foreground/50 w-20 shrink-0">{label}:</span>
              <span className="text-muted-foreground/70">{MOCK[token] ?? token}</span>
            </div>
          ))}
          <div className="text-[10px] text-muted-foreground/30">…</div>
        </div>
      )}
      {showJustify && (
        <div className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
          <p className="text-[10px] text-muted-foreground/40 italic">Justification input shown here</p>
        </div>
      )}
      {meta.buttons.length > 0 && (
        <div className="flex justify-end gap-2 pt-1">
          {meta.buttons.length > 1 && (
            <button className="px-3 py-1.5 text-xs rounded-lg bg-muted/40 text-muted-foreground/70 border border-border cursor-default">
              {meta.buttons[0]}
            </button>
          )}
          <button className="px-3 py-1.5 text-xs rounded-lg bg-primary/10 text-primary border border-primary/20 cursor-default">
            {meta.buttons[meta.buttons.length - 1]}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
  n,
  onSaved,
  onClose,
}: {
  n:       CoachingNotification | null  // null = new template
  onSaved: (updated: CoachingNotification) => void
  onClose: () => void
}) {
  const isNew = n === null

  const [name,              setName]              = useState(n?.name        ?? '')
  const [description,       setDescription]       = useState(n?.description ?? '')
  const [controlType,       setControlType]       = useState<ControlType>(n?.control_type ?? 'coach_acknowledge')
  const [title,             setTitle]             = useState(n?.title       ?? '')
  const [subtitle,          setSubtitle]          = useState(n?.subtitle    ?? '')
  const [message,           setMessage]           = useState(n?.message     ?? '')
  const [showExceptionLine, setShowExceptionLine] = useState(n?.show_exception_line ?? true)
  const [showDetails,       setShowDetails]       = useState(n?.show_details        ?? false)
  const [recommendedFor,    setRecommendedFor]    = useState<string[]>(n?.recommended_for ?? [])
  const [tagInput,          setTagInput]          = useState('')
  const [saving,            setSaving]            = useState(false)
  const [error,             setError]             = useState<string | null>(null)
  const msgRef = useRef<HTMLTextAreaElement>(null)

  // AI assistant state
  const [rightTab,       setRightTab]       = useState<'preview' | 'tokens' | 'ai'>('preview')
  const [aiAction,       setAiAction]       = useState('rewrite_existing')
  const [aiTone,         setAiTone]         = useState('professional')
  const [aiLength,       setAiLength]       = useState('medium')
  const [aiInstruction,  setAiInstruction]  = useState('')
  const [aiLoading,      setAiLoading]      = useState(false)
  const [aiError,        setAiError]        = useState<string | null>(null)
  const [aiSuggestion,   setAiSuggestion]   = useState<AiSuggestion | null>(null)
  const [aiApplyFields,  setAiApplyFields]  = useState<AiApplyFields>(DEFAULT_APPLY_FIELDS)

  function insertToken(token: string) {
    const el = msgRef.current
    if (!el) { setMessage(m => m + token); return }
    const s = el.selectionStart ?? message.length
    const e = el.selectionEnd   ?? message.length
    const next = message.slice(0, s) + token + message.slice(e)
    setMessage(next)
    setTimeout(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length) }, 0)
  }

  function addTag(raw: string) {
    const trimmed = raw.trim().replace(/,$/, '').trim()
    if (!trimmed || recommendedFor.includes(trimmed)) return
    setRecommendedFor(prev => [...prev, trimmed])
  }

  function removeTag(tag: string) {
    setRecommendedFor(prev => prev.filter(t => t !== tag))
  }

  async function generateSuggestion() {
    setAiLoading(true)
    setAiError(null)
    setAiSuggestion(null)
    try {
      const res = await fetch('/api/coaching-ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:           aiAction,
          tone:             aiTone,
          length:           aiLength,
          user_instruction: aiInstruction,
          current_template: {
            name:                name.trim(),
            description:         description.trim() || null,
            control_type:        controlType,
            title:               title.trim(),
            subtitle:            subtitle.trim() || null,
            message:             message.trim(),
            show_exception_line: showExceptionLine,
            show_details:        showDetails,
            recommended_for:     recommendedFor,
          },
        }),
      })
      if (!res.ok) {
        try {
          const json = await res.json() as { error?: string }
          setAiError(json.error || 'Failed to generate suggestion')
        } catch {
          setAiError('Failed to generate suggestion')
        }
        return
      }
      const json = await res.json() as { data: AiSuggestion }
      setAiSuggestion(json.data)
      setAiApplyFields(DEFAULT_APPLY_FIELDS)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setAiLoading(false)
    }
  }

  function applyAiSuggestion() {
    if (!aiSuggestion) return
    if (aiApplyFields.name)            setName(aiSuggestion.name)
    if (aiApplyFields.description)     setDescription(aiSuggestion.description)
    if (aiApplyFields.title)           setTitle(aiSuggestion.title)
    if (aiApplyFields.subtitle)        setSubtitle(aiSuggestion.subtitle)
    if (aiApplyFields.message)         setMessage(aiSuggestion.message)
    if (aiApplyFields.recommended_for) setRecommendedFor(aiSuggestion.recommended_for)
    if (aiApplyFields.control_type && aiSuggestion.control_type) {
      setControlType(aiSuggestion.control_type)
    }
    setAiSuggestion(null)
    setRightTab('preview')
  }

  async function save() {
    if (!name.trim() || !title.trim() || !message.trim()) {
      setError('Name, title and message are required.')
      return
    }
    setError(null)
    setSaving(true)

    const fields = {
      name:                name.trim(),
      description:         description.trim() || null,
      control_type:        controlType,
      title:               title.trim(),
      subtitle:            subtitle.trim() || null,
      message:             message.trim(),
      show_exception_line: showExceptionLine,
      show_details:        showDetails,
      recommended_for:     recommendedFor,
      is_default:          n?.is_default ?? false,
      is_active:           n?.is_active  ?? true,
      coach_label:         n?.coach_label ?? null,
      template_key:        n?.template_key ?? null,
      linked_policy_id:    n?.linked_policy_id ?? null,
    }

    const { error: err } = await upsertNotification(n?.id ?? null, fields)
    setSaving(false)
    if (err) { setError(err); return }

    onSaved({
      ...(n ?? {
        id: crypto.randomUUID(), org_id: '',
        tokens_used: [], tone: 'informational',
        linked_policy_id: null, coach_label: null, template_key: null,
        action_code: 'coach', created_at: new Date().toISOString(),
      }),
      ...fields,
      tokens_used:  [],   // server computes this; local state doesn't need it
      updated_at:   new Date().toISOString(),
    } as CoachingNotification)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <p className="text-sm font-semibold text-foreground">
            {isNew ? 'New Template' : 'Edit Template'}
          </p>
          <button onClick={onClose} className="text-muted-foreground/40 hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">

            {/* ── Left: form fields ── */}
            <div className="p-6 space-y-4">
              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}

              {/* Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Template Name *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Credential Sharing Blocked"
                  className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Description <span className="normal-case text-muted-foreground/40">(admin-facing)</span></label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Short description of when this template is used"
                  className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Control Type */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Control Type *</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {CONTROL_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setControlType(opt.value)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors',
                        controlType === opt.value
                          ? 'border-blue-500/40 bg-blue-500/8'
                          : 'border-border bg-muted/20 hover:bg-muted/40',
                      )}
                    >
                      <div>
                        <span className={cn('text-xs font-semibold', controlType === opt.value ? 'text-blue-400' : 'text-foreground/80')}>{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground/50 ml-2">{opt.description}</span>
                      </div>
                      <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                        CONTROL_TYPE_META[opt.value].cls,
                      )}>
                        {CONTROL_TYPE_META[opt.value].buttons.join(' / ') || '—'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Title *</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Shown as the heading of the coaching message"
                  className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Subtitle */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Subtitle <span className="normal-case text-muted-foreground/40">(optional)</span></label>
                <input
                  value={subtitle}
                  onChange={e => setSubtitle(e.target.value)}
                  placeholder="Short supporting line below the title"
                  className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Message */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Message *</label>
                <textarea
                  ref={msgRef}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={6}
                  placeholder="Main coaching message body. Do not include the exception request line here — use the toggle below."
                  className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Options</p>
                <button
                  type="button"
                  onClick={() => setShowExceptionLine(v => !v)}
                  className="flex items-center gap-3 cursor-pointer w-full text-left"
                >
                  <span className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                    showExceptionLine ? 'bg-blue-500' : 'bg-muted-foreground/20',
                  )}>
                    <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', showExceptionLine ? 'translate-x-4' : 'translate-x-0.5')} />
                  </span>
                  <span className="text-xs text-foreground/70">Show exception request line</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDetails(v => !v)}
                  className="flex items-center gap-3 cursor-pointer w-full text-left"
                >
                  <span className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                    showDetails ? 'bg-blue-500' : 'bg-muted-foreground/20',
                  )}>
                    <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', showDetails ? 'translate-x-4' : 'translate-x-0.5')} />
                  </span>
                  <span className="text-xs text-foreground/70">Show event details block</span>
                </button>
              </div>

              {/* Recommended For */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Recommended For <span className="normal-case text-muted-foreground/40">(tags)</span></label>
                {recommendedFor.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {recommendedFor.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-muted/30 text-xs text-foreground/70">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="opacity-50 hover:opacity-100 transition-opacity">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault()
                        addTag(tagInput)
                        setTagInput('')
                      }
                    }}
                    placeholder="Add scenario (e.g. PII, Source code)…"
                    className="flex-1 text-xs border border-border rounded-lg bg-background/60 px-3 py-1.5 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    disabled={!tagInput.trim()}
                    onClick={() => { addTag(tagInput); setTagInput('') }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 disabled:opacity-30 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* ── Right: tabbed panel ── */}
            <div className="p-6 flex flex-col gap-4 lg:overflow-y-auto">
              {/* Tab switcher */}
              <div className="flex gap-0.5 bg-muted/20 border border-border/50 rounded-lg p-0.5">
                {(['preview', 'tokens', 'ai'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRightTab(tab)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors',
                      rightTab === tab
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground/50 hover:text-muted-foreground',
                    )}
                  >
                    {tab === 'ai' && <Sparkles className="h-3 w-3" />}
                    {tab === 'preview' ? 'Live Preview' : tab === 'tokens' ? 'Tokens' : 'AI Assistant'}
                  </button>
                ))}
              </div>

              {/* Live Preview tab */}
              {rightTab === 'preview' && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground/40">Updates as you type. Uses sample values for tokens.</p>
                  <LivePreviewCard
                    controlType={controlType}
                    title={title}
                    subtitle={subtitle}
                    message={message}
                    showExceptionLine={showExceptionLine}
                    showDetails={showDetails}
                  />
                </div>
              )}

              {/* Tokens tab */}
              {rightTab === 'tokens' && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground/40">Click a token to insert it at the cursor in the Message field.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TOKENS.map(token => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => insertToken(token)}
                        className="text-[10px] px-2 py-1 rounded border border-border/60 bg-muted/20 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 hover:border-border transition-colors font-mono"
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Assistant tab */}
              {rightTab === 'ai' && (
                <div className="space-y-4">
                  {/* Action */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Action</label>
                    <select
                      value={aiAction}
                      onChange={e => setAiAction(e.target.value)}
                      className="w-full text-xs border border-border rounded-lg bg-background/60 px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {AI_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>

                  {/* Tone + Length */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Tone</label>
                      <select
                        value={aiTone}
                        onChange={e => setAiTone(e.target.value)}
                        className="w-full text-xs border border-border rounded-lg bg-background/60 px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {AI_TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Length</label>
                      <select
                        value={aiLength}
                        onChange={e => setAiLength(e.target.value)}
                        className="w-full text-xs border border-border rounded-lg bg-background/60 px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {AI_LENGTHS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Instruction */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Optional instruction</label>
                    <textarea
                      value={aiInstruction}
                      onChange={e => setAiInstruction(e.target.value)}
                      rows={2}
                      placeholder="e.g. 'make it shorter for financial services users'"
                      className="w-full text-xs border border-border rounded-lg bg-background/60 px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  </div>

                  {/* Generate */}
                  <button
                    type="button"
                    onClick={generateSuggestion}
                    disabled={aiLoading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {aiLoading ? 'Generating…' : 'Generate Suggestion'}
                  </button>

                  {/* Error */}
                  {aiError && (
                    <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                      {aiError}
                    </div>
                  )}

                  {/* Suggestion */}
                  {aiSuggestion && (
                    <div className="space-y-3 border-t border-border/50 pt-3">
                      {/* Warnings */}
                      {aiSuggestion.warnings.length > 0 && (
                        <div className="flex items-start gap-2 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                          <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
                          <span>Unsupported tokens were removed after retry: {aiSuggestion.warnings.join(', ')}</span>
                        </div>
                      )}

                      {/* Split view */}
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="space-y-1.5">
                          <p className="font-semibold text-muted-foreground/40 uppercase tracking-wider">Current</p>
                          <div>
                            <span className="text-muted-foreground/40">Title: </span>
                            <span className="text-muted-foreground/60">{title || '—'}</span>
                          </div>
                          {(subtitle || aiSuggestion.subtitle) && (
                            <div>
                              <span className="text-muted-foreground/40">Subtitle: </span>
                              <span className="text-muted-foreground/60 line-clamp-2">{subtitle || '—'}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground/40">Message: </span>
                            <span className="text-muted-foreground/60 line-clamp-3">{message || '—'}</span>
                          </div>
                          {recommendedFor.length > 0 && (
                            <div>
                              <span className="text-muted-foreground/40">For: </span>
                              <span className="text-muted-foreground/60">{recommendedFor.join(', ')}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <p className="font-semibold text-blue-400/70 uppercase tracking-wider">AI Suggestion</p>
                          <div>
                            <span className="text-muted-foreground/40">Title: </span>
                            <span className="text-foreground/80">{aiSuggestion.title || '—'}</span>
                          </div>
                          {(subtitle || aiSuggestion.subtitle) && (
                            <div>
                              <span className="text-muted-foreground/40">Subtitle: </span>
                              <span className="text-foreground/80 line-clamp-2">{aiSuggestion.subtitle || '—'}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground/40">Message: </span>
                            <span className="text-foreground/80 line-clamp-3">{aiSuggestion.message || '—'}</span>
                          </div>
                          {aiSuggestion.recommended_for.length > 0 && (
                            <div>
                              <span className="text-muted-foreground/40">For: </span>
                              <span className="text-foreground/80">{aiSuggestion.recommended_for.join(', ')}</span>
                            </div>
                          )}
                          {aiSuggestion.control_type && (
                            <div>
                              <span className="text-muted-foreground/40">Control: </span>
                              <span className="text-foreground/80">{CONTROL_TYPE_META[aiSuggestion.control_type]?.label ?? aiSuggestion.control_type}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Apply field checkboxes */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Apply</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                          {(Object.keys(DEFAULT_APPLY_FIELDS) as (keyof AiApplyFields)[])
                            .filter(k => k !== 'control_type' || !!aiSuggestion.control_type)
                            .map(k => (
                              <label key={k} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={aiApplyFields[k]}
                                  onChange={e => setAiApplyFields(prev => ({ ...prev, [k]: e.target.checked }))}
                                  className="w-3 h-3 rounded border-border accent-blue-500"
                                />
                                {k === 'recommended_for' ? 'Scenarios'
                                  : k === 'control_type' ? `Control → ${CONTROL_TYPE_META[aiSuggestion.control_type!]?.label ?? aiSuggestion.control_type}`
                                  : k.charAt(0).toUpperCase() + k.slice(1)}
                              </label>
                            ))
                          }
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={applyAiSuggestion}
                          className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-400 transition-colors"
                        >
                          Apply Selected
                        </button>
                        <button
                          type="button"
                          onClick={generateSuggestion}
                          disabled={aiLoading}
                          className="px-3 py-1.5 text-xs rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 disabled:opacity-50 transition-colors"
                        >
                          Regenerate
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiSuggestion(null)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 transition-colors"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Helper text */}
                  <p className="text-[10px] text-muted-foreground/30 leading-relaxed">
                    AI suggestions are not saved automatically. Review the output, click Apply Selected, then save the template.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 text-xs rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="px-4 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : isNew ? 'Add Template' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ─────────────────────────────────────────────────────────────

function DeleteConfirmModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Delete template?</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">&ldquo;{name}&rdquo; will be permanently removed.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-1.5 text-xs rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-400 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Table Row ─────────────────────────────────────────────────────────────────

function TemplateRow({
  notification,
  onEdit,
  onDeleted,
  onDuplicated,
}: {
  notification: CoachingNotification
  onEdit:       (n: CoachingNotification) => void
  onDeleted:    (id: string) => void
  onDuplicated: () => void
}) {
  // Only own UI flags + an active override for optimistic toggle.
  // All notification data comes from props so edits in the parent are reflected immediately.
  const [activeOverride, setActiveOverride] = useState<boolean | null>(null)
  const [previewing,     setPreviewing]     = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [, startTransition]                = useTransition()

  const isActive = activeOverride ?? notification.is_active
  const meta = CONTROL_TYPE_META[notification.control_type] ?? CONTROL_TYPE_META.coach_acknowledge

  function handleToggleActive() {
    const next = !isActive
    setActiveOverride(next)
    startTransition(() => {
      toggleNotificationActive(notification.id, next).then(res => {
        if (res.error) setActiveOverride(null)  // revert on failure
      })
    })
  }

  function handleDuplicate() {
    duplicateNotification(notification.id).then(() => onDuplicated())
  }

  function handleDelete() {
    setConfirmDelete(false)
    onDeleted(notification.id)
    startTransition(() => { deleteNotification(notification.id) })
  }

  return (
    <>
      <tr className={cn('border-b border-border/30 last:border-0 transition-colors hover:bg-muted/10', !isActive && 'opacity-60')}>
        {/* Preview */}
        <td className="w-10 px-3 py-3.5 text-center">
          <button
            onClick={() => setPreviewing(true)}
            className="text-muted-foreground/40 hover:text-foreground transition-colors"
            title="Preview"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </td>

        {/* Name + description */}
        <td className="px-4 py-3.5 min-w-[180px]">
          <p className="text-xs font-semibold text-foreground leading-snug">{notification.name}</p>
          {notification.description && (
            <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-snug line-clamp-1">{notification.description}</p>
          )}
        </td>

        {/* Control type */}
        <td className="px-4 py-3.5 whitespace-nowrap">
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border', meta.cls)}>
            {meta.label}
          </span>
        </td>

        {/* Recommended for */}
        <td className="px-4 py-3.5 max-w-[180px]">
          {notification.recommended_for.length === 0 ? (
            <span className="text-[10px] text-muted-foreground/30">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {notification.recommended_for.slice(0, 2).map(tag => (
                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded border border-border/50 bg-muted/30 text-muted-foreground/60 whitespace-nowrap">
                  {tag}
                </span>
              ))}
              {notification.recommended_for.length > 2 && (
                <span className="text-[9px] text-muted-foreground/40 self-center">+{notification.recommended_for.length - 2}</span>
              )}
            </div>
          )}
        </td>

        {/* Buttons */}
        <td className="px-4 py-3.5 whitespace-nowrap">
          {meta.buttons.length === 0 ? (
            <span className="text-[10px] text-muted-foreground/30">—</span>
          ) : (
            <div className="flex gap-1">
              {meta.buttons.map(b => (
                <span key={b} className="text-[10px] px-1.5 py-0.5 rounded border border-border/50 bg-muted/20 text-muted-foreground/60">
                  {b}
                </span>
              ))}
            </div>
          )}
        </td>

        {/* Status */}
        <td className="px-4 py-3.5 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-emerald-400' : 'bg-muted-foreground/30')} />
            <span className="text-[10px] text-muted-foreground/60">{isActive ? 'Active' : 'Disabled'}</span>
          </div>
        </td>

        {/* Last updated */}
        <td className="px-4 py-3.5 whitespace-nowrap text-[10px] text-muted-foreground/40">
          {formatDate(notification.updated_at || notification.created_at)}
        </td>

        {/* Actions */}
        <td className="px-3 py-3.5">
          <div className="flex items-center gap-2.5 justify-end">
            <button
              onClick={() => onEdit(notification)}
              className="text-muted-foreground/40 hover:text-foreground transition-colors"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleDuplicate}
              className="text-muted-foreground/40 hover:text-foreground transition-colors"
              title="Duplicate"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleToggleActive}
              className={cn('transition-colors', isActive ? 'text-muted-foreground/40 hover:text-amber-400' : 'text-muted-foreground/40 hover:text-emerald-400')}
              title={isActive ? 'Disable' : 'Enable'}
            >
              {isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-muted-foreground/40 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {previewing && <PreviewModal n={notification} onClose={() => setPreviewing(false)} />}
      {confirmDelete && (
        <DeleteConfirmModal
          name={notification.name}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

type EditState =
  | { mode: 'closed' }
  | { mode: 'new' }
  | { mode: 'edit'; n: CoachingNotification }

export function NotificationList({ notifications: initial }: { notifications: CoachingNotification[] }) {
  const router                                          = useRouter()
  const [items,       setItems]       = useState(initial)
  const [editState,   setEditState]   = useState<EditState>({ mode: 'closed' })
  const [search,      setSearch]      = useState('')
  const [ctFilter,    setCtFilter]    = useState<ControlType | ''>('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'disabled' | ''>('')
  const [ctOpen,      setCtOpen]      = useState(false)
  const [stOpen,      setStOpen]      = useState(false)

  const closeAll = useCallback(() => { setCtOpen(false); setStOpen(false) }, [])

  const editingNotification: CoachingNotification | null =
    editState.mode === 'edit' ? editState.n : null

  const visible = items.filter(n => {
    if (search && !n.name.toLowerCase().includes(search.toLowerCase()) &&
        !n.description?.toLowerCase().includes(search.toLowerCase())) return false
    if (ctFilter && n.control_type !== ctFilter) return false
    if (statusFilter === 'active'   && !n.is_active) return false
    if (statusFilter === 'disabled' &&  n.is_active) return false
    return true
  })

  function handleSaved(updated: CoachingNotification) {
    setItems(prev => {
      const idx = prev.findIndex(n => n.id === updated.id)
      return idx >= 0 ? prev.map((n, i) => i === idx ? updated : n) : [...prev, updated]
    })
    setEditState({ mode: 'closed' })
  }

  function handleDeleted(id: string) {
    setItems(prev => prev.filter(n => n.id !== id))
  }

  function handleDuplicated() {
    router.refresh()
  }

  function handleExport() {
    const header = ['Name', 'Description', 'Control Type', 'Title', 'Message', 'Status']
    const rows = items.map(n => [
      n.name,
      n.description ?? '',
      CONTROL_TYPE_META[n.control_type]?.label ?? n.control_type,
      n.title,
      n.message,
      n.is_active ? 'Active' : 'Disabled',
    ])
    const csv = [header, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'coaching-templates.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const activeCount   = items.filter(n =>  n.is_active).length
  const disabledCount = items.filter(n => !n.is_active).length

  return (
    <div className="space-y-4" onClick={closeAll}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="bg-card text-xs text-foreground placeholder:text-muted-foreground/30 border border-border/60 rounded-md pl-8 pr-3 py-1.5 w-52 focus:outline-none focus:border-border transition-colors"
          />
        </div>

        {/* Control Type filter */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => { setCtOpen(o => !o); setStOpen(false) }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors',
              ctFilter ? 'border-blue-500/40 bg-blue-500/8 text-blue-400' : 'border-border/60 bg-card text-muted-foreground hover:bg-muted/40',
            )}
          >
            {ctFilter ? CONTROL_TYPE_META[ctFilter].label : 'Control Type'}
            <ChevronDown className="w-3 h-3" />
          </button>
          {ctOpen && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
              <button onClick={() => { setCtFilter(''); setCtOpen(false) }} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground/60 hover:bg-muted/40">All types</button>
              {(Object.keys(CONTROL_TYPE_META) as ControlType[]).map(ct => (
                <button key={ct} onClick={() => { setCtFilter(ct); setCtOpen(false) }} className="w-full text-left px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted/40">
                  {CONTROL_TYPE_META[ct].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status filter */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => { setStOpen(o => !o); setCtOpen(false) }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors',
              statusFilter ? 'border-blue-500/40 bg-blue-500/8 text-blue-400' : 'border-border/60 bg-card text-muted-foreground hover:bg-muted/40',
            )}
          >
            {statusFilter ? (statusFilter === 'active' ? `Active (${activeCount})` : `Disabled (${disabledCount})`) : 'Status'}
            <ChevronDown className="w-3 h-3" />
          </button>
          {stOpen && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
              <button onClick={() => { setStatusFilter(''); setStOpen(false) }} className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground/60 hover:bg-muted/40">All</button>
              <button onClick={() => { setStatusFilter('active'); setStOpen(false) }} className="w-full text-left px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted/40">Active ({activeCount})</button>
              <button onClick={() => { setStatusFilter('disabled'); setStOpen(false) }} className="w-full text-left px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted/40">Disabled ({disabledCount})</button>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={() => setEditState({ mode: 'new' })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Template
        </button>
        <button
          onClick={handleExport}
          disabled={items.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-card hover:bg-muted/40 transition-colors text-muted-foreground disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center mb-4 shadow-sm">
              <Eye className="w-6 h-6 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-semibold text-foreground/70 mb-1">No templates found</p>
            <p className="text-xs text-muted-foreground/50 mb-6 max-w-xs">
              {items.length === 0 ? 'Create your first coaching message template.' : 'Try adjusting your search or filter.'}
            </p>
            {items.length === 0 && (
              <button
                onClick={() => setEditState({ mode: 'new' })}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90"
              >
                <Plus className="w-3.5 h-3.5" />
                New Template
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-card/80">
                  <th className="w-10 px-3 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide text-center">View</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide text-left">Template Name</th>
                  <th className="w-36 px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide text-left">Control Type</th>
                  <th className="w-52 px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide text-left">Recommended For</th>
                  <th className="w-28 px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide text-left">Buttons</th>
                  <th className="w-24 px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide text-left">Status</th>
                  <th className="w-28 px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide text-left">Last Updated</th>
                  <th className="w-24 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visible.map(n => (
                  <TemplateRow
                    key={n.id}
                    notification={n}
                    onEdit={updated => setEditState({ mode: 'edit', n: updated })}
                    onDeleted={handleDeleted}
                    onDuplicated={handleDuplicated}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / new modal */}
      {editState.mode !== 'closed' && (
        <EditModal
          n={editingNotification}
          onSaved={handleSaved}
          onClose={() => setEditState({ mode: 'closed' })}
        />
      )}
    </div>
  )
}
