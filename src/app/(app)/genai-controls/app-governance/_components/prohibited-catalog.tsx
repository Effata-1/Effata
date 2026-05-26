'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ExternalLink, Shield, FileText, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveRefAppNote } from '../actions'
import { PROHIBITED_GROUPS, RISK_TAG_META, type ProhibitedApp, type ProhibitedGroup } from '../_data/prohibited-apps'

// ── Control badge styles ──────────────────────────────────────────────────────

const CONTROL_CLS: Record<string, string> = {
  'Block':                        'bg-red-500/15 text-red-400 border-red-500/25',
  'Block (personal tier)':        'bg-red-500/15 text-red-400 border-red-500/25',
  'Block unless enterprise-approved': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Block unless approved':        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Block + Alert SOC':            'bg-red-500/20 text-red-300 border-red-500/30',
  'Block + Alert':                'bg-red-500/20 text-red-300 border-red-500/30',
}

// ── Individual app row ────────────────────────────────────────────────────────

function AppRow({
  app, notes, onNoteSaved,
}: {
  app:         ProhibitedApp
  notes:       string
  onNoteSaved: (slug: string, notes: string) => void
}) {
  const [open, setOpen]           = useState(false)
  const [localNotes, setNotes]    = useState(notes)
  const [isPending, startTransition] = useTransition()
  const [savedAt, setSavedAt]     = useState<number | null>(null)

  const isDirty = localNotes !== notes
  const justSaved = savedAt !== null && Date.now() - savedAt < 2500

  function save() {
    startTransition(async () => {
      const result = await saveRefAppNote(app.slug, localNotes)
      if (!result.error) {
        onNoteSaved(app.slug, localNotes)
        setSavedAt(Date.now())
      }
    })
  }

  return (
    <div className="border-t border-border/30 last:border-b-0">
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-card/40 transition-colors group"
      >
        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
          app.risk_level === 'critical'
            ? 'bg-red-500/15 text-red-400 border border-red-500/25'
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        )}>
          {app.name[0]}
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground/90">{app.name}</span>
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[11px] text-blue-400/70 hover:text-blue-400 transition-colors flex items-center gap-0.5"
            >
              {app.url.replace('https://', '')}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5 max-w-xl hidden sm:block">
            {app.description.split('.')[0]}.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {app.risk_tags.slice(0, 2).map(tag => {
            const m = RISK_TAG_META[tag]
            return (
              <span key={tag} className={cn('hidden lg:inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded border', m.cls)}>
                {m.label}
              </span>
            )
          })}
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded border',
            app.risk_level === 'critical'
              ? 'bg-red-500/15 text-red-400 border-red-500/25'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          )}>
            {app.risk_level === 'critical' ? 'CRITICAL' : 'HIGH'}
          </span>
          {localNotes && <FileText className="w-3 h-3 text-muted-foreground/30" />}
          <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/30 transition-transform', !open && '-rotate-90')} />
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-5 pb-5 pt-2 bg-card/20 space-y-4 border-t border-border/20">
          {/* Description */}
          <p className="text-xs text-foreground/70 leading-relaxed">{app.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* URL */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wide">Website</span>
              <div>
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                >
                  {app.url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Risk level */}
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
            <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wide">Your Organisation's Notes</span>
            <textarea
              value={localNotes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add exceptions, escalation contacts, approved substitutes, or review dates…"
              rows={2}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 border border-border/50 rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-border transition-colors resize-none"
            />
            <div className="flex items-center gap-2">
              {isDirty && (
                <button
                  type="button"
                  onClick={save}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
                >
                  {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save Notes
                </button>
              )}
              {justSaved && !isDirty && (
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
  group, notes, onNoteSaved,
}: {
  group:       ProhibitedGroup
  notes:       Record<string, string>
  onNoteSaved: (slug: string, notes: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ctrlCls = CONTROL_CLS[group.dlp_control] ?? 'bg-muted/60 text-muted-foreground border-border'

  return (
    <div className="border-t border-border/30 last:border-b-0">
      {/* Group header */}
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
          {/* Group description */}
          <div className="px-5 py-2.5 bg-muted/10 border-t border-border/20">
            <p className="text-xs text-muted-foreground/60 leading-relaxed">{group.description}</p>
          </div>

          {/* App rows */}
          {group.apps.map(app => (
            <AppRow
              key={app.slug}
              app={app}
              notes={notes[app.slug] ?? ''}
              onNoteSaved={onNoteSaved}
            />
          ))}
        </>
      )}
    </div>
  )
}

// ── Main ProhibitedCatalog component (Layer 1 content for prohibited category) ─

export function ProhibitedCatalog({
  initialNotes,
}: {
  initialNotes: Record<string, string>
}) {
  const [notes, setNotes] = useState<Record<string, string>>(initialNotes)

  function handleNoteSaved(slug: string, text: string) {
    setNotes(prev => ({ ...prev, [slug]: text }))
  }

  const totalApps   = PROHIBITED_GROUPS.reduce((s, g) => s + g.apps.length, 0)
  const totalGroups = PROHIBITED_GROUPS.length

  return (
    <div className="border-t border-border/40">
      {/* Catalog header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-red-500/5 border-b border-border/30">
        <Shield className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <div className="flex-1">
          <span className="text-xs font-semibold text-foreground/80">Blocked Application Reference Catalog</span>
          <span className="text-[10px] text-muted-foreground/40 ml-2">
            {totalGroups} risk groups · {totalApps} applications
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/40 hidden sm:block">
          Click any group to expand. Add notes per app.
        </span>
      </div>

      {/* Groups */}
      {PROHIBITED_GROUPS.map(group => (
        <GroupSection
          key={group.slug}
          group={group}
          notes={notes}
          onNoteSaved={handleNoteSaved}
        />
      ))}
    </div>
  )
}
