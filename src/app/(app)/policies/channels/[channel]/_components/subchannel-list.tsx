'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChannelSubchannel } from '@/lib/channel-taxonomy'

export function SubchannelList({ subchannels }: { subchannels: ChannelSubchannel[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="rounded-xl border border-border bg-card/40 divide-y divide-border overflow-hidden">
      {subchannels.map(sub => {
        const open          = expanded === sub.name
        const hasProtocols  = sub.protocols && sub.protocols.length > 0

        return (
          <div key={sub.name}>
            <button
              type="button"
              onClick={() => setExpanded(open ? null : sub.name)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
            >
              <span className="shrink-0 text-muted-foreground/50">
                {open
                  ? <ChevronDown  className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{sub.name}</p>
                  {hasProtocols && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      {sub.protocols!.length} protocol{sub.protocols!.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{sub.description}</p>
              </div>
            </button>

            {open && (
              <div className="px-11 pb-5 pt-1 space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{sub.description}</p>

                {/* Examples */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1.5">
                    Examples
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sub.examples.split(', ').map(ex => (
                      <span
                        key={ex}
                        className="px-2 py-0.5 rounded bg-muted border border-border-strong text-xs text-muted-foreground"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Protocol / port table */}
                {hasProtocols && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-2">
                      Protocols &amp; Ports
                    </p>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground/60 w-36">Protocol</th>
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground/60 w-32">Category</th>
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground/60">Ports</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {sub.protocols!.map(p => (
                            <tr key={p.name} className="hover:bg-muted/10 transition-colors">
                              <td className="px-3 py-2 font-mono font-semibold text-foreground/80">{p.name}</td>
                              <td className="px-3 py-2 text-muted-foreground/60">{p.category}</td>
                              <td className="px-3 py-2 font-mono text-muted-foreground/80">{p.ports}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
