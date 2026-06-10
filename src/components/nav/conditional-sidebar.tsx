'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'

// Routes with their own section sidebar. Dashboard intentionally keeps the main app nav.
const SECTION_ROUTES = [
  '/architecture',
  '/genai-controls',
  '/foundation',
  '/tools',
  '/dlp-tools',
  '/compliance',
  '/settings',
  '/data-at-rest',
  '/data-in-motion',
  '/data-in-use',
]

export function ConditionalSidebar() {
  const pathname = usePathname()
  if (SECTION_ROUTES.some(route => pathname.startsWith(route))) return null
  return <Sidebar />
}
