'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import { cn } from '@/lib/utils'
import { Shield, ArrowLeft, LogOut } from 'lucide-react'

interface NavItem { label: string; href: string }

interface Props {
  title: string
  items: NavItem[]
  backHref?: string
}

export function SectionSidebar({ title, items, backHref = '/dashboard' }: Props) {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen bg-card border-r border-border">
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-foreground" />
          </div>
          <span className="font-semibold text-foreground text-sm">Effata</span>
        </div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to app
        </Link>
      </div>

      <div className="px-4 py-4 border-b border-border">
        <h1 className="text-base font-bold text-foreground">{title}</h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {items.map(item => {
          const isActive = pathname === item.href
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

      <div className="px-3 py-3 border-t border-border">
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground/80 hover:text-foreground/70 hover:bg-accent/30 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
