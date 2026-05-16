import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { researchApp, discoverNewApps } from '@/lib/genai/research'
import type { GenAIApp } from '@/lib/genai/types'

export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const errors: Array<{ app_id: string; error: string }> = []

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
          app_id:         app.app_id,
          app_name:       app.app_name,
          vendor:         app.vendor,
          domain:         app.domain,
          app_type:       app.app_type,
          logo_letter:    app.logo_letter,
          logo_bg:        app.logo_bg,
          status:         'active',
          auto_researched: true,
          last_updated:   new Date().toISOString(),
        })
      if (insertError) {
        errors.push({ app_id: app.app_id, error: `Insert failed: ${insertError.message}` })
      } else {
        existingApps.push({ ...app, status: 'active', last_updated: new Date().toISOString() })
        appsAdded++
      }
    }

    // Research all apps (original + newly added) sequentially
    const allApps = existingApps
    for (const app of allApps) {
      try {
        const profile = await researchApp(app)

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

        // Update last_updated + research_notes on the app row
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
    await supabase
      .from('genai_research_runs')
      .update({
        completed_at:  new Date().toISOString(),
        apps_updated:  appsUpdated,
        apps_added:    appsAdded,
        errors:        errors,
        status:        errors.length > 0 && appsUpdated === 0 ? 'failed' : 'completed',
      })
      .eq('id', runId)

    return Response.json({
      status:       'completed',
      apps_updated: appsUpdated,
      apps_added:   appsAdded,
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
