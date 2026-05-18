'use client'

import { useState, useMemo, useTransition, useCallback, useRef, useEffect } from 'react'
import { Loader2, Trash2, Copy, Check, Sparkles, Search, FileDown, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateRegex, savePattern, deletePattern } from '../actions'
import type { AiRegexResult, ConfidenceReport, SavedPattern } from '../actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Match {
  index: number
  start: number
  end: number
  text: string
  groups: string[]
}

interface RegexResult {
  valid: boolean
  matches: Match[]
  error: string | null
}

// ── Client-side confidence heuristic (for manually-typed patterns) ────────────

function analyzePatternHeuristic(pattern: string): ConfidenceReport {
  const hasWordBoundary = pattern.includes('\\b')
  const hasLineAnchor   = /(?:^|[^\\])[\^$]/.test(pattern)
  const anchoring: 'strong' | 'weak' = (hasWordBoundary || hasLineAnchor) ? 'strong' : 'weak'

  const hasBroadness = /\.\*|\.\+|\[[\^]?[^\]]{0,3}\][+*]/.test(pattern)
  const hasSpecificQuantifier = /\{[0-9]+(?:,[0-9]+)?\}/.test(pattern)

  // Rough count of required/literal characters (strip meta-chars)
  const literalLen = pattern
    .replace(/\\[bBdDwWsSntr0-9]/g, 'X')
    .replace(/\[[^\]]+\]/g, 'X')
    .replace(/\{[0-9,]+\}/g, '')
    .replace(/[.*+?|(){}[\]^$\\]/g, '')
    .length

  let falsePositiveRisk: 'low' | 'medium' | 'high'
  if (hasBroadness || (anchoring === 'weak' && literalLen < 5)) {
    falsePositiveRisk = 'high'
  } else if (anchoring === 'weak' || literalLen < 8) {
    falsePositiveRisk = 'medium'
  } else {
    falsePositiveRisk = 'low'
  }

  const matchAccuracy: 'good' | 'fair' | 'poor' =
    (hasSpecificQuantifier && anchoring === 'strong' && literalLen >= 8) ? 'good' :
    (literalLen >= 5 || hasSpecificQuantifier) ? 'fair' : 'poor'

  const contextRequired = falsePositiveRisk !== 'low' || anchoring === 'weak'

  const dlpSeverity: 'critical' | 'high' | 'medium' | 'low' =
    (falsePositiveRisk === 'low' && matchAccuracy === 'good') ? 'high' :
    (falsePositiveRisk === 'medium' || matchAccuracy === 'fair') ? 'medium' : 'low'

  const recommendation =
    falsePositiveRisk === 'high'
      ? 'Monitor only — high false-positive risk. Add keyword context before alerting.'
    : falsePositiveRisk === 'medium' && anchoring === 'weak'
      ? 'Alert with review. Add proximity keywords to reduce false positives.'
    : falsePositiveRisk === 'medium'
      ? 'Alert first, review results before escalating to block.'
    : matchAccuracy === 'good'
      ? 'Suitable for alert or block. Validate with representative sample data.'
      : 'Test thoroughly with real data before deploying in production.'

  return { matchAccuracy, falsePositiveRisk, anchoring, contextRequired, dlpSeverity, recommendation }
}

// ── Confidence report row ─────────────────────────────────────────────────────

function ConfRow({ label, description, value }: { label: string; description: string; value: string }) {
  const color =
    ['good', 'low', 'strong'].includes(value)   ? 'text-green-400' :
    ['fair', 'medium'].includes(value)           ? 'text-amber-400' :
    ['poor', 'high', 'weak'].includes(value)     ? 'text-red-400'   :
    value === 'No'  ? 'text-green-400' :
    value === 'Yes' ? 'text-amber-400' :
    'text-zinc-300'
  return (
    <>
      <div>
        <p className="text-[10px] text-zinc-400">{label}</p>
        <p className="text-[9px] text-zinc-600 leading-snug mt-0.5">{description}</p>
      </div>
      <span className={cn('text-[10px] font-semibold capitalize self-start pt-0.5', color)}>{value}</span>
    </>
  )
}

// ── Built-in DLP Pattern Library ──────────────────────────────────────────────

interface DlpPattern {
  name: string
  description: string
  category: string
  pattern: string
  flags: string
  testExample: string
}

