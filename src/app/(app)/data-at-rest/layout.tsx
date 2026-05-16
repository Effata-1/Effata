import { SectionNav } from '@/components/nav/section-nav'

const ITEMS = [
  { label: 'Cloud Storage', href: '/data-at-rest/cloud-storage' },
  { label: 'Endpoints',     href: '/data-at-rest/endpoints' },
  { label: 'Databases',     href: '/data-at-rest/databases' },
]

export default function DataAtRestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <SectionNav title="Data at Rest" items={ITEMS} />
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  )
}
