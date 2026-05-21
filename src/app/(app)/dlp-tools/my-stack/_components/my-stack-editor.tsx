'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { cn } from '@/lib/utils'
import type { DLPTool } from '@/lib/onboarding/data'
import { updateMyStack } from '../actions'

interface StackState {
  tools: string[]
  modules: Record<string, string[]>
}

interface Props {
  allTools: DLPTool[]
  initialTools: string[]
  initialModules: Record<string, string[]>
  initialCoverageAreas: Record<string, string>
}

export function MyStackEditor({ allTools, initialTools, initialModules, initialCoverageAreas }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<StackState>({ tools: initialTools, modules: initialModules })
  const [isPending, startTransition] = useTransition()

  const [optimisticStack, applyOptimistic] = useOptimistic(
    { tools: initialTools, modules: initialModules } as StackState,
    (_: StackState, next: StackState) => next,
  )

  const realTools = allTools.filter(t => t.channelCoverage)
  const selectedTools = allTools.filter(t => optimisticStack.tools.includes(t.id))

  function toggleTool(id: string) {
    setDraft(prev => ({
      ...prev,
      tools: prev.tools.includes(id) ? prev.tools.filter(x => x !== id) : [...prev.tools, id],
    }))
  }

  function toggleModule(toolId: string, moduleId: string) {
    setDraft(prev => {
      const current = prev.modules[toolId] ?? []
      return {
        ...prev,
        modules: {
          ...prev.modules,
          [toolId]: current.includes(moduleId)
            ? current.filter(x => x !== moduleId)
            : [...current, moduleId],
        },
      }
    })
  }

  function handleSave() {
    const next = { ...draft }
    startTransition(async () => {
      applyOptimistic(next)
      await updateMyStack(next.tools, next.modules, initialCoverageAreas)
      setEditing(false)
    })
  }

  function handleCancel() {
    setDraft({ tools: optimisticStack.tools, modules: optimisticStack.modules })
    setEditing(false)
  }

  if (editing) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Edit Your Stack</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Select the tools and licences your organisation uses.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : 'Save Stack'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {realTools.map(tool => {
            const selected = draft.tools.includes(tool.id)
            return (
              <div
                key={tool.id}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  selected ? 'border-blue-500/40 bg-blue-500/5' : 'border-border bg-card/40',
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleTool(tool.id)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{tool.label}</span>
                      {tool.category?.map(c => (
                        <span key={c} className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-muted border border-border text-muted-foreground/70">
                          {c}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{tool.description}</p>

                    {selected && tool.modules.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-2">
                          Licences / Modules
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {tool.modules.map(mod => {
                            const modSelected = (draft.modules[tool.id] ?? []).includes(mod.id)
                            return (
                              <button
                                key={mod.id}
                                type="button"
                                onClick={() => toggleModule(tool.id, mod.id)}
                                className={cn(
                                  'px-2 py-0.5 rounded-md text-xs border transition-colors',
                                  modSelected
                                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                                    : 'bg-muted border-border text-muted-foreground hover:text-foreground',
                                )}
                              >
                                {mod.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Your Tools & Modules</h2>
          <p className="text-xs text-muted-foreground mt-0.5">DLP tools and licences active in your organisation.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          Edit Stack
        </button>
      </div>

      {selectedTools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No tools selected.</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Add your first tool →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selectedTools.map(tool => {
            const selectedModuleIds = optimisticStack.modules[tool.id] ?? []
            const selectedModules = selectedModuleIds
              .map(id => tool.modules.find(m => m.id === id))
              .filter((m): m is NonNullable<typeof m> => m !== undefined)

            return (
              <div key={tool.id} className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{tool.label}</span>
                  <div className="flex gap-1 flex-wrap">
                    {tool.category?.map(c => (
                      <span key={c} className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-muted border border-border text-muted-foreground/60">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                {selectedModules.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedModules.map(mod => (
                      <span key={mod.id} className="px-2 py-0.5 rounded-md text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        {mod.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
