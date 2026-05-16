'use client'

import { useState, useMemo, useTransition, useCallback } from 'react'
import { Loader2, Trash2, Check, Sparkles, Search, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateTestData, saveDataset, deleteDataset } from '../actions'
import type { GeneratedData, SavedDataset } from '../actions'

// ── Template Definitions ──────────────────────────────────────────────────────

interface Template {
  name: string
  description: string
  category: string
  fields: string[]
}

const TEMPLATES: Template[] = [
  // People & PII
  { category: 'People', name: 'US Employee',       description: 'Name, SSN, email, phone, address, dept', fields: ['full_name','email','ssn','dob','phone','address','department','job_title'] },
  { category: 'People', name: 'UK Employee',       description: 'Name, NI, NHS, postcode, dept',           fields: ['full_name','email','ni_number','nhs_number','dob','uk_phone','uk_postcode','department'] },
  { category: 'People', name: 'Indian Employee',   description: 'Name, Aadhaar, PAN, phone',               fields: ['full_name','email','aadhaar','pan_card','dob','in_phone'] },
  { category: 'People', name: 'Generic PII',       description: 'Name, email, DOB, phone, passport',       fields: ['full_name','email','dob','phone','passport','ip_address'] },
  // Financial
  { category: 'Financial', name: 'Credit Application', description: 'SSN, credit card, bank account',       fields: ['full_name','ssn','dob','credit_card','routing_number','bank_account','annual_income'] },
  { category: 'Financial', name: 'Banking Customer',   description: 'IBAN, SWIFT, sort code',               fields: ['full_name','email','iban','swift','sort_code','bank_account'] },
  { category: 'Financial', name: 'Crypto Wallet',      description: 'Bitcoin and Ethereum addresses',       fields: ['full_name','email','bitcoin_address','ethereum_address'] },
  // Healthcare
  { category: 'Healthcare', name: 'US Patient Record',   description: 'SSN, NPI, insurance, ICD-10',         fields: ['full_name','dob','ssn','npi_number','insurance_id','icd10_code','phone'] },
  { category: 'Healthcare', name: 'Prescription Record', description: 'DEA, drug name, dosage, ICD-10',      fields: ['full_name','dob','dea_number','drug_name','dosage','icd10_code'] },
  // Credentials
  { category: 'Credentials', name: 'API Config',        description: 'API key, AWS, DB URL, JWT',            fields: ['service','api_key','aws_access_key','aws_secret_key','db_url','jwt_token'] },
  { category: 'Credentials', name: 'Developer Secrets', description: 'GitHub PAT, Google, Stripe, password', fields: ['service','github_pat','google_api_key','stripe_key','password','api_key'] },
  { category: 'Credentials', name: 'User Account',      description: 'Username, password, API key, IP',      fields: ['username','email','password','api_key','ip_address','mac_address'] },
  // Network
  { category: 'Network', name: 'Server Inventory', description: 'IP, MAC, OS, hostname, ports',              fields: ['hostname','ip_address','mac_address','ipv6','os_version','open_ports'] },
  { category: 'Network', name: 'Network Scan',     description: 'IP, MAC, IPv6, hostname, last seen',        fields: ['ip_address','mac_address','ipv6','hostname','last_seen','status'] },
]

const TEMPLATE_CATEGORIES = ['All', 'People', 'Financial', 'Healthcare', 'Credentials', 'Network']

const CATEGORY_COLORS: Record<string, string> = {
  People:      'bg-blue-500/15 text-blue-400',
  Financial:   'bg-green-500/15 text-green-400',
  Healthcare:  'bg-red-500/15 text-red-400',
  Credentials: 'bg-amber-500/15 text-amber-400',
  Network:     'bg-purple-500/15 text-purple-400',
}

// ── Client-Side Data Generator ────────────────────────────────────────────────

