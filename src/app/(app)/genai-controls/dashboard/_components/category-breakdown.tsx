'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { colorClasses } from '@/lib/data-catalog/types'
import { cn } from '@/lib/utils'

export interface CategoryItem {
  key:   string
  name:  string
  color: string
  count: number
}

interface Props {
  items: CategoryItem[]
}

export function CategoryBreakdown({ items }: Props) {
  const shouldReduceMotion = useReducedMotion()
  const visible = items.filter(i => i.count > 0)

  if (visible.length === 0) {
    return <p className="text-xs text-muted-foreground/50">No apps classified yet.</p>
  }

  const maxCount = Math.max(...visible.map(i => i.count), 1)

  return (
    <div className="space-y-2.5">
      {visible.map((item, index) => {
        const cc  = colorClasses(item.color)
        const pct = Math.round((item.count / maxCount) * 100)
        return (
          <div key={item.key}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full shrink-0', cc.bg)} />
                <span className="text-xs text-foreground/80">{item.name}</span>
              </div>
              <span className="text-xs font-semibold text-foreground/70">{item.count}</span>
            </div>
            <div className="w-full bg-muted/40 rounded-full h-1.5">
              <motion.div
                className={cn('h-1.5 rounded-full opacity-70', cc.bg)}
                initial={shouldReduceMotion ? false : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.6, delay: index * 0.05, ease: 'easeOut' }
                }
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
