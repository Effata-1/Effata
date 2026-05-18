import { createClient } from '@/lib/supabase/server'
import { EvidenceReportClient } from './_components/evidence-report-client'

// ── Known dimensions (from Control Validator) ─────────────────────────────────

export const KNOWN_DATA_TYPES = [
  'credit_card', 'ssn', 'uk_nin', 'api_key', 'db_url',
  'jwt', 'phi', 'iban', 'passport', 'custom',
] as const

export const KNOWN_PROTOCOLS = [
  'https_post_text', 'https_post_json', 'https_post_form', 'file_upload',
  'get_param', 'base64', 'script_ftp', 'script_smtp', 'script_dns',
  'script_curl', 'script_powershell',
] as const

// ── Types ─────────────────────────────────────────────────────────────────────

export type TestResult = 'blocked' | 'not_blocked' | 'error'

export interface TestRow {
  id: string
  test_name: string
  protocol: string
  data_type: string
  destination: string
  result: TestResult
  response_code: number | null
  response_time_ms: number | null
  created_at: string
}

export interface DatasetRow {
  id: string
  name: string
  description: string | null
  columns: string[]
  row_count: number
  ai_generated: boolean
  ai_prompt: string | null
  created_at: string
}

export interface TypeStats {
  total: number
  blocked: number
  notBlocked: number
  error: number
}

export interface ProtocolStats {
  total: number
  blocked: number
}

export interface ReportData {
  days: number
  generatedAt: string
  userEmail: string
  totalTests: number
  blockedCount: number
  notBlockedCount: number
  errorCount: number
  blockRate: number
  typesTestedCount: number
  protocolsTestedCount: number
  byDataType: Record<string, TypeStats>
  byProtocol: Record<string, ProtocolStats>
  coverageMatrix: Record<string, Record<string, TestResult | null>>
  testLog: TestRow[]
  datasets: DatasetRow[]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EvidenceReportPage({
  searchParams,
}: {
  searchParams: { days?: string }
}) {
  const rawDays = parseInt(searchParams.days ?? '30', 10)
  const days = [7, 30, 90, 0].includes(rawDays) ? rawDays : 30

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div className="text-zinc-500 text-sm p-8">Not authenticated</div>
  }

  const { data: { session } } = await supabase.auth.getSession()
  const orgId: string | null = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id ?? null
    : null

  // ── Fetch test results ────────────────────────────────────────────────────

  let resultsQuery = supabase
    .from('dlp_test_results')
    .select('id, test_name, protocol, data_type, destination, result, response_code, response_time_ms, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (days > 0) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    resultsQuery = resultsQuery.gte('created_at', since)
  }

  const { data: rawTests } = await resultsQuery
  const tests = (rawTests ?? []) as TestRow[]

  // ── Fetch datasets (all time for provenance) ──────────────────────────────

  const { data: rawDatasets } = await supabase
    .from('test_datasets')
    .select('id, name, description, columns, row_count, ai_generated, ai_prompt, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  const datasets = (rawDatasets ?? []) as DatasetRow[]

  // ── Aggregate ─────────────────────────────────────────────────────────────

  const blockedCount    = tests.filter(t => t.result === 'blocked').length
  const notBlockedCount = tests.filter(t => t.result === 'not_blocked').length
  const errorCount      = tests.filter(t => t.result === 'error').length
  const denom           = blockedCount + notBlockedCount
  const blockRate       = denom > 0 ? Math.round((blockedCount / denom) * 100) : 0

  const byDataType: Record<string, TypeStats> = {}
  for (const t of tests) {
    if (!byDataType[t.data_type]) byDataType[t.data_type] = { total: 0, blocked: 0, notBlocked: 0, error: 0 }
    byDataType[t.data_type].total++
    if      (t.result === 'blocked')     byDataType[t.data_type].blocked++
    else if (t.result === 'not_blocked') byDataType[t.data_type].notBlocked++
    else                                  byDataType[t.data_type].error++
  }

  const byProtocol: Record<string, ProtocolStats> = {}
  for (const t of tests) {
    if (!byProtocol[t.protocol]) byProtocol[t.protocol] = { total: 0, blocked: 0 }
    byProtocol[t.protocol].total++
    if (t.result === 'blocked') byProtocol[t.protocol].blocked++
  }

  // Coverage matrix — most recent result per (dataType, protocol)
  // Tests are already sorted by created_at desc, so first match wins
  const coverageMatrix: Record<string, Record<string, TestResult | null>> = {}
  for (const dt of KNOWN_DATA_TYPES) {
    coverageMatrix[dt] = {}
    for (const pr of KNOWN_PROTOCOLS) coverageMatrix[dt][pr] = null
  }
  for (const t of tests) {
    if (coverageMatrix[t.data_type] && coverageMatrix[t.data_type][t.protocol] === null) {
      coverageMatrix[t.data_type][t.protocol] = t.result
    }
  }

  const testedTypes     = new Set(tests.map(t => t.data_type))
  const testedProtocols = new Set(tests.map(t => t.protocol))

  const report: ReportData = {
    days,
    generatedAt: new Date().toISOString(),
    userEmail: user.email ?? '',
    totalTests: tests.length,
    blockedCount,
    notBlockedCount,
    errorCount,
    blockRate,
    typesTestedCount: testedTypes.size,
    protocolsTestedCount: testedProtocols.size,
    byDataType,
    byProtocol,
    coverageMatrix,
    testLog: tests.slice(0, 100),
    datasets,
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Evidence Report</h1>
        <p className="text-zinc-500 text-sm">
          Audit-ready proof of DLP control effectiveness — what was tested, what data was used, and what controls fired
        </p>
      </div>
      <EvidenceReportClient report={report} />
    </div>
  )
}
