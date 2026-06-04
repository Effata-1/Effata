import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  label:   string
  value:   number | string
  sub?:    ReactNode
  accent?: 'emerald' | 'green' | 'amber' | 'red'
  icon?:   ReactNode
}

export function StatCard({ label, value, sub, accent, icon }: Props) {
  const valueColor =
    accent === 'emerald' ? 'text-emerald-400' :
    accent === 'green'   ? 'text-green-400'   :
    accent === 'amber'   ? 'text-yellow-400'  :
    accent === 'red'     ? 'text-red-400'     :
    'text-foreground'

  const iconTint =
    accent === 'emerald' ? 'text-emerald-400' :
    accent === 'green'   ? 'text-green-400'   :
    accent === 'amber'   ? 'text-amber-400'   :
    accent === 'red'     ? 'text-red-400'     :
    'text-muted-foreground'

  return (
    <div className={cn(
      'rounded-xl border border-border bg-card/50 shadow-sm px-5 py-5',
      accent === 'emerald' && 'border-t-[3px] border-t-emerald-500/50',
      accent === 'green'   && 'border-t-[3px] border-t-green-500/50',
      accent === 'amber'   && 'border-t-[3px] border-t-amber-500/50',
      accent === 'red'     && 'border-t-[3px] border-t-red-500/50',
    )}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide">{label}</p>
        {icon && <span className={cn('opacity-25', iconTint)}>{icon}</span>}
      </div>
      <p className={cn('text-3xl font-bold', valueColor)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground/60 mt-1">{sub}</p>}
    </div>
  )
}
