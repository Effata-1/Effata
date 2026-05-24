'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COLOR_OPTIONS } from '@/lib/data-catalog/types'
import { upsertGenAICategory } from '../actions'
import type { GenAIGovernanceCategory } from '../actions'

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {COLOR_OPTIONS.map(c => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          className={cn('w-5 h-5 rounded-full transition-all', c.class, value === c.value ? 'ring-2 ring-offset-2 ring-offset-card ring-white scale-110' : 'opacity-60 hover:opacity-100')}
          title={c.label}
        />
      ))}
    </div>
  )
}

interface Props {
  category: GenAIGovernanceCategory | null
  categories: GenAIGovernanceCategory[]
  onClose: () => void
}

export function EditCategoryModal({ category, categories, onClose }: Props) {
  const isNew = !category
  const [form, setForm] = useState({
    name:        category?.name ?? '',
    color:       category?.color ?? 'blue',
    priority:    category?.priority ?? (categories.length + 1),
    description: category?.description ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    startTransition(async () => {
      const result = await upsertGenAICategory(category?.id ?? null, { ...form, name: form.name.trim() })
      if (result.error) { setError(result.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-foreground">
            {isNew ? 'Add governance category' : 'Edit category'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Approved & Supported GenAI"
              className="w-full bg-muted border border-border-strong rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Color</label>
            <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="What GenAI apps belong in this category?"
              className="w-full bg-muted border border-border-strong rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Priority (1 = most trusted)</label>
            <input
              type="number"
              min={1}
              max={99}
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
              className="w-24 bg-muted border border-border-strong rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-blue-500"
            />
          </div>
          {category?.is_system && (
            <p className="text-xs text-muted-foreground/60 bg-muted/60 rounded-lg px-3 py-2">
              This is a system default — renaming updates your organisation&apos;s display name only. Existing app assignments are not affected.
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground/70">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {isPending ? 'Saving…' : isNew ? 'Add category' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
