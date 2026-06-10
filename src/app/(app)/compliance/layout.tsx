import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'
import { NAV } from '@/lib/nav'

const compliance = NAV.find(s => s.id === 'compliance')!
const ITEMS = compliance.pages.map(p => ({ label: p.label, href: p.route }))

export default async function ComplianceLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SectionSidebar title={compliance.label} items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
