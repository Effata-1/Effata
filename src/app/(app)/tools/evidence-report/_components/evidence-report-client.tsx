'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReportData, TestResult } from '../page'

// ── Labels ────────────────────────────────────────────────────────────────────

const DATA_TYPE_LABELS: Record<string, string> = {
  credit_card: 'Credit Card (PAN)',
  ssn:         'US SSN',
  uk_nin:      'UK NI Number',
  api_key:     'API Key / Secret',
  db_url:      'Database URL',
  jwt:         'JWT Token',
  phi:         'Health Data (PHI)',
  iban:        'IBAN',
  passport:    'Passport Number',
  custom:      'Custom',
}

const PROTOCOL_LABELS: Record<string, string> = {
  https_post_text:   'HTTPS Text',
  https_post_json:   'HTTPS JSON',
  https_post_form:   'HTTPS Form',
  file_upload:       'File Upload',
  get_param:         'GET Param',
  base64:            'Base64',
  script_ftp:        'FTP',
  script_smtp:       'SMTP',
  script_dns:        'DNS',
  script_curl:       'cURL',
  script_powershell: 'PowerShell',
}

const DATA_TYPES  = Object.keys(DATA_TYPE_LABELS)
const PROTOCOLS   = Object.keys(PROTOCOL_LABELS)

// ── Helpers ───────────────────────────────────────────────────────────────────

