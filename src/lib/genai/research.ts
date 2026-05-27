import 'server-only'
import { callAgent } from '@/lib/api-client'
import type { AppFields, DLPActivities, BreachInfo } from './types'

export interface ResearchedProfile {
  fields:      AppFields
  dlp:         DLPActivities
  breach_info: BreachInfo
  notes:       string
}

export async function researchApp(app: {
  app_id:   string
  app_name: string
  vendor:   string
  domain:   string
  app_type: string
}): Promise<ResearchedProfile> {
  return callAgent<ResearchedProfile>('genai-research', { app })
}

export interface IdentifiedApp {
  app_id:      string
  app_name:    string
  vendor:      string
  domain:      string
  app_type:    string
  logo_letter: string
  logo_bg:     string
}

export async function identifyApp(searchTerm: string): Promise<IdentifiedApp | null> {
  try {
    return await callAgent<IdentifiedApp | null>('genai-identify', { searchTerm })
  } catch {
    return null
  }
}

export interface DiscoveredApp {
  app_id:      string
  app_name:    string
  vendor:      string
  domain:      string
  app_type:    string
  logo_letter: string
  logo_bg:     string
}

export async function discoverNewApps(existingAppIds: string[]): Promise<DiscoveredApp[]> {
  try {
    return await callAgent<DiscoveredApp[]>('genai-discover', { existingAppIds })
  } catch {
    return []
  }
}
