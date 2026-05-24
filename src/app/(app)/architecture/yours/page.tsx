import { requireRole } from '@/lib/auth'
import { getOnboardingProfile } from '@/app/onboarding/actions'
import { DLP_TOOLS } from '@/lib/onboarding/data'
import { CHANNELS } from '@/lib/channel-taxonomy'
import { deriveCoverage } from '@/lib/dlp-tools/derive-coverage'
import type { DistrictData } from './_components/types'
import { CityMap } from './_components/city-map'

// Maps derive-coverage channel keys → channel-taxonomy slugs
const KEY_TO_SLUG: Record<string, string> = {
  'email':       'email-dlp',
  'web':         'web-dlp',
  'saas-inline': 'saas-inline',
  'saas-api':    'saas-api-data-at-rest',
  'endpoint':    'endpoint-device',
  'genai':       'genai-ai',
  'network':     'network-protocol-egress',
}

const CHANNEL_KEYS = ['email', 'genai', 'saas-inline', 'web', 'saas-api', 'endpoint', 'network'] as const

export default async function YourArchitecturePage() {
  await requireRole('analyst')

  const { data: profile } = await getOnboardingProfile()

  const orgTools:   string[]                  = (profile?.tools   as string[])                  ?? []
  const orgModules: Record<string, string[]>  = (profile?.modules as Record<string, string[]>)  ?? {}

  const derived  = deriveCoverage(orgTools, DLP_TOOLS, orgModules)
  const hasTools = orgTools.length > 0

  const districts: DistrictData[] = CHANNEL_KEYS.map(key => {
    const slug    = KEY_TO_SLUG[key]
    const channel = CHANNELS.find(c => c.slug === slug)
    const cov     = derived[key as keyof typeof derived]

    return {
      slug:        slug,
      channelKey:  key,
      name:        channel?.name      ?? key,
      shortName:   channel?.shortName ?? key,
      level:       hasTools ? cov.level : 'unknown',
      coveredBy:   hasTools ? cov.coveredBy : [],
      activities:  (channel?.activities ?? []).slice(0, 5).map(a => a.name),
      risks:       (channel?.risks      ?? []).slice(0, 5).map(r => ({ area: r.area, level: r.level })),
      channelHref: `/channels/${slug}`,
    }
  })

  return (
    <div className="-m-8 p-6 min-h-screen bg-background">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground">Your Architecture</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visual map of your DLP coverage across all channels, derived from your tool stack.
        </p>
      </div>
      <CityMap districts={districts} />
    </div>
  )
}
