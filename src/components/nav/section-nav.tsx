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
    <aside className="w-52 shrink-0 border-r border-border bg-card/40 flex flex-col overflow-y-auto">
      <div className="px-4 py-5 border-b border-border">
        <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">{title}</p>
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
                  ? 'bg-accent/50 text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground/70 hover:bg-accent/30'
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
