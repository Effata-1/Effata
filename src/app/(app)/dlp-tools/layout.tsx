import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'

const ITEMS = [
  { label: 'Market Overview', href: '/dlp-tools/market' },
  { label: 'My Stack',        href: '/dlp-tools/my-stack' },
  { label: 'AI Advisor',      href: '/dlp-tools/advisor' },
]

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
