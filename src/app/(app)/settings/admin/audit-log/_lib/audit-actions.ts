/**
 * Single source of truth for audit log action metadata.
 * Imported by:
 *   - audit-log-table.tsx  (client display — severity badge, category pill)
 *   - page.tsx             (server filtering — severity filter, category SQL query)
 *   - audit-filters.tsx    (UI — category dropdown options)
 */

export const SEVERITY_MAP: Record<string, 'high' | 'medium' | 'low' | 'info'> = {
  // Auth
  'auth.login_success':                 'info',
  'auth.logout':                        'info',
  'auth.signup':                        'low',
  // Onboarding
  'onboarding.completed':               'low',
  // GenAI app classification (legacy action name)
  'genai.classification_changed':       'medium',
  'classification_changed':             'medium',
  // Tools
  'regex.pattern_saved':                'low',
  'regex.pattern_deleted':              'medium',
  'test_data.dataset_saved':            'low',
  'test_data.dataset_deleted':          'medium',
  'dlp_test.run':                       'low',
  // Compliance
  'compliance.regulation_verified':     'low',
  'compliance.assessment_updated':      'low',
  'compliance_proposal.approved':       'high',
  'compliance_proposal.rejected':       'high',
  // Control Matrix
  'control_matrix.cell_updated':        'medium',
  'control_matrix.cell_reset':          'medium',
  'control_matrix.posture_updated':     'high',
  'control_matrix.reset':               'high',
  // Policies
  'policy.created':                     'medium',
  'policy.updated':                     'medium',
  'policy.deleted':                     'high',
  'policy.duplicated':                  'low',
  'policy.duplicated_as_manual':        'low',
  'policy.activated':                   'medium',
  'policy.deactivated':                 'medium',
  'policy.change_applied':              'medium',
  'policy_chat.diff_applied':           'medium',
  // Coaching templates
  'coaching_template.created':          'medium',
  'coaching_template.updated':          'medium',
  'coaching_template.deleted':          'medium',
  'coaching_template.activated':        'low',
  'coaching_template.deactivated':      'low',
  'coaching_template.reset':            'low',
  // App governance
  'app_governance.category_created':    'medium',
  'app_governance.category_updated':    'medium',
  'app_governance.category_deleted':    'medium',
  'app_governance.app_classified':      'medium',
  // Sensitivity labels
  'sensitivity_label.created':          'medium',
  'sensitivity_label.updated':          'medium',
  'sensitivity_label.deactivated':      'medium',
  // Classification labels (data catalog)
  'classification_label.updated':       'low',
  'classification_label.created':       'low',
  'classification_label.deleted':       'medium',
  'data_type.custom_created':           'low',
  'classification.ai_mapping_accepted': 'low',
  // Identity
  'identity.mapping_added':             'low',
  'identity.mapping_updated':           'low',
  'identity.mapping_deleted':           'low',
  'identity.scope_toggled':             'medium',
  // Destinations
  'destination.scope_toggled':          'medium',
  'destination.profile_updated':        'low',
  'destination.custom_added':           'medium',
  'destination.custom_deleted':         'medium',
  // Channels
  'channel.assessment_saved':           'medium',
  // Users / team
  'user.invited':                       'medium',
  'user.role_changed':                  'high',
  'user.removed':                       'high',
}

export function getSeverity(action: string): 'high' | 'medium' | 'low' | 'info' {
  return SEVERITY_MAP[action] ?? 'info'
}

// ─── Category filter ──────────────────────────────────────────────────────────
// Each entry maps a URL param value → one or more action prefixes used in SQL LIKE.
// Multi-prefix entries become OR conditions in the page query.

export const CATEGORY_PREFIXES_FOR_FILTER: Record<string, string[]> = {
  auth:           ['auth.'],
  genai:          ['genai.', 'classification_changed'],
  onboarding:     ['onboarding.'],
  policy:         ['policy.', 'policy_chat.'],
  user:           ['user.'],
  tools:          ['regex.', 'test_data.', 'dlp_test.', 'tool.'],
  compliance:     ['compliance.', 'compliance_proposal.'],
  control_matrix: ['control_matrix.'],
  coaching:       ['coaching_template.'],
  app_governance: ['app_governance.'],
  labels:         ['sensitivity_label.', 'classification_label.'],
  identity:       ['identity.'],
  destinations:   ['destination.'],
  channels:       ['channel.'],
  data_catalog:   ['data_type.', 'classification.'],
}

export const AUDIT_CATEGORIES: Array<{ label: string; value: string }> = [
  { label: 'Auth',           value: 'auth' },
  { label: 'GenAI',          value: 'genai' },
  { label: 'Onboarding',     value: 'onboarding' },
  { label: 'Policies',       value: 'policy' },
  { label: 'Users',          value: 'user' },
  { label: 'Tools',          value: 'tools' },
  { label: 'Compliance',     value: 'compliance' },
  { label: 'Control Matrix', value: 'control_matrix' },
  { label: 'Coaching',       value: 'coaching' },
  { label: 'App Governance', value: 'app_governance' },
  { label: 'Labels',         value: 'labels' },
  { label: 'Identity',       value: 'identity' },
  { label: 'Destinations',   value: 'destinations' },
  { label: 'Channels',       value: 'channels' },
  { label: 'Data Catalog',   value: 'data_catalog' },
]

/** Reverse map: URL param value → display label for active-filter chips. */
export const CATEGORY_LABEL_FOR_VALUE: Record<string, string> = Object.fromEntries(
  AUDIT_CATEGORIES.map(c => [c.value, c.label]),
)