const DLP_PATTERNS: DlpPattern[] = [
  // ── Payment & Banking ───────────────────────────────────────────────────────
  {
    category: 'Payment & Banking',
    name: 'Visa Card',
    description: 'Visa credit/debit card numbers',
    pattern: '\\b4[0-9]{12}(?:[0-9]{3})?\\b',
    flags: 'g',
    testExample: 'Card: 4532015112830366',
  },
  {
    category: 'Payment & Banking',
    name: 'Mastercard',
    description: 'Mastercard numbers (legacy 5x and 2x series)',
    pattern: '\\b(?:5[1-5][0-9]{2}|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}\\b',
    flags: 'g',
    testExample: 'Card: 5425233430109903 or 2720992589999816',
  },
  {
    category: 'Payment & Banking',
    name: 'American Express',
    description: 'Amex card numbers starting with 34 or 37',
    pattern: '\\b3[47][0-9]{13}\\b',
    flags: 'g',
    testExample: 'Amex: 378282246310005',
  },
  {
    category: 'Payment & Banking',
    name: 'Discover Card',
    description: 'Discover card numbers',
    pattern: '\\b6(?:011|5[0-9]{2})[0-9]{12}\\b',
    flags: 'g',
    testExample: 'Discover: 6011111111111117',
  },
  {
    category: 'Payment & Banking',
    name: 'Any Credit Card',
    description: 'Visa, Mastercard, Amex, Discover, Diners, JCB',
    pattern: '\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\\d{3})\\d{11})\\b',
    flags: 'g',
    testExample: '4532015112830366 or 378282246310005 or 5425233430109903',
  },
  {
    category: 'Payment & Banking',
    name: 'US Routing Number',
    description: 'ABA bank routing numbers (9 digits)',
    pattern: '\\b(?:routing[\\s:#]*)?(?:0[0-9]|[1-9][0-9])\\d{7}\\b',
    flags: 'gi',
    testExample: 'Routing: 021000021',
  },
  {
    category: 'Payment & Banking',
    name: 'UK Sort Code',
    description: 'UK bank sort codes (XX-XX-XX)',
    pattern: '\\b\\d{2}[-\\s]\\d{2}[-\\s]\\d{2}\\b',
    flags: 'g',
    testExample: 'Sort Code: 20-47-14',
  },
  {
    category: 'Payment & Banking',
    name: 'SWIFT / BIC',
    description: 'SWIFT/BIC bank identifier codes (8 or 11 chars)',
    pattern: '\\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\\b',
    flags: 'g',
    testExample: 'SWIFT: DEUTDEDB or BOFAUS3NXXX',
  },
  {
    category: 'Payment & Banking',
    name: 'IBAN',
    description: 'International Bank Account Numbers',
    pattern: '\\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}(?:[A-Z0-9]?){0,16}\\b',
    flags: 'gi',
    testExample: 'IBAN: GB29NWBK60161331926819',
  },
  {
    category: 'Payment & Banking',
    name: 'Bitcoin Address',
    description: 'Bitcoin wallet addresses (P2PKH and P2SH)',
    pattern: '\\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\\b',
    flags: 'g',
    testExample: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
  },
  {
    category: 'Payment & Banking',
    name: 'Ethereum Address',
    description: 'Ethereum wallet addresses (0x + 40 hex chars)',
    pattern: '\\b0x[a-fA-F0-9]{40}\\b',
    flags: 'g',
    testExample: '0x742d35Cc6634C0532925a3b8D4C9Ce1e47cF4f8',
  },

  // ── Personal Identity ───────────────────────────────────────────────────────
  {
    category: 'Personal Identity',
    name: 'US SSN',
    description: 'US Social Security Numbers',
    pattern: '\\b(?!000|666|9\\d{2})\\d{3}-(?!00)\\d{2}-(?!0000)\\d{4}\\b',
    flags: 'g',
    testExample: 'SSN: 123-45-6789',
  },
  {
    category: 'Personal Identity',
    name: 'US EIN',
    description: 'US Employer Identification Numbers (tax ID)',
    pattern: '\\b[0-9]{2}-[0-9]{7}\\b',
    flags: 'g',
    testExample: 'EIN: 91-1234567',
  },
  {
    category: 'Personal Identity',
    name: 'US ITIN',
    description: 'US Individual Taxpayer Identification Numbers (starts with 9)',
    pattern: '\\b9\\d{2}[- ](?!00)\\d{2}[- ](?!0000)\\d{4}\\b',
    flags: 'g',
    testExample: 'ITIN: 912-34-5678',
  },
  {
    category: 'Personal Identity',
    name: 'Indian Aadhaar',
    description: '12-digit Indian national ID',
    pattern: '\\b[2-9]\\d{3}\\s?\\d{4}\\s?\\d{4}\\b',
    flags: 'g',
    testExample: 'Aadhaar: 2345 6789 0123',
  },
  {
    category: 'Personal Identity',
    name: 'Indian PAN',
    description: 'Indian Permanent Account Number (income tax)',
    pattern: '\\b[A-Z]{5}[0-9]{4}[A-Z]\\b',
    flags: 'g',
    testExample: 'PAN: ABCDE1234F',
  },
  {
    category: 'Personal Identity',
    name: 'UK NI Number',
    description: 'UK National Insurance numbers',
    pattern: '\\b[A-CEGHJ-PR-TW-Z]{2}[0-9]{6}[A-D]\\b',
    flags: 'gi',
    testExample: 'NI: AB123456C',
  },
  {
    category: 'Personal Identity',
    name: 'UK NHS Number',
    description: 'UK National Health Service numbers',
    pattern: '\\b[0-9]{3}\\s[0-9]{3}\\s[0-9]{4}\\b',
    flags: 'g',
    testExample: 'NHS: 943 476 5919',
  },
  {
    category: 'Personal Identity',
    name: 'Passport Number',
    description: 'Generic alphanumeric passport numbers',
    pattern: '\\b(?:passport[:\\s]*)?([A-Z]{1,2}[0-9]{6,7})\\b',
    flags: 'gi',
    testExample: 'Passport: AB1234567',
  },
  {
    category: 'Personal Identity',
    name: 'Date of Birth',
    description: 'DOB in MM/DD/YYYY, DD/MM/YYYY, or YYYY-MM-DD',
    pattern: '\\b(?:(?:0[1-9]|1[0-2])\\/(?:0[1-9]|[12]\\d|3[01])\\/(?:19|20)\\d{2}|(?:0[1-9]|[12]\\d|3[01])\\/(?:0[1-9]|1[0-2])\\/(?:19|20)\\d{2}|(?:19|20)\\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01]))\\b',
    flags: 'g',
    testExample: 'DOB: 01/15/1990 or 15/01/1990 or 1990-01-15',
  },

  // ── Contact & Location ──────────────────────────────────────────────────────
  {
    category: 'Contact & Location',
    name: 'Email Address',
    description: 'Standard email addresses',
    pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
    flags: 'gi',
    testExample: 'Contact: user@example.com or admin@company.co.uk',
  },
  {
    category: 'Contact & Location',
    name: 'US Phone',
    description: 'US/Canada phone numbers (various formats)',
    pattern: '\\b(?:\\+1[\\s.-]?)?(?:\\(?[2-9]\\d{2}\\)?[\\s.-]?)[2-9]\\d{2}[\\s.-]?\\d{4}\\b',
    flags: 'g',
    testExample: '(800) 555-1234 or +1-212-555-6789',
  },
  {
    category: 'Contact & Location',
    name: 'UK Phone',
    description: 'UK landline and mobile numbers',
    pattern: '\\b(?:\\+44\\s?|0)(?:7\\d{3}|\\d{4})\\s?\\d{3}\\s?\\d{3,4}\\b',
    flags: 'g',
    testExample: '+44 7700 900123 or 07700 900123',
  },
  {
    category: 'Contact & Location',
    name: "Int'l Phone (E.164)",
    description: 'International phone numbers in E.164 format',
    pattern: '\\+[1-9]\\d{6,14}\\b',
    flags: 'g',
    testExample: '+14155552671 or +447700900123',
  },
  {
    category: 'Contact & Location',
    name: 'IPv4 Address',
    description: 'IPv4 addresses 0.0.0.0–255.255.255.255',
    pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b',
    flags: 'g',
    testExample: 'Server: 192.168.1.100 and 10.0.0.1',
  },
  {
    category: 'Contact & Location',
    name: 'IPv6 Address',
    description: 'Full and compressed IPv6 addresses',
    pattern: '\\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\\b',
    flags: 'gi',
    testExample: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
  },
  {
    category: 'Contact & Location',
    name: 'MAC Address',
    description: 'Network hardware MAC addresses',
    pattern: '\\b(?:[0-9A-Fa-f]{2}[:\\-]){5}[0-9A-Fa-f]{2}\\b',
    flags: 'gi',
    testExample: 'MAC: 00:1B:44:11:3A:B7',
  },
  {
    category: 'Contact & Location',
    name: 'US ZIP Code',
    description: 'US 5-digit and ZIP+4 postal codes',
    pattern: '\\b\\d{5}(?:-\\d{4})?\\b',
    flags: 'g',
    testExample: 'ZIP: 90210 or 90210-1234',
  },
  {
    category: 'Contact & Location',
    name: 'UK Postcode',
    description: 'UK postal codes',
    pattern: '\\b[A-Z]{1,2}[0-9][0-9A-Z]?\\s?[0-9][ABD-HJLNP-UW-Z]{2}\\b',
    flags: 'gi',
    testExample: 'London SW1A 2AA or EC1A 1BB',
  },
  {
    category: 'Contact & Location',
    name: 'Canadian Postal Code',
    description: 'Canadian postal codes (A1A 1A1 format)',
    pattern: '\\b[ABCEGHJ-NPRSTVXY]\\d[ABCEGHJ-NPRSTV-Z]\\s?\\d[ABCEGHJ-NPRSTV-Z]\\d\\b',
    flags: 'gi',
    testExample: 'Postal: M5V 3L9 or K1A 0A9',
  },

  // ── Credentials & Secrets ───────────────────────────────────────────────────
  {
    category: 'Credentials & Secrets',
    name: 'AWS Access Key',
    description: 'AWS Access Key IDs (AKIA/ASIA prefix)',
    pattern: '\\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\\b',
    flags: 'g',
    testExample: 'Key: AKIAIOSFODNN7EXAMPLE',
  },
  {
    category: 'Credentials & Secrets',
    name: 'AWS Secret Key',
    description: 'AWS secret access keys in config/env files',
    pattern: '(?:aws[_-]?secret[_-]?(?:access[_-]?)?key|AWS_SECRET_ACCESS_KEY)[^=:\\s]*[=:\\s]+[A-Za-z0-9\\/+=]{40}',
    flags: 'gi',
    testExample: 'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  },
  {
    category: 'Credentials & Secrets',
    name: 'GitHub PAT',
    description: 'GitHub classic personal access tokens (ghp_)',
    pattern: '\\bghp_[A-Za-z0-9]{36}\\b',
    flags: 'g',
    testExample: 'Token: ghp_16C7e42F292c6912E7710c838347Ae178B4a',
  },
  {
    category: 'Credentials & Secrets',
    name: 'Stripe Secret Key',
    description: 'Stripe live and test secret API keys',
    pattern: '\\bsk_(?:live|test)_[A-Za-z0-9]{24,}\\b',
    flags: 'g',
    testExample: 'sk_live_EXAMPLE000000000000000 or sk_test_EXAMPLE000000000000000',
  },
  {
    category: 'Credentials & Secrets',
    name: 'Google API Key',
    description: 'Google Cloud/Maps/Firebase API keys (AIza prefix)',
    pattern: '\\bAIza[0-9A-Za-z\\-_]{35}\\b',
    flags: 'g',
    testExample: 'key=AIzaSyDhz2FotRjLQ1v4FKb5aWIZnDzRnBYoxiE',
  },
  {
    category: 'Credentials & Secrets',
    name: 'Slack Token',
    description: 'Slack bot and user OAuth tokens (xoxb/xoxp)',
    pattern: '\\bxox[baprs]-(?:[0-9]{12}-){2}[0-9]{12}-[0-9a-f]{32}\\b',
    flags: 'g',
    testExample: 'xoxb-123456789012-123456789012-123456789012-abc123def456ghi7',
  },
  {
    category: 'Credentials & Secrets',
    name: 'Bearer Token / API Key',
    description: 'Authorization headers and inline API key assignments',
    pattern: '(?:Bearer\\s+|api[_-]?key[=:\\s]+|token[=:\\s]+)[A-Za-z0-9\\-_=+\\/]{20,}',
    flags: 'gi',
    testExample: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc123',
  },
  {
    category: 'Credentials & Secrets',
    name: 'JWT Token',
    description: 'JSON Web Tokens (three Base64URL-encoded segments)',
    pattern: '\\beyJ[A-Za-z0-9\\-_]+\\.eyJ[A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_.+\\/]*',
    flags: 'g',
    testExample: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  },
  {
    category: 'Credentials & Secrets',
    name: 'PEM Private Key',
    description: 'RSA/EC/DSA/OpenSSH private key headers',
    pattern: '-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----',
    flags: 'g',
    testExample: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...',
  },
  {
    category: 'Credentials & Secrets',
    name: 'Database URL',
    description: 'Database connection strings with embedded credentials',
    pattern: '(?:mysql|postgresql|postgres|mongodb(?:\\+srv)?|redis|mssql|sqlserver):\\/\\/[^\\s"\'<>]+',
    flags: 'gi',
    testExample: 'postgresql://admin:secretpass@db.example.com:5432/prod',
  },

  // ── Network & Technical ─────────────────────────────────────────────────────
  {
    category: 'Network & Technical',
    name: 'HTTPS URL',
    description: 'HTTP and HTTPS web URLs',
    pattern: 'https?:\\/\\/(?:www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b(?:[-a-zA-Z0-9()@:%_\\+.~#?&\\/=]*)',
    flags: 'gi',
    testExample: 'https://app.example.com/reset?token=abc123&user=42',
  },
  {
    category: 'Network & Technical',
    name: 'IPv4 CIDR Range',
    description: 'IPv4 addresses with CIDR subnet mask',
    pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\/(?:[0-9]|[12][0-9]|3[012])\\b',
    flags: 'g',
    testExample: 'Network: 192.168.0.0/24 or 10.0.0.0/8',
  },
  {
    category: 'Network & Technical',
    name: 'UUID / GUID',
    description: 'Universally unique identifiers (v1–v5)',
    pattern: '\\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\b',
    flags: 'gi',
    testExample: 'ID: 550e8400-e29b-41d4-a716-446655440000',
  },
  {
    category: 'Network & Technical',
    name: 'Semantic Version',
    description: 'SemVer version numbers (MAJOR.MINOR.PATCH)',
    pattern: '\\bv?(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)(?:-[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*)?(?:\\+[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*)?\\b',
    flags: 'g',
    testExample: 'Released 2.14.0 and 3.0.0-beta.1+build.123',
  },

  // ── Healthcare ──────────────────────────────────────────────────────────────
  {
    category: 'Healthcare',
    name: 'US NPI Number',
    description: 'National Provider Identifier (10 digits)',
    pattern: '\\bNPI[:\\s#]*([0-9]{10})\\b',
    flags: 'gi',
    testExample: 'NPI: 1234567890',
  },
  {
    category: 'Healthcare',
    name: 'DEA Number',
    description: 'US Drug Enforcement Administration registration numbers',
    pattern: '\\b[ABCDEFGHJKLMNPQRSTUVWXYZ][ABCDEFGHJKLMNPQRSTUVWXYZ9][0-9]{7}\\b',
    flags: 'g',
    testExample: 'DEA: AB1234563',
  },
  {
    category: 'Healthcare',
    name: 'ICD-10 Code',
    description: 'International Classification of Diseases codes',
    pattern: '\\b[A-Z][0-9]{2}(?:\\.[0-9A-Z]{1,4})?\\b',
    flags: 'g',
    testExample: 'Diagnosis: J18.9 or M54.5',
  },

  // ── Enterprise & Legal ──────────────────────────────────────────────────────
  {
    category: 'Enterprise & Legal',
    name: 'EU VAT Number',
    description: 'European Union VAT registration numbers',
    pattern: '\\b(?:AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|GB|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)[0-9A-Z]{6,13}\\b',
    flags: 'gi',
    testExample: 'VAT: DE123456789 or FR12345678901',
  },
  {
    category: 'Enterprise & Legal',
    name: 'UK VAT Number',
    description: 'UK VAT registration numbers (GB prefix)',
    pattern: '\\bGB\\s?[0-9]{3}\\s?[0-9]{4}\\s?[0-9]{2}(?:\\s?[0-9]{3})?\\b',
    flags: 'gi',
    testExample: 'VAT: GB 123 4567 89',
  },
  {
    category: 'Enterprise & Legal',
    name: 'UK Companies House',
    description: 'UK Companies House registration numbers',
    pattern: '\\b(?:SC|NI|OC|LP|SO|NC|R)?[0-9]{6,8}\\b',
    flags: 'g',
    testExample: 'Company: 12345678 or SC123456',
  },
]

const DLP_CATEGORIES = Array.from(new Set(DLP_PATTERNS.map(p => p.category)))

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHighlightedHtml(text: string, matches: Match[], mode: 'match' | 'fp' = 'match'): string {
  const bg    = mode === 'fp' ? 'rgba(239,68,68,0.25)'  : 'rgba(234,179,8,0.25)'
  const color = mode === 'fp' ? 'rgb(239,68,68)'        : 'rgb(234,179,8)'
  if (matches.length === 0) {
    return `<span style="color:rgb(161,161,170)">${escapeHtml(text)}</span>`
  }
  let html = ''
  let cursor = 0
  for (const m of matches) {
    if (cursor < m.start) {
      html += `<span style="color:rgb(161,161,170)">${escapeHtml(text.slice(cursor, m.start))}</span>`
    }
    html += `<span style="background:${bg};color:${color};border-radius:2px;padding:0 2px">${escapeHtml(text.slice(m.start, m.end))}</span>`
    cursor = m.end
  }
  if (cursor < text.length) {
    html += `<span style="color:rgb(161,161,170)">${escapeHtml(text.slice(cursor))}</span>`
  }
  return html
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

// Shared inline style for both overlay div and textarea (must match exactly)
const OVERLAY_STYLE: React.CSSProperties = {
  fontFamily: "'Menlo', 'Monaco', 'Consolas', monospace",
  fontSize: '13px',
  lineHeight: '1.65',
  padding: '14px 16px',
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  margin: 0,
  border: 'none',
  outline: 'none',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
  boxSizing: 'border-box',
  overflow: 'auto',
  tabSize: 2,
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  initialPatterns: SavedPattern[]
}

export function RegexLab({ initialPatterns }: Props) {
  // Core editor
  const [pattern,  setPattern]  = useState('')
  const [flags,    setFlags]    = useState('gi')
  const [testData, setTestData] = useState('')

  // AI
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, startAiTransition] = useTransition()
  const [aiResult, setAiResult] = useState<AiRegexResult | null>(null)
  const [aiError,  setAiError]  = useState<string | null>(null)

  // Save
  const [savedPatterns, setSavedPatterns] = useState<SavedPattern[]>(initialPatterns)
  const [saveName,        setSaveName]        = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [saveLoading, startSaveTransition] = useTransition()
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError,   setSaveError]   = useState<string | null>(null)

  // Clipboard
  const [copied,   setCopied]   = useState(false)
  const [copiedMd, setCopiedMd] = useState(false)

  // Library filter
  const [libSearch,   setLibSearch]   = useState('')
  const [libCategory, setLibCategory] = useState('All')

  // Context keywords (AI Assistant)
  const [contextKeywords, setContextKeywords] = useState('')
  const [showContext,     setShowContext]      = useState(false)

  // Scroll sync refs
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef  = useRef<HTMLDivElement>(null)

  const syncScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop  = textareaRef.current.scrollTop
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  // ── Flag toggle ────────────────────────────────────────────────────────────
  const toggleFlag = useCallback((flag: string) => {
    setFlags(prev => {
      if (flag === 'g') return prev // G is always on
      const has = prev.includes(flag)
      return has ? prev.replace(flag, '') : prev + flag
    })
  }, [])

  // ── Regex evaluation (client-side, zero server calls) ─────────────────────
  const regexResult = useMemo<RegexResult>(() => {
    if (!pattern) return { valid: true, matches: [], error: null }
    try {
      const flagsWithG = flags.includes('g') ? flags : flags + 'g'
      const regex = new RegExp(pattern, flagsWithG)
      const matches: Match[] = []
      const LIMIT = 100
      let m: RegExpExecArray | null
      regex.lastIndex = 0
      while ((m = regex.exec(testData)) !== null && matches.length < LIMIT) {
        matches.push({
          index:  matches.length,
          start:  m.index,
          end:    m.index + m[0].length,
          text:   m[0],
          groups: m.slice(1),
        })
        if (m[0].length === 0) {
          regex.lastIndex++
          if (regex.lastIndex > testData.length) break
        }
      }
      return { valid: true, matches, error: null }
    } catch (e) {
      return { valid: false, matches: [], error: (e as Error).message }
    }
  }, [pattern, flags, testData])

  // ── Confidence report (AI result takes priority, heuristic as fallback) ──────
  const confidence = useMemo<ConfidenceReport | null>(() => {
    if (!pattern || !regexResult.valid) return null
    if (aiResult?.confidence && pattern === aiResult.pattern) return aiResult.confidence
    return analyzePatternHeuristic(pattern)
  }, [pattern, regexResult.valid, aiResult])

  // ── Match highlighted HTML ────────────────────────────────────────────────
  const highlightedHtml = useMemo(
    () => buildHighlightedHtml(testData, regexResult.valid ? regexResult.matches : []),
    [testData, regexResult]
  )


  // ── AI generate ───────────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (!aiPrompt.trim()) return
    setAiError(null)
    setAiResult(null)
    startAiTransition(async () => {
      const fullPrompt = contextKeywords.trim()
        ? `${aiPrompt}. Only match when the data appears near these context keywords: ${contextKeywords}`
        : aiPrompt
      const { result, error } = await generateRegex(fullPrompt)
      if (error) { setAiError(error); return }
      if (result) {
        setAiResult(result)
        setPattern(result.pattern)
        setFlags(result.flags)
        setSaveName(result.title)
        if (!testData && result.testExamples.length > 0) {
          setTestData(result.testExamples.join('\n'))
        }
      }
    })
  }, [aiPrompt, contextKeywords, testData])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!pattern || !saveName.trim()) return
    setSaveError(null)
    setSaveSuccess(false)
    startSaveTransition(async () => {
      const { id, error } = await savePattern({
        name:          saveName,
        description:   saveDescription,
        pattern,
        flags,
        testData,
        aiGenerated:   !!aiResult,
        aiExplanation: aiResult?.explanation ?? '',
      })
      if (error) { setSaveError(error); return }
      const newEntry: SavedPattern = {
        id: id!,
        name:           saveName.trim(),
        description:    saveDescription.trim() || null,
        pattern,
        flags,
        test_data:      testData || null,
        ai_generated:   !!aiResult,
        ai_explanation: aiResult?.explanation ?? null,
        created_at:     new Date().toISOString(),
      }
      setSavedPatterns(prev => [newEntry, ...prev])
      setSaveSuccess(true)
      setSaveName('')
      setSaveDescription('')
      setTimeout(() => setSaveSuccess(false), 3000)
    })
  }, [pattern, saveName, saveDescription, flags, testData, aiResult])

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    const { error } = await deletePattern(id)
    if (!error) setSavedPatterns(prev => prev.filter(p => p.id !== id))
  }, [])

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadPattern = useCallback((p: SavedPattern | DlpPattern) => {
    setPattern(p.pattern)
    setFlags(p.flags)
    setSaveName(p.name)
    if ('test_data' in p && p.test_data) {
      setTestData(p.test_data)
    } else if ('testExample' in p) {
      setTestData(p.testExample)
    }
    setAiResult(null)
    setAiError(null)
  }, [])

  // ── Copy ──────────────────────────────────────────────────────────────────
  const copyPattern = useCallback(async () => {
    if (!pattern) return
    await navigator.clipboard.writeText(`/${pattern}/${flags}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [pattern, flags])

  // ── Export JSON ───────────────────────────────────────────────────────────
  const exportJson = useCallback(() => {
    if (!pattern) return
    const payload = {
      name:        saveName || 'Untitled Pattern',
      pattern,
      flags,
      test_data:   testData || null,
      ...(aiResult?.explanation && { explanation: aiResult.explanation }),
      ...(confidence && { confidence }),
      exported_at: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `dlp-pattern-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [pattern, flags, testData, saveName, aiResult, confidence])

  // ── Copy as markdown documentation ────────────────────────────────────────
  const copyAsMarkdown = useCallback(async () => {
    if (!pattern) return
    const conf = confidence
    const lines = [
      `## DLP Pattern: ${saveName || 'Untitled'}`,
      '',
      `**Pattern:** \`/${pattern}/${flags}\``,
      ...(aiResult?.explanation ? [`\n**Description:** ${aiResult.explanation.split('\\n')[0]}`] : []),
      ...(conf ? [
        '',
        '**Confidence Report**',
        '',
        '| Check | Result |',
        '|---|---|',
        `| Match accuracy | ${conf.matchAccuracy} |`,
        `| False-positive risk | ${conf.falsePositiveRisk} |`,
        `| Anchoring | ${conf.anchoring} |`,
        `| Context required | ${conf.contextRequired ? 'Yes' : 'No'} |`,
        `| DLP severity | ${conf.dlpSeverity} |`,
        '',
        `**Recommended use:** ${conf.recommendation}`,
      ] : []),
      ...(testData ? [`\n**Test data:**\n\`\`\`\n${testData}\n\`\`\``] : []),
    ]
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopiedMd(true)
    setTimeout(() => setCopiedMd(false), 1500)
  }, [pattern, flags, testData, saveName, aiResult, confidence])

  // ── Library filter ────────────────────────────────────────────────────────
  const filteredPatterns = useMemo(() => {
    const q = libSearch.toLowerCase()
    return DLP_PATTERNS.filter(p => {
      const catMatch = libCategory === 'All' || p.category === libCategory
      const textMatch = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      return catMatch && textMatch
    })
  }, [libSearch, libCategory])

  const groupedPatterns = useMemo(() => {
    const groups: Record<string, DlpPattern[]> = {}
    for (const p of filteredPatterns) {
      if (!groups[p.category]) groups[p.category] = []
      groups[p.category].push(p)
    }
    return groups
  }, [filteredPatterns])

  // ── Badge colour ──────────────────────────────────────────────────────────
  const matchBadgeClass =
    !regexResult.valid
      ? 'bg-red-500/15 text-red-400'
      : regexResult.matches.length > 0
      ? 'bg-green-500/15 text-green-400'
      : 'bg-zinc-800 text-zinc-500'

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="grid grid-cols-3 gap-5">

      {/* ══════════════════════════════════════════════════
          LEFT COLUMN (2/3)
          ══════════════════════════════════════════════════ */}
      <div className="col-span-2 space-y-5">

        {/* Pattern Editor */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Expression</SectionLabel>
            <div className="flex items-center gap-1.5">
              {/* Flag toggles */}
              {(['g', 'i', 'm'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => toggleFlag(f)}
                  title={f === 'g' ? 'Global — always on' : f === 'i' ? 'Case insensitive' : 'Multiline'}
                  className={cn(
                    'w-7 h-7 rounded text-xs font-bold font-mono transition-all',
                    flags.includes(f)
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300',
                    f === 'g' && 'opacity-60 cursor-default'
                  )}
                >
                  {f.toUpperCase()}
                </button>
              ))}
              {/* Copy */}
              <button onClick={copyPattern} disabled={!pattern} title="Copy pattern with flags"
                className="w-7 h-7 rounded flex items-center justify-center bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-30 transition-all">
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              {/* Copy as markdown */}
              <button onClick={copyAsMarkdown} disabled={!pattern} title="Copy as documentation (markdown)"
                className="w-7 h-7 rounded flex items-center justify-center bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-30 transition-all">
                {copiedMd ? <Check className="h-3.5 w-3.5 text-green-400" /> : <FileText className="h-3.5 w-3.5" />}
              </button>
              {/* Export JSON */}
              <button onClick={exportJson} disabled={!pattern} title="Export as JSON"
                className="w-7 h-7 rounded flex items-center justify-center bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-30 transition-all">
                <FileDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-mono text-xl select-none leading-none">/</span>
            <input
              type="text"
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              placeholder="e.g. \d{3}-\d{2}-\d{4}"
              spellCheck={false}
              autoComplete="off"
              className={cn(
                'flex-1 font-mono text-sm px-3 py-2.5 rounded-lg border bg-zinc-800 text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-blue-500',
                !regexResult.valid ? 'border-red-500/60 text-red-300' : 'border-zinc-700'
              )}
            />
            <span className="text-zinc-500 font-mono text-xl select-none leading-none">/{flags}</span>
          </div>

          {!regexResult.valid && (
            <p className="mt-2 text-xs text-red-400 font-mono">{regexResult.error}</p>
          )}

          {/* Confidence Report */}
          {confidence && (
            <div className="mt-4 rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Confidence Report</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <ConfRow
                  label="Match accuracy"
                  description="How precisely this pattern targets the intended data type without over-matching."
                  value={confidence.matchAccuracy}
                />
                <ConfRow
                  label="False-positive risk"
                  description="Likelihood of firing on non-sensitive strings that look similar to the target."
                  value={confidence.falsePositiveRisk}
                />
                <ConfRow
                  label="Anchoring"
                  description="Whether \\b word boundaries or ^ $ anchors prevent partial-word matches."
                  value={confidence.anchoring}
                />
                <ConfRow
                  label="Context required"
                  description="If yes, add a keyword proximity condition in your DLP tool to reduce noise."
                  value={confidence.contextRequired ? 'Yes' : 'No'}
                />
                <ConfRow
                  label="DLP severity"
                  description="Suggested enforcement level: critical=block, high=alert+block, medium=alert, low=monitor."
                  value={confidence.dlpSeverity}
                />
              </div>
              <p className="text-[10px] text-zinc-400 mt-3 leading-relaxed border-t border-zinc-700/60 pt-2.5">
                {confidence.recommendation}
              </p>
            </div>
          )}
        </div>

        {/* AI Assistant */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <SectionLabel>AI Assistant</SectionLabel>
            <Sparkles className="w-3 h-3 text-purple-400 mb-3" />
          </div>

          <div className="flex gap-2">
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
              placeholder='Describe what you want to match... e.g. "UK National Insurance numbers" or "Stripe secret API keys starting with sk_live"'
              rows={2}
              className="flex-1 bg-zinc-800 text-white text-sm px-3 py-2.5 rounded-lg border border-zinc-700 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
            />
            <button
              onClick={handleGenerate}
              disabled={aiLoading || !aiPrompt.trim()}
              className="flex items-center gap-1.5 px-4 py-2 self-start rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {aiLoading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                : 'Generate Pattern'}
            </button>
          </div>

          {/* Context keywords */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowContext(v => !v)}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Add context keywords (optional)
            </button>
            {showContext && (
              <div className="mt-2 space-y-1">
                <input
                  type="text"
                  value={contextKeywords}
                  onChange={e => setContextKeywords(e.target.value)}
                  placeholder='e.g. "secret, api_key, password" — match only near these words'
                  className="w-full bg-zinc-800 text-white text-xs px-3 py-2 rounded-lg border border-zinc-700 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-zinc-600">
                  Generates a proximity pattern: sensitive data matched only when near these keywords.
                </p>
              </div>
            )}
          </div>

          {aiError && <p className="mt-2 text-xs text-red-400">{aiError}</p>}

          {aiResult && (
            <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-800/60 p-4 space-y-4">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-2">
                  Pattern Explanation
                </p>
                <div className="space-y-1">
                  {aiResult.explanation.split('\\n').map((line, i) => (
                    <p key={i} className="text-xs text-zinc-300 leading-relaxed">{line}</p>
                  ))}
                </div>
              </div>

              {aiResult.testExamples.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-green-500 uppercase mb-1.5">
                    Matching Examples
                  </p>
                  <div className="space-y-1">
                    {aiResult.testExamples.map((ex, i) => (
                      <p key={i} className="text-xs font-mono text-green-400 bg-green-500/5 rounded px-2 py-1">
                        {ex}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {aiResult.nonMatchExamples.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-red-500 uppercase mb-1.5">
                    Non-Matching Examples
                  </p>
                  <div className="space-y-1">
                    {aiResult.nonMatchExamples.map((ex, i) => (
                      <p key={i} className="text-xs font-mono text-red-400 bg-red-500/5 rounded px-2 py-1">
                        {ex}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Test String */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Test String</SectionLabel>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase', matchBadgeClass)}>
              {!regexResult.valid
                ? 'Invalid pattern'
                : `${regexResult.matches.length} match${regexResult.matches.length !== 1 ? 'es' : ''}`}
            </span>
          </div>

          <div className="relative rounded-lg border border-zinc-700 overflow-hidden" style={{ height: '280px' }}>
            <div
              ref={overlayRef}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              style={{ ...OVERLAY_STYLE, zIndex: 1, pointerEvents: 'none', background: '#18181b' }}
            />
            <textarea
              ref={textareaRef}
              value={testData}
              onChange={e => setTestData(e.target.value)}
              onScroll={syncScroll}
              placeholder="Paste or type text to test against your pattern..."
              spellCheck={false}
              className="absolute inset-0 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-lg"
              style={{ ...OVERLAY_STYLE, zIndex: 2, background: 'transparent', caretColor: 'white', color: 'transparent', WebkitTextFillColor: 'transparent' }}
            />
          </div>
        </div>

        {/* Match Results */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <SectionLabel>Matches</SectionLabel>
            {regexResult.valid && regexResult.matches.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 mb-3">
                {regexResult.matches.length}
              </span>
            )}
          </div>

          {!pattern ? (
            <p className="text-xs text-zinc-600 italic">Enter a pattern above to start matching</p>
          ) : !regexResult.valid ? (
            <p className="text-xs text-red-400 font-mono">{regexResult.error}</p>
          ) : regexResult.matches.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No matches found in the test string</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {regexResult.matches.map(m => (
                <div
                  key={m.index}
                  className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-zinc-800/60 text-xs"
                >
                  <span className="text-zinc-600 tabular-nums w-5 shrink-0 text-right">
                    {m.index + 1}
                  </span>
                  <span className="text-zinc-500 tabular-nums shrink-0 w-16 text-right">
                    {m.start}–{m.end}
                  </span>
                  <span className="font-mono text-yellow-400 bg-yellow-400/10 rounded px-1.5 py-0.5 break-all flex-1">
                    {m.text}
                  </span>
                  {m.groups.filter(Boolean).length > 0 && (
                    <div className="flex flex-wrap gap-1 shrink-0">
                      {m.groups.filter(Boolean).map((g, gi) => (
                        <span
                          key={gi}
                          className="font-mono text-[10px] text-blue-400 bg-blue-400/10 rounded px-1"
                        >
                          #{gi + 1}: {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {regexResult.matches.length === 100 && (
                <p className="text-[10px] text-zinc-600 text-center pt-1">Showing first 100 matches</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          RIGHT COLUMN (1/3)
          ══════════════════════════════════════════════════ */}
      <div className="col-span-1 space-y-5">

        {/* Save Pattern */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <SectionLabel>Save Pattern</SectionLabel>
          <div className="space-y-2">
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Pattern name *"
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
              disabled={!pattern || !saveName.trim() || saveLoading}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saveLoading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
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

        {/* Saved Patterns */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <SectionLabel>Saved Patterns</SectionLabel>
          {savedPatterns.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No saved patterns yet</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {savedPatterns.map(p => (
                <div
                  key={p.id}
                  className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-3 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                      {p.description && (
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{p.description}</p>
                      )}
                      <p className="text-[10px] font-mono text-zinc-600 mt-1 truncate">
                        /{p.pattern.slice(0, 30)}{p.pattern.length > 30 ? '…' : ''}/{p.flags}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(p.id)}
                      title="Delete pattern"
                      className="p-1 text-zinc-600 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {p.ai_generated && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 uppercase">
                        AI
                      </span>
                    )}
                    <button
                      onClick={() => loadPattern(p)}
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

        {/* DLP Pattern Library */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>DLP Pattern Library</SectionLabel>
            <span className="text-[10px] text-zinc-600 mb-3">{filteredPatterns.length} patterns</span>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search patterns..."
              value={libSearch}
              onChange={e => setLibSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1 mb-3">
            {['All', ...DLP_CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setLibCategory(cat)}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                  libCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                )}
              >
                {cat === 'All' ? 'All' : cat.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Pattern list grouped by category */}
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {filteredPatterns.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No patterns match your search</p>
            ) : (
              Object.entries(groupedPatterns).map(([cat, patterns]) => (
                <div key={cat}>
                  {libCategory === 'All' && (
                    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5 px-0.5">
                      {cat}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-1">
                    {patterns.map(p => (
                      <button
                        key={p.name}
                        onClick={() => loadPattern(p)}
                        className="text-left rounded-lg border border-zinc-700 bg-zinc-800/60 p-2 hover:border-blue-500/50 hover:bg-zinc-700/60 transition-all group"
                      >
                        <p className="text-[10px] font-semibold text-white group-hover:text-blue-300 transition-colors leading-tight">
                          {p.name}
                        </p>
                        <p className="text-[9px] text-zinc-500 mt-0.5 leading-tight line-clamp-2">
                          {p.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
