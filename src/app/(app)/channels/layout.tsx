import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'
import { CHANNELS } from '@/lib/channel-taxonomy'

const ITEMS = CHANNELS.map(c => ({ label: c.shortName, href: `/channels/${c.slug}` }))

export default async function ChannelsLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SectionSidebar title="Channels" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
