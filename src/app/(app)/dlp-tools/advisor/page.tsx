import { requireRole } from '@/lib/auth'
import { getOnboardingProfile } from '@/app/onboarding/actions'
import { DLP_TOOLS } from '@/lib/onboarding/data'
import { listAdvisorChats } from './actions'
import { DlpAdvisorChat } from './_components/dlp-advisor-chat'

export default async function AdvisorPage() {
  await requireRole('analyst')
  const [{ data: profile }, initialChats] = await Promise.all([
    getOnboardingProfile(),
    listAdvisorChats(),
  ])

  const orgTools: string[] = (profile?.tools as string[]) ?? []
  const orgToolLabels = DLP_TOOLS
    .filter(t => orgTools.includes(t.id) && t.channelCoverage)
    .map(t => t.label)

  const allTools = DLP_TOOLS
    .filter(t => t.channelCoverage && t.id !== 'no-tool' && t.id !== 'other-tool')
    .map(t => ({ id: t.id, label: t.label }))

  return (
    <DlpAdvisorChat
      orgToolLabels={orgToolLabels}
      allTools={allTools}
      initialChats={initialChats}
    />
  )
}
