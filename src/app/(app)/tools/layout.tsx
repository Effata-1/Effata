import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'

const ITEMS = [
  { label: 'Regex Lab',         href: '/tools/regex-lab' },
  { label: 'Data Lab',          href: '/tools/test-data' },
  { label: 'Control Validator', href: '/tools/control-validator' },
  { label: 'Evidence Report',   href: '/tools/evidence-report' },
]

export default async function ToolsLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SectionSidebar title="Tools" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
