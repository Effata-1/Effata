'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Edit3, Eye, Printer, Plus, Trash2, Pencil, Loader2,
  CheckCircle2, XCircle, AlertCircle, ChevronDown, Save,
} from 'lucide-react'
import { updateReport, deleteTest } from '../actions'
import type {
  EvidenceReport, ReportTest, OverallResult, ReportType,
  Severity, ActualResult, FinalStatus, GapReason,
} from '../actions'
import { AddTestModal } from './add-test-modal'

// ── Label maps ────────────────────────────────────────────────────────────────

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  single_test:        'Single Test',
  control_validation: 'Control Validation',
  regulation:         'Regulation Compliance',
  executive:          'Executive Summary',
  regression:         'Regression Test',
}

const OVERALL_LABELS: Record<OverallResult, string> = {
  passed:           'Passed',
  partially_passed: 'Partially Passed',
  failed:           'Failed',
  inconclusive:     'Inconclusive',
}

const ACTUAL_RESULT_LABELS: Record<ActualResult, string> = {
  blocked:             'Blocked',
  allowed_with_alert:  'Allowed with Alert',
  allowed_with_coach:  'Allowed with Coach',
  allowed_no_alert:    'Allowed — No Alert',
  not_inspected:       'Not Inspected',
  test_failed:         'Test Failed',
  inconclusive:        'Inconclusive',
}

const EXPECTED_RESULT_LABELS = {
  block:        'Block',
  allow_alert:  'Allow with Alert',
  allow_coach:  'Allow with Coach',
  allow:        'Allow',
}

const GAP_REASON_LABELS: Record<GapReason, string> = {
  policy_not_configured:    'Policy Not Configured',
  monitor_mode:             'Monitor Mode Only',
  ssl_inspection_missing:   'SSL Inspection Missing',
  user_not_in_scope:        'User Not in Scope',
  destination_not_in_scope: 'Destination Not in Scope',
  regex_too_weak:           'Regex Pattern Too Weak',
  file_type_unsupported:    'File Type Not Supported',
  activity_unsupported:     'Activity Not Supported',
  threshold_too_high:       'Threshold Too High',
  other:                    'Other',
}

const SEVERITY_COLOURS: Record<Severity, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high:     'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low:      'bg-zinc-700/50 text-zinc-400 border-zinc-600/30',
}

const STATUS_COLOURS: Record<FinalStatus, string> = {
  passed:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed:      'bg-red-500/15 text-red-400 border-red-500/30',
  inconclusive:'bg-zinc-700/50 text-zinc-400 border-zinc-600/30',
}

const OVERALL_COLOURS: Record<OverallResult, string> = {
  passed:           'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  partially_passed: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  failed:           'text-red-400 border-red-500/40 bg-red-500/10',
  inconclusive:     'text-zinc-400 border-zinc-600/40 bg-zinc-800/40',
}

// ── Small reusable badges ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FinalStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLOURS[status]}`}>
      {status === 'passed'      && <CheckCircle2 className="w-3 h-3" />}
      {status === 'failed'      && <XCircle className="w-3 h-3" />}
      {status === 'inconclusive'&& <AlertCircle className="w-3 h-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${SEVERITY_COLOURS[severity]}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  )
}

// ── Section wrapper (shared between view mode sections) ───────────────────────

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 print:mb-10 print:break-inside-avoid">
      <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-800 print:border-zinc-300">
        <span className="text-xs font-mono text-zinc-600 print:text-zinc-400">{num}</span>
        <h2 className="text-sm font-semibold text-white print:text-black">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── View Mode ─────────────────────────────────────────────────────────────────

