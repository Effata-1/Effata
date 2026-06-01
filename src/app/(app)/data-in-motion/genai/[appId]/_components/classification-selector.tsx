'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import { setCustomerClassification } from '../actions'
import type { CustomerClass } from '@/lib/genai/types'

const OPTIONS: { value: CustomerClass; description: string }[] = [
  { value: 'enterprise-approved',        description: 'Allow as approved enterprise AI destination.' },
  { value: 'approved-with-conditions',   description: 'Allow only under defined data/user/activity conditions.' },
  { value: 'permitted-with-restriction', description: 'Allow limited usage with monitoring/coaching.' },
  { value: 'personal',                   description: 'Treat as personal/unmanaged AI destination.' },
  { value: 'unknown',                    description: 'Unassessed — treat as unknown until reviewed.' },
  { value: 'prohibited',                 description: 'Block regardless of system trust score.' },
]

interface Props {
  appId: string
  orgId: string | null
  currentClassification: CustomerClass
}

export function ClassificationSelector({ appId, orgId, currentClassification }: Props) {
  const [selected, setSelected] = useState<CustomerClass>(currentClassification)
  const [saved, setSaved] = useState(false)
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

  const COLOR_MAP: Record<string, string> = {
    green:  'border-green-500/60 bg-green-500/10 text-green-500',
    blue:   'border-blue-500/60 bg-blue-500/10 text-blue-500',
    amber:  'border-yellow-500/60 bg-yellow-500/10 text-yellow-300',
    purple: 'border-purple-500/60 bg-purple-500/10 text-purple-300',
    red:    'border-red-500/60 bg-red-500/10 text-red-300',
    zinc:   'border-border-strong bg-muted/60 text-foreground/70',
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(opt => {
          const meta = CLASSIFICATION_LABELS[opt.value]
          const isSelected = selected === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              disabled={isPending}
              title={opt.description}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                isSelected
                  ? COLOR_MAP[meta.color] ?? COLOR_MAP.zinc
                  : 'border-border-strong bg-transparent text-muted-foreground/80 hover:border-border-strong hover:text-foreground/70'
              )}
            >
              {meta.label}
            </button>
          )
        })}
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/80 self-center" />}
        {saved && <span className="text-xs text-green-400 self-center">Saved</span>}
      </div>
      {!orgId && (
        <p className="text-xs text-muted-foreground/60 mt-2">Sign in to set your organisation&apos;s classification.</p>
      )}
    </div>
  )
}
