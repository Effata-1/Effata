'use client'

import { useState, useTransition, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Sparkles, Loader2, Download, CheckCircle2, AlertCircle, ChevronDown, Clock } from 'lucide-react'
import { generateFileWithAI } from '../file-actions'
import type { GeneratedFileResult } from '../file-actions'
import { getAiSearchLogs, getLearnedTemplates } from '../actions'
import type { AiSearchLog, LearnedTemplate } from '../actions'
import { cn } from '@/lib/utils'

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)  return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

// ── Synthetic data helpers (for quick templates) ───────────────────────────────

const _FN = ['James','Emma','Oliver','Sophia','William','Ava','Noah','Isabella','Liam','Mia','Charlotte','Ethan','Amelia','Lucas','Harper','Aiden','Evelyn','Mason','Abigail','Logan']
const _LN = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Taylor','Anderson','Thomas','Jackson','White','Harris']
const _DO = ['gmail.com','outlook.com','company.com','corp.net']

const sn = (i: number) => `${_FN[i % _FN.length]} ${_LN[(i * 3) % _LN.length]}`
const se = (i: number) => `${_FN[i%_FN.length].toLowerCase()}.${_LN[(i*3)%_LN.length].toLowerCase()}${i+1}@${_DO[i%_DO.length]}`
const ss = (i: number) => `${100+(i*37)%799}-${String(10+(i*13)%79).padStart(2,'0')}-${1000+(i*97)%8999}`
const sc = (i: number) => `4111 1111 1111 ${String(1000+(i*97)%8999).padStart(4,'0')}`
const sd = (i: number) => `${String(1+(i*3)%12).padStart(2,'0')}/${String(1+(i*7)%28).padStart(2,'0')}/${1960+(i*7)%35}`
const sp = (i: number) => `(${200+(i*17)%799}) ${200+(i*13)%799}-${1000+(i*97)%8999}`
const sa = (i: number) => `${100+(i*13)%9899} ${['Oak','Maple','Pine','Cedar','Elm'][i%5]} St, ${['Austin TX','Seattle WA','Chicago IL','Boston MA','Denver CO'][i%5]}`
const sb = (i: number) => String(10000000 + (i * 123457) % 89999999).padStart(8, '0')

// ── Download helpers ───────────────────────────────────────────────────────────

function dlBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
function dlText(content: string, filename: string, mime = 'text/plain') {
  dlBlob(new Blob([content], { type: mime }), filename)
}

// ── Quick template generators ──────────────────────────────────────────────────

const PEM_CONTENT = `# SYNTHETIC DLP TEST DATA — NOT A REAL PRIVATE KEY
# Created for DLP policy validation testing only — do not use in production
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAuSYNTHETICKEYFORDLPTESTINGPURPOSESv3AAAAAAAAAAAAAAAa
BCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/SYNTH
ETICDATAFORDLPTESTINGONLYabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ
RSTUVWXYZSYNTHETICKEYBLOCKOneABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl
mnopqrstuvwxyz0123456789SYNTHETICKEYBLOCKTwoABCDEFGHIJKLMNOPQRSTUVWX
YZabcdefghijklmnopqrstuvwxyz0123456789+/SYNTHETICKEYBLOCKThreeAAAABBBB
CCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKKLLLLMMMMNNNNOOOOPPPPQQQQRRRRSSSS
TTTTUUUUVVVVWWWWXXXXYYYYZZZZaaaabbbbccccddddeeeeffffgggghhhhiiiijjjjkk
kkllllmmmmnnnnoooo0000111122223333444455556666777788889999SYNTHETICKEYDA
TAFORDLPTESTINGPURPOSESONLYaaaabbbbccccddddeeeeffffgggghhhhiiiijjjjkkk
kllllmmmmnnnnoooo0000111122223333444455556666777788889999AAAAABBBBCCCCdd
ddEEEEFFFFGGGGHHHHIIIIJJJJKKKKLLLLMMMMNNNNOOOOPPPPQQQQRRRRSSSSTTTTUU
UUVVVVWWWWXXXXYYYYZZZZDLPTESTSYNTHETICFINALBLOCKDataHere000111222==
-----END RSA PRIVATE KEY-----
`

