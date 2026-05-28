import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Globe, Building2, Calendar, Users, Tag } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { computeTrustScore, CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import { cn } from '@/lib/utils'
import type { GenAIApp, GenAIAppProfile, AppFields, DLPActivities, BreachInfo, CustomerClass, CustomerClassification, ApprovalStatus } from '@/lib/genai/types'
import { ClassificationSelector } from './_components/classification-selector'
import { AppLogo } from '../_components/app-logo'
import type { GovernanceCategory } from './_components/classification-selector'
import { AppDetailTabs } from './_components/app-detail-tabs'
import type { GovRecord } from './_components/app-detail-tabs'

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

  const typedApp            = app as GenAIApp
  const typedClassification = classification as CustomerClassification | null
  const typedProfiles       = (profiles ?? []) as GenAIAppProfile[]
  const profile             = typedProfiles[0] ?? null

  const score  = profile ? computeTrustScore(profile.fields, profile.dlp, profile.breach_info) : null
  const fields = profile?.fields as AppFields | undefined
  const dlp    = profile?.dlp    as DLPActivities | undefined
  const breach = profile?.breach_info as BreachInfo | undefined

  const currentClassification = (typedClassification?.customer_classification ?? 'unknown') as CustomerClass

  const govRecord: GovRecord = {
    business_owner:   typedClassification?.business_owner   ?? null,
    technical_owner:  typedClassification?.technical_owner  ?? null,
    approval_status:  (typedClassification?.approval_status ?? null) as ApprovalStatus | null,
    review_date:      typedClassification?.review_date      ?? null,
    next_review_date: typedClassification?.next_review_date ?? null,
    notes:            typedClassification?.notes            ?? null,
  }

  const scoreColor = (s: number) =>
    s >= 85 ? 'text-green-400' : s >= 70 ? 'text-blue-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link href="/genai-controls/apps" className="inline-flex items-center gap-1 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors">
        <ChevronLeft className="h-3 w-3" /> App Catalog
      </Link>

      {/* App header */}
      <div className="rounded-xl border border-border bg-card/50 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <AppLogo domain={typedApp.domain} letter={typedApp.logo_letter} bg={typedApp.logo_bg} size={48} />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">{typedApp.app_name}</h1>
            <p className="text-sm text-muted-foreground/80">{typedApp.vendor} · {typedApp.domain} · {typedApp.app_type}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={cn(
                'text-[11px] font-bold px-2 py-0.5 rounded border',
                CLASSIFICATION_LABELS[currentClassification].color === 'green'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                CLASSIFICATION_LABELS[currentClassification].color === 'red'    ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                CLASSIFICATION_LABELS[currentClassification].color === 'amber'  ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                CLASSIFICATION_LABELS[currentClassification].color === 'blue'   ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                'bg-muted text-muted-foreground border-border-strong',
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <SubScoreCard label="Data Governance"   score={score.data_governance}     weight="30%" />
          <SubScoreCard label="DLP Activity"      score={score.dlp_activity}        weight="30%" />
          <SubScoreCard label="Security"          score={score.security_compliance} weight="20%" />
          <SubScoreCard label="GenAI Risk"        score={score.genai_risk}          weight="15%" />
          <SubScoreCard label="Breach"            score={score.breach_transparency} weight="5%"  />
        </div>
      )}

      {/* App Info */}
      <div className="rounded-xl border border-border bg-card/50 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-card/80">
          <h2 className="text-sm font-semibold text-foreground">About this App</h2>
        </div>
        <div className="p-5 space-y-4">
          {/* Description */}
          {typedApp.description ? (
            <p className="text-sm text-foreground/80 leading-relaxed">{typedApp.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic">No description available yet.</p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap gap-3">
            <a
              href={`https://${typedApp.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30 border border-border/50 text-xs text-foreground/70 hover:text-foreground transition-colors"
            >
              <Globe className="h-3 w-3 flex-shrink-0" />
              {typedApp.domain}
            </a>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30 border border-border/50 text-xs text-foreground/70">
              <Tag className="h-3 w-3 flex-shrink-0" />
              {typedApp.app_type}
            </span>
            {typedApp.app_group && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30 border border-border/50 text-xs text-foreground/70">
                {typedApp.app_group}
              </span>
            )}
            {typedApp.headquarters && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30 border border-border/50 text-xs text-foreground/70">
                <Building2 className="h-3 w-3 flex-shrink-0" />
                {typedApp.headquarters}
              </span>
            )}
            {typedApp.founded_year && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30 border border-border/50 text-xs text-foreground/70">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                Founded {typedApp.founded_year}
              </span>
            )}
            {typedApp.employee_count && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30 border border-border/50 text-xs text-foreground/70">
                <Users className="h-3 w-3 flex-shrink-0" />
                {typedApp.employee_count} employees
              </span>
            )}
          </div>

          {/* Primary use cases */}
          {typedApp.primary_use_cases && typedApp.primary_use_cases.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wide mb-2">Primary Use Cases</p>
              <div className="flex flex-wrap gap-1.5">
                {typedApp.primary_use_cases.map((uc, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-muted/20 border border-border/40 text-xs text-foreground/70">
                    {uc}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Classification */}
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

      {/* Tabbed detail view */}
      <AppDetailTabs
        fields={fields}
        dlp={dlp}
        breach={breach}
        score={score}
        appId={appId}
        govRecord={govRecord}
      />
    </div>
  )
}
