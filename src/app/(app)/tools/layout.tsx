import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'
import { NAV } from '@/lib/nav'

const testEvidence = NAV.find(s => s.id === 'test-evidence')!
const ITEMS = testEvidence.pages.map(p => ({ label: p.label, href: p.route, badge: p.badge }))

export default async function ToolsLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SectionSidebar title={testEvidence.label} items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
