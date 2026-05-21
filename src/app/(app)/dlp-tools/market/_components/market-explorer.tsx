'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, BookOpen, Globe, FileText, CreditCard, LifeBuoy, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MODULE_TO_AREAS } from '@/lib/onboarding/data'
import type { DLPTool, DlpToolChannelCoverage, ChannelCoverageLevel, ToolDocLink } from '@/lib/onboarding/data'

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

const DOC_LINK_META: Record<ToolDocLink['type'], { label: string; icon: React.ElementType; class: string }> = {
  'product':       { label: 'Product Page',    icon: Globe,      class: 'bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20' },
  'docs':          { label: 'Documentation',   icon: BookOpen,   class: 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20' },
  'release-notes': { label: 'Release Notes',   icon: FileText,   class: 'bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20' },
  'licensing':     { label: 'Licensing',       icon: CreditCard, class: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20' },
  'support':       { label: 'Support Portal',  icon: LifeBuoy,   class: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' },
  'contact':       { label: 'Contact',         icon: Mail,       class: 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20' },
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
  const [expandedDocs, setExpandedDocs]     = useState<string | null>(null)

  function toggleTool(id: string) {
    if (expandedTool === id) {
      setExpandedTool(null)
      setExpandedModule(null)
      setExpandedDocs(null)
    } else {
      setExpandedTool(id)
      setExpandedModule(null)
      setExpandedDocs(null)
    }
  }

  function toggleModule(key: string) {
    setExpandedModule(prev => prev === key ? null : key)
  }

  function toggleDocs(toolId: string) {
    setExpandedDocs(prev => prev === toolId ? null : toolId)
  }

  return (
    <div className="space-y-6">

      {/* Tool list */}
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
        {tools.map(tool => {
          const inStack    = orgTools.includes(tool.id)
          const toolOpen   = expandedTool === tool.id
          const docsOpen   = expandedDocs === tool.id
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

                            {/* Pricing tier */}
                            {mod.pricingTier && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-1.5">
                                  Pricing Tier
                                </p>
                                <span className="px-2 py-0.5 rounded-md bg-muted border border-border text-xs text-muted-foreground">
                                  {mod.pricingTier}
                                </span>
                              </div>
                            )}

                            {/* Key features */}
                            {mod.keyFeatures && mod.keyFeatures.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-1.5">
                                  Key Features
                                </p>
                                <ul className="space-y-0.5 list-disc list-inside">
                                  {mod.keyFeatures.map(f => (
                                    <li key={f} className="text-xs text-muted-foreground">{f}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Prerequisites */}
                            {mod.prerequisites && mod.prerequisites.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-1.5">
                                  Prerequisites
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {mod.prerequisites.map(p => (
                                    <span key={p} className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] text-muted-foreground/70 font-mono">
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* DLP Channels */}
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

                            {/* Coverage Areas */}
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

                            {/* Official docs link */}
                            {mod.officialUrl && (
                              <a
                                href={mod.officialUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                Official documentation
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* ── Documentation row ───────────────────────────────── */}
                  {tool.toolLinks && tool.toolLinks.length > 0 && (
                    <div className={cn(
                      'rounded-lg border transition-colors',
                      docsOpen ? 'border-border bg-card/60' : 'border-border/50 bg-muted/10 hover:bg-muted/20',
                    )}>
                      <button
                        type="button"
                        onClick={() => toggleDocs(tool.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                      >
                        <span className="shrink-0 text-muted-foreground/40">
                          {docsOpen
                            ? <ChevronDown  className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                          <p className="text-xs font-medium text-foreground/90">Documentation & Resources</p>
                        </div>
                        <div className="shrink-0 flex gap-1">
                          {(['product', 'docs', 'support'] as ToolDocLink['type'][]).map(t => {
                            const hasLink = tool.toolLinks!.some(l => l.type === t)
                            if (!hasLink) return null
                            const meta = DOC_LINK_META[t]
                            return (
                              <span key={t} className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold', meta.class)}>
                                {meta.label.split(' ')[0]}
                              </span>
                            )
                          })}
                        </div>
                      </button>

                      {docsOpen && (
                        <div className="px-9 pb-4 pt-1">
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {tool.toolLinks.map(link => {
                              const meta = DOC_LINK_META[link.type]
                              const Icon = meta.icon
                              return (
                                <a
                                  key={link.type}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors',
                                    meta.class,
                                  )}
                                >
                                  <Icon className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{link.label}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0 ml-auto opacity-50" />
                                </a>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
