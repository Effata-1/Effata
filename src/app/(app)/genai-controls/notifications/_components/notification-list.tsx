'use client'

import { useState, useTransition, useRef } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { FilterSelect } from '@/components/ui/filter-select'
import {
  upsertNotification,
  deleteNotification,
  toggleNotificationActive,
  type NotificationFields,
} from '../actions'
import type { CoachingNotification, CoachingTone } from '@/lib/genai/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const TONE_STYLES: Record<CoachingTone, { badge: string; border: string; icon: string; preview: string }> = {
  informational: {
    badge:   'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    border:  'border-blue-500/30',
    icon:    '💡',
    preview: 'border-blue-500/30 bg-blue-500/5',
  },
  warning: {
    badge:   'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    border:  'border-amber-500/30',
    icon:    '⚠️',
    preview: 'border-amber-500/30 bg-amber-500/5',
  },
  urgent: {
    badge:   'bg-red-500/10 text-red-400 border border-red-500/20',
    border:  'border-red-500/30',
    icon:    '🚫',
    preview: 'border-red-500/30 bg-red-500/5',
  },
}

const ACTION_STYLES: Record<string, string> = {
  'coach':      'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  'coach-ack':  'bg-orange-500/15 text-orange-300 border border-orange-500/30',
  'coach-just': 'bg-amber-600/15 text-amber-300 border border-amber-600/25',
}

const ACTION_LABELS: Record<string, string> = {
  'coach':      'Coach',
  'coach-ack':  'Coach + Ack',
  'coach-just': 'Coach + Justify',
}

const TONE_LABELS: Record<CoachingTone, string> = {
  informational: 'Informational',
  warning:       'Warning',
  urgent:        'Urgent',
}

const VARIABLES = ['{{app_name}}', '{{policy_name}}', '{{data_type}}', '{{user_name}}']

const MOCK_VALUES: Record<string, string> = {
  '{{app_name}}':    'ChatGPT',
  '{{policy_name}}': 'Restricted GenAI Policy',
  '{{data_type}}':   'Confidential',
  '{{user_name}}':   'Alex',
}

function substituteMock(text: string): string {
  return VARIABLES.reduce((t, v) => t.replaceAll(v, MOCK_VALUES[v]), text)
}

function extractVariables(title: string, message: string): string[] {
  return VARIABLES.filter(v => title.includes(v) || message.includes(v))
}

// ─── Empty state ──────────────────────────────────────────────────────────────

const EMPTY: CoachingNotification = {
  id: '', org_id: '', name: '', action_code: 'coach', title: '', message: '',
  tone: 'informational', linked_policy_id: null, is_default: false, is_active: true,
  created_at: '', updated_at: '',
}

// ─── Live Preview ─────────────────────────────────────────────────────────────

