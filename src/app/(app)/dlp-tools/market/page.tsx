import { requireRole } from '@/lib/auth'
import { getOnboardingProfile } from '@/app/onboarding/actions'
import { DLP_TOOLS } from '@/lib/onboarding/data'
import { MarketExplorer } from './_components/market-explorer'

export default async function MarketPage() {
  await requireRole('analyst')
  const { data: profile } = await getOnboardingProfile()
  const orgTools: string[] = (profile?.tools as string[]) ?? []

  const tools = DLP_TOOLS.filter(t => t.channelCoverage && t.id !== 'no-tool' && t.id !== 'other-tool')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Market Overview</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
          Explore DLP platforms, drill into licences, and compare channel coverage. Your stack is highlighted.
        </p>
      </div>
      <MarketExplorer tools={tools} orgTools={orgTools} />
    </div>
  )
}