function ResultBadge({ result }: { result: TestResult | null }) {
  if (!result) return <span className="text-[10px] text-zinc-700">—</span>
  const cfg = {
    blocked:     { cls: 'bg-green-500/15 text-green-400', label: 'Blocked' },
    not_blocked: { cls: 'bg-red-500/15 text-red-400',     label: 'Not Blocked' },
    error:       { cls: 'bg-amber-500/15 text-amber-400', label: 'Error' },
  }[result]
  return (
    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

function cellDot(result: TestResult | null) {
  if (result === 'blocked')     return <span className="inline-block w-3 h-3 rounded-full bg-green-500" title="Blocked" />
  if (result === 'not_blocked') return <span className="inline-block w-3 h-3 rounded-full bg-red-500" title="Not Blocked" />
  if (result === 'error')       return <span className="inline-block w-3 h-3 rounded-full bg-amber-500" title="Error" />
  return <span className="inline-block w-2 h-2 rounded-full bg-zinc-800" title="Not Tested" />
}

function cellBg(result: TestResult | null) {
  if (result === 'blocked')     return 'bg-green-500/10'
  if (result === 'not_blocked') return 'bg-red-500/10'
  if (result === 'error')       return 'bg-amber-500/10'
  return ''
}

function rateColor(rate: number | null) {
  if (rate === null) return 'text-zinc-600'
  if (rate >= 80) return 'text-green-400'
  if (rate >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function EvidenceReportClient({ report }: { report: ReportData }) {
  const router   = useRouter()
  const pathname = usePathname()

  function setDays(d: number) {
    router.push(`${pathname}?days=${d}`)
  }

  const dayOptions = [
    { label: '7 days',   value: 7  },
    { label: '30 days',  value: 30 },
    { label: '90 days',  value: 90 },
    { label: 'All time', value: 0  },
  ]

  // Sorted by block rate ascending (worst first)
  const dataTypeRows = Object.entries(report.byDataType)
    .map(([dt, s]) => {
      const denom = s.blocked + s.notBlocked
      return { dt, label: DATA_TYPE_LABELS[dt] ?? dt, ...s, rate: denom > 0 ? Math.round((s.blocked / denom) * 100) : null }
    })
    .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101))

  const protocolRows = Object.entries(report.byProtocol)
    .map(([pr, s]) => ({
      pr, label: PROTOCOL_LABELS[pr] ?? pr, ...s,
      rate: s.total > 0 ? Math.round((s.blocked / s.total) * 100) : null,
    }))
    .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101))

  const periodLabel = report.days === 0 ? 'All time' : `Last ${report.days} days`

  return (
    <>
      {/* ── Print styles ─────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          body, html { background: white !important; color: #111 !important; }
          aside, nav, [data-print-hide] { display: none !important; }
          [data-print-section] { break-inside: avoid; margin-bottom: 20px; }
          .text-white  { color: #111 !important; }
          .text-zinc-300, .text-zinc-400 { color: #333 !important; }
          .text-zinc-500, .text-zinc-600 { color: #666 !important; }
          .text-zinc-700 { color: #999 !important; }
          .bg-zinc-900\\/50, .bg-zinc-900\\/40, .bg-zinc-800\\/40, .bg-zinc-800\\/60 { background: #f7f7f7 !important; }
          .border-zinc-800, .border-zinc-700 { border-color: #ddd !important; }
          .bg-green-500\\/10 { background: rgba(34,197,94,0.12) !important; }
          .bg-red-500\\/10   { background: rgba(239,68,68,0.12) !important; }
          .bg-amber-500\\/10 { background: rgba(245,158,11,0.12) !important; }
        }
      `}</style>

      {/* ── Controls bar (hidden on print) ───────────────────────────────── */}
      <div className="flex items-center justify-between mb-6" data-print-hide>
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {dayOptions.map(o => (
            <button
              key={o.value}
              onClick={() => setDays(o.value)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-colors',
                report.days === o.value
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
        >
          <Printer className="h-4 w-4" />
          Print / Export PDF
        </button>
      </div>

      {/* ── Report header (visible in print) ─────────────────────────────── */}
      <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-4 flex items-start justify-between" data-print-section>
        <div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">DLP Control Evidence Report</p>
          <p className="text-[10px] text-zinc-600 mt-1">Period: {periodLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-600">
            Generated {new Date(report.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="text-[10px] text-zinc-700 mt-0.5">{report.userEmail}</p>
        </div>
      </div>

      <div className="space-y-5">

        {/* ── Executive Summary ─────────────────────────────────────────────── */}
        <div data-print-section>
          <SectionLabel>Executive Summary</SectionLabel>
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                value: report.totalTests.toString(),
                label: 'Tests Run',
                sub: `${periodLabel}`,
              },
              {
                value: report.totalTests > 0 ? `${report.blockRate}%` : '—',
                label: 'Block Rate',
                sub: `${report.blockedCount} blocked · ${report.notBlockedCount} passed · ${report.errorCount} errors`,
              },
              {
                value: `${report.typesTestedCount} / ${DATA_TYPES.length}`,
                label: 'Data Types Covered',
                sub: report.typesTestedCount < DATA_TYPES.length
                  ? `${DATA_TYPES.length - report.typesTestedCount} untested`
                  : 'Full coverage',
              },
              {
                value: `${report.protocolsTestedCount} / ${PROTOCOLS.length}`,
                label: 'Protocols Covered',
                sub: report.protocolsTestedCount < PROTOCOLS.length
                  ? `${PROTOCOLS.length - report.protocolsTestedCount} untested`
                  : 'Full coverage',
              },
            ].map(card => (
              <div key={card.label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
                <div className="text-2xl font-bold text-white tabular-nums">{card.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{card.label}</div>
                <div className="text-[10px] text-zinc-600 mt-1">{card.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Coverage Matrix ───────────────────────────────────────────────── */}
        <div data-print-section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <SectionLabel>Control Coverage Matrix</SectionLabel>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-[10px] text-zinc-600 font-semibold pb-2 pr-6 min-w-[160px]">
                    Data Type
                  </th>
                  {PROTOCOLS.map(pr => (
                    <th
                      key={pr}
                      className="text-center text-[9px] text-zinc-600 font-semibold pb-2 px-2 whitespace-nowrap"
                    >
                      {PROTOCOL_LABELS[pr]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {DATA_TYPES.map(dt => (
                  <tr key={dt} className="hover:bg-zinc-800/20">
                    <td className="py-2 pr-6 text-[10px] text-zinc-400 whitespace-nowrap">
                      {DATA_TYPE_LABELS[dt]}
                    </td>
                    {PROTOCOLS.map(pr => {
                      const res = report.coverageMatrix[dt]?.[pr] ?? null
                      return (
                        <td key={pr} className={cn('text-center px-2 py-1.5', cellBg(res))}>
                          {cellDot(res)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-5 mt-3 pt-2.5 border-t border-zinc-800/60">
            {[
              { color: 'bg-green-500',  label: 'Blocked' },
              { color: 'bg-red-500',    label: 'Not Blocked' },
              { color: 'bg-amber-500',  label: 'Error' },
              { color: 'bg-zinc-800',   label: 'Not Tested' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className={cn('w-2.5 h-2.5 rounded-full', l.color)} />
                <span className="text-[10px] text-zinc-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Block Rate tables ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-5" data-print-section>

          {/* By Data Type */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <SectionLabel>Block Rate by Data Type</SectionLabel>
            {dataTypeRows.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No tests in this period</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left text-[10px] text-zinc-600 pb-2">Data Type</th>
                    <th className="text-right text-[10px] text-zinc-600 pb-2">Tests</th>
                    <th className="text-right text-[10px] text-zinc-600 pb-2">Blocked</th>
                    <th className="text-right text-[10px] text-zinc-600 pb-2">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {dataTypeRows.map(r => (
                    <tr key={r.dt}>
                      <td className="py-2 text-zinc-300">{r.label}</td>
                      <td className="py-2 text-right text-zinc-500 tabular-nums">{r.total}</td>
                      <td className="py-2 text-right text-zinc-500 tabular-nums">{r.blocked}</td>
                      <td className="py-2 text-right tabular-nums">
                        {r.rate !== null
                          ? <span className={cn('font-semibold', rateColor(r.rate))}>{r.rate}%</span>
                          : <span className="text-zinc-600">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* By Protocol */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <SectionLabel>Block Rate by Protocol</SectionLabel>
            {protocolRows.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No tests in this period</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left text-[10px] text-zinc-600 pb-2">Protocol</th>
                    <th className="text-right text-[10px] text-zinc-600 pb-2">Tests</th>
                    <th className="text-right text-[10px] text-zinc-600 pb-2">Blocked</th>
                    <th className="text-right text-[10px] text-zinc-600 pb-2">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {protocolRows.map(r => (
                    <tr key={r.pr}>
                      <td className="py-2 text-zinc-300">{r.label}</td>
                      <td className="py-2 text-right text-zinc-500 tabular-nums">{r.total}</td>
                      <td className="py-2 text-right text-zinc-500 tabular-nums">{r.blocked}</td>
                      <td className="py-2 text-right tabular-nums">
                        {r.rate !== null
                          ? <span className={cn('font-semibold', rateColor(r.rate))}>{r.rate}%</span>
                          : <span className="text-zinc-600">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Test Data Provenance ──────────────────────────────────────────── */}
        <div data-print-section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <SectionLabel>Test Data Provenance</SectionLabel>
          {report.datasets.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">
              No test datasets found — create synthetic test data in the Data Lab.
            </p>
          ) : (
            <div className="space-y-2">
              {report.datasets.map(d => (
                <div
                  key={d.id}
                  className="flex items-start gap-4 rounded-lg border border-zinc-800 bg-zinc-800/40 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-white truncate">{d.name}</p>
                      {d.ai_generated && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 uppercase shrink-0">
                          AI
                        </span>
                      )}
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 uppercase shrink-0">
                        Synthetic
                      </span>
                    </div>
                    {d.description && (
                      <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{d.description}</p>
                    )}
                    <p className="text-[10px] text-zinc-600 mt-1">
                      {d.row_count} rows · Columns: {d.columns.join(', ')}
                    </p>
                  </div>
                  <p className="text-[10px] text-zinc-600 shrink-0">
                    {new Date(d.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Full Test Log ─────────────────────────────────────────────────── */}
        <div data-print-section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Full Test Log</SectionLabel>
            <span className="text-[10px] text-zinc-600 -mt-3">
              {report.testLog.length} entries
              {report.testLog.length === 100 && ' (capped at 100)'}
            </span>
          </div>

          {report.testLog.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No test runs in this period</p>
          ) : (
            <div className="max-h-80 overflow-y-auto" data-print-hide>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-zinc-900 z-10">
                  <tr className="border-b border-zinc-800">
                    <th className="text-left text-[10px] text-zinc-600 pb-2 pr-4">Timestamp</th>
                    <th className="text-left text-[10px] text-zinc-600 pb-2 pr-4">Data Type</th>
                    <th className="text-left text-[10px] text-zinc-600 pb-2 pr-4">Protocol</th>
                    <th className="text-left text-[10px] text-zinc-600 pb-2 pr-4">Result</th>
                    <th className="text-right text-[10px] text-zinc-600 pb-2 pr-4">Code</th>
                    <th className="text-right text-[10px] text-zinc-600 pb-2">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {report.testLog.map(t => (
                    <tr key={t.id} className="hover:bg-zinc-800/30">
                      <td className="py-2 pr-4 text-zinc-600 tabular-nums whitespace-nowrap text-[10px]">
                        {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' '}
                        {new Date(t.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 pr-4 text-zinc-400">{DATA_TYPE_LABELS[t.data_type] ?? t.data_type}</td>
                      <td className="py-2 pr-4 text-zinc-500 text-[10px]">{PROTOCOL_LABELS[t.protocol] ?? t.protocol}</td>
                      <td className="py-2 pr-4"><ResultBadge result={t.result} /></td>
                      <td className="py-2 pr-4 text-right text-zinc-600 tabular-nums">{t.response_code ?? '—'}</td>
                      <td className="py-2 text-right text-zinc-600 tabular-nums">
                        {t.response_time_ms != null ? `${t.response_time_ms}ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Full table for print (unscrolled) */}
          {report.testLog.length > 0 && (
            <div className="hidden print:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left text-[10px] text-zinc-600 pb-2 pr-4">Timestamp</th>
                    <th className="text-left text-[10px] text-zinc-600 pb-2 pr-4">Data Type</th>
                    <th className="text-left text-[10px] text-zinc-600 pb-2 pr-4">Protocol</th>
                    <th className="text-left text-[10px] text-zinc-600 pb-2 pr-4">Result</th>
                    <th className="text-right text-[10px] text-zinc-600 pb-2 pr-4">Code</th>
                    <th className="text-right text-[10px] text-zinc-600 pb-2">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {report.testLog.map(t => (
                    <tr key={t.id}>
                      <td className="py-1.5 pr-4 text-zinc-600 tabular-nums whitespace-nowrap text-[10px]">
                        {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' '}
                        {new Date(t.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-1.5 pr-4 text-zinc-400">{DATA_TYPE_LABELS[t.data_type] ?? t.data_type}</td>
                      <td className="py-1.5 pr-4 text-zinc-500 text-[10px]">{PROTOCOL_LABELS[t.protocol] ?? t.protocol}</td>
                      <td className="py-1.5 pr-4"><ResultBadge result={t.result} /></td>
                      <td className="py-1.5 pr-4 text-right text-zinc-600 tabular-nums">{t.response_code ?? '—'}</td>
                      <td className="py-1.5 text-right text-zinc-600 tabular-nums">
                        {t.response_time_ms != null ? `${t.response_time_ms}ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