const FIRST_NAMES = ['James','Emma','Oliver','Sophia','William','Ava','Noah','Isabella','Liam','Mia','Charlotte','Ethan','Amelia','Lucas','Harper','Aiden','Evelyn','Mason','Abigail','Logan','Priya','Arjun','Fatima','Mohammed']
const LAST_NAMES  = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Taylor','Anderson','Thomas','Jackson','White','Harris']
const DOMAINS     = ['gmail.com','outlook.com','yahoo.com','company.com','enterprise.org','corp.net']
const DEPARTMENTS = ['Engineering','Marketing','Finance','Operations','HR','Sales','Legal','Product']
const JOB_TITLES  = ['Software Engineer','Product Manager','Data Analyst','Marketing Manager','Financial Analyst','HR Specialist','Sales Representative','Operations Lead','Legal Counsel','Designer']
const ICD10_CODES = ['J18.9','M54.5','I10','E11.9','F32.1','K21.0','R05','Z00.00','J06.9','N39.0']
const DRUG_NAMES  = ['Amoxicillin','Lisinopril','Metformin','Atorvastatin','Omeprazole']
const SERVICES    = ['payment-api','auth-service','data-pipeline','reporting-api','webhook-service','notification-svc','analytics-api','crm-service','billing-service','search-service']
const OS_VERSIONS = ['Ubuntu 22.04 LTS','Windows Server 2022','CentOS 7.9','Debian 11','RHEL 8.6']

function hex(n: number, len = 8): string {
  return Math.abs(n).toString(16).padStart(len, '0').slice(0, len).toUpperCase()
}
function pad(n: number, len = 2): string { return String(n).padStart(len, '0') }

