'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const SECTIONS = [
  {
    title: 'General',
    items: [
      { label: 'Tools Connected', href: '/settings/tools' },
      { label: 'Team',            href: '/settings/team' },
      { label: 'Integrations',    href: '/settings/integrations' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Audit Logs', href: '/settings/admin/audit-log' },
    ],
  },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="w-44 shrink-0">
      <h1 className="text-xl font-bold text-white mb-6">Settings</h1>
      <div className="space-y-5">
        {SECTIONS.map(section => (
          <div key={section.title}>
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest px-2 mb-1">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'block px-2 py-1.5 rounded-md text-sm transition-colors',
                    pathname === item.href || pathname.startsWith(item.href + '/')
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}
