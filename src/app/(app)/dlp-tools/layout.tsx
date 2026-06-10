import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'
import { NAV } from '@/lib/nav'

const ITEMS = NAV.find(s => s.id === 'dlp-tools')!.pages.map(p => ({ label: p.label, href: p.route }))

export default async function DlpToolsLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SectionSidebar title="DLP Tools" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
