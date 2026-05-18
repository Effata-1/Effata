// Maps onboarding region IDs → regulation region strings
export const ORG_REGION_MAP: Record<string, string[]> = {
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
export const ORG_INDUSTRY_MAP: Record<string, string[]> = {
  'financial-services':   ['financial'],
  'banking':              ['financial'],
  'insurance':            ['financial'],
  'healthcare':           ['healthcare'],
  'life-sciences':        ['healthcare'],
  'technology-saas':      ['technology'],
  'software-engineering': ['technology'],
  'retail-ecommerce':     ['retail'],
  'hospitality-travel':   ['retail'],
  'energy-utilities':     ['critical_infrastructure', 'energy'],
  'manufacturing':        ['critical_infrastructure'],
  'automotive':           ['automotive', 'transport'],
  'logistics-transport':  ['transport', 'critical_infrastructure'],
  'telecom':              ['telecom', 'digital_infrastructure'],
  'government':           ['government', 'defence'],
  'education':            ['education'],
  'legal':                ['legal'],
  'professional-services':['legal'],
  'media-entertainment':  ['media'],
  'non-profit':           [],
  'other':                [],
}

export function isRelevantToOrg(
  reg: { regions: string[]; industries: string[] | null },
  orgRegions: string[],
  orgIndustry: string | null
): boolean {
  if (orgRegions.length === 0) return false

  const orgIsGlobal = orgRegions.includes('global')
  const regIsGlobal = reg.regions.includes('Global')
  const orgRegionStrings = orgRegions.flatMap(r => ORG_REGION_MAP[r] ?? [])

  const regionMatch = orgIsGlobal || regIsGlobal || orgRegionStrings.some(orgR =>
    reg.regions.some(regR => regR.includes(orgR) || orgR.includes(regR))
  )
  if (!regionMatch) return false

  if (reg.industries === null) return true
  if (!orgIndustry) return true
  const mappedIndustries = ORG_INDUSTRY_MAP[orgIndustry] ?? []
  return mappedIndustries.some(i => reg.industries!.includes(i))
}
