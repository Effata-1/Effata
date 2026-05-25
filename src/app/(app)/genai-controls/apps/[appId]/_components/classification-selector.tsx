'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { colorClasses } from '@/lib/data-catalog/types'
import { setCustomerClassification } from '@/app/(app)/data-in-motion/genai/[appId]/actions'
import type { CustomerClass } from '@/lib/genai/types'

export interface GovernanceCategory {
  id:         string
  system_tag: string | null
  name:       string
  color:      string
}

// Always include Unknown as a fallback (no system_tag)
const UNKNOWN_OPTION = { system_tag: 'unknown', name: 'Unknown', color: 'zinc' }

interface Props {
  appId:      string
  orgId:      string | null
  currentClassification: CustomerClass
  categories: GovernanceCategory[]
}

export function ClassificationSelector({ appId, orgId, currentClassification, categories }: Props) {
  const [selected, setSelected]   = useState<CustomerClass>(currentClassification)
  const [saved, setSaved]         = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSelect = (value: CustomerClass) => {
    setSelected(value)
    setSaved(false)
    if (!orgId) return
    startTransition(async () => {
      await setCustomerClassification(appId, orgId, value, selected)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  // Build option list from live categories + unknown fallback
  const options = [
    ...categories.map(c => ({ value: (c.system_tag ?? c.id) as CustomerClass, name: c.name, color: c.color })),
    { value: 'unknown' as CustomerClass, name: UNKNOWN_OPTION.name, color: UNKNOWN_OPTION.color },
  ]

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const cc = colorClasses(opt.color)
          const isSelected = selected === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              disabled={isPending}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                isSelected
                  ? cn(cc.bg, cc.text, cc.border)
                  : 'border-border bg-transparent text-muted-foreground/70 hover:border-border-strong hover:text-foreground/70',
              )}
            >
              {opt.name}
            </button>
          )
        })}
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/80 self-center" />}
        {saved && <span className="text-xs text-emerald-400 self-center">Saved</span>}
      </div>
      {!orgId && (
        <p className="text-xs text-muted-foreground/60 mt-2">Sign in to set your organisation&apos;s classification.</p>
      )}
    </div>
  )
}
