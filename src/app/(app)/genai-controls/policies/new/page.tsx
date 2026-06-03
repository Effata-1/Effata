'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { createBlankPolicy } from './actions'

export default function NewPolicyPage() {
  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [error, setError]       = useState('')
  const [isPending, startTx]    = useTransition()
  const router                  = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Policy name is required.'); return }
    setError('')
    startTx(async () => {
      const result = await createBlankPolicy(name.trim(), desc.trim() || undefined)
      if (result.error) { setError(result.error); return }
      if (result.id) router.push(`/genai-controls/policies/${result.id}/edit`)
    })
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href="/genai-controls/policies"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors mb-3"
        >
          <ChevronLeft className="h-3 w-3" /> Policy Library
        </Link>
        <h1 className="text-xl font-bold text-foreground">New Blank Policy</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Creates an empty policy in the intent editor. Fill in detection, enforcement, and scope after creation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Policy Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Block Finance Users – PCI Data Upload to GenAI"
            autoFocus
            className="block w-full rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Description <span className="text-muted-foreground/40">(optional)</span>
          </label>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={2}
            placeholder="What does this policy enforce and why?"
            className="block w-full rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex items-center justify-end gap-3 pt-1">
          <Link
            href="/genai-controls/policies"
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground/70 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Policy
          </button>
        </div>
      </form>
    </div>
  )
}
