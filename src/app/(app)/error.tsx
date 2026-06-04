'use client'

import { useEffect } from 'react'
import { ShieldAlert, RotateCcw } from 'lucide-react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-full min-h-[400px] items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-amber-400" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground/70 leading-relaxed">
            {error.message
              ? error.message.length > 120
                ? error.message.slice(0, 120) + '…'
                : error.message
              : 'An unexpected error occurred. The team has been notified.'}
          </p>
          {error.digest && (
            <p className="text-[10px] text-muted-foreground/40 font-mono mt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Try again
        </button>
      </div>
    </div>
  )
}
