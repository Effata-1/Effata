import { createClient } from '@/lib/supabase/server'
import { RegulationsClient } from './_components/regulations-client'
import { isRelevantToOrg } from '@/lib/compliance/org-mappings'

export interface RegulationRow {
  id: string
  code: string
  short_name: string
  name: string
  regions: string[]
  industries: string[] | null
  jurisdiction: string
  authority: string | null
  type: string
  summary: string
  max_fine: string | null
  effective_date: string | null
  source_url: string | null
  created_at: string
  last_verified_at: string
  content_updated_at: string | null
  active: boolean
  requirements: RequirementRow[]
}

export interface RequirementRow {
  id: string
  article: string
  title: string
  description: string
  dlp_relevance: string
  fine: string | null
  severity: string
  dlp_controls: string[]
}

const REGION_GROUPS: Record<string, string[]> = {
  Global:          ['Global'],
  Europe:          ['EU', 'EEA', 'UK'],
  India:           ['India'],
  Americas:        ['US', 'Canada', 'Brazil', 'California, United States'],
  'Asia-Pacific':  ['Singapore', 'China', 'Japan', 'Australia', 'South Korea'],
  'Middle East':   ['Saudi Arabia', 'UAE'],
  Africa:          ['South Africa'],
}

function regionGroupMatch(regions: string[], group: string): boolean {
  if (group === 'all') return true
  if (group === 'Global') return regions.includes('Global')
  // Global frameworks appear under every geographic filter
  if (regions.includes('Global')) return true
  const targets = REGION_GROUPS[group] ?? []
  return regions.some(r => targets.some(t => r.includes(t) || t.includes(r)))
}


export default async function RegulationsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; industry?: string }>
}) {
  const { region = 'all', industry = 'all' } = await searchParams

  const supabase = await createClient()

  const [{ data: regsData }, { data: profileData }] = await Promise.all([
    supabase
      .from('compliance_regulations')
      .select('*, requirements:compliance_requirements(*)')
      .eq('active', true)
      .order('short_name'),
    supabase
      .from('onboarding_profiles')
      .select('regions, industry')
      .maybeSingle(),
  ])

  const allRegs = (regsData as RegulationRow[]) ?? []
  const orgRegions: string[] = profileData?.regions ?? []
  const orgIndustry: string | null = profileData?.industry ?? null

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const staleCount = allRegs.filter(
    r => new Date(r.last_verified_at) < sevenDaysAgo
  ).length

  // Compute relevance set
  const relevantCodes = new Set(
    allRegs
      .filter(r => isRelevantToOrg(r, orgRegions, orgIndustry))
      .map(r => r.code)
  )

  const filtered = allRegs.filter(r => {
    // 'my-regions' passes all regs through — client filters by relevantCodes
    const regionOk = region === 'all' || region === 'my-regions' || regionGroupMatch(r.regions, region)
    const industryOk =
      industry === 'all' ||
      r.industries === null ||
      r.industries.includes(industry)
    return regionOk && industryOk
  })

  // Sort: relevant regulations first, then alphabetical
  const sorted = [
    ...filtered.filter(r => relevantCodes.has(r.code)),
    ...filtered.filter(r => !relevantCodes.has(r.code)),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Regulations & Frameworks</h1>
        <p className="text-zinc-500 text-sm">
          Browse and filter DLP-relevant regulations across privacy, security, and sector-specific frameworks worldwide.
        </p>
      </div>

      <RegulationsClient
        regulations={sorted}
        allCount={allRegs.length}
        staleCount={staleCount}
        relevantCodes={[...relevantCodes]}
        hasOrgProfile={orgRegions.length > 0}
        currentRegion={region}
        currentIndustry={industry}
      />
    </div>
  )
}