const SSH_KEY_CONTENT = `# SYNTHETIC DLP TEST DATA — NOT A REAL SSH PRIVATE KEY
# Created for DLP policy validation testing only — do not use in production
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAAAAAEbm9uZQAAABFub25lAAAAAAAAAAAAUSYNTHETICDLP
TEST000001234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX
YZSYNTHETICSSHPRIVATEKEYaaaaabbbbbcccccdddddeeeeefffff00000111112222233
3334444455555666667777788888999990000011111222223333344444555556666677777
888889999900000SYNTHETICDATAFORDLPTESTINGPURPOSESabcdefghijklmnopqrstu
vwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/SYNTHETICSSHKEYBLOCKOneAAA
AABBBBBCCCCCDDDDDEEEEEFFFFFGGGGGHHHHHIIIIIJJJJJKKKKKLLLLLMMMMNNNNNOOO
OOPPPPPQQQQQRRRRRSSSSSYNTHETICFINALSSHKEYBLOCKTESTINGDATAHERExxxx0000
-----END OPENSSH PRIVATE KEY-----
`

const ENV_CONTENT = `# SYNTHETIC DLP TEST DATA — DO NOT USE IN PRODUCTION
# Created for DLP policy validation testing

DATABASE_URL=postgresql://app_user:SYNTH_DB_PASS_001_abc123@db.example.com:5432/production
DATABASE_READONLY_URL=postgresql://readonly:SYNTH_RO_PASS_xyz789@db-replica.example.com:5432/production
AWS_ACCESS_KEY_ID=AKIAIOSFODNNSYNTH001
AWS_SECRET_ACCESS_KEY=SYNTHETIC/AWS/SecretKey+001abcdefghijklmnopqrstuvwxyz
AWS_REGION=us-east-1
S3_BUCKET=synthetic-dlp-test-prod-001.example.com
STRIPE_SECRET_KEY=sk_test_SYNTHETIC_KEY_001_ABCDEFGHIJKLMNOPQabcdefg
STRIPE_PUBLISHABLE_KEY=pk_test_SYNTHETIC_PK_001_UVWXYZuvwxyz0123456789
SENDGRID_API_KEY=SG.SYNTHETICSendGridKey001.ABCDEFGHIJKLMNOPQRSTUVabcdefg
JWT_SECRET=SYNTHETIC_JWT_SECRET_DO_NOT_USE_abc123def456ghi789jkl0mno1pq2
NEXTAUTH_SECRET=SYNTHETIC_NEXTAUTH_SECRET_xyz789abc123def456ghi789jkl012345
REDIS_URL=redis://:SYNTH_REDIS_PASS_001_abc@redis.example.com:6379
GOOGLE_CLIENT_ID=SYNTH_GOOGLE_CLIENT_ID_001abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=SYNTH_GOOG_SECRET_001_abcdefghijklmnopqrstu
GITHUB_TOKEN=ghp_SYNTHETICGitHubToken001ABCDEFGHIJKLMNOPQabcdefg
ENCRYPTION_KEY=SYNTHETIC_AES256_ENC_KEY_DO_NOT_USE_0000111122223333444455
`

const YAML_CONTENT = `# SYNTHETIC DLP TEST DATA — Kubernetes Secret — NOT REAL CREDENTIALS
# Created for DLP policy validation testing
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets-dlp-test
  namespace: production
  labels:
    app: backend-api
    env: production
type: Opaque
stringData:
  DATABASE_URL: "postgresql://admin:SYNTH_DB_PASS_001@postgres.prod.svc.cluster.local:5432/appdb"
  DATABASE_PASSWORD: "SYNTH_DB_PASS_001_abc123def456ghi789"
  REDIS_PASSWORD: "SYNTH_REDIS_PASS_001_abc123def456"
  JWT_SECRET: "SYNTHETIC_JWT_SECRET_abc123def456ghi789jkl0"
  API_KEY: "SYNTHETIC_API_KEY_001_ABCDEF0123456789abcdef"
  AWS_ACCESS_KEY_ID: "AKIAIOSFODNNSYNTH001"
  AWS_SECRET_ACCESS_KEY: "SYNTHETIC/AWS/SecretKey+001abcdefghijklmnopqrstuvwxyz"
  STRIPE_SECRET_KEY: "sk_test_SYNTHETIC_KEY_001_ABCDEFGHIJKLMNOPQabcdefg"
  OAUTH_CLIENT_SECRET: "SYNTH_OAUTH_CLIENT_SECRET_001_xyz789abc123def456ghi0"
  ENCRYPTION_KEY: "SYNTHETIC_AES256_ENCRYPTION_KEY_DO_NOT_USE_0000111122223333"
  WEBHOOK_SECRET: "SYNTH_WEBHOOK_SECRET_001_abcdefghijklmnopqrstuvwxyz123456"
`

