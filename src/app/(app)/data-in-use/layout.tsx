import { SectionNav } from '@/components/nav/section-nav'

const ITEMS = [
  { label: 'Endpoint Activity',  href: '/data-in-use/endpoint-activity' },
  { label: 'Copy/Paste Controls', href: '/data-in-use/copy-paste' },
  { label: 'Removable Media',    href: '/data-in-use/removable-media' },
]

export default function DataInUseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <SectionNav title="Data in Use" items={ITEMS} />
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  )
}
