'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import type { OnboardingData } from './types'

export async function saveOnboardingProgress(
  data: Partial<OnboardingData>,
  step: number
): Promise<{ error?: string }> {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return { error: 'Not authenticated' }
  const { id: userId, orgId, email } = sessionUser
  if (!orgId) return { error: 'Organisation not found' }

  const supabase = await createClient()

  const payload: Record<string, unknown> = {
    org_id: orgId,
    user_id: userId,
    current_step: step,
    updated_at: new Date().toISOString(),
  }

  if (data.industry !== undefined) payload.industry = data.industry
  if (data.regions !== undefined) payload.regions = data.regions
  if (data.tools !== undefined) payload.tools = data.tools
  if (data.modules !== undefined) payload.modules = data.modules
  if (data.coverageAreas !== undefined) payload.coverage_areas = data.coverageAreas
  if (data.policyPresence !== undefined) payload.policy_presence = data.policyPresence
  if (data.policyMode !== undefined) payload.policy_mode = data.policyMode
  if (data.incidentReview !== undefined) payload.incident_review = data.incidentReview
  if (data.dataCategories !== undefined) payload.data_categories = data.dataCategories
  if (data.topPriorities !== undefined) payload.top_priorities = data.topPriorities

  const { error } = await supabase
    .from('onboarding_profiles')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) return { error: error.message }
  return {}
}

export async function completeOnboarding(data: OnboardingData): Promise<{ error?: string }> {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return { error: 'Not authenticated' }
  const { id: userId, orgId, email } = sessionUser
  if (!orgId) return { error: 'Organisation not found' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('onboarding_profiles')
    .upsert({
      org_id: orgId,
      user_id: userId,
      industry: data.industry,
      regions: data.regions,
      tools: data.tools,
      modules: data.modules,
      coverage_areas: data.coverageAreas,
      policy_presence: data.policyPresence,
      policy_mode: data.policyMode,
      incident_review: data.incidentReview,
      data_categories: data.dataCategories,
      top_priorities: data.topPriorities,
      current_step: 5,
      completed: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return { error: error.message }

  await logAuditEvent({
    action: 'onboarding.completed',
    entity_type: 'onboarding',
    details: { industry: data.industry, tools: data.tools },
    user_id: userId,
    user_email: email || undefined,
    org_id: orgId,
  })

  redirect('/dashboard')
}

export async function getOnboardingProfile(): Promise<{
  data: Record<string, unknown> | null
  error?: string
}> {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return { data: null, error: 'Not authenticated' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('onboarding_profiles')
    .select('*')
    .eq('user_id', sessionUser.id)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data }
}
