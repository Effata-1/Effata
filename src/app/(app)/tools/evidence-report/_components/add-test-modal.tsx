'use client'

import { useState, useTransition, useEffect } from 'react'
import { X, Loader2, CheckSquare, Square, Import, PenLine } from 'lucide-react'
import {
  addTest, updateTest, getValidatorResults, importFromValidator,
} from '../actions'
import type {
  ReportTest, ValidatorResult,
  Severity, ExpectedResult, ActualResult, FinalStatus, GapReason,
} from '../actions'

// ── Constants ─────────────────────────────────────────────────────────────────

const CHANNELS = ['Web', 'Email', 'Endpoint', 'SaaS & Cloud', 'GenAI', 'Developer', 'Network']

const DATA_TYPES = [
  'credit_card', 'ssn', 'uk_nin', 'api_key', 'db_url',
  'jwt', 'phi', 'iban', 'passport', 'custom',
]

const REGULATION_OPTIONS = [
  'PCI-DSS v4.0', 'GDPR Art 32', 'HIPAA Security Rule', 'HIPAA Privacy Rule',
  'ISO 27001', 'SOC 2 Type II', 'NIS2', 'DORA', 'India DPDP Act',
  'UK GDPR', 'FCA Guidelines',
]

const SEVERITY_OPTIONS: Severity[]       = ['critical', 'high', 'medium', 'low']
const EXPECTED_OPTIONS: { value: ExpectedResult; label: string }[] = [
  { value: 'block',        label: 'Block' },
  { value: 'allow_alert',  label: 'Allow with Alert' },
  { value: 'allow_coach',  label: 'Allow with Coach' },
  { value: 'allow',        label: 'Allow' },
]
const ACTUAL_OPTIONS: { value: ActualResult; label: string }[] = [
  { value: 'blocked',             label: 'Blocked' },
  { value: 'allowed_with_alert',  label: 'Allowed with Alert' },
  { value: 'allowed_with_coach',  label: 'Allowed with Coach' },
  { value: 'allowed_no_alert',    label: 'Allowed — No Alert' },
  { value: 'not_inspected',       label: 'Not Inspected' },
  { value: 'test_failed',         label: 'Test Failed' },
  { value: 'inconclusive',        label: 'Inconclusive' },
]
const FINAL_OPTIONS: { value: FinalStatus; label: string }[] = [
  { value: 'passed',      label: 'Passed' },
  { value: 'failed',      label: 'Failed' },
  { value: 'inconclusive',label: 'Inconclusive' },
]
const GAP_OPTIONS: { value: GapReason; label: string }[] = [
  { value: 'policy_not_configured',    label: 'Policy Not Configured' },
  { value: 'monitor_mode',             label: 'Monitor Mode Only' },
  { value: 'ssl_inspection_missing',   label: 'SSL Inspection Missing' },
  { value: 'user_not_in_scope',        label: 'User Not in Scope' },
  { value: 'destination_not_in_scope', label: 'Destination Not in Scope' },
  { value: 'regex_too_weak',           label: 'Regex Pattern Too Weak' },
  { value: 'file_type_unsupported',    label: 'File Type Not Supported' },
  { value: 'activity_unsupported',     label: 'Activity Not Supported' },
  { value: 'threshold_too_high',       label: 'Threshold Too High' },
  { value: 'other',                    label: 'Other' },
]

