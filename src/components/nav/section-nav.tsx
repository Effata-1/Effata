'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem { label: string; href: string }

interface Props {
  title: string
  items: NavItem[]
}

export function SectionNav({ title, items }: Props) {
  const pathname = usePathname()

  return (
    <aside className="w-52 shrink-0 border-r border-zinc-800 bg-zinc-900/40 flex flex-col overflow-y-auto">
      <div className="px-4 py-5 border-b border-zinc-800">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{title}</p>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-300 hover:bg-white/5'
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
