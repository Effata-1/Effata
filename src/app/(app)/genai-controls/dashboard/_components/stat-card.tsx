import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: number | string
  sub?: ReactNode
  accent?: 'emerald' | 'green' | 'amber' | 'red'
}

export function StatCard({ label, value, sub, accent }: Props) {
  const valueColor =
    accent === 'emerald' ? 'text-emerald-400' :
    accent === 'green'   ? 'text-green-400' :
    accent === 'amber'   ? 'text-yellow-400' :
    accent === 'red'     ? 'text-red-400' :
    'text-foreground'

  return (
    <div className="rounded-xl border border-border bg-card/50 shadow-sm px-5 py-4">
      <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wide">{label}</p>
      <p className={cn('text-3xl font-bold mt-1', valueColor)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  )
}
