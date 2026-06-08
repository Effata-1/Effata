import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'
import { CHANNELS } from '@/lib/channel-taxonomy'

const ITEMS = [
  { label: 'Policy Library',         href: '/policies/library' },
  { label: 'Data Catalog',           href: '/policies/data-catalog' },
  { label: 'Destinations',           href: '/policies/destinations' },
  { label: 'Classification Labels',  href: '/policies/classifications' },
  { label: 'Sensitivity Labels',     href: '/policies/sensitivity-labels' },
  { label: 'Coaching Templates',     href: '/policies/coaching-templates' },
  { label: 'Identity Context',       href: '/policies/identity' },
  { label: 'Channels',               isGroup: true as const },
  ...CHANNELS.map(c => ({ label: c.shortName, href: `/policies/channels/${c.slug}` })),
]

export default async function PoliciesLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SectionSidebar title="Policies" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
