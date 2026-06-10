import { requireRole } from '@/lib/auth'

export default async function Page() {
  await requireRole('admin')
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-1">Integrations</h1>
      <p className="text-muted-foreground/80 text-sm">Third-party integrations and webhooks</p>
    </div>
  )
}
