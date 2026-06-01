// Shared risk family constants — used by Control Matrix, Data Catalog, and policy recommendation.
// These 9 families are the canonical risk classification taxonomy across the product.
// Never duplicate these definitions in another file.

export const RISK_FAMILIES = [
  { id: 'credentials_keys_secrets',     label: 'Credentials, Keys & Secrets',    color: 'red',    order: 1 },
  { id: 'regulated_data',               label: 'Regulated Data',                  color: 'red',    order: 2 },
  { id: 'source_code',                  label: 'Source Code',                     color: 'red',    order: 3 },
  { id: 'intellectual_property',        label: 'Intellectual Property',            color: 'red',    order: 4 },
  { id: 'security_infrastructure_data', label: 'Security & Infrastructure Data',  color: 'orange', order: 5 },
  { id: 'customer_employee_data',       label: 'Customer & Employee Data',         color: 'orange', order: 6 },
  { id: 'financial_commercial_data',    label: 'Financial & Commercial Data',      color: 'amber',  order: 7 },
  { id: 'legal_contractual_data',       label: 'Legal & Contractual Data',         color: 'amber',  order: 8 },
  { id: 'public_low_risk_data',         label: 'Public & Low-Risk Data',           color: 'green',  order: 9 },
] as const

// Display name union — matches the DB CHECK constraint value (not the slug)
export type RiskFamily   = typeof RISK_FAMILIES[number]['label']
// Slug union — used in policy keys and internal identifiers
export type RiskFamilyId = typeof RISK_FAMILIES[number]['id']

// Derived lookup keyed by label (DB stores display names, not slugs)
export const RISK_FAMILY_META: Record<string, { color: string }> =
  Object.fromEntries(RISK_FAMILIES.map(rf => [rf.label, { color: rf.color }]))
