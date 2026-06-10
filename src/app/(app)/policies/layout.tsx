import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'
import { CHANNELS } from '@/lib/channel-taxonomy'
import { NAV } from '@/lib/nav'

const foundation = NAV.find(s => s.id === 'foundation')!
const staticItems = foundation.pages.map(p => ({ label: p.label, href: p.route }))

// Channel pages expand dynamically — Phase 4 will collapse these to a single page
const ITEMS = [
  ...staticItems,
  { label: 'Channels', isGroup: true as const },
  ...CHANNELS.map(c => ({ label: c.shortName, href: `/policies/channels/${c.slug}` })),
]

export default async function PoliciesLayout({ children }: { children: React.ReactNode }) {
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
