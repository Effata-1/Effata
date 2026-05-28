'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { FIELD_LABELS, VALUE_DISPLAY } from '@/lib/genai/scoring'
import { GovernanceRecord } from './governance-record'
import type { AppFields, DLPActivities, BreachInfo, TrustScores, ApprovalStatus } from '@/lib/genai/types'

type Dir = 'pos' | 'neg'

// ── Section definitions ───────────────────────────────────────────────────────

const ATTRIBUTE_SECTIONS = [
  {
    id:          'data-governance',
    label:       'Data Governance & Privacy',
    scoreKey:    'data_governance'    as keyof TrustScores,
    scoreWeight: '30%',
    fields:      ['dpa_available','customer_owns_data','trains_on_customer_data','opt_out_of_training','data_retention','data_deletion','data_residency','subprocessor_list','pii_sharing_third_parties','data_sharing_genai_vendor'],
    dirs: {
      dpa_available:'pos', customer_owns_data:'pos', trains_on_customer_data:'neg',
      opt_out_of_training:'pos', data_retention:'pos', data_deletion:'pos',
      data_residency:'pos', subprocessor_list:'pos',
      pii_sharing_third_parties:'neg', data_sharing_genai_vendor:'neg',
    } as Record<string, Dir>,
  },
  {
    id:          'security',
    label:       'Security & Compliance',
    scoreKey:    'security_compliance' as keyof TrustScores,
    scoreWeight: '20%',
    fields:      ['soc2','iso27001','iso27018','fedramp','pci_dss','hipaa_baa','encryption_at_rest','encryption_in_transit','tenant_segregation'],
    dirs: {
      soc2:'pos', iso27001:'pos', iso27018:'pos', fedramp:'pos', pci_dss:'pos',
      hipaa_baa:'pos', encryption_at_rest:'pos', encryption_in_transit:'pos', tenant_segregation:'pos',
    } as Record<string, Dir>,
  },
  {
    id:          'genai-risk',
    label:       'GenAI Risk',
    scoreKey:    'genai_risk' as keyof TrustScores,
    scoreWeight: '15%',
    fields:      ['model_provider_clear','prompt_retention_controls','connectors_agents_risk'],
    dirs: {
      model_provider_clear:'pos', prompt_retention_controls:'pos', connectors_agents_risk:'neg',
    } as Record<string, Dir>,
  },
]

const DLP_ROWS = [
  { key: 'post_prompt',    label: 'Post / Prompt inspection',       weight: '30%' },
  { key: 'upload',         label: 'Upload inspection',               weight: '30%' },
  { key: 'login_instance', label: 'Tenant / Instance Identification', weight: '15%' },
  { key: 'edit',           label: 'Edit inspection',                 weight: '10%' },
  { key: 'response',       label: 'Response inspection',             weight: '5%'  },
  { key: 'download',       label: 'Download inspection',             weight: '5%'  },
  { key: 'attach',         label: 'Attachment inspection',           weight: '5%'  },
]

const BREACH_ROWS: { key: keyof BreachInfo; label: string; dir: Dir }[] = [
  { key: 'recent_breach',    label: 'Recent breach (past 12 months)',  dir: 'neg' },
  { key: 'older_breach',     label: 'Older breach history',            dir: 'neg' },
  { key: 'breach_disclosed', label: 'Breach impact clearly disclosed', dir: 'pos' },
  { key: 'source_disclosure',label: 'Public disclosure available',     dir: 'pos' },
  { key: 'breach_remediated',label: 'Remediation / closure evidence',  dir: 'pos' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRisky(value: string, dir: Dir): boolean {
  return dir === 'pos' ? value === 'no' : value === 'yes'
}
function isWarning(value: string, dir: Dir): boolean {
  if (dir === 'pos') return ['no-published', 'partial', 'tier-dependent'].includes(value)
  return ['partial', 'no-published'].includes(value)
}

function scoreColor(s: number) {
  return s >= 80 ? 'text-green-400' : s >= 60 ? 'text-blue-400' : s >= 40 ? 'text-yellow-400' : 'text-red-400'
}

function ValueBadge({ value, dir }: { value: string; dir?: Dir }) {
  const meta = VALUE_DISPLAY[value] ?? { label: value, color: 'muted' }
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn(
        'text-xs font-semibold',
        meta.color === 'green' ? 'text-green-400' :
        meta.color === 'red'   ? 'text-red-400'   :
        meta.color === 'amber' ? 'text-yellow-400' :
        meta.color === 'blue'  ? 'text-blue-400'  :
        'text-muted-foreground/80 italic',
      )}>
        {meta.label}
      </span>
      {meta.note && (
        <span className="text-[11px] text-muted-foreground/50 leading-relaxed">{meta.note}</span>
      )}
    </div>
  )
}

