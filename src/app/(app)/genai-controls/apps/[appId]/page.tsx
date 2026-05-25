import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { computeTrustScore, FIELD_LABELS, VALUE_DISPLAY, CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import { cn } from '@/lib/utils'
import type { GenAIApp, GenAIAppProfile, AppFields, DLPActivities, BreachInfo, CustomerClass, CustomerClassification } from '@/lib/genai/types'
import { ClassificationSelector } from './_components/classification-selector'
import type { GovernanceCategory } from './_components/classification-selector'
import { GovernanceRecord } from './_components/governance-record'

// ── Value display helpers ──────────────────────────────────────
function FieldBadge({ value }: { value: string }) {
  const meta = VALUE_DISPLAY[value] ?? { label: value, color: 'muted' }
  return (
    <span className={cn(
      'text-xs font-semibold',
      meta.color === 'green'  ? 'text-green-400' :
      meta.color === 'red'    ? 'text-red-400' :
      meta.color === 'amber'  ? 'text-yellow-400' :
      meta.color === 'blue'   ? 'text-blue-400' :
      meta.color === 'muted'  ? 'text-muted-foreground/80 italic' :
      'text-muted-foreground'
    )}>
      {meta.label}
    </span>
  )
}

function FieldRow({ label, value, isNegative }: { label: string; value: string; isNegative?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0 gap-4">
      <span className="text-xs text-muted-foreground/80 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <FieldBadge value={value} />
        {isNegative && (value === 'yes') && (
          <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />
        )}
      </div>
    </div>
  )
}

function SubScoreCard({ label, score, weight }: { label: string; score: number; weight: string }) {
  const color =
    score >= 80 ? 'text-green-400' :
    score >= 60 ? 'text-blue-400' :
    score >= 40 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="rounded-lg border border-border bg-card/50 px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">{label}</p>
      <p className="text-xs text-muted-foreground/60 mt-0.5">{weight} of total</p>
      <p className={cn('text-xl font-bold mt-1', color)}>{score}<span className="text-xs font-normal text-muted-foreground/60">/100</span></p>
    </div>
  )
}

function DLPActivityRow({ label, value, weight }: { label: string; value: string; weight: string }) {
  const meta = VALUE_DISPLAY[value] ?? { label: value, color: 'muted' }
  const dot =
    meta.color === 'green' ? 'bg-green-500' :
    meta.color === 'amber' ? 'bg-yellow-500' :
    meta.color === 'red' ? 'bg-red-500' : 'bg-accent'
  return (
    <tr className="border-b border-border/60">
      <td className="py-2.5 text-xs text-foreground/70">{label}</td>
      <td className="py-2.5">
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold',
          meta.color === 'green' ? 'text-green-400' :
          meta.color === 'amber' ? 'text-yellow-400' :
          meta.color === 'red' ? 'text-red-400' : 'text-muted-foreground/80 italic'
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
          {meta.label}
        </span>
      </td>
      <td className="py-2.5 text-xs text-muted-foreground/60 text-right">{weight}</td>
    </tr>
  )
}

