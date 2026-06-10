'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, MinusCircle, Circle, Save } from 'lucide-react'
import type { AssessmentQuestion, CoverageStatus } from '@/lib/channel-taxonomy'
import { saveAssessmentAnswers } from '../actions'

interface Props {
  channelSlug:         string
  questions:           AssessmentQuestion[]
  initialAnswers:      Record<string, CoverageStatus>
}

const STATUS_OPTIONS: { value: CoverageStatus; label: string; icon: React.ReactNode; color: string }[] = [
  {
    value: 'not_assessed',
    label: 'Not Assessed',
    icon:  <Circle       className="w-4 h-4" />,
    color: 'text-muted-foreground',
  },
  {
    value: 'partial',
    label: 'Partial',
    icon:  <MinusCircle  className="w-4 h-4" />,
    color: 'text-amber-400',
  },
  {
    value: 'covered',
    label: 'Covered',
    icon:  <CheckCircle2 className="w-4 h-4" />,
    color: 'text-emerald-400',
  },
]

export function ChannelAssessment({ channelSlug, questions, initialAnswers }: Props) {
  const [answers, setAnswers] = useState<Record<string, CoverageStatus>>(initialAnswers)
  const [saved,   setSaved]   = useState(false)
  const [pending, startTransition] = useTransition()

  const counts = {
    not_assessed: questions.filter(q => (answers[q.key] ?? 'not_assessed') === 'not_assessed').length,
    partial:      questions.filter(q => answers[q.key] === 'partial').length,
    covered:      questions.filter(q => answers[q.key] === 'covered').length,
  }

  function setAnswer(key: string, status: CoverageStatus) {
    setSaved(false)
    setAnswers(prev => ({ ...prev, [key]: status }))
  }

  function handleSave() {
    startTransition(async () => {
      await saveAssessmentAnswers(channelSlug, answers)
      setSaved(true)
    })
  }

  return (
    <section className="space-y-4">
      {/* Header + summary counts */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Assessment</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Answer each question to contribute to your channel maturity score.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Circle       className="w-3.5 h-3.5" /> {counts.not_assessed} not assessed
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <MinusCircle  className="w-3.5 h-3.5" /> {counts.partial} partial
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> {counts.covered} covered
          </span>
        </div>
      </div>

      {/* Questions */}
      <div className="rounded-xl border border-border bg-card/40 divide-y divide-border overflow-hidden">
        {questions.map((q, i) => {
          const current = answers[q.key] ?? 'not_assessed'
          return (
            <div key={q.key} className="px-5 py-4">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-0.5">
                    {i + 1}. {q.area}
                  </p>
                  <p className="text-sm text-foreground/90">{q.question}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAnswer(q.key, opt.value)}
                      title={opt.label}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                        current === opt.value
                          ? opt.value === 'not_assessed'
                            ? 'bg-muted border-border-strong text-muted-foreground'
                            : opt.value === 'partial'
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          : 'bg-transparent border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:border-border',
                      )}
                    >
                      {opt.icon}
                      <span className="hidden sm:inline">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-muted disabled:text-muted-foreground/60 text-white text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Save className="w-3.5 h-3.5" />
          {pending ? 'Saving…' : 'Save Assessment'}
        </button>
      </div>
    </section>
  )
}
