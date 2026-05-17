'use client'

import { useState, useTransition } from 'react'
import { Play } from 'lucide-react'
import { triggerComplianceCheck } from '../actions'

export function TriggerButton() {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  function run() {
    setMessage('')
    startTransition(async () => {
      const result = await triggerComplianceCheck()
      if (result.error) {
        setMessage(`Error: ${result.error}`)
      } else {
        setMessage(`Done — ${result.regs_checked} checked, ${result.regs_updated} updated`)
        window.location.reload()
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <button
        onClick={run}
        disabled={isPending}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
      >
        <Play className="h-3.5 w-3.5" />
        {isPending ? 'Running…' : 'Run now'}
      </button>
      {message && !message.startsWith('Done') && (
        <p className="text-xs text-red-400">{message}</p>
      )}
    </div>
  )
}
