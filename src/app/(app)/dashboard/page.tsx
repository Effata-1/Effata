import { requireRole } from '@/lib/auth'

export default async function DashboardPage() {
  await requireRole('read_only')

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard</h1>
      <p className="text-muted-foreground/80 text-sm">Your DLP maturity score and quick wins</p>
    </div>
  )
}
