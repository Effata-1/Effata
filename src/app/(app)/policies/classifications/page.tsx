import { getClassificationsPageData } from '@/lib/data-catalog/actions'
import { ClassificationsClient } from './_components/classifications-client'

export default async function ClassificationsPage() {
  const { labels, orgTypes, mappings, userRole } = await getClassificationsPageData()

  const mappingMap = new Map(mappings.map(m => [m.org_data_type_id, m]))
  const countByLabel = new Map<string, number>()
  mappings.forEach(m => {
    countByLabel.set(m.org_classification_label_id, (countByLabel.get(m.org_classification_label_id) ?? 0) + 1)
  })

  const enrichedOrgTypes = orgTypes.map(t => ({
    ...t,
    classification_label_id:    mappingMap.get(t.id)?.org_classification_label_id ?? null,
    mapped_by:                  mappingMap.get(t.id)?.mapped_by ?? null,
    confidence:                 mappingMap.get(t.id)?.confidence ?? null,
  }))

  return (
    <ClassificationsClient
      labels={labels}
      orgTypes={enrichedOrgTypes}
      countByLabel={Object.fromEntries(countByLabel)}
      userRole={userRole}
    />
  )
}
