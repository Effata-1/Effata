import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole }    from '@/lib/auth'
import { NAV }            from '@/lib/nav'

const foundation = NAV.find(s => s.id === 'foundation')!
// Channel pages are still under /policies/channels — deferred to Phase 4
const ITEMS = foundation.pages.map(p => ({ label: p.label, href: p.route }))

export default async function FoundationLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SectionSidebar title={foundation.label} items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