function LivePreview({
  actionCode,
  tone,
  title,
  message,
}: {
  actionCode: 'coach' | 'coach-ack' | 'coach-just'
  tone: CoachingTone
  title: string
  message: string
}) {
  const ts = TONE_STYLES[tone]
  const previewTitle   = substituteMock(title   || 'Notification title will appear here')
  const previewMessage = substituteMock(message || 'Notification message will appear here.')

  return (
    <div className={`rounded-xl border p-4 ${ts.preview}`}>
      <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest mb-3">
        Live Preview
      </p>
      <div className={`rounded-lg border bg-card p-4 shadow-sm ${ts.border}`}>
        <div className="flex items-start gap-2 mb-2">
          <span className="text-base leading-none mt-0.5">{ts.icon}</span>
          <p className="text-sm font-semibold text-foreground leading-snug">{previewTitle}</p>
        </div>
        <p className="text-xs text-muted-foreground/80 leading-relaxed mb-4">{previewMessage}</p>

        {actionCode === 'coach-ack' && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground/70 mb-3 cursor-pointer">
            <input type="checkbox" className="rounded" readOnly />
            I acknowledge I have read the policy
          </label>
        )}
        {actionCode === 'coach-just' && (
          <textarea
            readOnly
            placeholder="Enter your justification…"
            className="w-full text-xs border border-border rounded-md bg-background/60 px-3 py-2 h-16 resize-none mb-3 text-muted-foreground/50"
          />
        )}

        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 text-xs rounded-md bg-muted/40 text-muted-foreground/70 border border-border cursor-default">
            Stop
          </button>
          <button className="px-3 py-1.5 text-xs rounded-md bg-primary/10 text-primary border border-primary/20 cursor-default">
            {actionCode === 'coach-ack' ? 'Acknowledge & Proceed' : actionCode === 'coach-just' ? 'Submit & Proceed' : 'Proceed'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

function NotificationModal({
  initial,
  policies,
  onClose,
  onSaved,
}: {
  initial: CoachingNotification
  policies: Array<{ id: string; name: string }>
  onClose: () => void
  onSaved: (n: CoachingNotification) => void
}) {
  const isNew = !initial.id
  const [form, setForm]     = useState<CoachingNotification>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const msgRef = useRef<HTMLTextAreaElement>(null)

  function set<K extends keyof CoachingNotification>(k: K, v: CoachingNotification[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function insertVariable(v: string) {
    const el = msgRef.current
    if (!el) {
      set('message', form.message + v)
      return
    }
    const start = el.selectionStart ?? form.message.length
    const end   = el.selectionEnd   ?? form.message.length
    const next  = form.message.slice(0, start) + v + form.message.slice(end)
    set('message', next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + v.length, start + v.length)
    }, 0)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.title.trim() || !form.message.trim()) {
      setError('Name, title and message are required.')
      return
    }
    setSaving(true)
    const { error: err } = await upsertNotification(isNew ? null : form.id, {
      name:             form.name,
      action_code:      form.action_code,
      title:            form.title,
      message:          form.message,
      tone:             form.tone,
      linked_policy_id: form.linked_policy_id,
      is_default:       form.is_default,
      is_active:        form.is_active,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onSaved(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-sm font-semibold text-foreground">
            {isNew ? 'New Coaching Template' : 'Edit Coaching Template'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground text-lg leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground/70 mb-1">Internal Name *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. ChatGPT Confidential Coach"
              className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Action Type + Tone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground/70 mb-1">Action Type</label>
              <select
                value={form.action_code}
                onChange={e => set('action_code', e.target.value as 'coach' | 'coach-ack' | 'coach-just')}
                className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="coach">Coach (proceed freely)</option>
                <option value="coach-ack">Coach + Acknowledge</option>
                <option value="coach-just">Coach + Justify</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground/70 mb-1">Tone</label>
              <select
                value={form.tone}
                onChange={e => set('tone', e.target.value as CoachingTone)}
                className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="informational">Informational</option>
                <option value="warning">Warning</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground/70 mb-1">Title *</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Heads up — {{app_name}} may not be approved for this data"
              className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground/70 mb-1">Message *</label>
            <textarea
              ref={msgRef}
              value={form.message}
              onChange={e => set('message', e.target.value)}
              rows={4}
              placeholder="Explain why this action is risky and what the user should do…"
              className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="text-[10px] text-muted-foreground/50 self-center">Insert variable:</span>
              {VARIABLES.map(v => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="text-[10px] px-2 py-0.5 rounded border border-border bg-muted/30 text-muted-foreground/60 hover:text-foreground hover:border-border/80 transition-colors font-mono"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Linked Policy */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground/70 mb-1">Linked Policy (optional)</label>
            <select
              value={form.linked_policy_id ?? ''}
              onChange={e => set('linked_policy_id', e.target.value || null)}
              className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— None —</option>
              {policies.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Live Preview */}
          <LivePreview
            actionCode={form.action_code}
            tone={form.tone}
            title={form.title}
            message={form.message}
          />
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex justify-end gap-2 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : isNew ? 'Create Template' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function NotificationRow({
  index,
  notification,
  onEdit,
  onDelete,
  onToggle,
}: {
  index:         number
  notification:  CoachingNotification
  onEdit:        () => void
  onDelete:      () => void
  onToggle:      (active: boolean) => void
}) {
  const ts = TONE_STYLES[notification.tone]

  return (
    <div className={`flex items-start gap-4 px-5 py-4 border-b border-border/30 last:border-0 transition-opacity ${notification.is_active ? '' : 'opacity-50'}`}>
      {/* Number */}
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted/30 border border-border/50 flex items-center justify-center text-[11px] font-semibold text-muted-foreground/60 mt-0.5">
        {index}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">{notification.name}</p>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ACTION_STYLES[notification.action_code]}`}>
            {ACTION_LABELS[notification.action_code]}
          </span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ts.badge}`}>
            {ts.icon} {TONE_LABELS[notification.tone]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground/60 leading-relaxed line-clamp-2">{notification.message}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-shrink-0 mt-0.5">
        <button
          onClick={() => onToggle(!notification.is_active)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${notification.is_active ? 'bg-primary' : 'bg-muted/40 border border-border'}`}
          aria-label="Toggle active"
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${notification.is_active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
        </button>
        <button onClick={onEdit} className="text-muted-foreground/40 hover:text-foreground transition-colors" aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="text-muted-foreground/40 hover:text-red-400 transition-colors" aria-label="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function NotificationList({
  notifications: initial,
  policies,
}: {
  notifications: CoachingNotification[]
  policies:      Array<{ id: string; name: string }>
}) {
  const [items, setItems]           = useState(initial)
  const [filterAction, setAction]   = useState('')
  const [filterTone, setTone]       = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [editing, setEditing]       = useState<CoachingNotification | null>(null)
  const [, startTransition]         = useTransition()

  const filtered = items.filter(n => {
    if (filterAction && n.action_code !== filterAction) return false
    if (filterTone   && n.tone        !== filterTone)   return false
    if (activeOnly   && !n.is_active)                   return false
    return true
  })

  function handleToggle(id: string, is_active: boolean) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_active } : n))
    startTransition(() => { toggleNotificationActive(id, is_active) })
  }

  function handleDelete(id: string) {
    setItems(prev => prev.filter(n => n.id !== id))
    startTransition(() => { deleteNotification(id) })
  }

  function handleSaved(saved: CoachingNotification) {
    setItems(prev => {
      const idx = prev.findIndex(n => n.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [...prev, { ...saved, id: saved.id || crypto.randomUUID() }]
    })
    setEditing(null)
  }

  const actionOptions = [
    { value: 'coach',      label: 'Coach' },
    { value: 'coach-ack',  label: 'Coach + Ack' },
    { value: 'coach-just', label: 'Coach + Justify' },
  ]

  const toneOptions = [
    { value: 'informational', label: 'Informational' },
    { value: 'warning',       label: 'Warning' },
    { value: 'urgent',        label: 'Urgent' },
  ]

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <FilterSelect
          options={actionOptions}
          value={filterAction}
          onChange={setAction}
          placeholder="All actions"
          searchable={false}
          className="w-44"
        />
        <FilterSelect
          options={toneOptions}
          value={filterTone}
          onChange={setTone}
          placeholder="All tones"
          searchable={false}
          className="w-40"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground/70 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={e => setActiveOnly(e.target.checked)}
            className="rounded"
          />
          Active only
        </label>
        <div className="ml-auto">
          <button
            onClick={() => setEditing({ ...EMPTY })}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Template
          </button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground/50">No templates match your filters.</p>
            <button
              onClick={() => setEditing({ ...EMPTY })}
              className="mt-3 text-xs text-primary hover:underline"
            >
              Create your first template
            </button>
          </div>
        ) : (
          filtered.map((n, i) => (
            <NotificationRow
              key={n.id}
              index={i + 1}
              notification={n}
              onEdit={() => setEditing(n)}
              onDelete={() => handleDelete(n.id)}
              onToggle={active => handleToggle(n.id, active)}
            />
          ))
        )}
      </div>

      {/* Bottom guidance callout */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 space-y-2">
        <p className="text-xs font-semibold text-amber-400">Your organisation should have coaching notifications defined for these scenarios</p>
        <ul className="space-y-1 text-xs text-muted-foreground/70">
          <li className="flex items-start gap-2"><span className="text-amber-500/60 mt-0.5">•</span>AI Acceptable Use Policy — shown whenever a user accesses any GenAI app</li>
          <li className="flex items-start gap-2"><span className="text-amber-500/60 mt-0.5">•</span>Confidential data upload — triggered when Confidential data is detected being sent to an AI app</li>
          <li className="flex items-start gap-2"><span className="text-amber-500/60 mt-0.5">•</span>Highly Confidential data upload — stricter message requiring written justification</li>
          <li className="flex items-start gap-2"><span className="text-amber-500/60 mt-0.5">•</span>Secrets &amp; credentials detection — most urgent; keys, tokens, certificates must never reach external AI</li>
          <li className="flex items-start gap-2"><span className="text-amber-500/60 mt-0.5">•</span>Prohibited app access — shown when a user attempts to reach a blocked or unapproved GenAI application</li>
        </ul>
        <p className="text-[11px] text-muted-foreground/40 pt-1">Without active coaching notifications, users receive no guidance when a DLP policy fires — reducing awareness and increasing repeat violations.</p>
      </div>

      {/* Modal */}
      {editing && (
        <NotificationModal
          initial={editing}
          policies={policies}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
