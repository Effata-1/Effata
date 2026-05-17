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

function regionGroupMatch(regions: string[], group: string): boolean {
  if (group === 'all') return true
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

  const { data: regsData } = await supabase
    .from('compliance_regulations')
    .select('*, requirements:compliance_requirements(*)')
    .eq('active', true)
    .order('short_name')

  const allRegs = (regsData as RegulationRow[]) ?? []

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const staleCount = allRegs.filter(
    r => new Date(r.last_verified_at) < sevenDaysAgo
  ).length

  const filtered = allRegs.filter(r => {
    const regionOk = region === 'all' || regionGroupMatch(r.regions, region)
    const industryOk =
      industry === 'all' ||
      r.industries === null ||
      r.industries.includes(industry)
    return regionOk && industryOk
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Regulations</h1>
        <p className="text-zinc-500 text-sm">
          {allRegs.length} DLP-relevant regulations across {Object.keys(REGION_GROUPS).length} regions — filter by your organisation&apos;s location and industry
        </p>
      </div>

      <RegulationsClient
        regulations={filtered}
        allCount={allRegs.length}
        staleCount={staleCount}
        currentRegion={region}
        currentIndustry={industry}
      />
    </div>
  )
}
