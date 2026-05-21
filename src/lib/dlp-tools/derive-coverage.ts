import type { DLPTool, ChannelCoverageLevel, DlpToolChannelCoverage } from '@/lib/onboarding/data'

export type DerivedChannelCoverage = Record<
  keyof DlpToolChannelCoverage,
  { level: ChannelCoverageLevel; coveredBy: string[] }
>

const CHANNEL_KEYS: (keyof DlpToolChannelCoverage)[] = [
  'email', 'web', 'saas-inline', 'saas-api', 'endpoint', 'genai', 'network',
]

const LEVEL_RANK: Record<ChannelCoverageLevel, number> = {
  full: 3, partial: 2, addon: 1, none: 0,
}

export function deriveCoverage(
  toolIds: string[],
  allTools: DLPTool[],
): DerivedChannelCoverage {
  const selected = allTools.filter(t => toolIds.includes(t.id) && t.channelCoverage)

  return Object.fromEntries(
    CHANNEL_KEYS.map(key => {
      let bestLevel: ChannelCoverageLevel = 'none'
      const coveredBy: string[] = []

      for (const tool of selected) {
        const level = tool.channelCoverage![key]
        if (LEVEL_RANK[level] > LEVEL_RANK[bestLevel]) bestLevel = level
        if (level !== 'none') coveredBy.push(tool.label)
      }

      return [key, { level: bestLevel, coveredBy }]
    }),
  ) as DerivedChannelCoverage
}
