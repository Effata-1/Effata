import { SectionSidebar } from '@/components/nav/section-sidebar'
import { NAV } from '@/lib/nav'

const ITEMS = NAV.find(s => s.id === 'architecture')!.pages.map(p => ({ label: p.label, href: p.route }))

export default function ArchitectureLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SectionSidebar title="Architecture" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
