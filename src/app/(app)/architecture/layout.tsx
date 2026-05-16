import { SectionSidebar } from '@/components/nav/section-sidebar'

const ITEMS = [
  { label: 'Global Framework',  href: '/architecture/framework' },
  { label: 'Your Architecture', href: '/architecture/yours' },
  { label: 'Gap Analysis',      href: '/architecture/gaps' },
]

export default function ArchitectureLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <SectionSidebar title="Architecture" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
