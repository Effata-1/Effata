'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { NAV } from '@/lib/nav'

// Derived from NAV — all section base paths suppress the main sidebar
const SECTION_ROUTES = [
  ...new Set(
    NAV.flatMap(s => s.pages).map(p => '/' + p.route.split('/')[1])
  ),
]

export function ConditionalSidebar() {
  const pathname = usePathname()
  if (SECTION_ROUTES.some(route => pathname.startsWith(route))) return null
  return <Sidebar />
}
