'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ExternalLink, Shield, FileText, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveRefAppData } from '../actions'
import { PROHIBITED_GROUPS, RISK_TAG_META, type ProhibitedApp, type ProhibitedGroup } from '../_data/prohibited-apps'
import type { RefAppData } from './governance-client'

// ── Classification options ────────────────────────────────────────────────────

const CLS_OPTIONS = [
  { value: 'prohibited',                 label: 'Prohibited'             },
  { value: 'permitted-with-restriction', label: 'Restricted / Unassessed'},
  { value: 'approved-with-conditions',   label: 'Approved w/ Conditions' },
  { value: 'enterprise-approved',        label: 'Approved & Supported'   },
] as const

type CatValue = typeof CLS_OPTIONS[number]['value']

const CLS_STYLE: Record<CatValue, string> = {
  'prohibited':                 'border-red-500/40    text-red-400    bg-red-500/5',
  'permitted-with-restriction': 'border-amber-500/40  text-amber-400  bg-amber-500/5',
  'approved-with-conditions':   'border-blue-500/40   text-blue-400   bg-blue-500/5',
  'enterprise-approved':        'border-emerald-500/40 text-emerald-400 bg-emerald-500/5',
}

// ── Control badge styles ──────────────────────────────────────────────────────

const CONTROL_CLS: Record<string, string> = {
  'Block':                            'bg-red-500/15 text-red-400 border-red-500/25',
  'Block (personal tier)':            'bg-red-500/15 text-red-400 border-red-500/25',
  'Block unless enterprise-approved': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Block unless approved':            'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Block + Alert SOC':                'bg-red-500/20 text-red-300 border-red-500/30',
  'Block + Alert':                    'bg-red-500/20 text-red-300 border-red-500/30',
}

// ── Individual app row ────────────────────────────────────────────────────────