const VALIDATOR_RESULT_LABELS: Record<string, string> = {
  blocked:     'Blocked',
  not_blocked: 'Not Blocked',
  error:       'Error',
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls    = 'w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors'
const selectCls   = 'w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-blue-500 transition-colors'
const labelCls    = 'block text-[10px] font-medium text-zinc-500 mb-1'

// ── Import Tab ────────────────────────────────────────────────────────────────

function ImportTab({
  reportId, currentTests, onDone, onClose,
}: {
  reportId:     string
  currentTests: ReportTest[]
  onDone:       (tests?: ReportTest[]) => void
  onClose:      () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading]        = useState(true)
  const [results, setResults]        = useState<ValidatorResult[]>([])
  const [selected, setSelected]      = useState<Set<string>>(new Set())
  const [error, setError]            = useState<string | null>(null)

  const alreadyLinked = new Set(currentTests.map(t => t.linked_test_id).filter(Boolean) as string[])

  useEffect(() => {
    getValidatorResults().then(({ results: r, error: e }) => {
      if (e) setError(e)
      else setResults(r)
      setLoading(false)
    })
  }, [])

  function toggleAll() {
    const available = results.filter(r => !alreadyLinked.has(r.id))
    if (selected.size === available.length) setSelected(new Set())
    else setSelected(new Set(available.map(r => r.id)))
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleImport() {
    if (!selected.size) return
    setError(null)
    startTransition(async () => {
      const result = await importFromValidator(reportId, Array.from(selected))
      if (result.error) { setError(result.error); return }
      onDone()
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
      </div>
    )
  }

  const available = results.filter(r => !alreadyLinked.has(r.id))

  return (
    <div>
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">{error}</div>
      )}

      {results.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-zinc-500 text-sm mb-1">No Control Validator results yet</p>
          <p className="text-zinc-600 text-xs">Run tests in Control Validator first, then import them here.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-500">{results.length} recent test{results.length !== 1 ? 's' : ''} · {selected.size} selected</p>
            {available.length > 0 && (
              <button onClick={toggleAll} className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                {selected.size === available.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {results.map(r => {
              const linked = alreadyLinked.has(r.id)
              const checked = selected.has(r.id)
              return (
                <button
                  key={r.id}
                  onClick={() => !linked && toggle(r.id)}
                  disabled={linked}
                  className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded transition-colors ${
                    linked ? 'opacity-40 cursor-not-allowed bg-zinc-900/30' :
                    checked ? 'bg-blue-500/10 border border-blue-500/30' :
                    'bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {checked
                      ? <CheckSquare className="w-4 h-4 text-blue-400" />
                      : <Square className="w-4 h-4 text-zinc-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-zinc-300 font-medium">{r.test_name || r.protocol}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        r.result === 'blocked'     ? 'bg-emerald-500/15 text-emerald-400' :
                        r.result === 'not_blocked' ? 'bg-red-500/15 text-red-400' :
                                                     'bg-zinc-700/50 text-zinc-400'
                      }`}>
                        {VALIDATOR_RESULT_LABELS[r.result]}
                      </span>
                      {linked && <span className="text-[10px] text-zinc-600">Already imported</span>}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {r.data_type} · {r.protocol} · {r.destination} ·{' '}
                      {new Date(r.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-800">
        <button
          onClick={handleImport}
          disabled={isPending || !selected.size}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Import className="w-3.5 h-3.5" />}
          Import {selected.size > 0 ? `${selected.size} Test${selected.size !== 1 ? 's' : ''}` : 'Selected'}
        </button>
        <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

// ── Manual Form ───────────────────────────────────────────────────────────────

interface FormState {
  testCode:            string
  channel:             string
  testVector:          string
  dataType:            string
  regulationTags:      string[]
  controlMapping:      string
  severity:            Severity
  expectedResult:      ExpectedResult
  expectedPolicy:      string
  expectedAlert:       boolean
  expectedDescription: string
  actualResult:        ActualResult
  httpResponseCode:    string
  responseTimeMs:      string
  dlpAlertGenerated:   '' | 'true' | 'false'
  finalStatus:         FinalStatus
  gapReason:           GapReason | ''
  gapNotes:            string
  recommendation:      string
  payloadSummary:      string
  dataSource:          string
  evidenceNotes:       string
}

function defaultForm(sortOrder: number, editTest?: ReportTest): FormState {
  if (editTest) {
    return {
      testCode:            editTest.test_code,
      channel:             editTest.channel,
      testVector:          editTest.test_vector,
      dataType:            editTest.data_type,
      regulationTags:      editTest.regulation_tags,
      controlMapping:      editTest.control_mapping ?? '',
      severity:            editTest.severity,
      expectedResult:      editTest.expected_result,
      expectedPolicy:      editTest.expected_policy ?? '',
      expectedAlert:       editTest.expected_alert,
      expectedDescription: editTest.expected_description ?? '',
      actualResult:        editTest.actual_result,
      httpResponseCode:    editTest.http_response_code != null ? String(editTest.http_response_code) : '',
      responseTimeMs:      editTest.response_time_ms != null ? String(editTest.response_time_ms) : '',
      dlpAlertGenerated:   editTest.dlp_alert_generated != null ? (editTest.dlp_alert_generated ? 'true' : 'false') : '',
      finalStatus:         editTest.final_status,
      gapReason:           editTest.gap_reason ?? '',
      gapNotes:            editTest.gap_notes ?? '',
      recommendation:      editTest.recommendation ?? '',
      payloadSummary:      editTest.payload_summary ?? '',
      dataSource:          editTest.data_source,
      evidenceNotes:       editTest.evidence_notes ?? '',
    }
  }
  return {
    testCode:            `DLP-${sortOrder + 1}`,
    channel:             'Web',
    testVector:          '',
    dataType:            'credit_card',
    regulationTags:      [],
    controlMapping:      '',
    severity:            'medium',
    expectedResult:      'block',
    expectedPolicy:      '',
    expectedAlert:       true,
    expectedDescription: '',
    actualResult:        'inconclusive',
    httpResponseCode:    '',
    responseTimeMs:      '',
    dlpAlertGenerated:   '',
    finalStatus:         'inconclusive',
    gapReason:           '',
    gapNotes:            '',
    recommendation:      '',
    payloadSummary:      '',
    dataSource:          'Data Lab (Synthetic)',
    evidenceNotes:       '',
  }
}

function ManualForm({
  reportId, editTest, sortOrder, onDone, onClose,
}: {
  reportId:  string
  editTest?: ReportTest
  sortOrder: number
  onDone:    (tests?: ReportTest[]) => void
  onClose:   () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [form, setForm]              = useState<FormState>(() => defaultForm(sortOrder, editTest))

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function toggleReg(tag: string) {
    setForm(f => ({
      ...f,
      regulationTags: f.regulationTags.includes(tag)
        ? f.regulationTags.filter(t => t !== tag)
        : [...f.regulationTags, tag],
    }))
  }

  function buildPayload() {
    return {
      testCode:            form.testCode,
      channel:             form.channel,
      testVector:          form.testVector,
      dataType:            form.dataType,
      regulationTags:      form.regulationTags,
      controlMapping:      form.controlMapping,
      severity:            form.severity,
      expectedResult:      form.expectedResult,
      expectedPolicy:      form.expectedPolicy,
      expectedAlert:       form.expectedAlert,
      expectedDescription: form.expectedDescription,
      actualResult:        form.actualResult,
      httpResponseCode:    form.httpResponseCode ? parseInt(form.httpResponseCode) : null,
      responseTimeMs:      form.responseTimeMs ? parseInt(form.responseTimeMs) : null,
      dlpAlertGenerated:   form.dlpAlertGenerated === 'true' ? true : form.dlpAlertGenerated === 'false' ? false : null,
      finalStatus:         form.finalStatus,
      gapReason:           (form.gapReason as GapReason) || null,
      gapNotes:            form.gapNotes,
      recommendation:      form.recommendation,
      payloadSummary:      form.payloadSummary,
      dataSource:          form.dataSource,
      evidenceNotes:       form.evidenceNotes,
      linkedTestId:        editTest?.linked_test_id ?? null,
      sortOrder:           editTest?.sort_order ?? sortOrder,
    }
  }

  function handleSave() {
    if (!form.testCode.trim())  { setError('Test ID is required'); return }
    if (!form.testVector.trim()) { setError('Test vector is required'); return }
    setError(null)

    startTransition(async () => {
      if (editTest) {
        const result = await updateTest(editTest.id, buildPayload())
        if (result.error) { setError(result.error); return }
      } else {
        const result = await addTest(reportId, buildPayload())
        if (result.error) { setError(result.error); return }
      }
      onDone()
    })
  }

  const isFailed = form.finalStatus === 'failed' || form.finalStatus === 'inconclusive'

  return (
    <div className="max-h-[65vh] overflow-y-auto pr-1">
      {/* ── Test Identification ── */}
      <fieldset className="mb-4">
        <legend className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Test Identification</legend>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <label className={labelCls}>Test ID <span className="text-red-400">*</span></label>
            <input value={form.testCode} onChange={e => set('testCode', e.target.value)} className={inputCls} placeholder="DLP-001" />
          </div>
          <div>
            <label className={labelCls}>Channel</label>
            <select value={form.channel} onChange={e => set('channel', e.target.value)} className={selectCls}>
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Data Type</label>
            <select value={form.dataType} onChange={e => set('dataType', e.target.value)} className={selectCls}>
              {DATA_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-2">
          <label className={labelCls}>Test Vector <span className="text-red-400">*</span></label>
          <input value={form.testVector} onChange={e => set('testVector', e.target.value)}
            className={inputCls} placeholder="e.g. HTTPS POST — JSON Payload to external host" />
        </div>
        <div>
          <label className={labelCls}>Regulation Tags</label>
          <div className="flex gap-1.5 flex-wrap">
            {REGULATION_OPTIONS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleReg(tag)}
                className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                  form.regulationTags.includes(tag)
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                }`}
              >{tag}</button>
            ))}
          </div>
        </div>
      </fieldset>

      {/* ── Severity & Control ── */}
      <fieldset className="mb-4">
        <legend className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Severity & Control</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Severity</label>
            <select value={form.severity} onChange={e => set('severity', e.target.value as Severity)} className={selectCls}>
              {SEVERITY_OPTIONS.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Control Mapping</label>
            <input value={form.controlMapping} onChange={e => set('controlMapping', e.target.value)}
              className={inputCls} placeholder="e.g. DLP-CC-BLOCK-001" />
          </div>
        </div>
      </fieldset>

      {/* ── Expected Behaviour ── */}
      <fieldset className="mb-4">
        <legend className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Expected Behaviour</legend>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className={labelCls}>Expected Action</label>
            <select value={form.expectedResult} onChange={e => set('expectedResult', e.target.value as ExpectedResult)} className={selectCls}>
              {EXPECTED_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Expected Policy</label>
            <input value={form.expectedPolicy} onChange={e => set('expectedPolicy', e.target.value)}
              className={inputCls} placeholder="Policy name" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Alert Expected</label>
            <select value={form.expectedAlert ? 'true' : 'false'} onChange={e => set('expectedAlert', e.target.value === 'true')} className={selectCls}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input value={form.expectedDescription} onChange={e => set('expectedDescription', e.target.value)}
              className={inputCls} placeholder="What should happen?" />
          </div>
        </div>
      </fieldset>

      {/* ── Actual Result ── */}
      <fieldset className="mb-4">
        <legend className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Actual Result</legend>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className={labelCls}>Actual Result</label>
            <select value={form.actualResult} onChange={e => set('actualResult', e.target.value as ActualResult)} className={selectCls}>
              {ACTUAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Final Status</label>
            <select value={form.finalStatus} onChange={e => set('finalStatus', e.target.value as FinalStatus)} className={selectCls}>
              {FINAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>HTTP Response Code</label>
            <input type="number" value={form.httpResponseCode} onChange={e => set('httpResponseCode', e.target.value)}
              className={inputCls} placeholder="200" />
          </div>
          <div>
            <label className={labelCls}>Response Time (ms)</label>
            <input type="number" value={form.responseTimeMs} onChange={e => set('responseTimeMs', e.target.value)}
              className={inputCls} placeholder="412" />
          </div>
          <div>
            <label className={labelCls}>DLP Alert Generated</label>
            <select value={form.dlpAlertGenerated} onChange={e => set('dlpAlertGenerated', e.target.value as FormState['dlpAlertGenerated'])} className={selectCls}>
              <option value="">Unknown</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* ── Gap Analysis (only shown when failed / inconclusive) ── */}
      {isFailed && (
        <fieldset className="mb-4">
          <legend className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Gap Analysis</legend>
          <div className="mb-2">
            <label className={labelCls}>Gap Reason</label>
            <select value={form.gapReason} onChange={e => set('gapReason', e.target.value as GapReason | '')} className={selectCls}>
              <option value="">— Select —</option>
              {GAP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="mb-2">
            <label className={labelCls}>Gap Notes</label>
            <textarea value={form.gapNotes} onChange={e => set('gapNotes', e.target.value)}
              rows={2} className={`${inputCls} resize-none`}
              placeholder="Why did the control miss this?" />
          </div>
          <div>
            <label className={labelCls}>Recommendation</label>
            <textarea value={form.recommendation} onChange={e => set('recommendation', e.target.value)}
              rows={2} className={`${inputCls} resize-none`}
              placeholder="What should be fixed or improved?" />
          </div>
        </fieldset>
      )}

      {/* ── Evidence ── */}
      <fieldset className="mb-4">
        <legend className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Evidence</legend>
        <div className="mb-2">
          <label className={labelCls}>Payload Summary (masked)</label>
          <input value={form.payloadSummary} onChange={e => set('payloadSummary', e.target.value)}
            className={inputCls} placeholder="e.g. 4532 **** **** 0366, Expiry: 09/28" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Data Source</label>
            <input value={form.dataSource} onChange={e => set('dataSource', e.target.value)}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Evidence Notes</label>
            <input value={form.evidenceNotes} onChange={e => set('evidenceNotes', e.target.value)}
              className={inputCls} placeholder="Screenshot ref, ticket ID, etc." />
          </div>
        </div>
      </fieldset>

      {/* Error + Actions */}
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">{error}</div>
      )}
      <div className="flex items-center gap-3 pt-3 border-t border-zinc-800">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {editTest ? 'Save Changes' : 'Add Test'}
        </button>
        <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

interface ModalProps {
  reportId:     string
  editTest?:    ReportTest
  currentTests: ReportTest[]
  onDone:       (tests?: ReportTest[]) => void
  onClose:      () => void
}

export function AddTestModal({ reportId, editTest, currentTests, onDone, onClose }: ModalProps) {
  const [tab, setTab] = useState<'import' | 'manual'>(editTest ? 'manual' : 'import')

  const tabCls = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
      active ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">
              {editTest ? 'Edit Test Record' : 'Add Test Record'}
            </h2>
            {!editTest && (
              <div className="flex gap-1">
                <button onClick={() => setTab('import')} className={tabCls(tab === 'import')}>
                  <Import className="w-3.5 h-3.5" />
                  Import from Validator
                </button>
                <button onClick={() => setTab('manual')} className={tabCls(tab === 'manual')}>
                  <PenLine className="w-3.5 h-3.5" />
                  Manual Entry
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {tab === 'import' && !editTest ? (
            <ImportTab
              reportId={reportId}
              currentTests={currentTests}
              onDone={onDone}
              onClose={onClose}
            />
          ) : (
            <ManualForm
              reportId={reportId}
              editTest={editTest}
              sortOrder={currentTests.length}
              onDone={onDone}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}
