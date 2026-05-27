'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { requestPolicyPackJob, getPolicyPackJobStatus } from '../actions'

interface Props {
  hasPolicyPackPolicies: boolean
  userRole:              string
}

type PollStatus = 'idle' | 'polling' | 'completed' | 'failed'

export function AiPolicyPackSection({ hasPolicyPackPolicies, userRole }: Props) {
  const router                          = useRouter()
  const [isPending, startTransition]    = useTransition()
  const [error, setError]               = useState<string | null>(null)
  const [pollStatus, setPollStatus]     = useState<PollStatus>('idle')
  const [processedItems, setProcessedItems] = useState<number | null>(null)
  const [totalItems, setTotalItems]     = useState<number | null>(null)
  const intervalRef                     = useRef<ReturnType<typeof setInterval> | null>(null)
  const inflightRef                     = useRef(false)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function startPolling(jobId: string) {
    setPollStatus('polling')
    intervalRef.current = setInterval(async () => {
      if (inflightRef.current) return
      inflightRef.current = true
      try {
        const job = await getPolicyPackJobStatus(jobId)
        if (job.totalItems !== null) setTotalItems(job.totalItems)
        if (job.processedItems !== null) setProcessedItems(job.processedItems)

        if (job.status === 'completed') {
          stopPolling()
          setPollStatus('completed')
          router.refresh()
        } else if (job.status === 'failed') {
          stopPolling()
          setPollStatus('failed')
          setError(job.error ?? 'Policy pack generation failed. Please try again.')
        }
      } catch {
        stopPolling()
        setPollStatus('failed')
        setError('Could not check job status. Please refresh the page.')
      } finally {
        inflightRef.current = false
      }
    }, 3000)
  }

  function handleRequest() {
    setError(null)
    setProcessedItems(null)
    setTotalItems(null)
    startTransition(async () => {
      try {
        const { jobId } = await requestPolicyPackJob()
        startPolling(jobId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed. Please try again.')
      }
    })
  }

  const isAdmin    = userRole === 'admin'
  const isActive   = isPending || pollStatus === 'polling'
  const isDone     = pollStatus === 'completed' || hasPolicyPackPolicies

  const buttonLabel =
    isPending              ? 'Requesting…'
    : pollStatus === 'polling'   ? 'Generating…'
    : pollStatus === 'completed' ? 'Policies Generated'
    : hasPolicyPackPolicies      ? 'AI Policies Generated'
    : 'Request AI Policy Pack'

  const progressPct =
    totalItems && totalItems > 0 && processedItems !== null
      ? Math.round((processedItems / totalItems) * 100)
      : null

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI Policy Pack</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Claude analyses your coverage gaps and org profile to generate targeted draft policy recommendations.
            {!isAdmin && (
              <span className="ml-1 text-muted-foreground/50">Admin only.</span>
            )}
          </p>
        </div>
        <div className="shrink-0 space-y-1.5 text-right">
          <button
            type="button"
            onClick={handleRequest}
            disabled={!isAdmin || isActive || isDone}
            className={cn(
              'px-3 py-1.5 text-xs rounded-md transition-colors',
              isDone
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : !isAdmin
                  ? 'bg-muted/50 text-muted-foreground cursor-not-allowed border border-border'
                  : isActive
                    ? 'bg-blue-600/50 text-white/70 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700',
            )}
          >
            {isActive && (
              <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white/40 border-t-white animate-spin mr-1.5 align-[-1px]" />
            )}
            {buttonLabel}
          </button>
          {error && <p className="text-xs text-red-400 max-w-xs">{error}</p>}
        </div>
      </div>

      {pollStatus === 'polling' && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
          <p className="text-sm text-blue-400 font-medium text-center">Generating AI policy recommendations…</p>
          <p className="text-xs text-muted-foreground text-center">
            Claude is analysing your coverage gaps and org profile. This takes about 30 seconds.
          </p>
          {progressPct !== null && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-muted-foreground/60 mb-1">
                <span>Step {processedItems}/{totalItems}</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-blue-500/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
