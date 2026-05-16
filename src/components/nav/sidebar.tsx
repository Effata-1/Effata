'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  Building2,
  ArrowRightLeft,
  HardDrive,
  Monitor,
  Shield,
  ClipboardList,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  score?: number
  children?: { label: string; href: string }[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: 'Architecture',
    href: '/architecture',
    icon: <Building2 className="h-4 w-4" />,
    children: [
      { label: 'Global Framework', href: '/architecture/framework' },
      { label: 'Your Architecture', href: '/architecture/yours' },
      { label: 'Gap Analysis', href: '/architecture/gaps' },
    ],
  },
  {
    label: 'Data in Motion',
    href: '/data-in-motion',
    icon: <ArrowRightLeft className="h-4 w-4" />,
    children: [
      { label: 'Web & Cloud Traffic', href: '/data-in-motion/web' },
      { label: 'Email', href: '/data-in-motion/email' },
      { label: 'GenAI Apps', href: '/data-in-motion/genai' },
      { label: 'SaaS Applications', href: '/data-in-motion/saas' },
    ],
  },
  {
    label: 'Data at Rest',
    href: '/data-at-rest',
    icon: <HardDrive className="h-4 w-4" />,
    children: [
      { label: 'Cloud Storage', href: '/data-at-rest/cloud-storage' },
      { label: 'Endpoints', href: '/data-at-rest/endpoints' },
      { label: 'Databases', href: '/data-at-rest/databases' },
    ],
  },
  {
    label: 'Data in Use',
    href: '/data-in-use',
    icon: <Monitor className="h-4 w-4" />,
    children: [
      { label: 'Endpoint Activity', href: '/data-in-use/endpoint-activity' },
      { label: 'Copy/Paste Controls', href: '/data-in-use/copy-paste' },
      { label: 'Removable Media', href: '/data-in-use/removable-media' },
    ],
  },
  {
    label: 'Policies',
    href: '/policies',
    icon: <Shield className="h-4 w-4" />,
    children: [
      { label: 'Policy Library', href: '/policies/library' },
      { label: 'Regex Lab', href: '/policies/regex-lab' },
      { label: 'Test Data', href: '/policies/test-data' },
    ],
  },
  {
    label: 'Compliance',
    href: '/compliance',
    icon: <ClipboardList className="h-4 w-4" />,
    children: [
      { label: 'Regulations', href: '/compliance/regulations' },
      { label: 'Gap Report', href: '/compliance/gap-report' },
      { label: 'Audit Trail', href: '/compliance/audit-trail' },
    ],
  },
]

function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined) return null
  const colour =
    score >= 71 ? 'bg-green-500/20 text-green-400 border-green-500/30' :
    score >= 51 ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
    score >= 26 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
    score === -1 ? 'bg-zinc-700/50 text-zinc-500 border-zinc-600/30' :
    'bg-red-500/20 text-red-400 border-red-500/30'
  const label = score === -1 ? '?' : `${score}`
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', colour)}>
      {label}
    </span>
  )
}

function NavItemRow({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname()
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const [open, setOpen] = useState(isActive)

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
            'hover:bg-white/5',
            isActive ? 'text-white' : 'text-zinc-400'
          )}
        >
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
          <ScoreBadge score={item.score} />
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {open && (
          <div className="ml-6 mt-0.5 flex flex-col gap-0.5">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs transition-colors',
                  pathname === child.href
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                )}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
        isActive ? 'bg-white/10 text-white font-medium' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-300'
      )}
    >
      {item.icon}
      <span className="flex-1">{item.label}</span>
      <ScoreBadge score={item.score} />
    </Link>
  )
}

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 flex flex-col h-screen bg-zinc-900 border-r border-zinc-800">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-white text-sm">Effata</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItemRow key={item.href} item={item} />
        ))}
      </nav>

      {/* Bottom: settings + logout */}
      <div className="px-3 py-3 border-t border-zinc-800 space-y-0.5">
        <p className="text-xs text-zinc-600 truncate px-1 mb-1">Organisation workspace</p>
        <Link
          href="/settings"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Link>
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
