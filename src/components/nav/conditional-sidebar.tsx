'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'

const SECTION_ROUTES = [
  '/settings',
  '/architecture',
  '/genai-controls',
  '/policies',
  '/tools',
  '/compliance',
  '/dlp-tools',
]

export function ConditionalSidebar() {
  const pathname = usePathname()
  if (SECTION_ROUTES.some(route => pathname.startsWith(route))) return null
  return <Sidebar />
}
