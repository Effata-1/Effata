import { cn } from '@/lib/utils'

interface Run {
  created_at: string
  status: string
}

interface Props {
  run: Run | null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function ResearchStatus({ run }: Props) {
  if (!run) {
    return <p className="text-xs text-muted-foreground/50">No research runs yet.</p>
  }

  const dotColor =
    run.status === 'completed' ? 'bg-emerald-500' :
    run.status === 'running'   ? 'bg-blue-500 animate-pulse' :
    'bg-red-500'

  const textColor =
    run.status === 'completed' ? 'text-emerald-400' :
    run.status === 'running'   ? 'text-blue-400' :
    'text-red-400'

  const label = run.status.charAt(0).toUpperCase() + run.status.slice(1)

  return (
    <div className="space-y-1.5">
      <div className={cn('flex items-center gap-2 text-sm font-semibold', textColor)}>
        <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
        {label}
      </div>
      <p className="text-xs text-muted-foreground/60 pl-4">{timeAgo(run.created_at)}</p>
    </div>
  )
}
