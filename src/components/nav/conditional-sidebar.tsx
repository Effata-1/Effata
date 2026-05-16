'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'

const SECTION_ROUTES = [
  '/settings',
  '/architecture',
  '/data-in-motion',
  '/data-at-rest',
  '/data-in-use',
  '/policies',
  '/compliance',
]

export function ConditionalSidebar() {
  const pathname = usePathname()
  if (SECTION_ROUTES.some(route => pathname.startsWith(route))) return null
  return <Sidebar />
}
