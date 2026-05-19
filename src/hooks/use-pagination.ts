'use client'

import { useState } from 'react'

export function usePagination<T>(items: T[], defaultPerPage = 10, storageKey?: string) {
  const [page, setPage] = useState(1)
  const [perPage, setPerPageRaw] = useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`pagination_${storageKey}`)
      if (saved) return Number(saved)
    }
    return defaultPerPage
  })

  const total    = items.length
  const pages    = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(page, pages)
  const slice    = items.slice((safePage - 1) * perPage, safePage * perPage)

  function setPerPage(n: number) {
    setPerPageRaw(n)
    setPage(1)
    if (storageKey) localStorage.setItem(`pagination_${storageKey}`, String(n))
  }

  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const to   = Math.min(safePage * perPage, total)

  return { slice, page: safePage, pages, perPage, setPage, setPerPage, total, from, to }
}
