'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Sparkles, PenLine } from 'lucide-react'
import { createReport } from '../actions'
import { AIReportBuilder } from '../_components/ai-report-builder'
import type { ReportType } from '../actions'

const REPORT_TYPES: { value: ReportType; label: string; desc: string }[] = [
  { value: 'control_validation', label: 'Control Validation',    desc: 'Validates that specific DLP controls are configured and firing correctly' },
  { value: 'regulation',         label: 'Regulation Compliance', desc: 'Maps tests to specific regulation articles (GDPR, HIPAA, PCI-DSS)' },
  { value: 'executive',          label: 'Executive Summary',     desc: 'High-level summary for CISOs and senior stakeholders' },
  { value: 'regression',         label: 'Regression Test',       desc: 'Verifies controls still work after policy or infrastructure changes' },
  { value: 'single_test',        label: 'Single Test',           desc: 'Documents a single focused test case for a specific gap or incident' },
]

const ENVIRONMENTS = ['UAT', 'Production', 'Staging', 'Development', 'Lab']

type Tab = 'manual' | 'ai'

// ── Manual form ───────────────────────────────────────────────────────────────

function ManualForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName]             = useState('')
  const [assessedOn, setAssessedOn] = useState(new Date().toISOString().slice(0, 10))
  const [testedBy, setTestedBy]     = useState('')
  const [environment, setEnvironment] = useState('UAT')
  const [reportType, setReportType]   = useState<ReportType>('control_validation')
  const [notes, setNotes]             = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim())    { setError('Report name is required'); return }
    if (!testedBy.trim()) { setError('Tested by is required'); return }

    startTransition(async () => {
      const result = await createReport({ name, assessedOn, testedBy, environment, reportType, notes })
      if (result.error) { setError(result.error); return }
      router.push(`/tools/evidence-report/${result.id}?mode=edit`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      {/* Report Name */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Report Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Q2 2026 — Netskope Web DLP Control Validation"
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Row: Date + Tested By */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Assessment Date <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={assessedOn}
            onChange={e => setAssessedOn(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Tested By <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={testedBy}
            onChange={e => setTestedBy(e.target.value)}
            placeholder="Name or team"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Row: Environment + Report Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Environment</label>
          <select
            value={environment}
            onChange={e => setEnvironment(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            {ENVIRONMENTS.map(env => <option key={env} value={env}>{env}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Report Type</label>
          <select
            value={reportType}
            onChange={e => setReportType(e.target.value as ReportType)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <p className="text-xs text-zinc-600 -mt-2">
        {REPORT_TYPES.find(t => t.value === reportType)?.desc}
      </p>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Notes <span className="text-zinc-600">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Scope, objectives, or context for this test run…"
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
        />
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">{error}</div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded transition-colors"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Create Report
        </button>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewReportPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('ai')

  const tabCls = (active: boolean) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-zinc-800 text-white'
        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
    }`

  return (
    <div className={tab === 'ai' ? 'w-full' : 'max-w-2xl'}>
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to reports
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">New Evidence Report</h1>
        <p className="text-zinc-500 text-sm">
          Build manually or let AI guide you through describing your DLP tests.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('ai')} className={tabCls(tab === 'ai')}>
          <Sparkles className="w-4 h-4" />
          AI Assistant
        </button>
        <button onClick={() => setTab('manual')} className={tabCls(tab === 'manual')}>
          <PenLine className="w-4 h-4" />
          Manual
        </button>
      </div>

      {tab === 'ai'     && <AIReportBuilder />}
      {tab === 'manual' && <ManualForm />}
    </div>
  )
}
