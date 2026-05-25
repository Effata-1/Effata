import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { researchApp, discoverNewApps } from '@/lib/genai/research'
import type { GenAIApp } from '@/lib/genai/types'

export const maxDuration = 300

interface FieldChange {
  app_id: string
  app_name: string
  field: string
  old_value: string
  new_value: string
}

function diffProfiles(
  appId: string,
  appName: string,
  oldFields: Record<string, string>,
  newFields: Record<string, string>,
  prefix = ''
): FieldChange[] {
  const changes: FieldChange[] = []
  for (const [key, newVal] of Object.entries(newFields)) {
    const oldVal = oldFields[key]
    if (oldVal && oldVal !== newVal) {
      changes.push({ app_id: appId, app_name: appName, field: prefix + key, old_value: oldVal, new_value: newVal })
    }
  }
  return changes
}

// Budget: stop processing apps when this many seconds remain before Vercel kills us
const BUDGET_RESERVE_SECONDS = 45
const STARTED_AT = Date.now()

function secondsElapsed() {
  return (Date.now() - STARTED_AT) / 1000
}

function budgetExceeded() {
  return secondsElapsed() > maxDuration - BUDGET_RESERVE_SECONDS
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const errors: Array<{ app_id: string; error: string }> = []
  const allChanges: FieldChange[] = []

  // Mark any run stuck at 'running' for > 10 minutes as timed_out
  await supabase
    .from('genai_research_runs')
    .update({ status: 'timed_out', completed_at: new Date().toISOString() })
    .eq('status', 'running')
    .lt('started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

  // Log run start
  const { data: run, error: runError } = await supabase
    .from('genai_research_runs')
    .insert({ status: 'running' })
    .select('id')
    .single()

  if (runError || !run) {
    return Response.json({ error: 'Failed to create run log' }, { status: 500 })
  }
  const runId: string = run.id

  let appsUpdated = 0
  let appsAdded = 0
  let appsSkipped = 0

  try {
    // Fetch all active apps
    const { data: apps } = await supabase
      .from('genai_apps')
      .select('*')
      .eq('status', 'active')

    const existingApps = (apps as GenAIApp[] ?? [])
    const existingIds = existingApps.map(a => a.app_id)

    // Discover new apps
    const newApps = await discoverNewApps(existingIds)

    // Insert new apps
    for (const app of newApps) {
      const { error: insertError } = await supabase
        .from('genai_apps')
        .insert({
          app_id:          app.app_id,
          app_name:        app.app_name,
          vendor:          app.vendor,
          domain:          app.domain,
          app_type:        app.app_type,
          logo_letter:     app.logo_letter,
          logo_bg:         app.logo_bg,
          status:          'active',
          auto_researched: true,
          last_updated:    new Date().toISOString(),
        })
      if (insertError) {
        errors.push({ app_id: app.app_id, error: `Insert failed: ${insertError.message}` })
      } else {
        existingApps.push({ ...app, status: 'active', last_updated: new Date().toISOString() })
        appsAdded++
      }
    }

    // Research all apps sequentially — stop if time budget is exhausted
    for (const app of existingApps) {
      if (budgetExceeded()) {
        appsSkipped = existingApps.length - appsUpdated - errors.length
        errors.push({ app_id: 'system', error: `Time budget reached after ${Math.round(secondsElapsed())}s — ${appsSkipped} apps deferred to next run` })
        break
      }
      try {
        // Fetch existing enterprise profile for diffing
        const { data: existingEnterprise } = await supabase
          .from('genai_app_profiles')
          .select('fields, dlp')
          .eq('app_id', app.app_id)
          .eq('mode', 'enterprise')
          .single()

        const profile = await researchApp(app)

        // Detect field changes vs previous research
        if (existingEnterprise) {
          const fieldChanges = diffProfiles(
            app.app_id, app.app_name,
            existingEnterprise.fields as Record<string, string>,
            profile.enterprise.fields as unknown as Record<string, string>
          )
          const dlpChanges = diffProfiles(
            app.app_id, app.app_name,
            existingEnterprise.dlp as Record<string, string>,
            profile.enterprise.dlp as unknown as Record<string, string>,
            'dlp.'
          )
          allChanges.push(...fieldChanges, ...dlpChanges)
        }

        // Upsert enterprise profile
        const { error: eErr } = await supabase
          .from('genai_app_profiles')
          .upsert({
            app_id:      app.app_id,
            mode:        'enterprise',
            fields:      profile.enterprise.fields,
            dlp:         profile.enterprise.dlp,
            breach_info: profile.enterprise.breach_info,
          }, { onConflict: 'app_id,mode' })

        if (eErr) {
          errors.push({ app_id: app.app_id, error: `Enterprise upsert: ${eErr.message}` })
          continue
        }

        // Upsert personal profile
        const { error: pErr } = await supabase
          .from('genai_app_profiles')
          .upsert({
            app_id:      app.app_id,
            mode:        'personal',
            fields:      profile.personal.fields,
            dlp:         profile.personal.dlp,
            breach_info: profile.personal.breach_info,
          }, { onConflict: 'app_id,mode' })

        if (pErr) {
          errors.push({ app_id: app.app_id, error: `Personal upsert: ${pErr.message}` })
          continue
        }

        // Update app metadata
        await supabase
          .from('genai_apps')
          .update({
            last_updated:    new Date().toISOString(),
            auto_researched: true,
            research_notes:  profile.notes,
          })
          .eq('app_id', app.app_id)

        appsUpdated++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push({ app_id: app.app_id, error: msg })
      }
    }

    // Finalise run log
    const finalStatus = appsSkipped > 0
      ? 'partial'
      : errors.length > 0 && appsUpdated === 0
        ? 'failed'
        : 'completed'

    await supabase
      .from('genai_research_runs')
      .update({
        completed_at: new Date().toISOString(),
        apps_updated: appsUpdated,
        apps_added:   appsAdded,
        errors:       errors,
        changes:      allChanges,
        status:       finalStatus,
      })
      .eq('id', runId)

    return Response.json({
      status:       finalStatus,
      apps_updated: appsUpdated,
      apps_added:   appsAdded,
      apps_skipped: appsSkipped,
      changes:      allChanges.length,
      errors:       errors,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase
      .from('genai_research_runs')
      .update({ completed_at: new Date().toISOString(), status: 'failed', errors: [{ error: msg }] })
      .eq('id', runId)

    return Response.json({ error: msg }, { status: 500 })
  }
}
