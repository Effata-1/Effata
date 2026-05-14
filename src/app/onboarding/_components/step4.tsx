'use client'

import { cn } from '@/lib/utils'
import {
  POLICY_PRESENCE_OPTIONS,
  POLICY_MODE_OPTIONS,
  INCIDENT_REVIEW_OPTIONS,
} from '@/lib/onboarding/data'
import type { OnboardingData } from '../types'

interface Props {
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
}

function QuestionGroup({
  label,
  subtitle,
  options,
  value,
  onSelect,
}: {
  label: string
  subtitle?: string
  options: string[]
  value: string
  onSelect: (v: string) => void
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={cn(
              'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
              value === opt
                ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300'
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Step4({ data, onChange }: Props) {
  return (
    <div className="space-y-8">
      <QuestionGroup
        label="Do you already have DLP policies in production?"
        subtitle="Policies that are actively running, even in monitor mode."
        options={POLICY_PRESENCE_OPTIONS}
        value={data.policyPresence}
        onSelect={v => onChange({ policyPresence: v })}
      />

      <QuestionGroup
        label="What mode are most of your DLP policies in?"
        subtitle="Monitor watches and logs. Coach warns users. Block prevents the action."
        options={POLICY_MODE_OPTIONS}
        value={data.policyMode}
        onSelect={v => onChange({ policyMode: v })}
      />

      <QuestionGroup
        label="Do you review DLP incidents regularly?"
        subtitle="Regular review means at least monthly triage of DLP incident queues."
        options={INCIDENT_REVIEW_OPTIONS}
        value={data.incidentReview}
        onSelect={v => onChange({ incidentReview: v })}
      />
    </div>
  )
}
