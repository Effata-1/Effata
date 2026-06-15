'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  LayoutDashboard,
  Building2,
  Bot,
  Shield,
  Wrench,
  ClipboardList,
  Package2,
  Settings,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { NAV } from '@/lib/nav'
import type { ReactNode } from 'react'

const SECTION_ICONS: Record<string, ReactNode> = {
  'home':          <LayoutDashboard className="h-4 w-4" />,
  'architecture':  <Building2 className="h-4 w-4" />,
  'genai-controls':<Bot className="h-4 w-4" />,
  'foundation':    <Shield className="h-4 w-4" />,
  'test-evidence': <Wrench className="h-4 w-4" />,
  'dlp-tools':     <Package2 className="h-4 w-4" />,
  'compliance':    <ClipboardList className="h-4 w-4" />,
}

// Build nav items from NAV — section-level only, settings excluded (shown in footer)
const NAV_ITEMS = NAV
  .filter(s => s.id !== 'settings')
  .map(s => ({
    label: s.label,
    href:  s.pages[0].route,
    base:  '/' + s.pages[0].route.split('/')[1],
    icon:  SECTION_ICONS[s.id] ?? <Shield className="h-4 w-4" />,
    sub:   s.pages.length > 1,
  }))

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-foreground text-sm">Effata</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.base || pathname.startsWith(item.base + '/')
          return (
            <Link
              key={item.base}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground'
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.sub && (
                <ChevronRight className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  isActive ? 'text-muted-foreground' : 'text-muted-foreground/40'
                )} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: theme toggle + settings + sign out */}
      <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
        <div className="px-1">
          <ThemeToggle />
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground/40 truncate px-2">Organisation workspace</p>
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors',
              pathname.startsWith('/settings')
                ? 'text-foreground/70'
                : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
