export type SystemLevel = 'secret' | 'highly_confidential' | 'confidential' | 'internal' | 'public'

export type TrustTag =
  | 'enterprise_approved'
  | 'approved_with_conditions'
  | 'permitted_with_restriction'
  | 'personal'
  | 'public'
  | 'unknown'
  | 'prohibited'

export interface OrgDestinationTrustLabel {
  id:          string
  org_id:      string
  system_tag:  TrustTag | null
  name:        string
  color:       string
  priority:    number
  description: string | null
  is_system:   boolean
  active:      boolean
}

export const SYSTEM_TRUST_DEFAULTS: Omit<OrgDestinationTrustLabel, 'id' | 'org_id'>[] = [
  { system_tag: 'enterprise_approved',        name: 'Enterprise Approved',        color: 'emerald', priority: 1, description: 'Fully managed and approved for corporate use.',                    is_system: true, active: true },
  { system_tag: 'approved_with_conditions',   name: 'Approved with Conditions',   color: 'blue',    priority: 2, description: 'Permitted with specific controls in place.',                       is_system: true, active: true },
  { system_tag: 'permitted_with_restriction', name: 'Permitted with Restriction', color: 'amber',   priority: 3, description: 'Allowed for low-risk use only — not for sensitive data.',          is_system: true, active: true },
  { system_tag: 'personal',                   name: 'Personal',                   color: 'purple',  priority: 4, description: 'Personal consumer accounts — outside corporate oversight.',        is_system: true, active: true },
  { system_tag: 'public',                     name: 'Public',                     color: 'sky',     priority: 5, description: 'Approved public-facing channels — low or no sensitivity allowed.', is_system: true, active: true },
  { system_tag: 'unknown',                    name: 'Unknown',                    color: 'zinc',    priority: 6, description: 'Not yet assessed — treat as high risk until reviewed.',            is_system: true, active: true },
  { system_tag: 'prohibited',                 name: 'Prohibited',                 color: 'red',     priority: 7, description: 'Blocked for all corporate data — no exceptions.',                 is_system: true, active: true },
]

export interface CatalogDataType {
  id:           string
  slug:         string
  name:         string
  system_level: SystemLevel
  subcategory:  string | null
  risk_family:  string | null
  description:  string | null
  examples:     string[]
  notes:        string | null
  priority:     number
  tags:         string[]
  active:       boolean
}

export interface OrgClassificationLabel {
  id:           string
  org_id:       string
  system_level: SystemLevel | null
  name:         string
  color:        string
  priority:     number
  description:  string | null
  is_system:    boolean
  active:       boolean
}

export interface OrgDataType {
  id:                    string
  org_id:                string
  catalog_data_type_id:  string | null
  name:                  string
  description:           string | null
  examples:              string[]
  notes:                 string | null
  risk_family:           string | null
  is_in_scope:           boolean
  is_custom:             boolean
  // joined fields
  classification_label_id?:   string | null
  classification_label_name?: string | null
  classification_label_color?: string | null
  mapped_by?:                 string | null
  confidence?:                number | null
}

export interface AISuggestion {
  org_data_type_id:  string
  label_name:        string
  confidence:        number
  reasoning:         string
  // resolved after match
  label_id?:         string
}

export const SYSTEM_LEVEL_META: Record<SystemLevel, {
  label:    string
  color:    string
  priority: number
  tagline:  string
}> = {
  secret: {
    label:    'Secret',
    color:    'red',
    priority: 1,
    tagline:  'Critical data that can cause severe damage if exposed. Block by default at any external destination.',
  },
  highly_confidential: {
    label:    'Highly Confidential',
    color:    'orange',
    priority: 2,
    tagline:  'Regulated, personal, financial, HR, legal, source code, and security-sensitive data.',
  },
  confidential: {
    label:    'Confidential',
    color:    'amber',
    priority: 3,
    tagline:  'Sensitive business data — contracts, pricing, proposals, customer documents, and strategy.',
  },
  internal: {
    label:    'Internal',
    color:    'blue',
    priority: 4,
    tagline:  'Normal internal business information. Not for public sharing, but not regulated.',
  },
  public: {
    label:    'Public',
    color:    'green',
    priority: 5,
    tagline:  'Formally approved for public release. Inspect for hidden sensitive content.',
  },
}

export const COLOR_OPTIONS = [
  { value: 'red',     label: 'Red',     class: 'bg-red-500' },
  { value: 'orange',  label: 'Orange',  class: 'bg-orange-500' },
  { value: 'amber',   label: 'Amber',   class: 'bg-amber-500' },
  { value: 'yellow',  label: 'Yellow',  class: 'bg-yellow-500' },
  { value: 'green',   label: 'Green',   class: 'bg-green-500' },
  { value: 'emerald', label: 'Emerald', class: 'bg-emerald-500' },
  { value: 'sky',     label: 'Sky',     class: 'bg-sky-500' },
  { value: 'blue',    label: 'Blue',    class: 'bg-blue-500' },
  { value: 'purple',  label: 'Purple',  class: 'bg-purple-500' },
  { value: 'zinc',    label: 'Grey',    class: 'bg-accent' },
]

export const RISK_FAMILIES = [
  'Credentials, Keys & Secrets',
  'Regulated Data',
  'Source Code',
  'Intellectual Property',
  'Customer & Employee Data',
  'Financial & Commercial Data',
  'Legal & Contractual Data',
  'Security & Infrastructure Data',
  'Public & Low-Risk Data',
] as const

export type RiskFamily = typeof RISK_FAMILIES[number]

export const RISK_FAMILY_META: Record<RiskFamily, { color: string }> = {
  'Credentials, Keys & Secrets':    { color: 'red'     },
  'Regulated Data':                 { color: 'red'     },
  'Source Code':                    { color: 'red'     },
  'Intellectual Property':          { color: 'red'     },
  'Customer & Employee Data':       { color: 'orange'  },
  'Financial & Commercial Data':    { color: 'amber'   },
  'Legal & Contractual Data':       { color: 'amber'   },
  'Security & Infrastructure Data': { color: 'orange'  },
  'Public & Low-Risk Data':         { color: 'green'   },
}

export function colorClasses(color: string) {
  const map: Record<string, { text: string; bg: string; border: string; dot: string }> = {
    red:     { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25',     dot: 'bg-red-400' },
    orange:  { text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/25',  dot: 'bg-orange-400' },
    amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   dot: 'bg-amber-400' },
    yellow:  { text: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/25',  dot: 'bg-yellow-400' },
    green:   { text: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/25',   dot: 'bg-green-400' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
    sky:     { text: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/25',     dot: 'bg-sky-400' },
    blue:    { text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25',    dot: 'bg-blue-400' },
    purple:  { text: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/25',  dot: 'bg-purple-400' },
    zinc:    { text: 'text-muted-foreground',    bg: 'bg-accent/40',    border: 'border-border-strong',       dot: 'bg-accent' },
  }
  return map[color] ?? map['zinc']
}
