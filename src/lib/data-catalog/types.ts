export type SystemLevel = 'secret' | 'highly_confidential' | 'confidential' | 'internal' | 'public'

export interface CatalogDataType {
  id:          string
  slug:        string
  name:        string
  system_level: SystemLevel
  subcategory: string | null
  description: string | null
  examples:    string[]
  notes:       string | null
  priority:    number
  tags:        string[]
  active:      boolean
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
  { value: 'red',    label: 'Red',    class: 'bg-red-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'amber',  label: 'Amber',  class: 'bg-amber-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'green',  label: 'Green',  class: 'bg-green-500' },
  { value: 'blue',   label: 'Blue',   class: 'bg-blue-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'zinc',   label: 'Grey',   class: 'bg-zinc-500' },
]

export function colorClasses(color: string) {
  const map: Record<string, { text: string; bg: string; border: string; dot: string }> = {
    red:    { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/25',    dot: 'bg-red-400' },
    orange: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/25', dot: 'bg-orange-400' },
    amber:  { text: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  dot: 'bg-amber-400' },
    yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25', dot: 'bg-yellow-400' },
    green:  { text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/25',  dot: 'bg-green-400' },
    blue:   { text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/25',   dot: 'bg-blue-400' },
    purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25', dot: 'bg-purple-400' },
    zinc:   { text: 'text-zinc-400',   bg: 'bg-zinc-700/40',   border: 'border-zinc-700',      dot: 'bg-zinc-400' },
  }
  return map[color] ?? map['zinc']
}
