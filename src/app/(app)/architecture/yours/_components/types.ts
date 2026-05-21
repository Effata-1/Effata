import type { ChannelCoverageLevel } from '@/lib/onboarding/data'
import type { RiskLevel } from '@/lib/channel-taxonomy'

export type DistrictData = {
  slug:        string
  channelKey:  string
  name:        string
  shortName:   string
  level:       ChannelCoverageLevel | 'unknown'
  coveredBy:   string[]
  activities:  string[]
  risks:       { area: string; level: RiskLevel }[]
  channelHref: string
}

export type SimSource   = 'managed-endpoint' | 'byod' | 'server' | 'saas-user' | 'mail-infra' | 'developer'
export type SimDataType = 'confidential-file' | 'source-code' | 'pii' | 'credentials' | 'bulk-data' | 'email-message'
export type SimChannel  = 'email' | 'web' | 'saas-inline' | 'saas-api' | 'endpoint' | 'genai' | 'network'
export type SimDest     = 'personal-email' | 'saas-app' | 'public-web' | 'usb' | 'genai-app' | 'cloud-storage' | 'external-host'
export type SimUserType = 'standard' | 'privileged' | 'leaver' | 'contractor'
export type SimAction   = 'block' | 'coach' | 'allow' | 'gap'

export type SimulationParams = {
  source:   SimSource
  dataType: SimDataType
  channel:  SimChannel
  dest:     SimDest
  userType: SimUserType
}

export type SimResult = {
  action:    SimAction
  reason:    string
  channelKey: string
}
