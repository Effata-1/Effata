import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'

const ITEMS = [
  { label: 'Setup Guide',           href: '/genai-controls' },
  { label: 'Dashboard',             href: '/genai-controls/dashboard' },
  { label: 'App Governance',        href: '/genai-controls/app-governance' },
  { label: 'App Catalog',           href: '/genai-controls/apps' },
  { label: 'Control Matrix',        href: '/genai-controls/control-matrix' },
  { label: 'Policy Library',        href: '/genai-controls/policies' },
  { label: 'Netskope Policies',     href: '/genai-controls/vendor-mapping/netskope/recommendation' },
  { label: 'Policy Flow',           href: '/genai-controls/vendor-mapping/netskope/architecture', indent: true },
  { label: 'Presentation',          href: '/genai-controls/presentation' },
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
