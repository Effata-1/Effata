'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  LayoutDashboard,
  Building2,
  ArrowRightLeft,
  HardDrive,
  Monitor,
  Shield,
  Wrench,
  ClipboardList,
  Layers,
  Settings,
  ChevronRight,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href:  '/dashboard',
    base:  '/dashboard',
    icon:  <LayoutDashboard className="h-4 w-4" />,
    sub:   false,
  },
  {
    label: 'Architecture',
    href:  '/architecture/framework',
    base:  '/architecture',
    icon:  <Building2 className="h-4 w-4" />,
    sub:   true,
  },
  {
    label: 'Data in Motion',
    href:  '/data-in-motion/genai',
    base:  '/data-in-motion',
    icon:  <ArrowRightLeft className="h-4 w-4" />,
    sub:   true,
  },
  {
    label: 'Data at Rest',
    href:  '/data-at-rest/cloud-storage',
    base:  '/data-at-rest',
    icon:  <HardDrive className="h-4 w-4" />,
    sub:   true,
  },
  {
    label: 'Data in Use',
    href:  '/data-in-use/endpoint-activity',
    base:  '/data-in-use',
    icon:  <Monitor className="h-4 w-4" />,
    sub:   true,
  },
  {
    label: 'Policies',
    href:  '/policies/library',
    base:  '/policies',
    icon:  <Shield className="h-4 w-4" />,
    sub:   true,
  },
  {
    label: 'Tools',
    href:  '/tools/regex-lab',
    base:  '/tools',
    icon:  <Wrench className="h-4 w-4" />,
    sub:   true,
  },
  {
    label: 'Channels',
    href:  '/channels/email-dlp',
    base:  '/channels',
    icon:  <Layers className="h-4 w-4" />,
    sub:   true,
  },
  {
    label: 'Compliance',
    href:  '/compliance',
    base:  '/compliance',
    icon:  <ClipboardList className="h-4 w-4" />,
    sub:   true,
  },
]

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
