'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

export function ThemeRestorer({ savedTheme }: { savedTheme: string }) {
  const { setTheme } = useTheme()
  useEffect(() => {
    setTheme(savedTheme)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