export default async function GenAIAppProfilePage({
  params,
}: {
  params: Promise<{ appId: string }>
}) {
  const { appId } = await params
  const supabase = await createClient()

  const [{ data: app }, { data: profiles }, sessionResult] = await Promise.all([
    supabase.from('genai_apps').select('*').eq('app_id', appId).single(),
    supabase.from('genai_app_profiles').select('*').eq('app_id', appId),
    supabase.auth.getSession(),
  ])

  if (!app) notFound()

  const orgId = sessionResult.data.session?.access_token
    ? JSON.parse(atob(sessionResult.data.session.access_token.split('.')[1]))?.org_id
    : null

  const [{ data: classification }, { data: categoryRows }] = await Promise.all([
    orgId
      ? supabase.from('genai_customer_classifications').select('*').eq('org_id', orgId).eq('app_id', appId).maybeSingle()
      : Promise.resolve({ data: null }),
    orgId
      ? supabase.from('org_genai_governance_categories').select('id, system_tag, name, color').eq('org_id', orgId).eq('active', true).order('priority')
      : Promise.resolve({ data: [] }),
  ])

  const categories = (categoryRows ?? []) as GovernanceCategory[]

  const typedApp = app as GenAIApp
  const typedClassification = classification as CustomerClassification | null
  const typedProfiles = (profiles ?? []) as GenAIAppProfile[]
  const enterpriseProfile = typedProfiles.find(p => p.mode === 'enterprise')
  const personalProfile = typedProfiles.find(p => p.mode === 'personal')
  const primaryProfile = enterpriseProfile ?? personalProfile

  const score = primaryProfile
    ? computeTrustScore(primaryProfile.fields, primaryProfile.dlp, primaryProfile.breach_info)
    : null
  const personalScore = personalProfile && enterpriseProfile
    ? computeTrustScore(personalProfile.fields, personalProfile.dlp, personalProfile.breach_info)
    : null

  const fields = primaryProfile?.fields as AppFields | undefined
  const dlp = primaryProfile?.dlp as DLPActivities | undefined
  const breach = primaryProfile?.breach_info as BreachInfo | undefined
  const currentClassification = (typedClassification?.customer_classification ?? 'unknown') as CustomerClass

  const scoreColor = (s: number) =>
    s >= 85 ? 'text-green-400' : s >= 70 ? 'text-blue-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400'

  const COMPARE_FIELDS: { key: keyof AppFields; label: string }[] = [
    { key: 'sso_saml', label: 'SSO / SAML' },
    { key: 'admin_console', label: 'Admin console' },
    { key: 'user_audit_logs', label: 'User audit logs' },
    { key: 'data_access_audit_logs', label: 'Data access audit logs' },
    { key: 'tenant_isolation', label: 'Tenant isolation / private instance' },
    { key: 'trains_on_customer_data', label: 'Customer data used for training' },
    { key: 'data_retention', label: 'Data retention controls' },
    { key: 'dpa_available', label: 'DPA available' },
    { key: 'data_residency', label: 'Data residency' },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link href="/genai-controls/apps" className="inline-flex items-center gap-1 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors">
        <ChevronLeft className="h-3 w-3" /> App Catalog
      </Link>

      {/* App header */}
      <div className="rounded-xl border border-border bg-card/50 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-foreground font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: typedApp.logo_bg }}
          >
            {typedApp.logo_letter}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">{typedApp.app_name}</h1>
            <p className="text-sm text-muted-foreground/80">{typedApp.vendor} · {typedApp.domain} · {typedApp.app_type}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {score && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-muted text-foreground/70 border border-border-strong">
                  System: {score.suggested_classification}
                </span>
              )}
              <span className={cn(
                'text-[11px] font-bold px-2 py-0.5 rounded border',
                CLASSIFICATION_LABELS[currentClassification].color === 'green' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                CLASSIFICATION_LABELS[currentClassification].color === 'red' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                CLASSIFICATION_LABELS[currentClassification].color === 'amber' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                CLASSIFICATION_LABELS[currentClassification].color === 'blue' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                'bg-muted text-muted-foreground border-border-strong'
              )}>
                Your classification: {CLASSIFICATION_LABELS[currentClassification].label}
              </span>
              {score?.applied_cap && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                  Cap: {score.applied_cap}
                </span>
              )}
            </div>
          </div>
          {score && (
            <div className="text-right flex-shrink-0">
              <p className={cn('text-4xl font-bold', scoreColor(score.final_score))}>{score.final_score}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Trust Score / 100</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Updated {typedApp.last_updated ?? 'N/A'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sub-scores */}
      {score && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SubScoreCard label="Data Governance" score={score.data_governance} weight="25%" />
          <SubScoreCard label="DLP Activity Support" score={score.dlp_activity} weight="25%" />
          <SubScoreCard label="Enterprise Access" score={score.enterprise_access} weight="20%" />
          <SubScoreCard label="Security & Compliance" score={score.security_compliance} weight="15%" />
          <SubScoreCard label="GenAI-Specific Risk" score={score.genai_risk} weight="10%" />
          <SubScoreCard label="Breach & Transparency" score={score.breach_transparency} weight="5%" />
        </div>
      )}

      {/* Customer classification */}
      <div className="rounded-xl border border-border bg-card/50 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-1">Your Classification</h2>
        <p className="text-xs text-muted-foreground/80 mb-4">
          This overrides the system suggestion in your organisation&apos;s DLP policy matrix. The system score does not change.
        </p>
        <ClassificationSelector
          appId={appId}
          orgId={orgId}
          currentClassification={currentClassification}
          categories={categories}
        />
      </div>

      {/* Governance Record */}
      <GovernanceRecord
        appId={appId}
        initial={{
          business_owner:   typedClassification?.business_owner  ?? null,
          technical_owner:  typedClassification?.technical_owner ?? null,
          approval_status:  typedClassification?.approval_status ?? null,
          review_date:      typedClassification?.review_date     ?? null,
          next_review_date: typedClassification?.next_review_date ?? null,
          notes:            typedClassification?.notes            ?? null,
        }}
      />

      {/* Enterprise vs Personal comparison */}
      {enterpriseProfile && personalProfile && (
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-card">
            <h2 className="text-sm font-semibold text-foreground">Enterprise vs Personal Mode</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] text-muted-foreground/80 uppercase tracking-wide px-5 py-3 w-48">Capability</th>
                  <th className="text-left text-[11px] text-muted-foreground/80 uppercase tracking-wide px-4 py-3">
                    Enterprise / Team
                    {score && <span className={cn('ml-2 font-bold', scoreColor(score.final_score))}>{score.final_score}</span>}
                  </th>
                  <th className="text-left text-[11px] text-muted-foreground/80 uppercase tracking-wide px-4 py-3">
                    Personal / Free
                    {personalScore && <span className={cn('ml-2 font-bold', scoreColor(personalScore.final_score))}>{personalScore.final_score}</span>}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_FIELDS.map(({ key, label }) => (
                  <tr key={key} className="border-b border-border/60">
                    <td className="px-5 py-2.5 text-xs text-muted-foreground">{label}</td>
                    <td className="px-4 py-2.5"><FieldBadge value={enterpriseProfile.fields[key] as string} /></td>
                    <td className="px-4 py-2.5"><FieldBadge value={personalProfile.fields[key] as string} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Governance & Privacy */}
      {fields && (
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Data Governance & Privacy</h2>
            {score && <span className={cn('text-sm font-bold', scoreColor(score.data_governance))}>{score.data_governance}/100</span>}
          </div>
          <div className="px-5">
            {(['dpa_available','customer_owns_data','trains_on_customer_data','opt_out_of_training','data_retention','data_deletion','data_residency','subprocessor_list','pii_sharing_third_parties','data_sharing_genai_vendor'] as const).map(key => (
              <FieldRow key={key} label={FIELD_LABELS[key]} value={fields[key] as string}
                isNegative={['trains_on_customer_data','pii_sharing_third_parties','data_sharing_genai_vendor'].includes(key)} />
            ))}
          </div>
        </div>
      )}

      {/* DLP Activity Support */}
      {dlp && (
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">DLP Activity Support</h2>
            {score && <span className={cn('text-sm font-bold', scoreColor(score.dlp_activity))}>{score.dlp_activity}/100</span>}
          </div>
          <div className="px-5">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-[11px] text-muted-foreground/60 uppercase tracking-wide py-2.5">Activity</th>
                  <th className="text-left text-[11px] text-muted-foreground/60 uppercase tracking-wide py-2.5">DLP Support</th>
                  <th className="text-right text-[11px] text-muted-foreground/60 uppercase tracking-wide py-2.5">Weight</th>
                </tr>
              </thead>
              <tbody>
                <DLPActivityRow label="Post / Prompt inspection" value={dlp.post_prompt} weight="30%" />
                <DLPActivityRow label="Upload inspection" value={dlp.upload} weight="30%" />
                <DLPActivityRow label="Login / Instance Detection" value={dlp.login_instance} weight="15%" />
                <DLPActivityRow label="Edit inspection" value={dlp.edit} weight="10%" />
                <DLPActivityRow label="Response inspection" value={dlp.response} weight="5%" />
                <DLPActivityRow label="Download inspection" value={dlp.download} weight="5%" />
                <DLPActivityRow label="Attach inspection" value={dlp.attach} weight="5%" />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enterprise Capability & Access */}
      {fields && (
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Enterprise Capability & Access Control</h2>
            {score && <span className={cn('text-sm font-bold', scoreColor(score.enterprise_access))}>{score.enterprise_access}/100</span>}
          </div>
          <div className="px-5">
            {(['enterprise_tier','sso_saml','mfa_support','role_based_auth','authorization_policies','admin_console','user_audit_logs','data_access_audit_logs','tenant_isolation'] as const).map(key => (
              <FieldRow key={key} label={FIELD_LABELS[key]} value={fields[key] as string} />
            ))}
          </div>
        </div>
      )}

      {/* Security & Compliance */}
      {fields && (
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Security & Compliance Assurance</h2>
            {score && <span className={cn('text-sm font-bold', scoreColor(score.security_compliance))}>{score.security_compliance}/100</span>}
          </div>
          <div className="px-5">
            {(['soc2','iso27001','iso27018','fedramp','pci_dss','hipaa_baa','encryption_at_rest','encryption_in_transit','tenant_segregation'] as const).map(key => (
              <FieldRow key={key} label={FIELD_LABELS[key]} value={fields[key] as string} />
            ))}
          </div>
        </div>
      )}

      {/* GenAI-Specific Risk */}
      {fields && (
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">GenAI-Specific Risk</h2>
            {score && <span className={cn('text-sm font-bold', scoreColor(score.genai_risk))}>{score.genai_risk}/100</span>}
          </div>
          <div className="px-5">
            {(['model_provider_clear','trains_on_customer_data','opt_out_of_training','prompt_retention_controls','private_instance','connectors_agents_risk'] as const).map(key => (
              <FieldRow key={key} label={FIELD_LABELS[key]} value={fields[key] as string}
                isNegative={['trains_on_customer_data','connectors_agents_risk'].includes(key)} />
            ))}
          </div>
        </div>
      )}

      {/* Breach & Transparency */}
      {breach && (
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-card flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Breach & Transparency</h2>
            {score && <span className={cn('text-sm font-bold', scoreColor(score.breach_transparency))}>{score.breach_transparency}/100</span>}
          </div>
          <div className="px-5">
            <FieldRow label="Recent breach (past 12 months)" value={breach.recent_breach as string} isNegative />
            <FieldRow label="Older breach history" value={breach.older_breach as string} isNegative />
            <FieldRow label="Breach impact clearly disclosed" value={breach.breach_disclosed as string} />
            <FieldRow label="Public disclosure available" value={breach.source_disclosure as string} />
            <FieldRow label="Remediation / closure evidence" value={breach.breach_remediated as string} />
            {breach.breach_name && (
              <div className="py-3 border-b border-border/60 last:border-0">
                <p className="text-xs text-muted-foreground/80 mb-1">Breach record</p>
                <p className="text-xs text-foreground font-medium">{breach.breach_name}</p>
                {breach.breach_date && <p className="text-xs text-muted-foreground/80 mt-0.5">{breach.breach_date}</p>}
                {breach.breach_description && <p className="text-xs text-muted-foreground mt-1">{breach.breach_description}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
