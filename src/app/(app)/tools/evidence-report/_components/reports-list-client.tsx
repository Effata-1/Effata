'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Eye, FileText, Loader2, PencilLine } from 'lucide-react'
import { deleteReport } from '../actions'
import type { ReportSummary, OverallResult, ReportType } from '../actions'
import { usePagination } from '@/hooks/use-pagination'

// ── Label helpers ─────────────────────────────────────────────────────────────

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  single_test:        'Single Test',
  control_validation: 'Control Validation',
  regulation:         'Regulation',
  executive:          'Executive',
  regression:         'Regression',
}

const RESULT_LABELS: Record<OverallResult, string> = {
  passed:           'Passed',
  partially_passed: 'Partially Passed',
  failed:           'Failed',
  inconclusive:     'Inconclusive',
}

function ResultBadge({ result }: { result: OverallResult }) {
  const colours: Record<OverallResult, string> = {
    passed:           'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    partially_passed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    failed:           'bg-red-500/15 text-red-400 border-red-500/30',
    inconclusive:     'bg-accent/50 text-muted-foreground border-border-strong/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colours[result]}`}>
      {RESULT_LABELS[result]}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  reports: ReportSummary[]
  error?: string
}

export function ReportsListClient({ reports, error }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId]   = useState<string | null>(null)
  const pg = usePagination(reports, 10, 'reports_list')
  const PER_PAGE_OPTIONS = [10, 25, 50, 100]

  function handleView(id: string) {
    router.push(`/tools/evidence-report/${id}`)
  }

  function handleContinue(id: string) {
    router.push(`/tools/evidence-report/new?draft=${id}`)
  }

  function handleDelete(id: string) {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    setConfirmId(null)
    setDeletingId(id)
    startTransition(async () => {
      await deleteReport(id)
      setDeletingId(null)
      router.refresh()
    })
  }

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-muted-foreground/80 text-xs">{reports.length} report{reports.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => router.push('/tools/evidence-report/new')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Report
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && reports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground text-sm font-medium mb-1">No reports yet</p>
          <p className="text-muted-foreground/60 text-xs max-w-xs">
            Create your first evidence report to document DLP control testing for audits and compliance reviews.
          </p>
          <button
            onClick={() => router.push('/tools/evidence-report/new')}
            className="mt-5 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create First Report
          </button>
        </div>
      )}

      {/* Reports table */}
      {reports.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/60">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground/80">Report Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground/80">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground/80">Environment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground/80">Assessed</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground/80">Result</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground/80">Tests</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pg.slice.map((r, i) => (
                <tr
                  key={r.id}
                  className={`${i < pg.slice.length - 1 ? 'border-b border-border/50' : ''} hover:bg-card/40 transition-colors`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => r.status === 'draft' ? handleContinue(r.id) : handleView(r.id)}
                        className="text-foreground hover:text-blue-400 font-medium text-sm text-left transition-colors"
                      >
                        {r.name}
                      </button>
                      {r.status === 'draft' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-amber-500/15 text-amber-400 border-amber-500/30">
                          Draft
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {REPORT_TYPE_LABELS[r.report_type]}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-muted text-foreground/70 text-xs rounded">
                      {r.environment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(r.assessed_on).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <ResultBadge result={r.overall_result} />
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                    {r.test_count}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'draft' ? (
                        <button
                          onClick={() => handleContinue(r.id)}
                          className="p-1.5 text-muted-foreground/80 hover:text-amber-400 hover:bg-muted rounded transition-colors"
                          title="Continue draft"
                        >
                          <PencilLine className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleView(r.id)}
                          className="p-1.5 text-muted-foreground/80 hover:text-foreground hover:bg-muted rounded transition-colors"
                          title="View report"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {confirmId === r.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground/80">Delete?</span>
                          <button
                            onClick={() => handleDelete(r.id)}
                            disabled={isPending}
                            className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                          >
                            {deletingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="px-2 py-1 text-xs bg-muted hover:bg-accent text-foreground/70 rounded transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 text-muted-foreground/60 hover:text-red-400 hover:bg-muted rounded transition-colors"
                          title="Delete report"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination footer */}
      {reports.length > pg.perPage && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/60">
          <span className="text-xs text-muted-foreground/60 tabular-nums">
            Showing {pg.from}–{pg.to} of {pg.total}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => pg.setPage(pg.page - 1)}
                disabled={pg.page === 1}
                className="px-2.5 py-1 text-xs rounded bg-muted text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ←
              </button>
              <span className="text-xs text-muted-foreground/60 px-2 tabular-nums">{pg.page} / {pg.pages}</span>
              <button
                onClick={() => pg.setPage(pg.page + 1)}
                disabled={pg.page === pg.pages}
                className="px-2.5 py-1 text-xs rounded bg-muted text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                →
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground/60">Rows per page:</span>
              <select
                value={pg.perPage}
                onChange={e => pg.setPerPage(Number(e.target.value))}
                className="bg-muted border border-border-strong text-foreground/70 text-xs rounded px-2 py-0.5 focus:outline-none focus:border-border-strong"
              >
                {PER_PAGE_OPTIONS.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
