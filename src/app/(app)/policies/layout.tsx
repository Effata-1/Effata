import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'

const ITEMS = [
  { label: 'Policy Library',         href: '/policies/library' },
  { label: 'Data Catalog',           href: '/policies/data-catalog' },
  { label: 'Classification Labels',  href: '/policies/classifications' },
]

export default async function PoliciesLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <SectionSidebar title="Policies" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