function ViewMode({ report, tests }: { report: EvidenceReport; tests: ReportTest[] }) {
  const passed      = tests.filter(t => t.final_status === 'passed').length
  const failed      = tests.filter(t => t.final_status === 'failed').length
  const inconclusive= tests.filter(t => t.final_status === 'inconclusive').length
  const criticalGaps= tests.filter(t => t.severity === 'critical' && t.final_status === 'failed')
  const gapTests    = tests.filter(t => t.final_status !== 'passed' && (t.gap_reason || t.gap_notes || t.recommendation))

  // Group recommendations by gap_reason
  const recGroups = new Map<string, ReportTest[]>()
  for (const t of tests.filter(t => t.recommendation)) {
    const key = t.gap_reason ? GAP_REASON_LABELS[t.gap_reason] : 'General'
    const group = recGroups.get(key) ?? []
    group.push(t)
    recGroups.set(key, group)
  }

  return (
    <div className="print:text-black print:bg-white">

      {/* 01 — Executive Summary */}
      <Section num="01" title="Executive Summary">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <table className="text-xs">
            <tbody className="space-y-1">
              {[
                ['Report Name',    report.name],
                ['Assessment Date',new Date(report.assessed_on).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })],
                ['Tested By',      report.tested_by],
                ['Environment',    report.environment],
                ['Report Type',    REPORT_TYPE_LABELS[report.report_type]],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-zinc-800/50 print:border-zinc-200">
                  <td className="py-2 pr-4 font-medium text-zinc-500 print:text-zinc-600 whitespace-nowrap">{k}</td>
                  <td className="py-2 text-white print:text-black">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Total Tests',   value: tests.length, colour: 'text-white' },
                { label: 'Passed',        value: passed,       colour: 'text-emerald-400' },
                { label: 'Failed',        value: failed,       colour: 'text-red-400' },
                { label: 'Inconclusive',  value: inconclusive, colour: 'text-amber-400' },
              ].map(({ label, value, colour }) => (
                <div key={label} className="bg-zinc-900 print:bg-zinc-100 border border-zinc-800 print:border-zinc-200 rounded p-3 text-center">
                  <div className={`text-2xl font-bold ${colour}`}>{value}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            {criticalGaps.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                <p className="text-xs font-medium text-red-400 mb-1">Critical Gaps ({criticalGaps.length})</p>
                {criticalGaps.map(t => (
                  <p key={t.id} className="text-xs text-zinc-400">{t.test_code} — {t.test_vector}</p>
                ))}
              </div>
            )}
          </div>
        </div>
        {report.notes && (
          <p className="text-xs text-zinc-400 print:text-zinc-600 bg-zinc-900/50 print:bg-zinc-50 rounded p-3 border border-zinc-800 print:border-zinc-200">
            {report.notes}
          </p>
        )}
      </Section>

      {/* 02 — Test Details Table */}
      <Section num="02" title="Test Details">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-zinc-800 print:border-zinc-300 bg-zinc-900/60 print:bg-zinc-50">
                {['Test ID', 'Channel', 'Vector', 'Data Type', 'Regulation', 'Control', 'Expected', 'Actual', 'Status', 'Severity'].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-medium text-zinc-500 print:text-zinc-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tests.map((t, i) => (
                <tr key={t.id} className={`${i < tests.length - 1 ? 'border-b border-zinc-800/40 print:border-zinc-200' : ''}`}>
                  <td className="px-3 py-2 font-mono text-zinc-300 print:text-zinc-700 whitespace-nowrap">{t.test_code}</td>
                  <td className="px-3 py-2 text-zinc-400 print:text-zinc-600">{t.channel}</td>
                  <td className="px-3 py-2 text-zinc-300 print:text-zinc-700">{t.test_vector}</td>
                  <td className="px-3 py-2 text-zinc-400 print:text-zinc-600">{t.data_type}</td>
                  <td className="px-3 py-2 text-zinc-500 print:text-zinc-600">
                    {t.regulation_tags.join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-zinc-500 print:text-zinc-600">{t.control_mapping || '—'}</td>
                  <td className="px-3 py-2 text-zinc-400 print:text-zinc-600">
                    {EXPECTED_RESULT_LABELS[t.expected_result]}
                  </td>
                  <td className="px-3 py-2 text-zinc-300 print:text-zinc-700">
                    {ACTUAL_RESULT_LABELS[t.actual_result]}
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={t.final_status} /></td>
                  <td className="px-3 py-2"><SeverityBadge severity={t.severity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {tests.length === 0 && (
            <p className="text-center py-6 text-zinc-600 text-xs">No tests added to this report yet</p>
          )}
        </div>
      </Section>

      {/* 03 — Test Payload Evidence */}
      <Section num="03" title="Test Payload Evidence">
        {tests.filter(t => t.payload_summary || t.evidence_notes).length === 0 ? (
          <p className="text-xs text-zinc-600">No payload evidence recorded for these tests.</p>
        ) : (
          <div className="space-y-3">
            {tests.filter(t => t.payload_summary || t.evidence_notes).map(t => (
              <div key={t.id} className="bg-zinc-900/50 print:bg-zinc-50 border border-zinc-800 print:border-zinc-200 rounded p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs text-zinc-500">{t.test_code}</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-xs text-zinc-400">{t.test_vector}</span>
                </div>
                {t.payload_summary && (
                  <p className="text-xs font-mono bg-zinc-950 print:bg-white print:border print:border-zinc-200 text-zinc-300 print:text-zinc-700 rounded p-3 mb-2">{t.payload_summary}</p>
                )}
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-zinc-500">Source: <span className="text-zinc-300 print:text-zinc-700">{t.data_source}</span></span>
                  {t.evidence_notes && <span className="text-zinc-500">Notes: <span className="text-zinc-300 print:text-zinc-700">{t.evidence_notes}</span></span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 04 — Expected Control Behaviour */}
      <Section num="04" title="Expected Control Behaviour">
        <div className="space-y-3">
          {tests.map(t => (
            <div key={t.id} className="bg-zinc-900/50 print:bg-zinc-50 border border-zinc-800 print:border-zinc-200 rounded p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-zinc-500">{t.test_code}</span>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-zinc-300 print:text-zinc-700">{t.test_vector}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div className="flex gap-2">
                  <span className="text-zinc-500 w-28 shrink-0">Expected Action</span>
                  <span className="text-zinc-300 print:text-zinc-700">{EXPECTED_RESULT_LABELS[t.expected_result]}</span>
                </div>
                {t.expected_policy && (
                  <div className="flex gap-2">
                    <span className="text-zinc-500 w-28 shrink-0">Policy</span>
                    <span className="text-zinc-300 print:text-zinc-700">{t.expected_policy}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-zinc-500 w-28 shrink-0">Alert Expected</span>
                  <span className={t.expected_alert ? 'text-emerald-400' : 'text-zinc-400'}>{t.expected_alert ? 'Yes' : 'No'}</span>
                </div>
                {t.expected_description && (
                  <div className="flex gap-2 col-span-2">
                    <span className="text-zinc-500 w-28 shrink-0">Description</span>
                    <span className="text-zinc-300 print:text-zinc-700">{t.expected_description}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {tests.length === 0 && <p className="text-xs text-zinc-600">No tests added.</p>}
        </div>
      </Section>

      {/* 05 — Actual Result */}
      <Section num="05" title="Actual Result">
        <div className="space-y-3">
          {tests.map(t => (
            <div key={t.id} className="bg-zinc-900/50 print:bg-zinc-50 border border-zinc-800 print:border-zinc-200 rounded p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-xs text-zinc-500">{t.test_code}</span>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-zinc-300 print:text-zinc-700">{t.test_vector}</span>
                <StatusBadge status={t.final_status} />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div className="flex gap-2">
                  <span className="text-zinc-500 w-28 shrink-0">Actual Result</span>
                  <span className="text-zinc-300 print:text-zinc-700">{ACTUAL_RESULT_LABELS[t.actual_result]}</span>
                </div>
                {t.http_response_code != null && (
                  <div className="flex gap-2">
                    <span className="text-zinc-500 w-28 shrink-0">HTTP Status</span>
                    <span className="font-mono text-zinc-300 print:text-zinc-700">{t.http_response_code}</span>
                  </div>
                )}
                {t.dlp_alert_generated != null && (
                  <div className="flex gap-2">
                    <span className="text-zinc-500 w-28 shrink-0">Alert Generated</span>
                    <span className={t.dlp_alert_generated ? 'text-emerald-400' : 'text-red-400'}>
                      {t.dlp_alert_generated ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}
                {t.response_time_ms != null && (
                  <div className="flex gap-2">
                    <span className="text-zinc-500 w-28 shrink-0">Response Time</span>
                    <span className="text-zinc-300 print:text-zinc-700">{t.response_time_ms} ms</span>
                  </div>
                )}
                {t.evidence_notes && (
                  <div className="flex gap-2 col-span-2">
                    <span className="text-zinc-500 w-28 shrink-0">Notes</span>
                    <span className="text-zinc-300 print:text-zinc-700">{t.evidence_notes}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {tests.length === 0 && <p className="text-xs text-zinc-600">No tests added.</p>}
        </div>
      </Section>

      {/* 06 — Gap Analysis */}
      <Section num="06" title="Gap Analysis">
        {gapTests.length === 0 ? (
          <p className="text-xs text-zinc-500">No gaps identified — all tests passed.</p>
        ) : (
          <div className="space-y-3">
            {gapTests.map(t => (
              <div key={t.id} className="bg-zinc-900/50 print:bg-zinc-50 border border-red-500/20 print:border-zinc-200 rounded p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-xs text-zinc-500">{t.test_code}</span>
                  <StatusBadge status={t.final_status} />
                  <SeverityBadge severity={t.severity} />
                </div>
                <div className="grid grid-cols-1 gap-y-1.5 text-xs">
                  {t.gap_reason && (
                    <div className="flex gap-2">
                      <span className="text-zinc-500 w-32 shrink-0">Gap Reason</span>
                      <span className="text-red-300 print:text-red-700 font-medium">{GAP_REASON_LABELS[t.gap_reason]}</span>
                    </div>
                  )}
                  {t.gap_notes && (
                    <div className="flex gap-2">
                      <span className="text-zinc-500 w-32 shrink-0">Gap Notes</span>
                      <span className="text-zinc-300 print:text-zinc-700">{t.gap_notes}</span>
                    </div>
                  )}
                  {t.recommendation && (
                    <div className="flex gap-2">
                      <span className="text-zinc-500 w-32 shrink-0">Recommendation</span>
                      <span className="text-zinc-300 print:text-zinc-700">{t.recommendation}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 07 — Recommendations */}
      <Section num="07" title="Recommendations">
        {recGroups.size === 0 ? (
          <p className="text-xs text-zinc-500">No recommendations recorded.</p>
        ) : (
          <div className="space-y-4">
            {Array.from(recGroups.entries()).map(([group, groupTests]) => (
              <div key={group}>
                <p className="text-xs font-medium text-zinc-400 print:text-zinc-600 mb-2">{group}</p>
                <div className="space-y-1">
                  {groupTests.map(t => (
                    <div key={t.id} className="flex gap-3 text-xs bg-zinc-900/40 print:bg-zinc-50 border border-zinc-800 print:border-zinc-200 rounded px-3 py-2">
                      <span className="font-mono text-zinc-500 shrink-0">{t.test_code}</span>
                      <span className="text-zinc-300 print:text-zinc-700">{t.recommendation}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 08 — Overall Result */}
      <Section num="08" title="Overall Result">
        <div className={`inline-flex items-center gap-3 px-6 py-4 rounded-lg border text-lg font-bold ${OVERALL_COLOURS[report.overall_result]}`}>
          {report.overall_result === 'passed'           && <CheckCircle2 className="w-6 h-6" />}
          {report.overall_result === 'partially_passed' && <AlertCircle className="w-6 h-6" />}
          {report.overall_result === 'failed'           && <XCircle className="w-6 h-6" />}
          {report.overall_result === 'inconclusive'     && <AlertCircle className="w-6 h-6" />}
          {OVERALL_LABELS[report.overall_result]}
        </div>
        <p className="text-xs text-zinc-500 mt-3">
          Report generated {new Date(report.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}
        </p>
      </Section>
    </div>
  )
}

// ── Edit Mode — test card ─────────────────────────────────────────────────────

function TestCard({
  test, onEdit, onDelete,
}: {
  test: ReportTest
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-mono text-xs text-zinc-500">{test.test_code}</span>
            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded">{test.channel}</span>
            <span className="text-xs text-zinc-400">{test.data_type}</span>
            <SeverityBadge severity={test.severity} />
            <StatusBadge status={test.final_status} />
          </div>
          <p className="text-xs text-zinc-300 mb-1">{test.test_vector}</p>
          {test.regulation_tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {test.regulation_tags.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] rounded">{tag}</span>
              ))}
            </div>
          )}
          {test.gap_reason && (
            <p className="text-[10px] text-red-400 mt-1">Gap: {GAP_REASON_LABELS[test.gap_reason]}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {confirming ? (
            <div className="flex items-center gap-1">
              <button onClick={onDelete} className="p-1.5 text-red-400 hover:bg-zinc-800 rounded transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setConfirming(false)} className="p-1.5 text-zinc-500 hover:bg-zinc-800 rounded transition-colors text-[10px]">✕</button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Edit Mode — header form ────────────────────────────────────────────────────

const ENVIRONMENTS = ['UAT', 'Production', 'Staging', 'Development', 'Lab']
const OVERALL_OPTIONS: OverallResult[] = ['passed', 'partially_passed', 'failed', 'inconclusive']
const REPORT_TYPES: ReportType[] = ['single_test', 'control_validation', 'regulation', 'executive', 'regression']

function HeaderEditForm({
  report,
  onSaved,
}: {
  report: EvidenceReport
  onSaved: (updated: Partial<EvidenceReport>) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName]           = useState(report.name)
  const [assessedOn, setAssessedOn]= useState(report.assessed_on.slice(0, 10))
  const [testedBy, setTestedBy]   = useState(report.tested_by)
  const [environment, setEnvironment] = useState(report.environment)
  const [reportType, setReportType]   = useState<ReportType>(report.report_type)
  const [overallResult, setOverallResult] = useState<OverallResult>(report.overall_result)
  const [notes, setNotes]         = useState(report.notes ?? '')

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await updateReport(report.id, {
        name, assessedOn, testedBy, environment, reportType, overallResult, notes,
      })
      if (result.error) { setError(result.error); return }
      onSaved({ name, assessed_on: assessedOn, tested_by: testedBy, environment, report_type: reportType, overall_result: overallResult, notes: notes || null })
    })
  }

  const inputCls = 'w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-blue-500 transition-colors'
  const selectCls = 'w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-blue-500 transition-colors'

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 mb-6">
      <p className="text-xs font-medium text-zinc-400 mb-3">Report Header</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="col-span-2">
          <label className="text-[10px] text-zinc-500 mb-1 block">Report Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 mb-1 block">Assessment Date</label>
          <input type="date" value={assessedOn} onChange={e => setAssessedOn(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 mb-1 block">Tested By</label>
          <input value={testedBy} onChange={e => setTestedBy(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 mb-1 block">Environment</label>
          <select value={environment} onChange={e => setEnvironment(e.target.value)} className={selectCls}>
            {ENVIRONMENTS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 mb-1 block">Report Type</label>
          <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className={selectCls}>
            {REPORT_TYPES.map(v => <option key={v} value={v}>{REPORT_TYPE_LABELS[v]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 mb-1 block">Overall Result</label>
          <select value={overallResult} onChange={e => setOverallResult(e.target.value as OverallResult)} className={selectCls}>
            {OVERALL_OPTIONS.map(v => <option key={v} value={v}>{OVERALL_LABELS[v]}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[10px] text-zinc-500 mb-1 block">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className={`${inputCls} resize-none`} />
        </div>
      </div>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <button
        onClick={save}
        disabled={isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-medium rounded transition-colors"
      >
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Save Changes
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  report:      EvidenceReport
  tests:       ReportTest[]
  initialMode: 'view' | 'edit'
}

export function ReportDetailClient({ report: initialReport, tests: initialTests, initialMode }: Props) {
  const router = useRouter()
  const [mode, setMode]       = useState<'view' | 'edit'>(initialMode)
  const [report, setReport]   = useState<EvidenceReport>(initialReport)
  const [tests, setTests]     = useState<ReportTest[]>(initialTests)
  const [isPending, startTransition] = useTransition()

  // Modal state
  const [modalOpen, setModalOpen]   = useState(false)
  const [editingTest, setEditingTest] = useState<ReportTest | undefined>()

  function handleDeleteTest(testId: string) {
    startTransition(async () => {
      await deleteTest(testId)
      setTests(prev => prev.filter(t => t.id !== testId))
    })
  }

  function handleModalDone(newTests?: ReportTest[]) {
    setModalOpen(false)
    setEditingTest(undefined)
    if (newTests) {
      setTests(newTests)
    }
    // Refresh to get latest from DB
    router.refresh()
  }

  const overallColour = OVERALL_COLOURS[report.overall_result]

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-white { background: white !important; color: black !important; }
        }
      `}</style>

      {/* Top bar — hidden on print */}
      <div className="no-print">
        {/* Back + breadcrumb */}
        <button
          onClick={() => router.push('/tools/evidence-report')}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Reports
        </button>

        {/* Report title + actions */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">{report.name}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${overallColour}`}>
                {OVERALL_LABELS[report.overall_result]}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {REPORT_TYPE_LABELS[report.report_type]} · {report.environment} ·{' '}
              Assessed {new Date(report.assessed_on).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} ·{' '}
              By {report.tested_by}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setMode('view'); router.replace(`/tools/evidence-report/${report.id}`) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${mode === 'view' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              View
            </button>
            <button
              onClick={() => { setMode('edit'); router.replace(`/tools/evidence-report/${report.id}?mode=edit`) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${mode === 'edit' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Print header — shown only on print */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold text-black">{report.name}</h1>
        <p className="text-sm text-zinc-600 mt-1">
          {REPORT_TYPE_LABELS[report.report_type]} · {report.environment} ·
          Assessed {new Date(report.assessed_on).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })} ·
          Tested by {report.tested_by}
        </p>
        <hr className="mt-4 border-zinc-300" />
      </div>

      {/* ── EDIT MODE ─────────────────────────────────────────────── */}
      {mode === 'edit' && (
        <div className="no-print">
          <HeaderEditForm
            report={report}
            onSaved={updates => setReport(r => ({ ...r, ...updates }))}
          />

          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-zinc-400">Test Records ({tests.length})</p>
            <button
              onClick={() => { setEditingTest(undefined); setModalOpen(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Test
            </button>
          </div>

          {tests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-zinc-800 rounded-lg text-center">
              <p className="text-zinc-500 text-sm mb-1">No tests yet</p>
              <p className="text-zinc-600 text-xs mb-4">Import from Control Validator or add manually</p>
              <button
                onClick={() => { setEditingTest(undefined); setModalOpen(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add First Test
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {tests.map(t => (
                <TestCard
                  key={t.id}
                  test={t}
                  onEdit={() => { setEditingTest(t); setModalOpen(true) }}
                  onDelete={() => handleDeleteTest(t.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VIEW MODE ─────────────────────────────────────────────── */}
      {mode === 'view' && (
        <div className="print-white">
          <ViewMode report={report} tests={tests} />
        </div>
      )}

      {/* Add/Edit Test Modal */}
      {modalOpen && (
        <AddTestModal
          reportId={report.id}
          editTest={editingTest}
          currentTests={tests}
          onDone={handleModalDone}
          onClose={() => { setModalOpen(false); setEditingTest(undefined) }}
        />
      )}
    </>
  )
}
