import { SectionSidebar } from '@/components/nav/section-sidebar'

const ITEMS = [
  { label: 'Endpoint Activity',   href: '/data-in-use/endpoint-activity' },
  { label: 'Copy/Paste Controls', href: '/data-in-use/copy-paste' },
  { label: 'Removable Media',     href: '/data-in-use/removable-media' },
]

export default function DataInUseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <SectionSidebar title="Data in Use" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
