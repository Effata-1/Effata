import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole }    from '@/lib/auth'
import { NAV }            from '@/lib/nav'
import { CHANNELS }       from '@/lib/channel-taxonomy'

const foundation = NAV.find(s => s.id === 'foundation')!
// Filter channel-reference from the auto-mapped list — individual channels are shown in the group below
const ITEMS = [
  ...foundation.pages
    .filter(p => p.id !== 'channels')
    .map(p => ({ label: p.label, href: p.route })),
  { label: 'Channels', isGroup: true as const },
  ...CHANNELS.map(c => ({ label: c.shortName, href: `/foundation/channels/${c.slug}` })),
]

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
