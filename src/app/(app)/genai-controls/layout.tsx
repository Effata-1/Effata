import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'
import { NAV } from '@/lib/nav'

// Setup Guide and Dashboard are section-local (not in the GenAI spine)
const STATIC_PREFIX = [
  { label: 'Setup Guide', href: '/genai-controls' },
  { label: 'Dashboard',   href: '/genai-controls/dashboard' },
]

// Spine steps 1–7 derived from NAV, with step numbers and deliverable badges
const SPINE_ITEMS = NAV
  .find(s => s.id === 'genai-controls')!
  .pages
  .sort((a, b) => (a.step ?? 0) - (b.step ?? 0))
  .map(p => ({ label: p.label, href: p.route, step: p.step, badge: p.badge }))

// Policy Flow is a sub-page of the Netskope policy pack (indented, no step)
const POLICY_FLOW = { label: 'Policy Flow', href: '/genai-controls/netskope-pack/flow', indent: true as const }

const ITEMS = [
  ...STATIC_PREFIX,
  ...SPINE_ITEMS,
  POLICY_FLOW,
]

export default async function GenAIControlsLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SectionSidebar title={NAV.find(s => s.id === 'genai-controls')!.label} items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
