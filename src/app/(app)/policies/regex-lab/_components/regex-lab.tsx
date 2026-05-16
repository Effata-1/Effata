'use client'

import { useState, useMemo, useTransition, useCallback, useRef } from 'react'
import { Loader2, Trash2, Copy, Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateRegex, savePattern, deletePattern } from '../actions'
import type { AiRegexResult, SavedPattern } from '../actions'

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

// ── Built-in DLP Pattern Library ──────────────────────────────────────────────

interface DlpPattern {
  name: string
  description: string
  pattern: string
  flags: string
  testExample: string
}

const DLP_PATTERNS: DlpPattern[] = [
  {
    name: 'Visa / Mastercard',
    description: 'Credit card numbers',
    pattern: '\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\\b',
    flags: 'g',
    testExample: 'Card: 4532015112830366 or 5425233430109903',
  },
  {
    name: 'US SSN',
    description: 'Social Security Numbers',
    pattern: '\\b(?!000|666|9\\d{2})\\d{3}-(?!00)\\d{2}-(?!0000)\\d{4}\\b',
    flags: 'g',
    testExample: 'SSN: 123-45-6789',
  },
  {
    name: 'Email Address',
    description: 'Standard email addresses',
    pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
    flags: 'gi',
    testExample: 'Contact: user@example.com or admin@company.co.uk',
  },
  {
    name: 'US Phone',
    description: 'US/Canada phone numbers',
    pattern: '\\b(?:\\+1[\\s.-]?)?(?:\\(?[2-9]\\d{2}\\)?[\\s.-]?)[2-9]\\d{2}[\\s.-]?\\d{4}\\b',
    flags: 'g',
    testExample: 'Call: (800) 555-1234 or +1-212-555-6789',
  },
  {
    name: 'IPv4 Address',
    description: 'IPv4 addresses 0.0.0.0–255.255.255.255',
    pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b',
    flags: 'g',
    testExample: 'Servers: 192.168.1.100 and 10.0.0.1',
  },
  {
    name: 'IBAN',
    description: 'International Bank Account Numbers',
    pattern: '\\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}(?:[A-Z0-9]?){0,16}\\b',
    flags: 'gi',
    testExample: 'IBAN: GB29NWBK60161331926819',
  },
  {
    name: 'UK NI Number',
    description: 'UK National Insurance numbers',
    pattern: '\\b[A-CEGHJ-PR-TW-Z]{2}[0-9]{6}[A-D]\\b',
    flags: 'gi',
    testExample: 'NI Number: AB123456C',
  },
  {
    name: 'UK Postcode',
    description: 'UK postal codes',
    pattern: '\\b[A-Z]{1,2}[0-9][0-9A-Z]?\\s?[0-9][ABD-HJLNP-UW-Z]{2}\\b',
    flags: 'gi',
    testExample: 'Address: London SW1A 2AA or EC1A 1BB',
  },
  {
    name: 'AWS Access Key',
    description: 'AWS Access Key IDs (AKIA...)',
    pattern: '\\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\\b',
    flags: 'g',
    testExample: 'Key: AKIAIOSFODNN7EXAMPLE in config.yml',
  },
  {
    name: 'Bearer Token',
    description: 'API keys and bearer tokens',
    pattern: '(?:Bearer\\s+|api[_-]?key[=:\\s]+|token[=:\\s]+)[A-Za-z0-9\\-_=+\\/]{20,}',
    flags: 'gi',
    testExample: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123',
  },
  {
    name: 'Passport Number',
    description: 'Generic alphanumeric passport numbers',
    pattern: '\\b(?:passport[:\\s]*)?([A-Z]{1,2}[0-9]{6,7})\\b',
    flags: 'gi',
    testExample: 'Passport: AB1234567',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHighlightedHtml(text: string, matches: Match[]): string {
  if (matches.length === 0) {
    return `<span style="color:rgb(161,161,170)">${escapeHtml(text)}</span>`
  }
  let html = ''
  let cursor = 0
  for (const m of matches) {
    if (cursor < m.start) {
      html += `<span style="color:rgb(161,161,170)">${escapeHtml(text.slice(cursor, m.start))}</span>`
    }
    html += `<span style="background:rgba(234,179,8,0.25);color:rgb(234,179,8);border-radius:2px;padding:0 2px">${escapeHtml(text.slice(m.start, m.end))}</span>`
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
  const [copied, setCopied] = useState(false)

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

  // ── Highlighted HTML ───────────────────────────────────────────────────────
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
      const { result, error } = await generateRegex(aiPrompt)
      if (error) { setAiError(error); return }
      if (result) {
        setAiResult(result)
        setPattern(result.pattern)
        setFlags(result.flags)
        if (!testData && result.testExamples.length > 0) {
          setTestData(result.testExamples.join('\n'))
        }
      }
    })
  }, [aiPrompt, testData])

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
              <button
                onClick={copyPattern}
                disabled={!pattern}
                title="Copy pattern with flags"
                className="w-7 h-7 rounded flex items-center justify-center bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-30 transition-all"
              >
                {copied
                  ? <Check className="h-3.5 w-3.5 text-green-400" />
                  : <Copy className="h-3.5 w-3.5" />}
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
            <p className="mt-2 text-xs text-red-400 font-mono">
              {regexResult.error}
            </p>
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
              placeholder='Describe what you want to match in plain English... e.g. "UK National Insurance numbers" or "Stripe secret API keys starting with sk_live"'
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

        {/* Test String with overlay highlighting */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Test String</SectionLabel>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase', matchBadgeClass)}>
              {!regexResult.valid
                ? 'Invalid pattern'
                : `${regexResult.matches.length} match${regexResult.matches.length !== 1 ? 'es' : ''}`}
            </span>
          </div>

          {/* Overlay container */}
          <div
            className="relative rounded-lg border border-zinc-700 overflow-hidden"
            style={{ height: '280px' }}
          >
            {/* Background: rendered highlighted HTML */}
            <div
              ref={overlayRef}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              style={{
                ...OVERLAY_STYLE,
                zIndex: 1,
                pointerEvents: 'none',
                background: '#18181b',
              }}
            />
            {/* Foreground: transparent editable textarea */}
            <textarea
              ref={textareaRef}
              value={testData}
              onChange={e => setTestData(e.target.value)}
              onScroll={syncScroll}
              placeholder="Paste or type text to test against your pattern..."
              spellCheck={false}
              className="absolute inset-0 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-lg"
              style={{
                ...OVERLAY_STYLE,
                zIndex: 2,
                background: 'transparent',
                caretColor: 'white',
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
              }}
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
          <SectionLabel>DLP Pattern Library</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {DLP_PATTERNS.map(p => (
              <button
                key={p.name}
                onClick={() => loadPattern(p)}
                className="text-left rounded-lg border border-zinc-700 bg-zinc-800/60 p-2.5 hover:border-blue-500/50 hover:bg-zinc-700/60 transition-all group"
              >
                <p className="text-[11px] font-semibold text-white group-hover:text-blue-300 transition-colors leading-tight">
                  {p.name}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight line-clamp-2">
                  {p.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
