import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'

const ITEMS = [
  { label: 'Overview',                 href: '/compliance' },
  { label: 'Regulations & Frameworks', href: '/compliance/regulations' },
  { label: 'Gap Report',               href: '/compliance/gap-report' },
  { label: 'Audit Trail',              href: '/compliance/audit-trail' },
]

export default async function ComplianceLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <SectionSidebar title="Compliance" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
