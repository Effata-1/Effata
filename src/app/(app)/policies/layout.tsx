import { SectionNav } from '@/components/nav/section-nav'

const ITEMS = [
  { label: 'Policy Library', href: '/policies/library' },
  { label: 'Regex Lab',      href: '/policies/regex-lab' },
  { label: 'Test Data',      href: '/policies/test-data' },
]

export default function PoliciesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <SectionNav title="Policies" items={ITEMS} />
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  )
}
