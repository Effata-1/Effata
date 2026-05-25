'use client'

import { useState, useRef, useTransition } from 'react'
import { Search, Pencil, Trash2, Plus, X } from 'lucide-react'
import { upsertNotification, deleteNotification } from '../actions'
import type { CoachingNotification, CoachingTone } from '@/lib/genai/types'

const NS_VARIABLES = [
  '{{NS_APP}}', '{{NS_USER}}', '{{NS_POLICY_NAME}}', '{{NS_ACTIVITY}}',
  '{{NS_HOST}}', '{{NS_URL}}', '{{NS_CATEGORY}}', '{{NS_FILENAME}}',
]

const MOCK: Record<string, string> = {
  '{{NS_APP}}':         'ChatGPT',
  '{{NS_USER}}':        'alex.smith@company.com',
  '{{NS_POLICY_NAME}}': 'GenAI Confidential Block',
  '{{NS_ACTIVITY}}':    'Upload',
  '{{NS_HOST}}':        'chat.openai.com',
  '{{NS_URL}}':         'https://chat.openai.com/upload',
  '{{NS_CATEGORY}}':    'Artificial Intelligence',
  '{{NS_FILENAME}}':    'Q3-financials.xlsx',
}

const ACTION_LABELS: Record<string, string> = {
  'coach':      'User Alert',
  'coach-ack':  'User Alert + Acknowledge',
  'coach-just': 'User Alert + Justify',
}

const TONE_ICON: Record<CoachingTone, string> = {
  informational: '💡',
  warning:       '⚠️',
  urgent:        '🚫',
}

