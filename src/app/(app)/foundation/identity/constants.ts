import type { IdentityFieldName, IdentitySourceType } from './actions'

export const FIELD_LABELS: Record<IdentityFieldName, string> = {
  business_function:      'Business Function',
  privilege_level:        'Privilege Level',
  employment_type:        'Employment Type',
  user_lifecycle_status:  'User Lifecycle Status',
}

export const FIELD_DESCRIPTIONS: Record<IdentityFieldName, string> = {
  business_function:     "Map your organisation's departments, OUs, and groups to standard DLP business function categories.",
  privilege_level:       'Identify which groups have admin or elevated access — these carry higher DLP impact.',
  employment_type:       'Distinguish employees, contractors, vendors, and service accounts for contextual risk.',
  user_lifecycle_status: 'Track leavers, inactive accounts, and role changes — the highest-risk identity events.',
}

export const SOURCE_TYPE_LABELS: Record<IdentitySourceType, string> = {
  ad_group:     'AD Group',
  ou:           'OU',
  hr_attribute: 'HR Attribute',
  okta_group:   'Okta Group',
  google_group: 'Google Group',
  custom:       'Custom',
}
