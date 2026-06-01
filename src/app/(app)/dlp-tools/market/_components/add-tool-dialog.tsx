'use client'

import { useState } from 'react'
import { X, Loader2, ShieldCheck, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createCustomTool } from '../actions'
import type { CustomToolData } from '../actions'
import type { ChannelCoverageLevel } from '@/lib/onboarding/data'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewResult {
  isRealDlp:  boolean
  confidence: 'high' | 'medium' | 'low'
  reason:     string
  toolData:   {
    label:            string
    description:      string
    category?:        string[]
    website?:         string
    channelCoverage?: Record<string, string>
    modules?:         { id: string; label: string; description: string }[]
  }
}

interface Props {
  onAdded: () => void
  onClose: () => void
}

const CHANNELS = [
  { key: 'email',       label: 'Email' },
  { key: 'web',         label: 'Web' },
  { key: 'saas-inline', label: 'SaaS Inline' },
  { key: 'saas-api',    label: 'SaaS API' },
  { key: 'endpoint',    label: 'Endpoint' },
  { key: 'genai',       label: 'GenAI' },
  { key: 'network',     label: 'Network' },
] as const

const LEVELS: ChannelCoverageLevel[] = ['full', 'partial', 'addon', 'none']
const LEVEL_LABELS: Record<ChannelCoverageLevel, string> = {
  full: 'Full', partial: 'Partial', addon: 'Add-on', none: 'None',
}

