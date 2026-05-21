import type { DLPTool, ChannelCoverageLevel, DlpToolChannelCoverage } from '@/lib/onboarding/data'
import { MODULE_TO_AREAS } from '@/lib/onboarding/data'

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

// Maps coverage-area IDs from MODULE_TO_AREAS to DLP channel keys
const AREA_TO_CHANNEL: Record<string, keyof DlpToolChannelCoverage> = {
  'email-dlp':        'email',
  'web-dlp':          'web',
  'saas-casb-inline': 'saas-inline',
  'saas-api-rest':    'saas-api',
  'endpoint-dlp':     'endpoint',
  'genai-ai-dlp':     'genai',
  'network-dlp':      'network',
}

// Returns the channels this tool contributes to, based only on its selected modules.
// Falls back to the tool's full channelCoverage when no modules are selected.
function effectiveCoverage(
  tool: DLPTool,
  selectedModuleIds: string[],
): Partial<DlpToolChannelCoverage> {
  if (!tool.channelCoverage) return {}
  if (selectedModuleIds.length === 0) return tool.channelCoverage

  const result: Partial<DlpToolChannelCoverage> = {}

  for (const moduleId of selectedModuleIds) {
    const areas = MODULE_TO_AREAS[moduleId] ?? []
    for (const area of areas) {
      const channel = AREA_TO_CHANNEL[area]
      if (!channel) continue
      const level = tool.channelCoverage[channel]
      if (!result[channel] || LEVEL_RANK[level] > LEVEL_RANK[result[channel]!]) {
        result[channel] = level
      }
    }
  }

  return result
}

export function deriveCoverage(
  toolIds: string[],
  allTools: DLPTool[],
  selectedModules: Record<string, string[]> = {},
): DerivedChannelCoverage {
  const selected = allTools.filter(t => toolIds.includes(t.id) && t.channelCoverage)

  return Object.fromEntries(
    CHANNEL_KEYS.map(key => {
      let bestLevel: ChannelCoverageLevel = 'none'

      for (const tool of selected) {
        const coverage = effectiveCoverage(tool, selectedModules[tool.id] ?? [])
        const level = coverage[key] ?? 'none'
        if (LEVEL_RANK[level] > LEVEL_RANK[bestLevel]) bestLevel = level
      }

      const coveredBy: string[] = []
      for (const tool of selected) {
        const coverage = effectiveCoverage(tool, selectedModules[tool.id] ?? [])
        const level = coverage[key] ?? 'none'
        if (level === bestLevel && bestLevel !== 'none') coveredBy.push(tool.label)
      }

      return [key, { level: bestLevel, coveredBy }]
    }),
  ) as DerivedChannelCoverage
}
