import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'

const ITEMS = [
  { label: 'App Governance', href: '/genai-controls/app-governance' },
  { label: 'App Catalog',    href: '/genai-controls/apps' },
  { label: 'Policy Matrix',  href: '/genai-controls/policy-matrix' },
]

export default async function GenAIControlsLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SectionSidebar title="GenAI Controls" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