function AppRow({
  app, data, onSaved,
}: {
  app:     ProhibitedApp
  data:    RefAppData
  onSaved: (slug: string, data: RefAppData) => void
}) {
  const [open, setOpen]           = useState(false)
  const [localData, setLocalData] = useState<RefAppData>(data)
  const [isPending, startTransition] = useTransition()
  const [savedAt, setSavedAt]     = useState<number | null>(null)

  const isNotesDirty = localData.notes !== data.notes
  // eslint-disable-next-line react-hooks/purity
  const justSaved    = savedAt !== null && Date.now() - savedAt < 2500

  // The effective classification: user override → system suggestion ('prohibited')
  const effectiveCls: CatValue = (localData.classification as CatValue) ?? 'prohibited'
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _isSystemDefault       = localData.classification === null

  function persist(patch: Partial<RefAppData>) {
    const next = { ...localData, ...patch }
    setLocalData(next)
    startTransition(async () => {
      const result = await saveRefAppData(app.slug, next)
      if (!result.error) {
        onSaved(app.slug, next)
        setSavedAt(Date.now())
      }
    })
  }

  function handleClassification(v: string) {
    persist({ classification: v === 'prohibited' ? null : v })
  }

  function handleInScope() {
    persist({ in_scope: !localData.in_scope })
  }

  function saveNotes() {
    persist({ notes: localData.notes })
  }

  return (
    <div className="border-t border-border/30 last:border-b-0">
      {/* Collapsed row */}
      <div className="flex items-center gap-3 px-5 py-3 hover:bg-card/30 transition-colors group">
        {/* Expand toggle + identity */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
            app.risk_level === 'critical'
              ? 'bg-red-500/15 text-red-400 border border-red-500/25'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
          )}>
            {app.name[0]}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground/90">{app.name}</span>
              <a
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[11px] text-blue-400/60 hover:text-blue-400 transition-colors flex items-center gap-0.5"
              >
                {app.url.replace('https://', '')}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground/40 truncate mt-0.5 max-w-xl hidden sm:block">
              {app.description.split('.')[0]}.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded border hidden md:inline-flex',
              app.risk_level === 'critical'
                ? 'bg-red-500/15 text-red-400 border-red-500/25'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            )}>
              {app.risk_level === 'critical' ? 'CRITICAL' : 'HIGH'}
            </span>
            {localData.notes && <FileText className="w-3 h-3 text-muted-foreground/30" />}
            <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/30 transition-transform', !open && '-rotate-90')} />
          </div>
        </button>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/40" />
          ) : localData.in_scope ? (
            <>
              {/* Classification select — only visible once in scope */}
              <div className={cn(
                'relative rounded-lg border px-2.5 py-1.5 w-[178px]',
                CLS_STYLE[effectiveCls],
              )}>
                <select
                  value={effectiveCls}
                  onChange={e => handleClassification(e.target.value)}
                  className="w-full appearance-none bg-transparent text-xs font-semibold focus:outline-none cursor-pointer pr-5"
                  style={{ color: 'inherit' }}
                >
                  {CLS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} className="bg-card text-foreground font-normal">
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
              </div>

              <button
                type="button"
                onClick={handleInScope}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
              >
                In scope ✓
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleInScope}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap border-border text-muted-foreground/50 hover:border-border-strong hover:text-foreground/70"
            >
              Add to scope
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-5 pb-5 pt-2 bg-card/20 space-y-4 border-t border-border/20">
          <p className="text-xs text-foreground/70 leading-relaxed">{app.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wide">Website</span>
              <a href={app.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                {app.url}<ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wide">Risk Level</span>
              <span className={cn(
                'inline-flex text-[10px] font-bold px-2 py-1 rounded border',
                app.risk_level === 'critical'
                  ? 'bg-red-500/15 text-red-400 border-red-500/25'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
              )}>
                {app.risk_level === 'critical' ? 'Critical' : 'High'}
              </span>
            </div>
          </div>

          {/* DLP Treatment */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Shield className="w-3 h-3 text-red-400 shrink-0" />
              <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wide">DLP Treatment</span>
            </div>
            <div className="rounded-lg border border-red-500/15 bg-red-500/5 px-3.5 py-2.5">
              <p className="text-xs text-foreground/80 leading-relaxed">{app.dlp_treatment}</p>
            </div>
          </div>

          {/* Risk tags */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wide">Risk Factors</span>
            <div className="flex flex-wrap gap-1.5">
              {app.risk_tags.map(tag => {
                const m = RISK_TAG_META[tag]
                return (
                  <span key={tag} className={cn('text-[10px] font-semibold px-2 py-1 rounded border', m.cls)}>
                    {m.label}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wide">Your Organisation&apos;s Notes</span>
            <textarea
              value={localData.notes}
              onChange={e => setLocalData(d => ({ ...d, notes: e.target.value }))}
              placeholder="Add exceptions, escalation contacts, approved substitutes, or review dates…"
              rows={2}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 border border-border/50 rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-border transition-colors resize-none"
            />
            <div className="flex items-center gap-2">
              {isNotesDirty && (
                <button
                  type="button"
                  onClick={saveNotes}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
                >
                  {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save Notes
                </button>
              )}
              {justSaved && !isNotesDirty && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Group section (Layer 2) ───────────────────────────────────────────────────

function GroupSection({
  group, appData, onSaved,
}: {
  group:   ProhibitedGroup
  appData: Record<string, RefAppData>
  onSaved: (slug: string, data: RefAppData) => void
}) {
  const [open, setOpen] = useState(false)
  const ctrlCls = CONTROL_CLS[group.dlp_control] ?? 'bg-muted/60 text-muted-foreground border-border'
  const inScopeCount = group.apps.filter(a => appData[a.slug]?.in_scope).length

  return (
    <div className="border-t border-border/30 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/40 shrink-0 transition-transform', !open && '-rotate-90')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground/80">{group.name}</span>
            <span className="text-[10px] text-muted-foreground/40">
              {group.apps.length} {group.apps.length === 1 ? 'app' : 'apps'}
            </span>
            {inScopeCount > 0 && (
              <span className="text-[10px] font-semibold text-emerald-400">{inScopeCount} in scope</span>
            )}
          </div>
          {!open && (
            <p className="text-[11px] text-muted-foreground/40 truncate mt-0.5 hidden sm:block">
              {group.description.split('.')[0]}.
            </p>
          )}
        </div>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border shrink-0', ctrlCls)}>
          {group.dlp_control}
        </span>
      </button>

      {open && (
        <>
          <div className="px-5 py-2.5 bg-muted/10 border-t border-border/20">
            <p className="text-xs text-muted-foreground/60 leading-relaxed">{group.description}</p>
          </div>
          {/* Column headers */}
          <div className="flex items-center px-5 py-2 border-t border-border/20 bg-card/10">
            <span className="flex-1 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">App</span>
            <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest pr-1">Classification</span>
          </div>
          {group.apps.map(app => (
            <AppRow
              key={app.slug}
              app={app}
              data={appData[app.slug] ?? { notes: '', in_scope: false, classification: null }}
              onSaved={onSaved}
            />
          ))}
        </>
      )}
    </div>
  )
}

// ── Main ProhibitedCatalog (Layer 1 content for prohibited category) ──────────

export function ProhibitedCatalog({
  initialNotes,
}: {
  initialNotes: Record<string, RefAppData>
}) {
  const [appData, setAppData] = useState<Record<string, RefAppData>>(initialNotes)

  function handleSaved(slug: string, data: RefAppData) {
    setAppData(prev => ({ ...prev, [slug]: data }))
  }

  const totalApps    = PROHIBITED_GROUPS.reduce((s, g) => s + g.apps.length, 0)
  const inScopeTotal = Object.values(appData).filter(d => d.in_scope).length

  return (
    <div className="border-t border-border/40">
      {/* Catalog header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-red-500/5 border-b border-border/30">
        <Shield className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <div className="flex-1">
          <span className="text-xs font-semibold text-foreground/80">Blocked Application Reference Catalog</span>
          <span className="text-[10px] text-muted-foreground/40 ml-2">
            {PROHIBITED_GROUPS.length} risk groups · {totalApps} applications
          </span>
        </div>
        {inScopeTotal > 0 && (
          <span className="text-[10px] font-semibold text-emerald-400">{inScopeTotal} tracked in scope</span>
        )}
        <span className="text-[10px] text-muted-foreground/40 hidden sm:block">
          Classification defaults to system-suggested · override per app
        </span>
      </div>

      {PROHIBITED_GROUPS.map(group => (
        <GroupSection
          key={group.slug}
          group={group}
          appData={appData}
          onSaved={handleSaved}
        />
      ))}
    </div>
  )
}
