import { SectionSidebar } from '@/components/nav/section-sidebar'

const ITEMS = [
  { label: 'Regex Lab',         href: '/tools/regex-lab' },
  { label: 'Data Lab',          href: '/tools/test-data' },
  { label: 'Control Validator', href: '/tools/control-validator' },
]

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <SectionSidebar title="Tools" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
