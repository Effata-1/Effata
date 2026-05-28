'use client'

import { cn } from '@/lib/utils'
import { FIELD_LABELS, VALUE_DISPLAY, DLP_ACTIVITY_LABELS } from '@/lib/genai/scoring'
import { GovernanceRecord } from './governance-record'
import { AlertTriangle } from 'lucide-react'
import type { AppFields, DLPActivities, BreachInfo, TrustScores, ApprovalStatus } from '@/lib/genai/types'

// ── Governance record shape (passed from server) ──────────────────────────────

export interface GovRecord {
  business_owner:   string | null
  technical_owner:  string | null
  approval_status:  ApprovalStatus | null
  review_date:      string | null
  next_review_date: string | null
  notes:            string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  return s >= 80 ? 'text-green-400' : s >= 60 ? 'text-blue-400' : s >= 40 ? 'text-yellow-400' : 'text-red-400'
}

function scoreBorderColor(s: number) {
  return s >= 80 ? 'border-t-green-500' : s >= 60 ? 'border-t-blue-500' : s >= 40 ? 'border-t-yellow-500' : 'border-t-red-500'
}

function FieldRow({ label, value, isNegative }: { label: string; value: string; isNegative?: boolean }) {
  const meta = VALUE_DISPLAY[value] ?? { label: value, color: 'muted' }
  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors">
      <td className="py-2.5 pr-6 text-xs text-foreground/70 w-[45%] align-top">
        {label}
      </td>
      <td className="py-2.5 align-top">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
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
            {isNegative && value === 'yes' && (
              <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />
            )}
          </div>
          {meta.note && (
            <span className="text-[11px] text-muted-foreground/50 leading-relaxed">{meta.note}</span>
          )}
        </div>
      </td>
    </tr>
  )
}

