'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { OnboardingData } from './types'

export async function saveOnboardingProgress(
  data: Partial<OnboardingData>,
  step: number
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get org_id from JWT claims
  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null
  if (!orgId) return { error: 'Organisation not found' }

  const payload: Record<string, unknown> = {
    org_id: orgId,
    user_id: user.id,
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null
  if (!orgId) return { error: 'Organisation not found' }

  const { error } = await supabase
    .from('onboarding_profiles')
    .upsert({
      org_id: orgId,
      user_id: user.id,
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
  redirect('/dashboard')
}

export async function getOnboardingProfile(): Promise<{
  data: Record<string, unknown> | null
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('onboarding_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data }
}
