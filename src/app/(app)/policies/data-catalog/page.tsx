import { getCatalogPageData } from '@/lib/data-catalog/actions'
import { CatalogClient } from './_components/catalog-client'

export default async function DataCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ rf?: string }>
}) {
  const { rf } = await searchParams
  const { catalog, orgTypes, labels, mappings } = await getCatalogPageData()

  // Build lookup: catalogDataTypeId → org selection + classification
  const orgTypeMap = new Map(orgTypes.map(t => [t.catalog_data_type_id, t]))
  const mappingMap = new Map(mappings.map(m => [m.org_data_type_id, m]))

  const enrichedCatalog = catalog.map(c => {
    const orgType = orgTypeMap.get(c.id)
    const mapping = orgType ? mappingMap.get(orgType.id) : undefined
    return {
      ...c,
      org_data_type_id:           orgType?.id ?? null,
      is_in_scope:                !!orgType?.is_in_scope,
      classification_label_id:    mapping?.org_classification_label_id ?? null,
      mapped_by:                  mapping?.mapped_by ?? null,
    }
  })

  const customTypes = orgTypes
    .filter(t => t.is_custom)
    .map(t => {
      const mapping = mappingMap.get(t.id)
      return {
        ...t,
        org_data_type_id:           t.id,
        is_in_scope:                true,
        classification_label_id:    mapping?.org_classification_label_id ?? null,
        mapped_by:                  mapping?.mapped_by ?? null,
      }
    })

  return (
    <CatalogClient
      catalog={enrichedCatalog}
      customTypes={customTypes}
      labels={labels}
      initialRfFilter={rf ?? ''}
    />
  )
}
