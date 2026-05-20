import { SectionSidebar } from '@/components/nav/section-sidebar'

const ITEMS = [
  { label: 'Cloud Storage', href: '/data-at-rest/cloud-storage' },
  { label: 'Endpoints',     href: '/data-at-rest/endpoints' },
  { label: 'Databases',     href: '/data-at-rest/databases' },
]

export default function DataAtRestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SectionSidebar title="Data at Rest" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