function AttributeRow({ label, value, dir }: { label: string; value: string; dir: Dir }) {
  const risky   = isRisky(value, dir)
  const warning = isWarning(value, dir)
  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors">
      <td className="py-2.5 pr-6 text-xs text-foreground/70 w-[45%] align-top">
        <div className="flex items-start gap-1.5 pt-0.5">
          {(risky || warning) && (
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-0.5', risky ? 'bg-red-400' : 'bg-yellow-400')} />
          )}
          {!risky && !warning && <span className="w-1.5 h-1.5 shrink-0" />}
          {label}
        </div>
      </td>
      <td className="py-2.5 align-top">
        <ValueBadge value={value} dir={dir} />
      </td>
    </tr>
  )
}

// ── Governance record shape (passed from server) ──────────────────────────────

export interface GovRecord {
  business_owner:   string | null
  technical_owner:  string | null
  approval_status:  ApprovalStatus | null
  review_date:      string | null
  next_review_date: string | null
  notes:            string | null
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  fields:    AppFields   | undefined
  dlp:       DLPActivities | undefined
  breach:    BreachInfo  | undefined
  score:     TrustScores | null
  appId:     string
  govRecord: GovRecord
}

export function AppDetailTabs({ fields, dlp, breach, score, appId, govRecord }: Props) {
  const [tab,           setTab]           = useState<'attributes' | 'usage-risk' | 'notes'>('attributes')
  const [activeSection, setActiveSection] = useState(ATTRIBUTE_SECTIONS[0].id)
  const [riskyOnly,     setRiskyOnly]     = useState(false)

  const currentSection = ATTRIBUTE_SECTIONS.find(s => s.id === activeSection) ?? ATTRIBUTE_SECTIONS[0]

  // ── Tab bar ─────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
      <div className="flex items-center border-b border-border px-4">
        {([
          { id: 'attributes', label: 'Attributes' },
          { id: 'usage-risk', label: 'Usage & Risk' },
          { id: 'notes',      label: 'Notes' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-3 text-xs font-semibold uppercase tracking-wide transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-muted-foreground/60 hover:text-foreground/70',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ATTRIBUTES ──────────────────────────────────────────────────────── */}
      {tab === 'attributes' && (
        <>
          {/* Toolbar */}
          <div className="flex items-center px-4 py-2 border-b border-border/50 bg-card/30">
            <button
              type="button"
              onClick={() => setRiskyOnly(v => !v)}
              className="flex items-center gap-2 select-none"
            >
              <div className={cn(
                'w-8 h-4 rounded-full transition-colors relative shrink-0',
                riskyOnly ? 'bg-amber-500' : 'bg-muted',
              )}>
                <div className={cn(
                  'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform',
                  riskyOnly ? 'translate-x-4' : 'translate-x-0.5',
                )} />
              </div>
              <span className="text-xs text-muted-foreground/60">Show risky attributes only</span>
            </button>
          </div>

          {fields ? (
            <div className="flex min-h-[320px]">
              {/* Left nav */}
              <div className="w-52 border-r border-border shrink-0 py-1">
                {ATTRIBUTE_SECTIONS.map(section => {
                  const s = score ? (score[section.scoreKey] as number) : null
                  const active = activeSection === section.id
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        'w-full text-left px-4 py-2.5 text-xs transition-colors',
                        active
                          ? 'bg-blue-500/10 text-foreground font-semibold'
                          : 'text-muted-foreground/70 hover:text-foreground/70 hover:bg-muted/30',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{section.label}</span>
                        {s !== null && (
                          <span className={cn('text-[11px] font-bold shrink-0', scoreColor(s))}>{s}</span>
                        )}
                      </div>
                      {active && s !== null && (
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{section.scoreWeight} of trust score</p>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Attribute table */}
              <div className="flex-1 px-6 py-4 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left text-[11px] text-muted-foreground/50 uppercase tracking-wide pb-2 w-[45%]">Attribute</th>
                      <th className="text-left text-[11px] text-muted-foreground/50 uppercase tracking-wide pb-2">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentSection.fields
                      .filter(key => {
                        if (!riskyOnly) return true
                        const val = fields[key as keyof AppFields] as string
                        const dir = currentSection.dirs[key]
                        return isRisky(val, dir) || isWarning(val, dir)
                      })
                      .map(key => (
                        <AttributeRow
                          key={key}
                          label={FIELD_LABELS[key] ?? key}
                          value={fields[key as keyof AppFields] as string}
                          dir={currentSection.dirs[key]}
                        />
                      ))}
                    {riskyOnly && currentSection.fields.every(key => {
                      const val = fields[key as keyof AppFields] as string
                      const dir = currentSection.dirs[key]
                      return !isRisky(val, dir) && !isWarning(val, dir)
                    }) && (
                      <tr>
                        <td colSpan={2} className="py-6 text-center text-xs text-muted-foreground/50">
                          No risky attributes in this section.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground/50">
              No attribute data available for this app yet.
            </div>
          )}
        </>
      )}

      {/* ── USAGE & RISK ────────────────────────────────────────────────────── */}
      {tab === 'usage-risk' && (
        <div className="divide-y divide-border/60">
          {/* DLP Activity Support */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">DLP Activity Support</h3>
              {score && (
                <span className={cn('text-sm font-bold', scoreColor(score.dlp_activity))}>
                  {score.dlp_activity}/100
                  <span className="text-xs font-normal text-muted-foreground/60 ml-1.5">· 30% of score</span>
                </span>
              )}
            </div>
            {dlp ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left text-[11px] text-muted-foreground/50 uppercase tracking-wide pb-2">Activity</th>
                    <th className="text-left text-[11px] text-muted-foreground/50 uppercase tracking-wide pb-2">DLP Support</th>
                    <th className="text-right text-[11px] text-muted-foreground/50 uppercase tracking-wide pb-2">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {DLP_ROWS.map(({ key, label, weight }) => {
                    const val  = dlp[key as keyof DLPActivities]
                    const meta = VALUE_DISPLAY[val] ?? { label: val, color: 'muted' }
                    const dot  = meta.color === 'green' ? 'bg-green-500' : meta.color === 'amber' ? 'bg-yellow-500' : meta.color === 'red' ? 'bg-red-500' : 'bg-muted'
                    return (
                      <tr key={key} className="border-b border-border/40 last:border-0">
                        <td className="py-2.5 text-xs text-foreground/70">{label}</td>
                        <td className="py-2.5">
                          <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold',
                            meta.color === 'green' ? 'text-green-400' :
                            meta.color === 'amber' ? 'text-yellow-400' :
                            meta.color === 'red'   ? 'text-red-400' : 'text-muted-foreground/80 italic',
                          )}>
                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground/60 text-right">{weight}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-muted-foreground/50 py-4">No DLP activity data available.</p>
            )}
          </div>

          {/* Breach & Transparency */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Breach & Transparency</h3>
              {score && (
                <span className={cn('text-sm font-bold', scoreColor(score.breach_transparency))}>
                  {score.breach_transparency}/100
                  <span className="text-xs font-normal text-muted-foreground/60 ml-1.5">· 5% of score</span>
                </span>
              )}
            </div>
            {breach ? (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left text-[11px] text-muted-foreground/50 uppercase tracking-wide pb-2 w-[45%]">Factor</th>
                      <th className="text-left text-[11px] text-muted-foreground/50 uppercase tracking-wide pb-2">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BREACH_ROWS.map(({ key, label, dir }) => (
                      <AttributeRow key={key} label={label} value={breach[key] as string} dir={dir} />
                    ))}
                  </tbody>
                </table>
                {breach.breach_name && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <p className="text-xs font-semibold text-red-400 mb-1">Breach Record</p>
                    <p className="text-xs text-foreground">{breach.breach_name}</p>
                    {breach.breach_date && <p className="text-xs text-muted-foreground/70 mt-0.5">{breach.breach_date}</p>}
                    {breach.breach_description && <p className="text-xs text-muted-foreground mt-1">{breach.breach_description}</p>}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground/50 py-4">No breach data available.</p>
            )}
          </div>
        </div>
      )}

      {/* ── NOTES ───────────────────────────────────────────────────────────── */}
      {tab === 'notes' && (
        <div className="px-6 py-5">
          <GovernanceRecord appId={appId} initial={govRecord} initiallyOpen />
        </div>
      )}
    </div>
  )
}
