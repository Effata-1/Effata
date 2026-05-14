import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOnboardingProfile } from './actions'
import { OnboardingWizard } from './_components/wizard'
import type { OnboardingData } from './types'
import { EMPTY_ONBOARDING } from './types'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await getOnboardingProfile()

  // Already completed → go to dashboard
  if (profile?.completed) redirect('/dashboard')

  // Map DB columns back to OnboardingData shape
  const initialData: OnboardingData = profile ? {
    industry:       (profile.industry as string) ?? '',
    regions:        (profile.regions as string[]) ?? [],
    tools:          (profile.tools as string[]) ?? [],
    modules:        (profile.modules as Record<string, string[]>) ?? {},
    coverageAreas:  (profile.coverage_areas as Record<string, string>) ?? {},
    policyPresence: (profile.policy_presence as string) ?? '',
    policyMode:     (profile.policy_mode as string) ?? '',
    incidentReview: (profile.incident_review as string) ?? '',
    dataCategories: (profile.data_categories as string[]) ?? [],
    topPriorities:  (profile.top_priorities as string[]) ?? [],
  } : EMPTY_ONBOARDING

  const initialStep = profile?.current_step
    ? Math.min(Number(profile.current_step), 5)
    : 1

  return <OnboardingWizard initialData={initialData} initialStep={initialStep} />
}
