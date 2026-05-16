import { SectionSidebar } from '@/components/nav/section-sidebar'

const ITEMS = [
  { label: 'Policy Library', href: '/policies/library' },
  { label: 'Regex Lab',      href: '/policies/regex-lab' },
  { label: 'Data Lab',       href: '/policies/test-data' },
]

export default function PoliciesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <SectionSidebar title="Policies" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
