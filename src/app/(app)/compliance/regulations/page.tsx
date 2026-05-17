import { createClient } from '@/lib/supabase/server'
import { RegulationsClient } from './_components/regulations-client'

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
  last_verified_at: string
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
  Europe:           ['EU', 'EEA', 'UK'],
  India:            ['India'],
  Americas:         ['US', 'Canada', 'Brazil', 'California, United States'],
  'Asia-Pacific':   ['Singapore', 'China', 'Japan', 'Australia', 'South Korea'],
  'MENA & Africa':  ['Saudi Arabia', 'UAE', 'South Africa'],
}

// Maps onboarding region IDs → regulation region strings
const ORG_REGION_MAP: Record<string, string[]> = {
  'european-union': ['EU', 'EEA'],
  'united-kingdom': ['UK'],
  'india':          ['India'],
  'united-states':  ['US', 'California, United States'],
  'canada':         ['Canada'],
  'brazil':         ['Brazil'],
  'latin-america':  ['Brazil'],
  'singapore':      ['Singapore'],
  'china':          ['China'],
  'japan':          ['Japan'],
  'south-korea':    ['South Korea'],
  'australia':      ['Australia'],
  'apac':           ['Singapore', 'Japan', 'Australia', 'South Korea', 'China'],
  'saudi-arabia':   ['Saudi Arabia'],
  'uae':            ['UAE'],
  'middle-east':    ['Saudi Arabia', 'UAE'],
  'south-africa':   ['South Africa'],
  'africa':         ['South Africa'],
}

// Maps onboarding industry IDs → regulation industry strings
const ORG_INDUSTRY_MAP: Record<string, string[]> = {
  'financial-services': ['financial'],
  'banking':            ['financial'],
  'insurance':          ['financial'],
  'healthcare':         ['healthcare'],
  'life-sciences':      ['healthcare'],
  'defence':            ['defence'],
  'government':         ['defence'],
  'energy':             ['critical_infrastructure'],
  'utilities':          ['critical_infrastructure'],
  'manufacturing':      ['critical_infrastructure'],
}

function regionGroupMatch(regions: string[], group: string): boolean {
  if (group === 'all') return true
  const targets = REGION_GROUPS[group] ?? []
  return regions.some(r => targets.some(t => r.includes(t) || t.includes(r)))
}

function isRelevantToOrg(
  reg: RegulationRow,
  orgRegions: string[],
  orgIndustry: string | null
): boolean {
  if (orgRegions.length === 0) return false

  const isGlobal = orgRegions.includes('global')

  // Map org region IDs to regulation region strings
  const orgRegionStrings = orgRegions.flatMap(r => ORG_REGION_MAP[r] ?? [])

  const regionMatch = isGlobal || orgRegionStrings.some(orgR =>
    reg.regions.some(regR => regR.includes(orgR) || orgR.includes(regR))
  )
  if (!regionMatch) return false

  // No industry restriction on the regulation → applies to all industries
  if (reg.industries === null) return true

  // Match org industry
  if (!orgIndustry) return true
  const mappedIndustries = ORG_INDUSTRY_MAP[orgIndustry] ?? []
  return mappedIndustries.some(i => reg.industries!.includes(i))
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
    const regionOk = region === 'all' || regionGroupMatch(r.regions, region)
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
        <h1 className="text-2xl font-bold text-white mb-1">Regulations</h1>
        <p className="text-zinc-500 text-sm">
          {allRegs.length} DLP-relevant regulations across {Object.keys(REGION_GROUPS).length} regions
          {relevantCodes.size > 0 && ` — ${relevantCodes.size} apply to your organisation`}
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
