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
        const open = expanded === sub.name
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
                <p className="text-sm font-medium text-foreground">{sub.name}</p>
                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{sub.description}</p>
              </div>
            </button>

            {open && (
              <div className="px-11 pb-4 pt-1 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">{sub.description}</p>
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
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
