'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveOnboardingProgress, completeOnboarding } from '../actions'
import type { OnboardingData } from '../types'
import { Step1 } from './step1'
import { Step2 } from './step2'
import { Step3 } from './step3'
import { Step4 } from './step4'
import { Step5 } from './step5'

const STEPS = [
  { number: 1, title: 'Who are you?', subtitle: 'Industry and operating regions' },
  { number: 2, title: 'Your DLP tools', subtitle: 'Tools and licences you own' },
  { number: 3, title: 'Coverage today', subtitle: 'Confirm what is actually configured' },
  { number: 4, title: 'Policy maturity', subtitle: 'Your current DLP programme state' },
  { number: 5, title: 'Data priorities', subtitle: 'What matters most to protect' },
]

function canProceed(step: number, data: OnboardingData): boolean {
  switch (step) {
    case 1: return !!data.industry && data.regions.length > 0
    case 2: return data.tools.length > 0
    case 3: return true  // All areas default to unknown — always valid
    case 4: return !!data.policyPresence && !!data.policyMode && !!data.incidentReview
    case 5: return data.dataCategories.length > 0
    default: return false
  }
}

interface Props {
  initialData: OnboardingData
  initialStep: number
}

export function OnboardingWizard({ initialData, initialStep }: Props) {
  const [step, setStep] = useState(initialStep)
  const [direction, setDirection] = useState(1)
  const [data, setData] = useState<OnboardingData>(initialData)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const patch = (partial: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...partial }))
  }

  const goNext = () => {
    if (!canProceed(step, data)) return
    setError(null)
    setDirection(1)

    startTransition(async () => {
      const result = await saveOnboardingProgress(data, step + 1)
      if (result.error) {
        setError(result.error)
        return
      }
      setStep(s => s + 1)
    })
  }

  const goBack = () => {
    setDirection(-1)
    setStep(s => s - 1)
  }

  const finish = () => {
    if (!canProceed(5, data)) return
    setError(null)

    startTransition(async () => {
      const result = await completeOnboarding(data)
      if (result?.error) {
        setError(result.error)
      }
      // redirect happens inside completeOnboarding on success
    })
  }

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-foreground" />
          </div>
          <span className="font-semibold text-foreground text-sm">Effata</span>
        </div>
        <p className="text-xs text-muted-foreground/80">
          Step {step} of {STEPS.length}
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-muted">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${(step / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="px-6 pt-8 pb-2 flex items-center justify-center gap-2">
        {STEPS.map(s => (
          <div
            key={s.number}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              s.number < step ? 'w-6 bg-blue-600' :
              s.number === step ? 'w-8 bg-blue-500' :
              'w-6 bg-accent'
            )}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-start py-6 px-4 overflow-y-auto">
        <div className="w-full max-w-2xl">
          {/* Step heading */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-foreground">{STEPS[step - 1].title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{STEPS[step - 1].subtitle}</p>
          </div>

          {/* Animated step content */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {step === 1 && <Step1 data={data} onChange={patch} />}
              {step === 2 && <Step2 data={data} onChange={patch} />}
              {step === 3 && <Step3 data={data} onChange={patch} />}
              {step === 4 && <Step4 data={data} onChange={patch} />}
              {step === 5 && <Step5 data={data} onChange={patch} />}
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          {error && (
            <p className="mt-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="border-t border-border px-6 py-4 flex items-center justify-between">
        <button
          onClick={goBack}
          disabled={step === 1 || isPending}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            step === 1
              ? 'invisible'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/30 border border-border-strong hover:border-border-strong'
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-center gap-3">
          {/* Validation hint */}
          {!canProceed(step, data) && (
            <p className="text-xs text-muted-foreground/60 hidden sm:block">
              {step === 1 && 'Select an industry and at least one region.'}
              {step === 2 && 'Select at least one DLP tool.'}
              {step === 4 && 'Answer all three questions.'}
              {step === 5 && 'Select at least one data category.'}
            </p>
          )}

          {step < 5 ? (
            <button
              onClick={goNext}
              disabled={!canProceed(step, data) || isPending}
              className={cn(
                'flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all',
                canProceed(step, data) && !isPending
                  ? 'bg-blue-600 hover:bg-blue-500 text-foreground'
                  : 'bg-muted text-muted-foreground/80 cursor-not-allowed'
              )}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={!canProceed(5, data) || isPending}
              className={cn(
                'flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all',
                canProceed(5, data) && !isPending
                  ? 'bg-blue-600 hover:bg-blue-500 text-foreground'
                  : 'bg-muted text-muted-foreground/80 cursor-not-allowed'
              )}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Build my DLP city map →'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
