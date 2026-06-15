'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'

export function ThemeToaster() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Render nothing server-side to avoid hydration mismatch on theme class
  if (!mounted) return null

  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      richColors
      closeButton
    />
  )
}
