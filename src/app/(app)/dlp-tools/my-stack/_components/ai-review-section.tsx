'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { requestCoverageReview, getJobStatus } from '../actions'

interface Gap {
  channel:     string
  severity:    string
  description: string
}

interface Recommendation {
  priority:    number
  title:       string
  description: string
}

interface AiReview {
  id:              string
  coverage_score:  number | null
  gaps:            Gap[]
  recommendations: Recommendation[]
  reviewed_at:     string
  review_type:     string
}

interface Props {
  latestReview: AiReview | null
}

const SCORE_STYLE = (score: number) => {
  if (score >= 75) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
  if (score >= 50) return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
  return 'bg-red-500/15 text-red-400 border-red-500/20'
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  high:     'text-orange-400 bg-orange-500/10 border-orange-500/20',
  medium:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
  low:      'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

type PollStatus = 'idle' | 'polling' | 'completed' | 'failed'

export function AiReviewSection({ latestReview }: Props) {
  const router                          = useRouter()
  const [isPending, startTransition]    = useTransition()
  const [error, setError]               = useState<string | null>(null)
  const [pollStatus, setPollStatus]     = useState<PollStatus>('idle')
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
        const { status } = await getJobStatus(jobId)
        if (status === 'completed') {
          stopPolling()
          setPollStatus('completed')
          router.refresh()
        } else if (status === 'failed') {
          stopPolling()
          setPollStatus('failed')
          setError('Review failed. Please try again.')
        }
      } catch {
        stopPolling()
        setPollStatus('failed')
        setError('Could not check review status. Please refresh the page.')
      } finally {
        inflightRef.current = false
      }
    }, 3000)
  }

  function handleRequest() {
    setError(null)
    startTransition(async () => {
      try {
        const { jobId } = await requestCoverageReview()
        startPolling(jobId)
      } catch {
        setError('Review request failed. Please try again.')
      }
    })
  }

  const isActive    = isPending || pollStatus === 'polling'
  const isDone      = pollStatus === 'completed'
  const buttonLabel =
    isPending              ? 'Requesting…'
    : pollStatus === 'polling'   ? 'Analysing…'
    : pollStatus === 'completed' ? 'Review Complete'
    : 'Request AI Review'

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI Coverage Review</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Claude reviews your tool stack and assessment answers to identify gaps and recommend improvements. Runs monthly on the 1st.
          </p>
        </div>
        <div className="shrink-0 space-y-1.5 text-right">
          <button
            type="button"
            onClick={handleRequest}
            disabled={isActive || isDone}
            className={cn(
              'px-3 py-1.5 text-xs rounded-md transition-colors',
              isDone
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
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
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>

      {pollStatus === 'polling' && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-center space-y-1">
          <p className="text-sm text-blue-400 font-medium">Analysing your DLP coverage…</p>
          <p className="text-xs text-muted-foreground">Claude is reviewing your tool stack and channel assessments. This takes about 30 seconds.</p>
        </div>
      )}

      {pollStatus !== 'polling' && !latestReview && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-1">
          <p className="text-sm text-muted-foreground">No AI review yet.</p>
          <p className="text-xs text-muted-foreground/60">Request one above or wait for the monthly automated review.</p>
        </div>
      )}

      {pollStatus !== 'polling' && latestReview && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={cn(
              'px-3 py-1 rounded-lg border text-sm font-bold',
              SCORE_STYLE(latestReview.coverage_score ?? 0),
            )}>
              Score: {latestReview.coverage_score ?? '—'}/100
            </span>
            <span className="text-xs text-muted-foreground">
              Last reviewed {new Date(latestReview.reviewed_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
            <span className="text-xs text-muted-foreground/50 capitalize">
              {latestReview.review_type === 'scheduled' ? 'Automated' : 'Manual'} review
            </span>
          </div>

          {latestReview.gaps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-foreground/80">Coverage Gaps</h3>
              <div className="space-y-2">
                {latestReview.gaps.map((gap, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card/40 p-3 flex items-start gap-3">
                    <span className={cn(
                      'shrink-0 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide mt-0.5',
                      SEVERITY_STYLES[gap.severity] ?? SEVERITY_STYLES.medium,
                    )}>
                      {gap.severity}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground/80">{gap.channel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{gap.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {latestReview.recommendations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-foreground/80">Recommendations</h3>
              <div className="space-y-2">
                {latestReview.recommendations.map((rec, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card/40 p-3 flex items-start gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {rec.priority}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground/80">{rec.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
