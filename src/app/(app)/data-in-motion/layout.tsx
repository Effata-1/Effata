import { SectionSidebar } from '@/components/nav/section-sidebar'
import { requireRole } from '@/lib/auth'

const ITEMS = [
  { label: 'Web & Cloud Traffic',  href: '/data-in-motion/web' },
  { label: 'Email',                href: '/data-in-motion/email' },
  { label: 'GenAI Apps',           href: '/data-in-motion/genai' },
  { label: 'SaaS Applications',    href: '/data-in-motion/saas' },
]

export default async function DataInMotionLayout({ children }: { children: React.ReactNode }) {
  await requireRole('analyst')
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <SectionSidebar title="Data in Motion" items={ITEMS} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