const CONF_CONTENT = `# SYNTHETIC DLP TEST DATA — Server configuration with synthetic credentials
# Created for DLP policy validation testing — do not use in production

upstream backend_pool {
    server app-server-001.internal:3000 weight=3;
    server app-server-002.internal:3000 weight=2;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate     /etc/nginx/certs/example.com.crt;
    ssl_certificate_key /etc/nginx/certs/SYNTHETIC_PRIVATE_KEY_DO_NOT_USE.key;
    ssl_dhparam         /etc/nginx/certs/SYNTHETIC_DH_PARAMS.pem;

    location /api {
        proxy_pass http://backend_pool;
        proxy_set_header X-Internal-Auth-Token SYNTH_INT_TOKEN_001_abc123def456;
    }

    location /admin {
        auth_basic "Admin Area";
        auth_basic_user_file /etc/nginx/.htpasswd;
        # admin:SYNTH_ADMIN_PASS_001_abc123  (htpasswd format)
    }
}

# Database backup configuration (SYNTHETIC)
# DB_BACKUP_HOST:  db-backup.internal
# DB_BACKUP_USER:  backup_svc
# DB_BACKUP_PASS:  SYNTH_BACKUP_PASS_001_xyz789abc123
# DB_BACKUP_KEY:   SYNTHETIC_BACKUP_ENCRYPTION_KEY_0000111122223333

# SFTP upload credentials (SYNTHETIC)
# SFTP_HOST:       sftp.partner.example.com
# SFTP_USER:       data_transfer_svc
# SFTP_KEY_PASS:   SYNTH_SFTP_KEY_PASSPHRASE_abc123def456
`

function genJSON(): string {
  const N = 10
  const records = Array.from({ length: N }, (_, i) => ({
    id:           `SYNTH-${String(i + 1).padStart(3, '0')}`,
    full_name:    sn(i),
    email:        se(i),
    ssn:          ss(i),
    credit_card:  sc(i),
    dob:          sd(i),
    phone:        sp(i),
    address:      sa(i),
    bank_account: sb(i),
  }))
  const header = '// SYNTHETIC DLP TEST DATA — NOT REAL PII\n// Created for DLP policy validation testing\n'
  return header + JSON.stringify(records, null, 2)
}

function genSQL(): string {
  const N = 10
  const inserts = Array.from({ length: N }, (_, i) =>
    `('${sn(i)}', '${se(i)}', '${ss(i)}', '${sc(i)}', '${sd(i)}', '${sp(i)}', '${sb(i)}')`
  ).join(',\n  ')

  return `-- SYNTHETIC DLP TEST DATA — DO NOT USE IN PRODUCTION
-- Created for DLP policy validation testing

CREATE TABLE IF NOT EXISTS customers (
  id           SERIAL PRIMARY KEY,
  full_name    VARCHAR(100),
  email        VARCHAR(255),
  ssn          CHAR(11),
  credit_card  CHAR(19),
  dob          VARCHAR(10),
  phone        VARCHAR(25),
  bank_account VARCHAR(20)
);

INSERT INTO customers (full_name, email, ssn, credit_card, dob, phone, bank_account) VALUES
  ${inserts};
`
}

function genLog(): string {
  const N = 20
  const levels = ['INFO ', 'WARN ', 'ERROR', 'INFO ', 'DEBUG']
  const templates = [
    (i: number) => `POST /api/payment - user=${se(i)} card=${sc(i)} amount=$${1000+(i*547)%9000}.00 status=200`,
    (i: number) => `GET  /api/profile - user=${se(i)} ssn_last4=${ss(i).slice(-4)} ip=10.${(i*3)%255}.${(i*7)%255}.1`,
    (i: number) => `Login failed - email=${se(i)} reason=invalid_password ip=192.168.${(i*7)%255}.${(i*11)%254}`,
    (i: number) => `ALERT: SSN exposed in request body - ssn=${ss(i)} user=${se(i)} endpoint=/api/kyc`,
    (i: number) => `Bulk export - user=${se(i)} records=${10+(i*7)%90} fields=[ssn,credit_card,dob,bank_account]`,
  ]
  const lines = Array.from({ length: N }, (_, i) => {
    const d = new Date(2026, 4, 1 + Math.floor(i / 4), (i * 2) % 24, (i * 7) % 60, (i * 13) % 60)
    const ts = d.toISOString().replace('T', ' ').slice(0, 19)
    return `${ts} ${levels[i % levels.length]} [api-gateway] ${templates[i % templates.length](i)}`
  })
  return [
    '# SYNTHETIC DLP TEST DATA — Application log with synthetic PII',
    '# Created for DLP policy validation testing\n',
    ...lines,
  ].join('\n')
}

