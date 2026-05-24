import type { ChannelCoverageLevel } from '@/lib/onboarding/data'
import type { RiskLevel } from '@/lib/channel-taxonomy'

export type DistrictData = {
  slug:       string
  channelKey: string
  name:       string
  shortName:  string
  level:      ChannelCoverageLevel | 'unknown'
  coveredBy:  string[]
  activities: string[]
  risks:      { area: string; level: RiskLevel }[]
  channelHref: string
}
