'use client'

import { useState } from 'react'

export function usePagination<T>(items: T[], defaultPerPage = 25) {
  const [page,    setPage]    = useState(1)
  const [perPage, setPerPageRaw] = useState(defaultPerPage)

  const total  = items.length
  const pages  = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(page, pages)
  const slice  = items.slice((safePage - 1) * perPage, safePage * perPage)

  function setPerPage(n: number) { setPerPageRaw(n); setPage(1) }

  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const to   = Math.min(safePage * perPage, total)

  return { slice, page: safePage, pages, perPage, setPage, setPerPage, total, from, to }
}