function SectionCard({
  id, title, score, scoreWeight, verified, total, children,
}: {
  id: string
  title: string
  score: number | null
  scoreWeight: string
  verified?: number
  total?: number
  children: React.ReactNode
}) {
  return (
    <div id={id} className={cn(
      'rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm border-t-2',
      score !== null ? scoreBorderColor(score) : 'border-t-border',
    )}>
      <div className="px-5 py-3 border-b border-border bg-card/80 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {score !== null && (
          <div className="flex flex-col items-end gap-0.5">
            {verified !== undefined && total !== undefined && (
              <span className="text-[11px] text-muted-foreground/50">
                {verified}/{total} fields publicly verified
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground/50">{scoreWeight} of score</span>
              <span className={cn('text-sm font-bold', scoreColor(score))}>{score}/100</span>
            </div>
          </div>
        )}
      </div>
      <div className="px-5 py-1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left text-[11px] text-muted-foreground/50 uppercase tracking-wide py-2 w-[45%]">Attribute</th>
              <th className="text-left text-[11px] text-muted-foreground/50 uppercase tracking-wide py-2">Value</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
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
  return (
    <div className="space-y-4">
      {/* ── Data Governance & Privacy ──────────────────────────────────────── */}
      <div>
        {fields ? (
          <SectionCard id="data-governance" title="Publicly Verified Data Governance" score={score?.data_governance ?? null} scoreWeight="30%" verified={score?.data_governance_verified} total={score?.data_governance_total}>
            {(['trains_on_customer_data','opt_out_of_training','dpa_available','customer_owns_data','data_retention','data_deletion','data_residency','subprocessor_list','pii_sharing_third_parties','data_sharing_genai_vendor'] as const).map(key => (
              <FieldRow
                key={key}
                label={FIELD_LABELS[key]}
                value={fields[key]}
                isNegative={['trains_on_customer_data','pii_sharing_third_parties','data_sharing_genai_vendor'].includes(key)}
              />
            ))}
          </SectionCard>
        ) : null}
      </div>

      {/* ── DLP Activity Support ───────────────────────────────────────────── */}
      <div>
        {dlp ? (
          <div id="dlp-activity" className={cn(
            'rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm border-t-2',
            score ? scoreBorderColor(score.dlp_activity) : 'border-t-border',
          )}>
            <div className="px-5 py-3 border-b border-border bg-card/80 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">DLP Activity Support</h2>
              {score && (
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[11px] text-muted-foreground/50">
                    {score.dlp_activities_supported}/{score.dlp_activities_total} activities supported
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/50">30% of score</span>
                    <span className={cn('text-sm font-bold', scoreColor(score.dlp_activity))}>{score.dlp_activity}/100</span>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-1">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-[11px] text-muted-foreground/50 uppercase tracking-wide py-2 w-[45%]">Activity</th>
                    <th className="text-left text-[11px] text-muted-foreground/50 uppercase tracking-wide py-2">DLP Support</th>
                    <th className="text-right text-[11px] text-muted-foreground/50 uppercase tracking-wide py-2">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { key: 'post_prompt',    weight: '30%' },
                    { key: 'upload',         weight: '30%' },
                    { key: 'login_instance', weight: '15%' },
                    { key: 'edit',           weight: '10%' },
                    { key: 'response',       weight: '5%'  },
                    { key: 'download',       weight: '5%'  },
                    { key: 'attach',         weight: '5%'  },
                  ] as const).map(({ key, weight }) => {
                    const val  = dlp[key]
                    const meta = VALUE_DISPLAY[val] ?? { label: val, color: 'muted' }
                    const dot  = meta.color === 'green' ? 'bg-green-500' : meta.color === 'amber' ? 'bg-yellow-500' : meta.color === 'red' ? 'bg-red-500' : 'bg-muted'
                    return (
                      <tr key={key} className="border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 text-xs text-foreground/70">{DLP_ACTIVITY_LABELS[key]}</td>
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
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Security & Compliance ──────────────────────────────────────────── */}
      <div>
        {fields ? (
          <SectionCard id="security" title="Publicly Verified Security & Compliance" score={score?.security_compliance ?? null} scoreWeight="20%" verified={score?.security_compliance_verified} total={score?.security_compliance_total}>
            {(['soc2','iso27001','iso27018','fedramp','pci_dss','hipaa_baa','encryption_at_rest','encryption_in_transit','tenant_segregation'] as const).map(key => (
              <FieldRow key={key} label={FIELD_LABELS[key]} value={fields[key]} />
            ))}
          </SectionCard>
        ) : null}
      </div>

      {/* ── GenAI-Specific Risk ────────────────────────────────────────────── */}
      <div>
        {fields ? (
          <SectionCard id="genai-risk" title="Publicly Verified GenAI Risk" score={score?.genai_risk ?? null} scoreWeight="15%" verified={score?.genai_risk_verified} total={score?.genai_risk_total}>
            {(['trains_on_customer_data','opt_out_of_training','prompt_retention_controls','model_provider_clear','connectors_agents_risk'] as const).map(key => (
              <FieldRow
                key={key}
                label={FIELD_LABELS[key]}
                value={fields[key]}
                isNegative={['trains_on_customer_data','connectors_agents_risk'].includes(key)}
              />
            ))}
          </SectionCard>
        ) : null}
      </div>

      {/* ── Breach & Transparency ─────────────────────────────────────────── */}
      <div>
        {breach ? (
          <SectionCard id="breach" title="Breach History & Transparency" score={score?.breach_transparency ?? null} scoreWeight="5%" verified={score?.breach_transparency_verified} total={score?.breach_transparency_total}>
            <FieldRow label="Recent breach (past 12 months)"  value={breach.recent_breach}    isNegative />
            <FieldRow label="Older breach history"            value={breach.older_breach}     isNegative />
            <FieldRow label="Breach impact clearly disclosed" value={breach.breach_disclosed} />
            <FieldRow label="Public disclosure available"     value={breach.source_disclosure} />
            <FieldRow label="Remediation / closure evidence"  value={breach.breach_remediated} />
            {breach.breach_name && (
              <tr>
                <td colSpan={2} className="py-3">
                  <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3">
                    <p className="text-xs font-semibold text-red-400 mb-1">Breach Record</p>
                    <p className="text-xs text-foreground">{breach.breach_name}</p>
                    {breach.breach_date && <p className="text-xs text-muted-foreground/70 mt-0.5">{breach.breach_date}</p>}
                    {breach.breach_description && <p className="text-xs text-muted-foreground mt-1">{breach.breach_description}</p>}
                  </div>
                </td>
              </tr>
            )}
          </SectionCard>
        ) : null}
      </div>

      {/* ── Notes / Governance Record ─────────────────────────────────────── */}
      <div>
        <GovernanceRecord appId={appId} initial={govRecord} initiallyOpen />
      </div>
    </div>
  )
}
