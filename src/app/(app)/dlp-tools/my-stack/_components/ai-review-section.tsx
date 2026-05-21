'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { requestCoverageReview } from '../actions'

interface Gap {
  channel: string
  severity: string
  description: string
}

interface Recommendation {
  priority: number
  title: string
  description: string
}

interface AiReview {
  id: string
  coverage_score: number | null
  gaps: Gap[]
  recommendations: Recommendation[]
  reviewed_at: string
  review_type: string
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

export function AiReviewSection({ latestReview }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [requested, setRequested] = useState(false)

  function handleRequest() {
    setError(null)
    startTransition(async () => {
      try {
        await requestCoverageReview()
        setRequested(true)
      } catch {
        setError('Review request failed. Please try again.')
      }
    })
  }

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
            disabled={isPending || requested}
            className={cn(
              'px-3 py-1.5 text-xs rounded-md transition-colors',
              requested
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50',
            )}
          >
            {isPending ? 'Requesting…' : requested ? 'Review Requested' : 'Request AI Review'}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>

      {!latestReview ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-1">
          <p className="text-sm text-muted-foreground">No AI review yet.</p>
          <p className="text-xs text-muted-foreground/60">Request one above or wait for the monthly automated review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Meta bar */}
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

          {/* Gaps */}
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

          {/* Recommendations */}
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
