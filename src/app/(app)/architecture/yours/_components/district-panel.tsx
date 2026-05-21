'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, CheckCircle2, AlertTriangle, Minus } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { DistrictData } from './types'

const LEVEL_BADGE: Record<string, { label: string; className: string }> = {
  full:    { label: 'Full Coverage', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  partial: { label: 'Partial',       className: 'bg-amber-500/15  text-amber-400  border-amber-500/20'  },
  addon:   { label: 'Add-on Only',   className: 'bg-blue-500/15   text-blue-400   border-blue-500/20'   },
  none:    { label: 'Gap',           className: 'bg-red-500/15    text-red-400    border-red-500/20'    },
  unknown: { label: 'Not Assessed',  className: 'bg-slate-500/15  text-slate-400  border-slate-500/20'  },
}

const RISK_BADGE: Record<string, string> = {
  critical: 'bg-red-500/15    text-red-400    border-red-500/20',
  high:     'bg-orange-500/15 text-orange-400 border-orange-500/20',
  medium:   'bg-amber-500/15  text-amber-400  border-amber-500/20',
  low:      'bg-slate-500/15  text-slate-400  border-slate-500/20',
}

interface DistrictPanelProps {
  district: DistrictData | null
  onClose:  () => void
}

export function DistrictPanel({ district, onClose }: DistrictPanelProps) {
  return (
    <AnimatePresence>
      {district && (
        <motion.div
          key={district.slug}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          className="absolute right-0 top-0 h-full w-[340px] z-50 bg-slate-900/96 border-l border-white/8 flex flex-col backdrop-blur-sm"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-white/6">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">DLP Channel</p>
              <h2 className="text-sm font-semibold text-slate-100 leading-snug">{district.name}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide',
                LEVEL_BADGE[district.level]?.className ?? LEVEL_BADGE.unknown.className,
              )}>
                {LEVEL_BADGE[district.level]?.label ?? 'Unknown'}
              </span>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-white/8 text-slate-500 hover:text-slate-200 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Coverage */}
            <section>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Coverage</p>
              {district.coveredBy.length > 0 ? (
                <div className="space-y-1.5">
                  {district.coveredBy.map(tool => (
                    <div key={tool} className="flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                      <span className="text-xs text-slate-300">{tool}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/8 border border-red-500/15">
                  <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400 leading-snug">
                    {district.level === 'unknown'
                      ? 'No tools configured — add tools in My Stack to derive coverage.'
                      : 'No coverage detected — gap in this channel.'}
                  </p>
                </div>
              )}
            </section>

            {/* Activities */}
            {district.activities.length > 0 && (
              <section>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Key Activities</p>
                <div className="space-y-1">
                  {district.activities.map(activity => (
                    <div key={activity} className="flex items-start gap-2">
                      <Minus size={10} className="text-slate-600 shrink-0 mt-1" />
                      <span className="text-xs text-slate-400">{activity}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Risks */}
            {district.risks.length > 0 && (
              <section>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Top Risks</p>
                <div className="space-y-2">
                  {district.risks.map(risk => (
                    <div key={risk.area} className="flex items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center px-1.5 py-0.5 rounded border text-[8px] font-bold uppercase tracking-wide shrink-0',
                        RISK_BADGE[risk.level] ?? RISK_BADGE.low,
                      )}>
                        {risk.level}
                      </span>
                      <span className="text-xs text-slate-400">{risk.area}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-3 border-t border-white/6">
            <Link
              href={district.channelHref}
              className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg border border-white/8 bg-white/4 hover:bg-white/8 text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors"
            >
              <span>View Deep Assessment</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
