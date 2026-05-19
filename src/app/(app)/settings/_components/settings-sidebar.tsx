'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import { cn } from '@/lib/utils'
import { Shield, ArrowLeft, LogOut } from 'lucide-react'

const GENERAL_ITEMS = [
  { label: 'Tools Connected', href: '/settings/tools' },
  { label: 'Team',            href: '/settings/team' },
  { label: 'Integrations',    href: '/settings/integrations' },
]

const ADMIN_ITEMS = [
  { label: 'Audit Log', href: '/settings/admin/audit-log' },
  { label: 'Cron Runs', href: '/settings/admin/cron-runs' },
  { label: 'AI Logs',   href: '/settings/admin/ai-logs' },
]

export function SettingsSidebar({ role }: { role: string }) {
  const pathname = usePathname()

  const navLink = (item: { label: string; href: string }) => (
    <Link
      key={item.href}
      href={item.href}
      className={cn(
        'block px-3 py-2 rounded-md text-sm transition-colors',
        pathname === item.href || pathname.startsWith(item.href + '/')
          ? 'bg-white/10 text-white font-medium'
          : 'text-zinc-400 hover:text-zinc-300 hover:bg-white/5'
      )}
    >
      {item.label}
    </Link>
  )

  return (
    <aside className="w-52 shrink-0 flex flex-col h-screen bg-zinc-900 border-r border-zinc-800">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-white text-sm">Effata</span>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to app
        </Link>
      </div>

      {/* Settings title */}
      <div className="px-4 py-4 border-b border-zinc-800">
        <h1 className="text-base font-bold text-white">Settings</h1>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <div>
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest px-3 mb-1">
            General
          </p>
          <div className="space-y-0.5">
            {GENERAL_ITEMS.map(navLink)}
          </div>
        </div>

        {role === 'admin' && (
          <div>
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest px-3 mb-1">
              Admin
            </p>
            <div className="space-y-0.5">
              {ADMIN_ITEMS.map(navLink)}
            </div>
          </div>
        )}
      </nav>

      {/* Footer: sign out */}
      <div className="px-3 py-3 border-t border-zinc-800">
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
