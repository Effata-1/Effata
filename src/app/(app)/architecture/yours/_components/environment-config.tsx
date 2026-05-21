'use client'

import Link from 'next/link'
import { ChevronRight, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DistrictData } from './types'
import { DLP_TOOLS } from '@/lib/onboarding/data'

const CHANNEL_LABELS: Record<string, string> = {
  email:        'Email DLP',
  web:          'Web / SWG',
  'saas-inline':'SaaS / CASB Inline',
  'saas-api':   'SaaS API / At-Rest',
  endpoint:     'Endpoint DLP',
  genai:        'GenAI Apps',
  network:      'Network Egress',
}

const LEVEL_BADGE: Record<string, { label: string; className: string }> = {
  full:    { label: 'Enabled',      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  partial: { label: 'Partial',      className: 'bg-amber-500/15  text-amber-400  border-amber-500/20'  },
  addon:   { label: 'Add-on',       className: 'bg-blue-500/15   text-blue-400   border-blue-500/20'   },
  none:    { label: 'Gap',          className: 'bg-red-500/15    text-red-400    border-red-500/20'    },
  unknown: { label: 'Not Assessed', className: 'bg-slate-500/15  text-slate-400  border-slate-500/20'  },
}

const LEVEL_DOT: Record<string, string> = {
  full:    'bg-emerald-500',
  partial: 'bg-amber-500',
  addon:   'bg-blue-500',
  none:    'bg-red-500',
  unknown: 'bg-slate-500',
}

interface EnvironmentConfigProps {
  districts:  DistrictData[]
  orgTools:   string[]
}

export function EnvironmentConfig({ districts, orgTools }: EnvironmentConfigProps) {
  const configuredTools = DLP_TOOLS.filter(t => orgTools.includes(t.id))

  return (
    <div className="w-64 shrink-0 border-l border-white/6 bg-[#030c1a] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/6">
        <p className="text-[9px] text-slate-600 uppercase tracking-[0.18em] font-medium">Current</p>
        <h2 className="text-xs font-bold text-slate-200 mt-0.5">Environment Configuration</h2>
        <p className="text-[10px] text-slate-500 mt-1">Global Enterprise</p>
      </div>

      {/* Channel coverage rows */}
      <div className="px-4 py-3 space-y-1.5 border-b border-white/6">
        <p className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-2">DLP Coverage</p>
        {districts.map(d => {
          const badge = LEVEL_BADGE[d.level] ?? LEVEL_BADGE.unknown
          const dot   = LEVEL_DOT[d.level]   ?? LEVEL_DOT.unknown
          return (
            <div key={d.channelKey} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/2 hover:bg-white/4 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
                <span className="text-[10.5px] text-slate-400 truncate">{CHANNEL_LABELS[d.channelKey] ?? d.shortName}</span>
              </div>
              <span className={cn(
                'shrink-0 ml-2 inline-flex items-center px-1.5 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wide',
                badge.className,
              )}>
                {badge.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Tool list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-2">My Environment</p>
        {configuredTools.length === 0 ? (
          <p className="text-[10px] text-slate-600 italic">No tools configured yet.</p>
        ) : (
          <div className="space-y-1">
            {configuredTools.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="text-[9px] text-slate-600 w-3.5 shrink-0">{i + 1}.</span>
                <span className="text-[10.5px] text-slate-400 truncate">{t.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer link */}
      <div className="px-4 pb-4 pt-2 border-t border-white/6">
        <Link
          href="/dlp-tools/my-stack"
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-white/8 bg-white/3 hover:bg-white/6 text-[10.5px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span className="flex items-center gap-1.5"><Settings size={10} /> Manage My Environment</span>
          <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  )
}
