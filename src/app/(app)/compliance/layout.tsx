import { SectionSidebar } from '@/components/nav/section-sidebar'

const ITEMS = [
  { label: 'Regulations',  href: '/compliance/regulations' },
  { label: 'Gap Report',   href: '/compliance/gap-report' },
  { label: 'Audit Trail',  href: '/compliance/audit-trail' },
]

export default function ComplianceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <SectionSidebar title="Compliance" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
