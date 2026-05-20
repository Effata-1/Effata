'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DLP_TOOLS } from '@/lib/onboarding/data'
import type { OnboardingData } from '../types'

interface Props {
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
}

function ToolCard({
  tool,
  selected,
  selectedModules,
  onToggleTool,
  onToggleModule,
}: {
  tool: (typeof DLP_TOOLS)[number]
  selected: boolean
  selectedModules: string[]
  onToggleTool: () => void
  onToggleModule: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(selected && tool.modules.length > 0)

  const handleToggleTool = () => {
    onToggleTool()
    if (!selected && tool.modules.length > 0) setExpanded(true)
    if (selected) setExpanded(false)
  }

  return (
    <div
      className={cn(
        'rounded-xl border transition-all',
        selected ? 'border-blue-500/60 bg-blue-500/5' : 'border-border bg-card/40'
      )}
    >
      {/* Tool header */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer"
        onClick={handleToggleTool}
      >
        <div className={cn(
          'mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
          selected ? 'bg-blue-600 border-blue-600' : 'border-border-strong'
        )}>
          {selected && <Check className="h-2.5 w-2.5 text-foreground" strokeWidth={3} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium', selected ? 'text-foreground' : 'text-foreground/70')}>{tool.label}</p>
          <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-1">{tool.description}</p>
        </div>
        {selected && tool.modules.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
            className="text-muted-foreground/80 hover:text-foreground/70 flex-shrink-0 mt-0.5"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Modules */}
      {selected && expanded && tool.modules.length > 0 && (
        <div className="px-4 pb-3 border-t border-border/60 pt-3">
          <p className="text-xs text-muted-foreground/80 mb-2">Select the licences / modules you own:</p>
          <div className="flex flex-wrap gap-1.5">
            {tool.modules.map(mod => {
              const active = selectedModules.includes(mod.id)
              return (
                <button
                  key={mod.id}
                  onClick={() => onToggleModule(mod.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg border text-xs font-medium transition-all',
                    active
                      ? 'border-blue-500/60 bg-blue-500/15 text-blue-500'
                      : 'border-border-strong bg-muted/60 text-muted-foreground hover:border-border-strong hover:text-foreground/70'
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
  )
}

export function Step2({ data, onChange }: Props) {
  const toggleTool = (toolId: string) => {
    const nowSelected = data.tools.includes(toolId)
    const nextTools = nowSelected
      ? data.tools.filter(t => t !== toolId)
      : [...data.tools, toolId]

    const nextModules = { ...data.modules }
    if (nowSelected) delete nextModules[toolId]

    onChange({ tools: nextTools, modules: nextModules })
  }

  const toggleModule = (toolId: string, moduleId: string) => {
    const current = data.modules[toolId] ?? []
    const next = current.includes(moduleId)
      ? current.filter(m => m !== moduleId)
      : [...current, moduleId]
    onChange({ modules: { ...data.modules, [toolId]: next } })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground/80">
        Select your DLP tool(s), then choose which licences or modules you own.
      </p>
      <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
        {DLP_TOOLS.map(tool => (
          <ToolCard
            key={tool.id}
            tool={tool}
            selected={data.tools.includes(tool.id)}
            selectedModules={data.modules[tool.id] ?? []}
            onToggleTool={() => toggleTool(tool.id)}
            onToggleModule={(moduleId) => toggleModule(tool.id, moduleId)}
          />
        ))}
      </div>
    </div>
  )
}