function emptyChannels(): Record<string, ChannelCoverageLevel> {
  return Object.fromEntries(CHANNELS.map(c => [c.key, 'none' as ChannelCoverageLevel]))
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AddToolDialog({ onAdded, onClose }: Props) {
  const [step,       setStep]       = useState<'input' | 'review'>('input')
  const [toolName,   setToolName]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [result,     setResult]     = useState<ReviewResult | null>(null)
  const [saving,     setSaving]     = useState(false)

  // Editable form state (populated from AI or blank)
  const [label,       setLabel]       = useState('')
  const [description, setDescription] = useState('')
  const [categories,  setCategories]  = useState('')
  const [website,     setWebsite]     = useState('')
  const [coverage,    setCoverage]    = useState<Record<string, ChannelCoverageLevel>>(emptyChannels())
  const [modules,     setModules]     = useState<{ id: string; label: string; description: string }[]>([])

  async function handleReview() {
    if (!toolName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dlp-tool-review', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ toolName: toolName.trim() }),
      })
      if (!res.ok) throw new Error('Review failed')
      const data = await res.json() as ReviewResult
      setResult(data)

      // Pre-fill editable fields from AI result
      setLabel(data.toolData.label ?? toolName)
      setDescription(data.toolData.description ?? '')
      setCategories((data.toolData.category ?? []).join(', '))
      setWebsite(data.toolData.website ?? '')
      const cov = emptyChannels()
      if (data.toolData.channelCoverage) {
        for (const [k, v] of Object.entries(data.toolData.channelCoverage)) {
          if (LEVELS.includes(v as ChannelCoverageLevel)) cov[k] = v as ChannelCoverageLevel
        }
      }
      setCoverage(cov)
      setModules(data.toolData.modules ?? [])
      setStep('review')
    } catch {
      setError('Could not review this tool. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!label.trim()) return
    setSaving(true)
    try {
      const toolData: CustomToolData = {
        label:           label.trim(),
        description:     description.trim(),
        category:        categories.split(',').map(s => s.trim()).filter(Boolean),
        website:         website.trim() || undefined,
        channelCoverage: coverage as CustomToolData['channelCoverage'],
        modules,
      }
      const status = result?.isRealDlp ? 'verified' : 'custom'
      await createCustomTool(toolName.trim(), result?.isRealDlp ?? null, status, toolData)
      onAdded()
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function addModule() {
    const id = `custom-mod-${Date.now()}`
    setModules(prev => [...prev, { id, label: '', description: '' }])
  }

  function updateModule(idx: number, patch: Partial<{ label: string; description: string }>) {
    setModules(prev => prev.map((m, i) => i === idx ? { ...m, ...patch } : m))
  }

  function removeModule(idx: number) {
    setModules(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 z-20 w-[480px] flex flex-col bg-card border-l border-border shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="text-sm font-semibold text-foreground">Submit a DLP Tool</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === 'input' ? 'Tell us which tool you use — we\'ll add it to the platform' : 'Confirm or fill in the details below'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/40 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── Step 1: Input ───────────────────────────────────────────── */}
          {step === 'input' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/70">Tool name</label>
                <input
                  autoFocus
                  type="text"
                  value={toolName}
                  onChange={e => setToolName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleReview() }}
                  placeholder="e.g. Nightfall DLP, Securonix, CipherTrust, Trellix…"
                  className="w-full px-3 py-2.5 text-sm rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                />
              </div>

              {error && <p className="text-xs text-rose-400">{error}</p>}

              <button
                onClick={handleReview}
                disabled={!toolName.trim() || loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-500 text-white text-sm font-medium hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Looking up tool…</> : 'Look up & continue'}
              </button>

              <p className="text-[11px] text-muted-foreground/50 text-center">
                We&apos;ll look it up and pre-fill what we know — you can edit before submitting
              </p>
            </div>
          )}

          {/* ── Step 2: Review & edit ───────────────────────────────────── */}
          {step === 'review' && result && (
            <div className="space-y-5">

              {/* Verdict badge */}
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border border-border">
                <ShieldCheck className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-foreground/80">We found some details — please review and fill in anything missing</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">Once submitted, we&apos;ll review and add this tool to the platform.</p>
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-3">
                <Field label="Tool name">
                  <input type="text" value={label} onChange={e => setLabel(e.target.value)}
                    className={inputCls} />
                </Field>
                <Field label="Description">
                  <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                    className={cn(inputCls, 'resize-none')} />
                </Field>
                <Field label="Categories (comma separated)">
                  <input type="text" value={categories} onChange={e => setCategories(e.target.value)}
                    placeholder="e.g. Cloud-native DLP, API-based" className={inputCls} />
                </Field>
                <Field label="Website (optional)">
                  <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                    placeholder="https://vendor.com/" className={inputCls} />
                </Field>
              </div>

              {/* Channel coverage */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">Channel Coverage</p>
                <div className="grid grid-cols-2 gap-2">
                  {CHANNELS.map(ch => (
                    <div key={ch.key} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{ch.label}</span>
                      <select
                        value={coverage[ch.key] ?? 'none'}
                        onChange={e => setCoverage(prev => ({ ...prev, [ch.key]: e.target.value as ChannelCoverageLevel }))}
                        className="px-2 py-1 text-xs rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                      >
                        {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modules */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">Modules / Licences</p>
                  <button onClick={addModule} className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
                    <Plus className="w-3 h-3" /> Add module
                  </button>
                </div>
                {modules.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/40 italic">No modules — click &quot;Add module&quot; to define licences</p>
                )}
                {modules.map((mod, idx) => (
                  <div key={mod.id} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1.5">
                      <input type="text" value={mod.label} onChange={e => updateModule(idx, { label: e.target.value })}
                        placeholder="Module name" className={cn(inputCls, 'text-[11px]')} />
                      <input type="text" value={mod.description} onChange={e => updateModule(idx, { description: e.target.value })}
                        placeholder="Brief description" className={cn(inputCls, 'text-[11px]')} />
                    </div>
                    <button onClick={() => removeModule(idx)} className="mt-1 p-1 rounded text-muted-foreground/50 hover:text-rose-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {error && <p className="text-xs text-rose-400">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'review' && (
          <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
            <button
              onClick={() => { setStep('input'); setResult(null); setError(null) }}
              className="px-3 py-2 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleSave}
              disabled={!label.trim() || saving}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors bg-violet-500 text-white hover:bg-violet-400',
                (!label.trim() || saving) && 'opacity-40 cursor-not-allowed',
              )}
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting…</> : 'Submit Tool'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-violet-500/40'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">{label}</p>
      {children}
    </div>
  )
}
