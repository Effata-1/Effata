import { cn } from '@/lib/utils'

interface Props {
  avg: number | null
  high: number
  medium: number
  low: number
  total: number
}

export function TrustScoreSummary({ avg, high, medium, low, total }: Props) {
  if (total === 0) {
    return <p className="text-xs text-muted-foreground/50">No app profiles researched yet.</p>
  }

  const avgColor =
    avg === null ? 'text-muted-foreground' :
    avg >= 70    ? 'text-green-400' :
    avg >= 40    ? 'text-yellow-400' :
    'text-red-400'

  return (
    <div className="space-y-3">
      {avg !== null && (
        <div>
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Average</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={cn('text-3xl font-bold', avgColor)}>{avg}</span>
            <span className="text-xs text-muted-foreground/60">/100</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-2">
          <p className="text-lg font-bold text-red-400">{high}</p>
          <p className="text-[10px] text-red-400/70 uppercase tracking-wide">High Risk</p>
          <p className="text-[10px] text-muted-foreground/50">score &lt; 40</p>
        </div>
        <div className="text-center rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-2 py-2">
          <p className="text-lg font-bold text-yellow-400">{medium}</p>
          <p className="text-[10px] text-yellow-400/70 uppercase tracking-wide">Medium</p>
          <p className="text-[10px] text-muted-foreground/50">40–69</p>
        </div>
        <div className="text-center rounded-lg bg-green-500/10 border border-green-500/20 px-2 py-2">
          <p className="text-lg font-bold text-green-400">{low}</p>
          <p className="text-[10px] text-green-400/70 uppercase tracking-wide">Low Risk</p>
          <p className="text-[10px] text-muted-foreground/50">score ≥ 70</p>
        </div>
      </div>
    </div>
  )
}