function generateField(field: string, i: number): string {
  const fn = FIRST_NAMES[i % FIRST_NAMES.length]
  const ln = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length]

  switch (field) {
    case 'full_name':      return `${fn} ${ln}`
    case 'email':          return `${fn.toLowerCase()}.${ln.toLowerCase()}${i + 1}@${DOMAINS[i % DOMAINS.length]}`
    case 'ssn':            return `${100 + (i * 37) % 799}-${10 + (i * 13) % 79}-${1000 + (i * 97) % 8999}`
    case 'dob': {
      const year  = 1960 + (i * 7) % 35
      const month = 1 + (i * 3) % 12
      const day   = 1 + (i * 11) % 28
      return `${pad(month)}/${pad(day)}/${year}`
    }
    case 'phone':
    case 'us_phone':       return `(${200 + (i * 17) % 799}) ${200 + (i * 13) % 799}-${1000 + (i * 97) % 8999}`
    case 'uk_phone':       return `+44 7${pad(700 + (i * 13) % 299, 3)} ${pad(100 + (i * 7) % 899, 3)} ${pad(100 + (i * 31) % 899, 3)}`
    case 'in_phone':       return `+91 ${9000000000 + (i * 1234567) % 999999999}`
    case 'address':        return `${100 + (i * 13) % 9899} ${['Oak','Maple','Pine','Cedar','Elm'][(i * 3) % 5]} ${['Street','Avenue','Boulevard','Drive','Lane'][i % 5]}, ${['Austin TX','Seattle WA','Chicago IL','Boston MA','Denver CO'][i % 5]}`
    case 'uk_postcode':    return `${['SW','EC','W','N','SE','E','NW','WC'][i % 8]}${1 + (i * 3) % 9}${String.fromCharCode(65 + (i * 7) % 26)} ${1 + (i * 11) % 9}${String.fromCharCode(65 + (i * 13) % 20)}${String.fromCharCode(65 + (i * 17) % 20)}`
    case 'department':     return DEPARTMENTS[i % DEPARTMENTS.length]
    case 'job_title':      return JOB_TITLES[i % JOB_TITLES.length]
    case 'ni_number':      return `${String.fromCharCode(65 + (i * 3) % 22)}${String.fromCharCode(65 + (i * 7) % 22)}${pad(100000 + (i * 13) % 899999, 6)}${String.fromCharCode(65 + (i % 4))}`
    case 'nhs_number':     return `${pad(100 + (i * 37) % 899, 3)} ${pad(100 + (i * 13) % 899, 3)} ${pad(1000 + (i * 97) % 8999, 4)}`
    case 'passport':       return `${String.fromCharCode(65 + (i * 3) % 26)}${String.fromCharCode(65 + (i * 7) % 26)}${pad(1000000 + (i * 97) % 8999999, 7)}`
    case 'aadhaar':        return `${2 + (i % 8)}${pad((i * 3737 + 100) % 999, 3)} ${pad((i * 7919 + 1000) % 9999, 4)} ${pad((i * 6271 + 1000) % 9999, 4)}`
    case 'pan_card':       return `${String.fromCharCode(65 + (i * 3) % 26)}${String.fromCharCode(65 + (i * 7) % 26)}${String.fromCharCode(65 + (i * 11) % 26)}${String.fromCharCode(65 + (i * 13) % 26)}${String.fromCharCode(65 + (i * 17) % 26)}${pad(1000 + (i * 97) % 8999, 4)}${String.fromCharCode(65 + (i * 19) % 26)}`
    case 'credit_card':    return `4111 1111 1111 ${pad(1000 + (i * 97) % 8999, 4)}`
    case 'routing_number': return `0${pad(21000000 + (i * 12347) % 99999999, 8)}`
    case 'bank_account':   return `${pad(10000000 + (i * 123457) % 89999999, 8)}`
    case 'annual_income':  return `$${(45000 + (i * 5500) % 155000).toLocaleString()}`
    case 'iban':           return `GB${pad(29 + (i * 7) % 60, 2)}NWBK${pad(60000000 + (i * 123457) % 39999999, 8)}${pad(10000000 + (i * 97531) % 89999999, 8)}`
    case 'swift':          return `${['DEUT','BARC','HSBC','CITI','BOFA'][i % 5]}GB${String.fromCharCode(50 + i % 25)}${String.fromCharCode(50 + (i * 3) % 25)}`
    case 'sort_code':      return `${pad(10 + (i * 7) % 89, 2)}-${pad(10 + (i * 13) % 89, 2)}-${pad(10 + (i * 17) % 89, 2)}`
    case 'bitcoin_address': return `1SYNTH${hex(i * 7777 + 1000000, 8)}${hex(i * 3333 + 500000, 8)}TEST`
    case 'ethereum_address': return `0xSYNTH${hex(i * 9999 + 100000, 8)}${hex(i * 4444 + 200000, 8)}${hex(i * 2222 + 300000, 8)}TEST`
    case 'npi_number':     return `NPI: ${pad(1000000000 + (i * 123457) % 999999999, 10)}`
    case 'insurance_id':   return `INS-${String.fromCharCode(65 + (i * 3) % 26)}${String.fromCharCode(65 + (i * 7) % 26)}-${pad(10000 + (i * 97) % 89999, 5)}`
    case 'icd10_code':     return ICD10_CODES[i % ICD10_CODES.length]
    case 'dea_number':     return `${String.fromCharCode(65 + (i * 3) % 26)}${String.fromCharCode(66 + (i * 7) % 8)}${pad(1000000 + (i * 97) % 8999999, 7)}`
    case 'drug_name':      return DRUG_NAMES[i % DRUG_NAMES.length]
    case 'dosage':         return `${[100,200,250,500,750,1000][i % 6]}mg ${['twice daily','once daily','three times daily','as needed'][i % 4]}`
    case 'api_key':        return `SYNTHETIC_API_${pad(i + 1, 3)}_${hex(i * 31337 + 100000, 16)}`
    case 'aws_access_key': return `AKIAIOSFODNN${hex(i * 97531 + 1000000, 7)}`
    case 'aws_secret_key': return `SYNTHETIC_AWS_SECRET_${hex(i * 12345 + 100000, 8)}/${hex(i * 67890 + 200000, 8)}KEY`
    case 'db_url':         return `postgresql://user_${i + 1}:SYNTH_PASS_${pad(i + 1, 3)}@db.example.com:5432/testdb_${['prod','staging','dev'][i % 3]}`
    case 'jwt_token':      return `eyJhbGciOiJIUzI1NiJ9.SYNTHETIC_PAYLOAD_${pad(i + 1, 3)}.SYNTHETIC_SIG_${hex(i * 54321 + 100000, 8)}`
    case 'github_pat':     return `ghp_SYNTHETIC${pad(i + 1, 3)}${hex(i * 11111 + 100000, 16)}${hex(i * 22222 + 200000, 16)}`
    case 'google_api_key': return `AIzaSYNTHETIC${hex(i * 33333 + 100000, 8)}${hex(i * 44444 + 200000, 8)}TEST`
    case 'stripe_key':     return `sk_test_SYNTHETIC_KEY_${pad(i + 1, 3)}_${hex(i * 55555 + 100000, 8)}`
    case 'password':       return `P@ssw0rd_TEST_${pad(i + 1, 3)}!`
    case 'username':       return `${fn.toLowerCase()}${ln.toLowerCase().slice(0, 3)}${pad(i + 1, 2)}`
    case 'ip_address':     return `10.${(i * 3) % 255}.${(i * 7) % 255}.${(i * 13 + 1) % 254}`
    case 'ipv6':           return `2001:0db8:85a3:${hex(i * 17, 4).toLowerCase()}:${hex(i * 31, 4).toLowerCase()}:8a2e:0370:${hex(i * 43 + 1000, 4).toLowerCase()}`
    case 'mac_address':    return `02:${hex(i * 17 + 10, 2).toLowerCase()}:${hex(i * 31 + 20, 2).toLowerCase()}:${hex(i * 43 + 30, 2).toLowerCase()}:${hex(i * 59 + 40, 2).toLowerCase()}:${hex(i * 67 + 50, 2).toLowerCase()}`
    case 'hostname':       return `server-${['web','app','db','cache','worker'][i % 5]}-${pad(i + 1, 3)}.internal.example.com`
    case 'os_version':     return OS_VERSIONS[i % OS_VERSIONS.length]
    case 'open_ports':     return [['80,443','22,80,443','3306,33060','6379','22,8080'][i % 5]][0]
    case 'last_seen':      return `${pad(1 + (i * 7) % 28)}/${pad(1 + (i * 3) % 12)}/2026 ${pad((i * 5) % 23)}:${pad((i * 13) % 59)}`
    case 'status':         return ['active','inactive','unknown','vulnerable','patched'][i % 5]
    case 'service':        return SERVICES[i % SERVICES.length]
    default:               return `value_${i + 1}`
  }
}

