import { SectionNav } from '@/components/nav/section-nav'

const ITEMS = [
  { label: 'Regulations', href: '/compliance/regulations' },
  { label: 'Gap Report',  href: '/compliance/gap-report' },
  { label: 'Audit Trail', href: '/compliance/audit-trail' },
]

export default function ComplianceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <SectionNav title="Compliance" items={ITEMS} />
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  )
}
