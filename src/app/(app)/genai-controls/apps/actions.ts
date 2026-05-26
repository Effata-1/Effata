'use server'

import { requireRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { identifyApp, researchApp } from '@/lib/genai/research'
import { computeTrustScore, CLASSIFICATION_LABELS } from '@/lib/genai/scoring'
import type { GenAIApp, GenAIAppProfile } from '@/lib/genai/types'

export interface EvaluatedAppCard {
  app_id:                  string
  app_name:                string
  vendor:                  string
  app_type:                string
  logo_letter:             string
  logo_bg:                 string
  trustScore:              number
  dlpActivitiesSupported:  number
  dlpActivitiesTotal:      number
  suggestedClassification: string
  isNewToDb:               boolean
}

export async function evaluateApp(
  searchTerm: string,
): Promise<{ data?: EvaluatedAppCard; error?: string }> {
  try {
    await requireRole('analyst')

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY not configured — evaluation requires the service role key.' }
    }

    const service = createServiceClient()

    // 1. Search existing catalog by name (case-insensitive)
    const { data: existingApps } = await service
      .from('genai_apps')
      .select('*')
      .ilike('app_name', `%${searchTerm}%`)
      .eq('status', 'active')
      .limit(1)

    let app: GenAIApp
    let isNewToDb = false

    if (existingApps && existingApps.length > 0) {
      app = existingApps[0] as GenAIApp
    } else {
      // 2. Ask Claude to identify the app
      const identified = await identifyApp(searchTerm)
      if (!identified) {
        return { error: `"${searchTerm}" doesn't appear to be a known GenAI application.` }
      }

      // 3. Upsert into genai_apps
      const { data: inserted, error: insertError } = await service
        .from('genai_apps')
        .upsert(
          { ...identified, status: 'active', auto_researched: true, last_updated: new Date().toISOString() },
          { onConflict: 'app_id' },
        )
        .select()
        .single()

      if (insertError || !inserted) {
        return { error: `Failed to save app to catalog: ${insertError?.message ?? 'unknown error'}` }
      }

      app = inserted as GenAIApp
      isNewToDb = true
    }

    // 4. Check for existing profile
    const { data: existingProfile } = await service
      .from('genai_app_profiles')
      .select('*')
      .eq('app_id', app.app_id)
      .maybeSingle()

    let profile: GenAIAppProfile

    if (existingProfile) {
      profile = existingProfile as GenAIAppProfile
    } else {
      // 5. Run AI research via Claude (~15-60s depending on response size)
      const researched = await researchApp({
        app_id:   app.app_id,
        app_name: app.app_name,
        vendor:   app.vendor,
        domain:   app.domain,
        app_type: app.app_type,
      })

      // 6. Upsert single personal profile
      const { error: upsertErr } = await service.from('genai_app_profiles').upsert(
        { app_id: app.app_id, mode: 'personal', fields: researched.fields, dlp: researched.dlp, breach_info: researched.breach_info },
        { onConflict: 'app_id,mode' },
      )

      if (upsertErr) {
        return { error: `Profile saved but DB write failed: ${upsertErr.message}` }
      }

      profile = {
        app_id:      app.app_id,
        fields:      researched.fields,
        dlp:         researched.dlp,
        breach_info: researched.breach_info,
      } as GenAIAppProfile
    }

    // 7. Compute trust score
    const score = computeTrustScore(profile.fields, profile.dlp, profile.breach_info)
    const suggestedLabel = CLASSIFICATION_LABELS[score.suggested_classification]?.label ?? '—'

    return {
      data: {
        app_id:                  app.app_id,
        app_name:                app.app_name,
        vendor:                  app.vendor,
        app_type:                app.app_type,
        logo_letter:             app.logo_letter,
        logo_bg:                 app.logo_bg,
        trustScore:              score.final_score,
        dlpActivitiesSupported:  score.dlp_activities_supported,
        dlpActivitiesTotal:      score.dlp_activities_total,
        suggestedClassification: suggestedLabel,
        isNewToDb,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: `Evaluation failed: ${msg}` }
  }
}