function genCSV(): string {
  const N = 25
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const header = ['full_name', 'email', 'ssn', 'credit_card', 'dob', 'phone', 'address', 'bank_account'].map(esc).join(',')
  const rows = Array.from({ length: N }, (_, i) =>
    [sn(i), se(i), ss(i), sc(i), sd(i), sp(i), sa(i), sb(i)].map(esc).join(',')
  )
  return [header, ...rows].join('\n')
}

function genXLSX() {
  const N = 25
  const rows = Array.from({ length: N }, (_, i) => ({
    'Full Name':     sn(i),
    'Email':         se(i),
    'SSN':           ss(i),
    'Credit Card':   sc(i),
    'Date of Birth': sd(i),
    'Phone':         sp(i),
    'Address':       sa(i),
    'Bank Account':  sb(i),
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'PII Records')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  dlBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'synthetic-pii-records.xlsx'
  )
}

// ── Template group definitions ────────────────────────────────────────────────

interface TplCard {
  ext:  string
  desc: string
  run:  () => void
}

const TEMPLATE_GROUPS: { title: string; color: string; cards: TplCard[] }[] = [
  {
    title: 'Credentials & Secrets',
    color: 'amber',
    cards: [
      { ext: '.pem',  desc: 'RSA private key',   run: () => dlText(PEM_CONTENT,  'synthetic-rsa-private-key.pem') },
      { ext: '.key',  desc: 'SSH private key',   run: () => dlText(SSH_KEY_CONTENT, 'synthetic-ssh-private-key.key') },
      { ext: '.env',  desc: 'Environment config', run: () => dlText(ENV_CONTENT,  'synthetic-secrets.env') },
      { ext: '.yaml', desc: 'K8s app secrets',   run: () => dlText(YAML_CONTENT, 'synthetic-k8s-secrets.yaml',  'application/x-yaml') },
      { ext: '.conf', desc: 'Server config',     run: () => dlText(CONF_CONTENT, 'synthetic-server.conf') },
    ],
  },
  {
    title: 'Data & Records',
    color: 'blue',
    cards: [
      { ext: '.json', desc: '10 PII records',    run: () => dlText(genJSON(), 'synthetic-pii-records.json', 'application/json') },
      { ext: '.sql',  desc: 'SQL dump + inserts', run: () => dlText(genSQL(),  'synthetic-customers.sql',   'application/sql') },
      { ext: '.log',  desc: 'App log with PII',  run: () => dlText(genLog(),  'synthetic-app.log') },
      { ext: '.csv',  desc: '25 rows of PII',    run: () => dlText(genCSV(),  'synthetic-pii-export.csv',  'text/csv') },
    ],
  },
  {
    title: 'Office',
    color: 'emerald',
    cards: [
      { ext: '.xlsx', desc: '25-row customer PII', run: genXLSX },
    ],
  },
]

// ── Main component ────────────────────────────────────────────────────────────

export function FileFormatGenerator() {
  const [aiPrompt, setAiPrompt]   = useState('')
  const [isPending, startTransition] = useTransition()
  const [result, setResult]       = useState<GeneratedFileResult | null>(null)
  const [aiError, setAiError]     = useState<string | null>(null)
  const [recentSearches, setRecentSearches]   = useState<AiSearchLog[]>([])
  const [learnedTemplates, setLearnedTemplates] = useState<LearnedTemplate[]>([])
  const [historyOpen, setHistoryOpen] = useState(true)

  useEffect(() => {
    getAiSearchLogs('file_generator', 10).then(setRecentSearches)
    getLearnedTemplates().then(setLearnedTemplates)
  }, [])

  function handleGenerate() {
    const text = aiPrompt.trim()
    if (!text || isPending) return
    setAiError(null)
    setResult(null)

    startTransition(async () => {
      const res = await generateFileWithAI(text)
      if (res.error) { setAiError(res.error); return }
      setResult(res)

      // Optimistically add to recent searches
      setRecentSearches(prev => [{
        id: crypto.randomUUID(), source: 'file_generator',
        prompt: text, result: `${res.filename} — ${res.description}`,
        created_at: new Date().toISOString(),
      }, ...prev.slice(0, 9)])

      // Refresh learned templates (AI may have added one)
      getLearnedTemplates().then(setLearnedTemplates)

      if (res.fileType === 'xlsx') {
        try {
          const records = JSON.parse(res.content) as Record<string, unknown>[]
          const ws = XLSX.utils.json_to_sheet(records)
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
          const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
          dlBlob(
            new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            res.filename
          )
        } catch {
          dlText(res.content, res.filename.replace(/\.xlsx$/, '.json'), 'application/json')
        }
      } else {
        dlBlob(new Blob([res.content], { type: res.mimeType }), res.filename)
      }
    })
  }

  const colorBg: Record<string, string> = {
    amber:   'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20 hover:border-amber-500/40',
    blue:    'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20 hover:border-blue-500/40',
    emerald: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 hover:border-emerald-500/40',
    violet:  'bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20 hover:border-violet-500/40',
  }
  const colorText: Record<string, string> = {
    amber:   'text-amber-400',
    blue:    'text-blue-400',
    emerald: 'text-emerald-400',
    violet:  'text-violet-400',
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── AI Generator ── */}
      <div className="rounded-xl border border-border bg-card/50 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">AI File Generator</p>
          <Sparkles className="w-3 h-3 text-purple-400 mb-0.5" />
        </div>

        <div className="flex gap-2 items-start">
          <textarea
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
            placeholder='Describe any file you need… e.g. "Generate a .pem RSA private key" or "Nginx access log with credit card numbers accidentally logged" or "Kubernetes secret YAML with AWS credentials" or "Excel spreadsheet with 20 rows of HIPAA patient data"'
            rows={3}
            className="flex-1 bg-muted text-foreground text-sm px-3 py-2.5 rounded-lg border border-border-strong placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500 resize-none"
          />
          <button
            onClick={handleGenerate}
            disabled={isPending || !aiPrompt.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            {isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
              : <><Download className="h-3.5 w-3.5" /> Generate File</>
            }
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground/60">⌘ + Enter to generate · Any file format supported</p>

        {aiError && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{aiError}</p>
          </div>
        )}

        {result && (
          <div className="mt-3 flex items-center gap-3 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-400">{result.filename} — downloaded</p>
              {result.description && (
                <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">{result.description}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Recent AI Searches ── */}
      {recentSearches.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground/80" />
              <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">Recent AI Searches</span>
              <span className="text-[10px] text-muted-foreground/60">{recentSearches.length}</span>
            </div>
            <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/60 transition-transform', historyOpen && 'rotate-180')} />
          </button>
          {historyOpen && (
            <div className="border-t border-border/60 divide-y divide-border/40">
              {recentSearches.map(s => (
                <div key={s.id} className="flex items-start justify-between gap-3 px-5 py-2.5 hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground/70 truncate">{s.prompt}</p>
                    {s.result && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{s.result}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums">{timeAgo(s.created_at)}</span>
                    <button
                      onClick={() => { setAiPrompt(s.prompt); setResult(null); setAiError(null) }}
                      className="text-[10px] text-muted-foreground/60 hover:text-blue-400 transition-colors"
                      title="Re-run this prompt"
                    >
                      ↺
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Quick Templates ── */}
      <div className="rounded-xl border border-border bg-card/50 p-5 shadow-sm">
        <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-4">Quick Templates</p>
        <div className="grid grid-cols-3 gap-5">
          {TEMPLATE_GROUPS.map(group => (
            <div key={group.title}>
              <p className="text-[10px] font-semibold text-muted-foreground/80 mb-2">{group.title}</p>
              <div className="space-y-1.5">
                {group.cards.map(card => (
                  <button
                    key={card.ext}
                    onClick={card.run}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${colorBg[group.color]}`}
                  >
                    <span className={`font-mono text-[11px] font-bold ${colorText[group.color]} w-11 shrink-0`}>
                      {card.ext}
                    </span>
                    <span className="text-xs text-muted-foreground">{card.desc}</span>
                    <Download className="w-3 h-3 text-muted-foreground/60 shrink-0 ml-auto" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Discovered by AI — only shown if there are learned templates */}
          {learnedTemplates.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-[10px] font-semibold text-muted-foreground/80">Discovered by AI</p>
                <Sparkles className="w-2.5 h-2.5 text-violet-400" />
              </div>
              <div className="space-y-1.5">
                {learnedTemplates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => dlText(t.content, t.filename, t.mime_type ?? 'text/plain')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${colorBg.violet}`}
                  >
                    <span className={`font-mono text-[11px] font-bold ${colorText.violet} w-11 shrink-0`}>
                      {t.ext}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.description}</span>
                    <Download className="w-3 h-3 text-muted-foreground/60 shrink-0 ml-auto" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
