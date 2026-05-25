'use client'

import { useState, useRef } from 'react'
import { upsertNotification } from '../actions'
import type { CoachingNotification } from '@/lib/genai/types'

const NS_VARIABLES = [
  '{{NS_APP}}',
  '{{NS_USER}}',
  '{{NS_POLICY_NAME}}',
  '{{NS_ACTIVITY}}',
  '{{NS_HOST}}',
  '{{NS_URL}}',
  '{{NS_CATEGORY}}',
  '{{NS_FILENAME}}',
]

function TemplateEditor({
  index,
  notification,
}: {
  index:        number
  notification: CoachingNotification
}) {
  const [title,   setTitle]   = useState(notification.title)
  const [message, setMessage] = useState(notification.message)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const msgRef = useRef<HTMLTextAreaElement>(null)

  const dirty = title !== notification.title || message !== notification.message

  function insertVariable(v: string) {
    const el = msgRef.current
    if (!el) { setMessage(m => m + v); return }
    const start = el.selectionStart ?? message.length
    const end   = el.selectionEnd   ?? message.length
    const next  = message.slice(0, start) + v + message.slice(end)
    setMessage(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + v.length, start + v.length)
    }, 0)
  }

  async function handleSave() {
    if (!title.trim() || !message.trim()) { setError('Title and message cannot be empty.'); return }
    setError(null)
    setSaving(true)
    const { error: err } = await upsertNotification(notification.id || null, {
      name:             notification.name,
      action_code:      notification.action_code,
      tone:             notification.tone,
      title,
      message,
      linked_policy_id: notification.linked_policy_id,
      is_default:       notification.is_default,
      is_active:        notification.is_active,
    })
    setSaving(false)
    if (err) { setError(err); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted/30 border border-border/50 flex items-center justify-center text-[11px] font-semibold text-muted-foreground/60">
          {index}
        </span>
        <p className="text-sm font-semibold text-foreground">{notification.name}</p>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Title</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Message</label>
        <textarea
          ref={msgRef}
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={4}
          className="w-full text-sm border border-border rounded-lg bg-background/60 px-3 py-2 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
        />
        {/* NS variable chips */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <span className="text-[10px] text-muted-foreground/40 self-center mr-1">Insert:</span>
          {NS_VARIABLES.map(v => (
            <button
              key={v}
              onClick={() => insertVariable(v)}
              className="text-[10px] px-2 py-0.5 rounded border border-border/60 bg-muted/20 text-muted-foreground/60 hover:text-foreground hover:border-border hover:bg-muted/40 transition-colors font-mono"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className={`px-4 py-1.5 text-xs rounded-lg font-medium transition-colors ${
            saved
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
              : dirty
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted/30 text-muted-foreground/40 border border-border cursor-default'
          } disabled:cursor-default`}
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export function NotificationList({
  notifications,
}: {
  notifications: CoachingNotification[]
}) {
  return (
    <div className="space-y-4">
      {/* Template editors */}
      {notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 py-16 text-center">
          <p className="text-sm text-muted-foreground/50">No templates yet — reload the page to generate defaults.</p>
        </div>
      ) : (
        notifications.map((n, i) => (
          <TemplateEditor key={n.id} index={i + 1} notification={n} />
        ))
      )}

      {/* Bottom guidance callout */}
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
