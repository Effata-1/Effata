'use client'

import { useTheme } from 'next-themes'
import { Sun, Monitor, Moon, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light',  Icon: Sun,     label: 'Light',  desc: 'Always use light theme'   },
  { value: 'system', Icon: Monitor, label: 'System', desc: 'Follow device preference' },
  { value: 'dark',   Icon: Moon,    label: 'Dark',   desc: 'Always use dark theme'    },
] as const

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="grid grid-cols-3 gap-3">
      {OPTIONS.map(({ value, Icon, label, desc }) => {
        const active = theme === value
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              'flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all text-center',
              active
                ? 'border-blue-500/50 bg-blue-500/10 text-foreground'
                : 'border-border bg-card/40 text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center',
              active ? 'bg-blue-500/20' : 'bg-muted/50',
            )}>
              <Icon className="w-[18px] h-[18px]" />
            </div>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            {active && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </button>
        )
      })}
    </div>
  )
}
