import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { computeTrustScore, CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import { cn } from '@/lib/utils'
import type { GenAIApp, GenAIAppProfile, CustomerClassification } from '@/lib/genai/types'

function RiskBadge({ score }: { score: number }) {
  if (score >= 85) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">Low Risk</span>
  if (score >= 70) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">Moderate</span>
  if (score >= 50) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Medium Risk</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">High Risk</span>
}

export default async function GenAIAppsPage() {
  const supabase = await createClient()

  // Optional: only available once SUPABASE_SERVICE_ROLE_KEY is configured
  let lastRun: { status: string; apps_updated: number; apps_added: number } | null = null
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const serviceClient = createServiceClient()
      const { data } = await serviceClient
        .from('genai_research_runs')
        .select('status, completed_at, apps_updated, apps_added')
        .order('started_at', { ascending: false })
        .limit(1)
        .single()
      lastRun = data
    }
  } catch {
    // ignore — logs link just won't show a status
  }

  const { data: apps } = await supabase
    .from('genai_apps')
    .select('*')
    .eq('status', 'active')
    .order('app_name')

  const { data: profiles } = await supabase
    .from('genai_app_profiles')
    .select('*')
    .eq('mode', 'enterprise')

  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null

  const { data: classifications } = orgId ? await supabase
    .from('genai_customer_classifications')
    .select('*')
    .eq('org_id', orgId) : { data: [] }

  const profileMap = new Map((profiles as GenAIAppProfile[] ?? []).map(p => [p.app_id, p]))
  const classMap = new Map((classifications as CustomerClassification[] ?? []).map(c => [c.app_id, c]))

  const appsWithScores = (apps as GenAIApp[] ?? []).map(app => {
    const profile = profileMap.get(app.app_id)
    const score = profile ? computeTrustScore(profile.fields, profile.dlp, profile.breach_info) : null
    const classification = classMap.get(app.app_id)
    return { app, score, classification }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">GenAI Apps</h1>
          <p className="text-sm text-muted-foreground/80 mt-1">
            Trust scores and DLP coverage for {apps?.length ?? 0} GenAI applications.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Low Risk</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Moderate</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Medium</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />High</span>
          </div>
          <Link
            href="/data-in-motion/genai/refresh-logs"
            className="flex items-center gap-2 text-xs text-muted-foreground/80 hover:text-foreground/70 transition-colors"
          >
            {lastRun ? (
              <>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  lastRun.status === 'completed' ? 'bg-green-500' :
                  lastRun.status === 'failed'    ? 'bg-red-500'   : 'bg-yellow-500 animate-pulse'
                )} />
                <span>Last refresh: {lastRun.apps_updated} updated · {lastRun.apps_added} added</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span>No refresh runs yet</span>
              </>
            )}
            <span className="text-muted-foreground/40">→ View logs</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {appsWithScores.map(({ app, score, classification }) => {
          const cls = classification?.customer_classification ?? 'unknown'
          const clsMeta = CLASSIFICATION_LABELS[cls]
          const suggested = score?.suggested_classification ?? '—'

          return (
            <Link
              key={app.app_id}
              href={`/data-in-motion/genai/${app.app_id}`}
              className="group block rounded-xl border border-border bg-card/50 p-4 hover:border-border-strong hover:bg-card transition-all shadow-sm"
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-foreground font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: app.logo_bg }}
                >
                  {app.logo_letter}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-blue-300 transition-colors truncate">{app.app_name}</p>
                  <p className="text-xs text-muted-foreground/80 truncate">{app.vendor} · {app.app_type}</p>
                </div>
                {score && <RiskBadge score={score.final_score} />}
              </div>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">Trust Score</p>
                  {score ? (
                    <div className={cn(
                      'text-2xl font-bold tabular-nums',
                      score.final_score >= 85 ? 'text-green-400' :
                      score.final_score >= 70 ? 'text-blue-400' :
                      score.final_score >= 50 ? 'text-yellow-400' : 'text-red-400'
                    )}>
                      {score.final_score}
                      <span className="text-xs font-normal text-muted-foreground/80">/100</span>
                    </div>
                  ) : <span className="text-muted-foreground/60 text-sm">Not scored</span>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">DLP Activities</p>
                  <p className="text-sm font-semibold text-foreground">
                    {score ? `${score.dlp_activities_supported}/${score.dlp_activities_total}` : '—'}
                  </p>
                </div>
              </div>

              {score && (
                <div className="h-1 bg-muted rounded-full mb-3 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full',
                      score.final_score >= 85 ? 'bg-green-500' :
                      score.final_score >= 70 ? 'bg-blue-500' :
                      score.final_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    )}
                    style={{ width: `${score.final_score}%` }}
                  />
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/60">System suggests:</span>
                  <span className="text-[10px] text-muted-foreground font-medium">{suggested}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/60">Your classification:</span>
                  {cls !== 'unknown' ? (
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded',
                      clsMeta.color === 'green' ? 'bg-green-500/15 text-green-400' :
                      clsMeta.color === 'red' ? 'bg-red-500/15 text-red-400' :
                      clsMeta.color === 'amber' ? 'bg-yellow-500/15 text-yellow-400' :
                      clsMeta.color === 'blue' ? 'bg-blue-500/15 text-blue-400' :
                      clsMeta.color === 'purple' ? 'bg-purple-500/15 text-purple-400' :
                      'bg-accent/50 text-muted-foreground'
                    )}>{clsMeta.label}</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60 italic">Not set</span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {(!apps || apps.length === 0) && (
        <div className="text-center py-16 text-muted-foreground/60">
          <p className="text-sm">No apps found. Run the seed SQL in Supabase to populate the catalog.</p>
        </div>
      )}
    </div>
  )
}