function generateFromTemplate(template: Template, rowCount: number): GeneratedData {
  const records: Record<string, string>[] = []
  for (let i = 0; i < rowCount; i++) {
    const record: Record<string, string> = {}
    for (const field of template.fields) {
      record[field] = generateField(field, i)
    }
    records.push(record)
  }
  return {
    columns:     template.fields,
    records,
    description: `${template.name} — ${rowCount} synthetic records for DLP testing`,
  }
}

// ── Download Helpers ──────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function escapeXml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
}

function toCSV(columns: string[], records: Record<string, string>[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const header = columns.map(escape).join(',')
  const rows   = records.map(r => columns.map(c => escape(r[c] ?? '')).join(','))
  return [header, ...rows].join('\n')
}

function toJSON(records: Record<string, string>[]): string {
  return JSON.stringify(records, null, 2)
}

function toTXT(columns: string[], records: Record<string, string>[]): string {
  return records.map((r, i) =>
    `--- Record ${i + 1} ---\n${columns.map(c => `${c}: ${r[c] ?? ''}`).join('\n')}`
  ).join('\n\n')
}

function toXML(columns: string[], records: Record<string, string>[]): string {
  const rows = records.map(r => {
    const fields = columns.map(c => `    <${c}>${escapeXml(r[c] ?? '')}</${c}>`).join('\n')
    return `  <record>\n${fields}\n  </record>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<records>\n${rows}\n</records>`
}

function toSQL(columns: string[], records: Record<string, string>[]): string {
  return records.map(r => {
    const cols = columns.map(c => `\`${c}\``).join(', ')
    const vals = columns.map(c => `'${(r[c] ?? '').replace(/'/g, "''")}'`).join(', ')
    return `INSERT INTO \`test_data\` (${cols}) VALUES (${vals});`
  }).join('\n')
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

const FORMATS = [
  { id: 'csv',  label: 'CSV'  },
  { id: 'json', label: 'JSON' },
  { id: 'txt',  label: 'TXT'  },
  { id: 'xml',  label: 'XML'  },
  { id: 'sql',  label: 'SQL'  },
] as const

type Format = typeof FORMATS[number]['id']

const ROW_COUNT_AI_OPTIONS  = [5, 10, 25, 50]
const ROW_COUNT_TPL_OPTIONS = [5, 10, 25, 50, 100, 250, 500]

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  initialDatasets: SavedDataset[]
}

export function TestDataGenerator({ initialDatasets }: Props) {
  const [generatedData,   setGeneratedData]   = useState<GeneratedData | null>(null)
  const [aiPrompt,        setAiPrompt]        = useState('')
  const [aiRowCount,      setAiRowCount]      = useState(25)
  const [tplRowCount,     setTplRowCount]     = useState(25)
  const [aiLoading,       startAiTransition]  = useTransition()
  const [aiError,         setAiError]         = useState<string | null>(null)
  const [downloadFormat,  setDownloadFormat]  = useState<Format>('csv')
  const [savedDatasets,   setSavedDatasets]   = useState<SavedDataset[]>(initialDatasets)
  const [saveName,        setSaveName]        = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [saveLoading,     startSaveTransition] = useTransition()
  const [saveSuccess,     setSaveSuccess]     = useState(false)
  const [saveError,       setSaveError]       = useState<string | null>(null)
  const [tplSearch,       setTplSearch]       = useState('')
  const [tplCategory,     setTplCategory]     = useState('All')

  // ── Template filter ────────────────────────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    const q = tplSearch.toLowerCase()
    return TEMPLATES.filter(t => {
      const catMatch  = tplCategory === 'All' || t.category === tplCategory
      const textMatch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      return catMatch && textMatch
    })
  }, [tplSearch, tplCategory])

  // ── AI generate ───────────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (!aiPrompt.trim()) return
    setAiError(null)
    startAiTransition(async () => {
      const { result, error } = await generateTestData(aiPrompt, aiRowCount)
      if (error) { setAiError(error); return }
      if (result) setGeneratedData(result)
    })
  }, [aiPrompt, aiRowCount])

  // ── Template generate (client-side, instant) ───────────────────────────────
  const handleTemplate = useCallback((template: Template) => {
    setGeneratedData(generateFromTemplate(template, tplRowCount))
    setAiError(null)
  }, [tplRowCount])

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!generatedData) return
    const { columns, records } = generatedData
    const ts = Date.now()
    switch (downloadFormat) {
      case 'csv':  downloadFile(toCSV(columns, records),  `dlp-test-data-${ts}.csv`,  'text/csv')           ; break
      case 'json': downloadFile(toJSON(records),           `dlp-test-data-${ts}.json`, 'application/json')   ; break
      case 'txt':  downloadFile(toTXT(columns, records),  `dlp-test-data-${ts}.txt`,  'text/plain')          ; break
      case 'xml':  downloadFile(toXML(columns, records),  `dlp-test-data-${ts}.xml`,  'application/xml')     ; break
      case 'sql':  downloadFile(toSQL(columns, records),  `dlp-test-data-${ts}.sql`,  'text/plain')          ; break
    }
  }, [generatedData, downloadFormat])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!generatedData || !saveName.trim()) return
    setSaveError(null)
    setSaveSuccess(false)
    startSaveTransition(async () => {
      const { id, error } = await saveDataset({
        name:        saveName,
        description: saveDescription,
        columns:     generatedData.columns,
        records:     generatedData.records,
        aiGenerated: !!aiPrompt,
        aiPrompt:    aiPrompt,
      })
      if (error) { setSaveError(error); return }
      const entry: SavedDataset = {
        id: id!,
        name:         saveName.trim(),
        description:  saveDescription.trim() || null,
        columns:      generatedData.columns,
        records:      generatedData.records,
        row_count:    generatedData.records.length,
        ai_generated: !!aiPrompt,
        ai_prompt:    aiPrompt || null,
        created_at:   new Date().toISOString(),
      }
      setSavedDatasets(prev => [entry, ...prev])
      setSaveSuccess(true)
      setSaveName('')
      setSaveDescription('')
      setTimeout(() => setSaveSuccess(false), 3000)
    })
  }, [generatedData, saveName, saveDescription, aiPrompt])

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    const { error } = await deleteDataset(id)
    if (!error) setSavedDatasets(prev => prev.filter(d => d.id !== id))
  }, [])

  // ── Load saved ────────────────────────────────────────────────────────────
  const handleLoad = useCallback((ds: SavedDataset) => {
    setGeneratedData({ columns: ds.columns, records: ds.records, description: ds.name })
    setAiError(null)
  }, [])

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="grid grid-cols-3 gap-5">

      {/* ══════════════════════════════════════════════════
          LEFT COLUMN (2/3)
          ══════════════════════════════════════════════════ */}
      <div className="col-span-2 space-y-5">

        {/* AI Assistant */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <SectionLabel>AI Assistant</SectionLabel>
            <Sparkles className="w-3 h-3 text-purple-400 mb-3" />
          </div>

          <div className="flex gap-2 items-start">
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
              placeholder='Describe the test data you need in plain English… e.g. "25 UK patient records with NHS numbers, ICD-10 codes and prescriptions" or "API configs with AWS keys and database URLs"'
              rows={2}
              className="flex-1 bg-zinc-800 text-white text-sm px-3 py-2.5 rounded-lg border border-zinc-700 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex flex-col gap-2 shrink-0">
              <select
                value={aiRowCount}
                onChange={e => setAiRowCount(Number(e.target.value))}
                className="bg-zinc-800 text-zinc-300 text-xs px-2 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
              >
                {ROW_COUNT_AI_OPTIONS.map(n => (
                  <option key={n} value={n}>{n} rows</option>
                ))}
              </select>
              <button
                onClick={handleGenerate}
                disabled={aiLoading || !aiPrompt.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {aiLoading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                  : 'Generate Data'}
              </button>
            </div>
          </div>

          {aiError && <p className="mt-2 text-xs text-red-400">{aiError}</p>}
          <p className="mt-1.5 text-[10px] text-zinc-600">Tip: ⌘ + Enter to generate</p>
        </div>

        {/* Data Preview */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Data Preview</SectionLabel>
            {generatedData && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {generatedData.columns.length} cols
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-bold">
                  {generatedData.records.length} rows
                </span>
              </div>
            )}
          </div>

          {!generatedData ? (
            <div className="py-16 text-center">
              <p className="text-sm text-zinc-600 italic">Generate data above or pick a template →</p>
              <p className="text-xs text-zinc-700 mt-1">AI-generated or instant templates, your choice</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] text-zinc-500 mb-3 italic">{generatedData.description}</p>
              <div className="overflow-x-auto rounded-lg border border-zinc-700" style={{ maxHeight: '360px' }}>
                <table className="text-xs w-full">
                  <thead>
                    <tr className="sticky top-0 bg-zinc-800 z-10">
                      <th className="text-[9px] font-bold text-zinc-600 uppercase px-3 py-2 text-right w-8 border-r border-zinc-700">#</th>
                      {generatedData.columns.map(col => (
                        <th key={col} className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide px-3 py-2 text-left whitespace-nowrap border-r border-zinc-700 last:border-r-0">
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {generatedData.records.map((row, i) => (
                      <tr key={i} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="px-3 py-2 text-zinc-700 text-right tabular-nums text-[9px] border-r border-zinc-800">{i + 1}</td>
                        {generatedData.columns.map(col => (
                          <td key={col} className="px-3 py-2 font-mono text-zinc-300 whitespace-nowrap border-r border-zinc-800 last:border-r-0" title={row[col] ?? ''}>
                            {(row[col] ?? '').length > 28
                              ? (row[col] ?? '').slice(0, 28) + '…'
                              : (row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Download Bar */}
        {generatedData && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <SectionLabel>Download</SectionLabel>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 p-1 bg-zinc-800 rounded-lg">
                {FORMATS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setDownloadFormat(f.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                      downloadFormat === f.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download {downloadFormat.toUpperCase()}
              </button>
              <span className="text-[10px] text-zinc-600">
                {generatedData.records.length} records · {generatedData.columns.length} columns
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          RIGHT COLUMN (1/3)
          ══════════════════════════════════════════════════ */}
      <div className="col-span-1 space-y-5">

        {/* Quick Templates */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Quick Templates</SectionLabel>
          </div>

          {/* Template row count */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-zinc-500 shrink-0">Rows:</span>
            <select
              value={tplRowCount}
              onChange={e => setTplRowCount(Number(e.target.value))}
              className="flex-1 bg-zinc-800 text-zinc-300 text-xs px-2 py-1.5 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
            >
              {ROW_COUNT_TPL_OPTIONS.map(n => (
                <option key={n} value={n}>{n} rows</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search templates..."
              value={tplSearch}
              onChange={e => setTplSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1 mb-3">
            {TEMPLATE_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setTplCategory(cat)}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                  tplCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template grid */}
          <div className="grid grid-cols-2 gap-1 max-h-80 overflow-y-auto pr-0.5">
            {filteredTemplates.length === 0 ? (
              <p className="col-span-2 text-xs text-zinc-600 italic">No templates match</p>
            ) : (
              filteredTemplates.map(t => (
                <button
                  key={t.name}
                  onClick={() => handleTemplate(t)}
                  className="text-left rounded-lg border border-zinc-700 bg-zinc-800/60 p-2.5 hover:border-blue-500/50 hover:bg-zinc-700/60 transition-all group"
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', CATEGORY_COLORS[t.category]?.split(' ')[0])} />
                    <p className="text-[10px] font-semibold text-white group-hover:text-blue-300 transition-colors leading-tight truncate">
                      {t.name}
                    </p>
                  </div>
                  <p className="text-[9px] text-zinc-500 leading-tight line-clamp-2 pl-2.5">
                    {t.description}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Save Dataset */}
        {generatedData && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <SectionLabel>Save Dataset</SectionLabel>
            <div className="space-y-2">
              <input
                type="text"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="Dataset name *"
                maxLength={80}
                className="w-full bg-zinc-800 text-white text-sm px-3 py-2 rounded-lg border border-zinc-700 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={saveDescription}
                onChange={e => setSaveDescription(e.target.value)}
                placeholder="Description (optional)"
                maxLength={200}
                className="w-full bg-zinc-800 text-white text-sm px-3 py-2 rounded-lg border border-zinc-700 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim() || saveLoading}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saveLoading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                  : 'Save to Library'}
              </button>
              {saveSuccess && (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Saved successfully
                </p>
              )}
              {saveError && <p className="text-xs text-red-400">{saveError}</p>}
            </div>
          </div>
        )}

        {/* Saved Datasets */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <SectionLabel>Saved Datasets</SectionLabel>
          {savedDatasets.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No saved datasets yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {savedDatasets.map(ds => (
                <div
                  key={ds.id}
                  className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-3 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{ds.name}</p>
                      {ds.description && (
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{ds.description}</p>
                      )}
                      <p className="text-[10px] text-zinc-600 mt-1">
                        {new Date(ds.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(ds.id)}
                      title="Delete dataset"
                      className="p-1 text-zinc-600 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 font-mono">
                      {ds.row_count} rows
                    </span>
                    {ds.ai_generated && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 uppercase">
                        AI
                      </span>
                    )}
                    <button
                      onClick={() => handleLoad(ds)}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      Load →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
