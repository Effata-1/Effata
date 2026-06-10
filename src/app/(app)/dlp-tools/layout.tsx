import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'
import { NAV } from '@/lib/nav'

const dlpTools = NAV.find(s => s.id === 'dlp-tools')!
const ITEMS = dlpTools.pages.map(p => ({ label: p.label, href: p.route }))

export default async function DlpToolsLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SectionSidebar title={dlpTools.label} items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
