import { SectionNav } from '@/components/nav/section-nav'

const ITEMS = [
  { label: 'Web & Cloud Traffic', href: '/data-in-motion/web' },
  { label: 'Email',               href: '/data-in-motion/email' },
  { label: 'GenAI Apps',          href: '/data-in-motion/genai' },
  { label: 'SaaS Applications',   href: '/data-in-motion/saas' },
]

export default function DataInMotionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <SectionNav title="Data in Motion" items={ITEMS} />
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  )
}