function sub(text: string) {
  return NS_VARIABLES.reduce((t, v) => t.replaceAll(v, MOCK[v] ?? v), text)
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({ n, onClose }: { n: CoachingNotification; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Preview — {n.name}</p>
          <button onClick={onClose} className="text-muted-foreground/40 hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <div className="rounded-xl border border-border bg-background p-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">{TONE_ICON[n.tone]}</span>
              <p className="text-sm font-semibold text-foreground leading-snug">{sub(n.title)}</p>
            </div>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">{sub(n.message)}</p>
            {n.action_code === 'coach-ack' && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground/70 cursor-pointer">
                <input type="checkbox" readOnly className="rounded" />
                I acknowledge I have read the policy
              </label>
            )}
            {n.action_code === 'coach-just' && (
              <textarea
                readOnly
                placeholder="Enter your justification…"
                className="w-full text-xs border border-border rounded-lg bg-muted/20 px-3 py-2 h-16 resize-none text-muted-foreground/50"
              />
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button className="px-3 py-1.5 text-xs rounded-lg bg-muted/40 text-muted-foreground/70 border border-border cursor-default">
                Stop
              </button>
              <button className="px-3 py-1.5 text-xs rounded-lg bg-primary/10 text-primary border border-primary/20 cursor-default">
                {n.action_code === 'coach-ack' ? 'Acknowledge & Proceed' : n.action_code === 'coach-just' ? 'Submit & Proceed' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Shared edit fields ────────────────────────────────────────────────────────

function EditFields({
  title, setTitle,
  message, setMessage,
  msgRef,
}: {
  title: string; setTitle: (v: string) => void
  message: string; setMessage: (v: string) => void
  msgRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  function insertVar(v: string) {
    const el = msgRef.current
    if (!el) { setMessage(message + v); return }
    const s = el.selectionStart ?? message.length
    const e = el.selectionEnd   ?? message.length
    setMessage(message.slice(0, s) + v + message.slice(e))
    setTimeout(() => { el.focus(); el.setSelectionRange(s + v.length, s + v.length) }, 0)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Title</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Message</label>
        <textarea
          ref={msgRef}
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={4}
          className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
        />
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <span className="text-[10px] text-muted-foreground/40 self-center mr-1">Insert:</span>
          {NS_VARIABLES.map(v => (
            <button
              key={v}
              onClick={() => insertVar(v)}
              className="text-[10px] px-2 py-0.5 rounded border border-border/60 bg-muted/20 text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors font-mono"
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Edit expansion (existing template) ───────────────────────────────────────

function EditPanel({
  n,
  onSaved,
  onCancel,
}: {
  n:        CoachingNotification
  onSaved:  (updated: CoachingNotification) => void
  onCancel: () => void
}) {
  const [title,   setTitle]   = useState(n.title)
  const [message, setMessage] = useState(n.message)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const msgRef = useRef<HTMLTextAreaElement>(null)

  async function save() {
    if (!title.trim() || !message.trim()) { setError('Title and message are required.'); return }
    setError(null); setSaving(true)
    const { error: err } = await upsertNotification(n.id, {
      name: n.name, action_code: n.action_code, tone: n.tone,
      title, message, linked_policy_id: n.linked_policy_id,
      is_default: n.is_default, is_active: n.is_active,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onSaved({ ...n, title, message, updated_at: new Date().toISOString() })
  }

  return (
    <div className="px-5 py-4 bg-muted/10 border-t border-border/40 space-y-4">
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <EditFields title={title} setTitle={setTitle} message={message} setMessage={setMessage} msgRef={msgRef} />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-1.5 text-xs rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 transition-colors">Cancel</button>
        <button onClick={save} disabled={saving} className="px-4 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ─── New template panel ────────────────────────────────────────────────────────

function NewTemplatePanel({
  onSaved,
  onCancel,
}: {
  onSaved:  (n: CoachingNotification) => void
  onCancel: () => void
}) {
  const [name,    setName]    = useState('')
  const [title,   setTitle]   = useState('')
  const [message, setMessage] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const msgRef = useRef<HTMLTextAreaElement>(null)

  async function save() {
    if (!name.trim() || !title.trim() || !message.trim()) { setError('Name, title and message are required.'); return }
    setError(null); setSaving(true)
    const { error: err } = await upsertNotification(null, {
      name, action_code: 'coach', tone: 'informational',
      title, message, linked_policy_id: null, is_default: false, is_active: true,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onSaved({
      id: crypto.randomUUID(), org_id: '', name, action_code: 'coach', tone: 'informational',
      title, message, linked_policy_id: null, is_default: false, is_active: true,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
  }

  return (
    <div className="px-5 py-4 bg-muted/10 border-t border-border/40 space-y-4">
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Template Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. GenAI PCI Data Upload"
          className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <EditFields title={title} setTitle={setTitle} message={message} setMessage={setMessage} msgRef={msgRef} />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-1.5 text-xs rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 transition-colors">Cancel</button>
        <button onClick={save} disabled={saving} className="px-4 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Add Template'}
        </button>
      </div>
    </div>
  )
}

// ─── Table Row ─────────────────────────────────────────────────────────────────

function TemplateRow({
  notification: initial,
  onDelete,
}: {
  notification: CoachingNotification
  onDelete:     () => void
}) {
  const [n,          setN]          = useState(initial)
  const [expanded,   setExpanded]   = useState(false)
  const [previewing, setPreviewing] = useState(false)

  return (
    <>
      <tr className={`border-b border-border/30 last:border-0 transition-colors ${expanded ? 'bg-muted/10' : 'hover:bg-muted/20'}`}>
        <td className="w-12 px-4 py-3.5 text-center">
          <button onClick={() => setPreviewing(true)} className="text-muted-foreground/40 hover:text-foreground transition-colors" aria-label="Preview">
            <Search className="h-3.5 w-3.5" />
          </button>
        </td>
        <td className="px-4 py-3.5">
          <p className="text-sm font-semibold text-foreground">{n.name}</p>
        </td>
        <td className="px-4 py-3.5 text-xs text-muted-foreground/60 whitespace-nowrap">{ACTION_LABELS[n.action_code]}</td>
        <td className="px-4 py-3.5 text-xs text-muted-foreground/50 whitespace-nowrap">
          {formatDate(n.updated_at || n.created_at)}
        </td>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-3 justify-end">
            <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground/40 hover:text-foreground transition-colors" aria-label="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="text-muted-foreground/40 hover:text-red-400 transition-colors" aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border/30">
          <td colSpan={5} className="p-0">
            <EditPanel
              n={n}
              onSaved={updated => { setN(updated); setExpanded(false) }}
              onCancel={() => setExpanded(false)}
            />
          </td>
        </tr>
      )}
      {previewing && <PreviewModal n={n} onClose={() => setPreviewing(false)} />}
    </>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export function NotificationList({ notifications: initial }: { notifications: CoachingNotification[] }) {
  const [items,  setItems]  = useState(initial)
  const [adding, setAdding] = useState(false)
  const [, startTransition] = useTransition()

  function handleDelete(id: string) {
    setItems(prev => prev.filter(n => n.id !== id))
    startTransition(() => { deleteNotification(id) })
  }

  return (
    <div className="space-y-5">
      <div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Template
        </button>
      </div>

      <div className="rounded-xl border border-border/50 overflow-hidden">
        {/* Table header info */}
        <div className="px-4 py-3 border-b border-border/30 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground/70">User Notification Templates</p>
          <p className="text-[11px] text-muted-foreground/40 mt-0.5">{items.length} created</p>
        </div>

        {items.length === 0 && !adding ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground/50">No templates yet — reload the page to generate defaults.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border/30 bg-card/60">
                <th className="w-12 px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider text-center">Preview</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider text-left">Name</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider text-left">Type</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider text-left">Last Edit</th>
                <th className="w-20 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {items.map(n => (
                <TemplateRow key={n.id} notification={n} onDelete={() => handleDelete(n.id)} />
              ))}
              {adding && (
                <tr>
                  <td colSpan={5} className="p-0">
                    <NewTemplatePanel
                      onSaved={saved => { setItems(prev => [...prev, saved]); setAdding(false) }}
                      onCancel={() => setAdding(false)}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Guidance callout */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 space-y-2">
        <p className="text-xs font-semibold text-amber-400">Your organisation should have coaching notifications defined for these scenarios</p>
        <ul className="space-y-1 text-xs text-muted-foreground/70">
          <li className="flex items-start gap-2"><span className="text-amber-500/60 mt-0.5">•</span>AI Acceptable Use Policy — shown whenever a user accesses any GenAI app</li>
          <li className="flex items-start gap-2"><span className="text-amber-500/60 mt-0.5">•</span>Confidential data upload — triggered when Confidential data is sent to an AI app</li>
          <li className="flex items-start gap-2"><span className="text-amber-500/60 mt-0.5">•</span>Highly Confidential data upload — requires written justification from the user</li>
          <li className="flex items-start gap-2"><span className="text-amber-500/60 mt-0.5">•</span>Secrets &amp; credentials detection — keys, tokens, certificates must never reach external AI</li>
          <li className="flex items-start gap-2"><span className="text-amber-500/60 mt-0.5">•</span>Prohibited app access — shown when a user attempts to reach a blocked GenAI application</li>
        </ul>
        <p className="text-[11px] text-muted-foreground/40 pt-1">Without active coaching notifications, users receive no guidance when a DLP policy fires — reducing awareness and increasing repeat violations.</p>
      </div>
    </div>
  )
}
