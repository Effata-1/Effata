export interface OnboardingData {
  industry: string
  regions: string[]
  tools: string[]
  modules: Record<string, string[]>
  coverageAreas: Record<string, string>
  policyPresence: string
  policyMode: string
  incidentReview: string
  dataCategories: string[]
  topPriorities: string[]
}

export const EMPTY_ONBOARDING: OnboardingData = {
  industry: '',
  regions: [],
  tools: [],
  modules: {},
  coverageAreas: {},
  policyPresence: '',
  policyMode: '',
  incidentReview: '',
  dataCategories: [],
  topPriorities: [],
}
