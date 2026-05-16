import { SectionNav } from '@/components/nav/section-nav'

const ITEMS = [
  { label: 'Global Framework',  href: '/architecture/framework' },
  { label: 'Your Architecture', href: '/architecture/yours' },
  { label: 'Gap Analysis',      href: '/architecture/gaps' },
]

export default function ArchitectureLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <SectionNav title="Architecture" items={ITEMS} />
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  )
}
