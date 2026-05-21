'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MODULE_TO_AREAS } from '@/lib/onboarding/data'
import type { DLPTool, DlpToolChannelCoverage, ChannelCoverageLevel } from '@/lib/onboarding/data'

// ─── Constants ───────────────────────────────────────────────────────────────

const CHANNEL_KEYS = ['email', 'web', 'saas-inline', 'saas-api', 'endpoint', 'genai', 'network'] as const
type ChannelKey = typeof CHANNEL_KEYS[number]

const CHANNEL_LABELS: Record<ChannelKey, string> = {
  email:         'Email',
  web:           'Web',
  'saas-inline': 'SaaS Inline',
  'saas-api':    'SaaS API',
  endpoint:      'Endpoint',
  genai:         'GenAI',
  network:       'Network',
}

const AREA_TO_CHANNEL: Record<string, ChannelKey> = {
  'email-dlp':        'email',
  'web-dlp':          'web',
  'saas-casb-inline': 'saas-inline',
  'saas-api-rest':    'saas-api',
  'endpoint-dlp':     'endpoint',
  'removable-media':  'endpoint',
  'printing-dlp':     'endpoint',
  'genai-ai-dlp':     'genai',
  'network-dlp':      'network',
}

const LEVEL_CLASS: Record<ChannelCoverageLevel, string> = {
  full:    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  partial: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  addon:   'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  none:    'text-muted-foreground/25',
}

const LEVEL_LABEL: Record<ChannelCoverageLevel, string> = {
  full: 'Full', partial: 'Partial', addon: 'Add-on', none: '—',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getModuleChannels(moduleId: string): ChannelKey[] {
  const areas = MODULE_TO_AREAS[moduleId] ?? []
  return [...new Set(areas.map(a => AREA_TO_CHANNEL[a]).filter((c): c is ChannelKey => !!c))]
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  tools: DLPTool[]
  orgTools: string[]
}

export function MarketExplorer({ tools, orgTools }: Props) {
  const [expandedTool, setExpandedTool]     = useState<string | null>(null)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)

  function toggleTool(id: string) {
    if (expandedTool === id) {
      setExpandedTool(null)
      setExpandedModule(null)
    } else {
      setExpandedTool(id)
      setExpandedModule(null)
    }
  }

  function toggleModule(key: string) {
    setExpandedModule(prev => prev === key ? null : key)
  }

  return (
    <div className="space-y-6">

      {/* Tool list */}
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
        {tools.map(tool => {
          const inStack    = orgTools.includes(tool.id)
          const toolOpen   = expandedTool === tool.id
          const coverage   = tool.channelCoverage as DlpToolChannelCoverage

          return (
            <div key={tool.id}>

              {/* ── Layer 1: Tool header ─────────────────────────────────── */}
              <button
                type="button"
                onClick={() => toggleTool(tool.id)}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-4 text-left transition-colors',
                  inStack  ? 'bg-emerald-500/5'  : 'bg-card/20',
                  toolOpen ? 'bg-muted/20'        : 'hover:bg-muted/20',
                )}
              >
                <span className="shrink-0 mt-0.5 text-muted-foreground/50">
                  {toolOpen
                    ? <ChevronDown  className="w-4 h-4" />
                    : <ChevronRight className="w-4 h-4" />}
                </span>

                {/* Name + categories + description */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{tool.label}</span>
                    {inStack && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 leading-tight">
                        YOUR STACK
                      </span>
                    )}
                    {tool.category?.map(c => (
                      <span key={c} className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-muted border border-border text-muted-foreground/60">
                        {c}
                      </span>
                    ))}
                  </div>
                  <p className={cn(
                    'text-xs text-muted-foreground leading-relaxed',
                    toolOpen ? '' : 'line-clamp-1',
                  )}>
                    {tool.description}
                  </p>
                </div>

                {/* 7 channel mini-badges */}
                <div className="shrink-0 flex flex-wrap gap-1 justify-end max-w-[300px]">
                  {CHANNEL_KEYS.map(key => {
                    const level = coverage[key]
                    return (
                      <span key={key} className={cn(
                        'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold',
                        LEVEL_CLASS[level],
                      )}>
                        {CHANNEL_LABELS[key].split(' ')[0]}:{LEVEL_LABEL[level]}
                      </span>
                    )
                  })}
                </div>
              </button>

              {/* ── Layer 2: Module rows ─────────────────────────────────── */}
              {toolOpen && (
                <div className="px-10 pb-3 pt-1 space-y-1 bg-muted/5">
                  {tool.modules.map(mod => {
                    const modKey      = `${tool.id}::${mod.id}`
                    const modOpen     = expandedModule === modKey
                    const modChannels = getModuleChannels(mod.id)

                    return (
                      <div key={mod.id} className={cn(
                        'rounded-lg border transition-colors',
                        modOpen ? 'border-border bg-card/60' : 'border-border/50 bg-muted/10 hover:bg-muted/20',
                      )}>
                        <button
                          type="button"
                          onClick={() => toggleModule(modKey)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                        >
                          <span className="shrink-0 text-muted-foreground/40">
                            {modOpen
                              ? <ChevronDown  className="w-3.5 h-3.5" />
                              : <ChevronRight className="w-3.5 h-3.5" />}
                          </span>

                          {/* Module name + description */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground/90">{mod.label}</p>
                            {!modOpen && (
                              <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
                                {mod.description}
                              </p>
                            )}
                          </div>

                          {/* Channel tags for this module */}
                          {modChannels.length > 0 && (
                            <div className="shrink-0 flex flex-wrap gap-1 justify-end">
                              {modChannels.map(ch => {
                                const level = coverage[ch]
                                return (
                                  <span key={ch} className={cn(
                                    'px-1.5 py-0.5 rounded text-[9px] font-semibold',
                                    LEVEL_CLASS[level],
                                  )}>
                                    {CHANNEL_LABELS[ch]}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </button>

                        {/* ── Layer 3: Module detail ───────────────────────── */}
                        {modOpen && (
                          <div className="px-9 pb-4 pt-1 space-y-3">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {mod.description}
                            </p>

                            {modChannels.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-1.5">
                                  DLP Channels
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {modChannels.map(ch => {
                                    const level = coverage[ch]
                                    return (
                                      <span key={ch} className={cn(
                                        'px-2 py-0.5 rounded-md border text-[10px] font-semibold',
                                        LEVEL_CLASS[level],
                                      )}>
                                        {CHANNEL_LABELS[ch]}: {LEVEL_LABEL[level]}
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {(MODULE_TO_AREAS[mod.id] ?? []).length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-1.5">
                                  Coverage Areas
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {MODULE_TO_AREAS[mod.id].map(area => (
                                    <span key={area} className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] text-muted-foreground/60 font-mono">
                                      {area}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Full</span>
          Native full coverage
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">Partial</span>
          Requires config or extra licence
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">Add-on</span>
          Available as paid add-on
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground/40 text-[10px] font-semibold pr-0.5">—</span>
          Not covered
        </span>
      </div>

    </div>
  )
}
