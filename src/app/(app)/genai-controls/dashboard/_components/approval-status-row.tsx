import { cn } from '@/lib/utils'
import type { ApprovalStatus } from '@/lib/genai/types'

const APPROVAL_META: Record<ApprovalStatus, { chip: string; label: string }> = {
  approved:       { chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Approved' },
  'under-review': { chip: 'bg-blue-500/10 text-blue-400 border-blue-500/20',          label: 'Under Review' },
  draft:          { chip: 'bg-muted/60 text-muted-foreground border-border',           label: 'Draft' },
  rejected:       { chip: 'bg-red-500/10 text-red-400 border-red-500/20',             label: 'Rejected' },
  expired:        { chip: 'bg-amber-500/10 text-amber-400 border-amber-500/20',       label: 'Expired' },
}

const STATUSES: ApprovalStatus[] = ['approved', 'under-review', 'draft', 'rejected', 'expired']

interface Props {
  counts: Record<ApprovalStatus, number>
}

export function ApprovalStatusRow({ counts }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map(status => {
        const { chip, label } = APPROVAL_META[status]
        return (
          <div key={status} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold', chip)}>
            <span className="text-base font-bold leading-none">{counts[status]}</span>
            <span className="opacity-80">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
