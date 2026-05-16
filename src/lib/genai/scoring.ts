import type { AppFields, DLPActivities, BreachInfo, TrustScores, FieldValue, DLPValue } from './types'

// ── Field value → score ────────────────────────────────────────
const POS: Record<string, number> = {
  'yes': 100, 'enterprise-only': 80, 'configurable': 80,
  'tier-dependent': 60, 'partial': 60,
  'no-published': 40, 'no': 0, 'na': 0,
}

const NEG: Record<string, number> = {
  'no': 100, 'na': 100,
  'configurable': 80, 'tier-dependent': 60, 'partial': 60,
  'no-published': 40, 'yes': 0,
}

const DLP_SCORE: Record<string, number> = {
  'enforcement': 100, 'monitoring': 80, 'partial': 60,
  'no-published': 40, 'not-supported': 0,
}

const p = (v: FieldValue) => POS[v] ?? 40
const n = (v: FieldValue) => NEG[v] ?? 40
const d = (v: DLPValue)   => DLP_SCORE[v] ?? 0

// ── Sub-score A: Data Governance & Privacy (25%) ───────────────
function scoreDataGovernance(f: AppFields): number {
  return (
    p(f.dpa_available)               * 0.10 +
    p(f.customer_owns_data)          * 0.10 +
    n(f.trains_on_customer_data)     * 0.20 +
    p(f.opt_out_of_training)         * 0.15 +
    p(f.data_retention)              * 0.10 +
    p(f.data_deletion)               * 0.10 +
    p(f.data_residency)              * 0.10 +
    p(f.subprocessor_list)           * 0.05 +
    n(f.pii_sharing_third_parties)   * 0.05 +
    n(f.data_sharing_genai_vendor)   * 0.05
  )
}

// ── Sub-score B: DLP Activity Support (25%) ───────────────────
function scoreDLPActivity(dlp: DLPActivities): number {
  return (
    d(dlp.post_prompt)    * 0.30 +
    d(dlp.upload)         * 0.30 +
    d(dlp.login_instance) * 0.15 +
    d(dlp.edit)           * 0.10 +
    d(dlp.response)       * 0.05 +
    d(dlp.download)       * 0.05 +
    d(dlp.attach)         * 0.05
  )
}

// ── Sub-score C: Enterprise Capability & Access Control (20%) ─
function scoreEnterpriseAccess(f: AppFields): number {
  return (
    p(f.enterprise_tier)        * 0.10 +
    p(f.sso_saml)               * 0.15 +
    p(f.mfa_support)            * 0.10 +
    p(f.role_based_auth)        * 0.10 +
    p(f.authorization_policies) * 0.10 +
    p(f.admin_console)          * 0.10 +
    p(f.user_audit_logs)        * 0.10 +
    p(f.data_access_audit_logs) * 0.10 +
    p(f.tenant_isolation)       * 0.15
  )
}

// ── Sub-score D: Security & Compliance Assurance (15%) ────────
function scoreSecurityCompliance(f: AppFields): number {
  return (
    p(f.soc2)               * 0.15 +
    p(f.iso27001)           * 0.15 +
    p(f.iso27018)           * 0.10 +
    p(f.fedramp)            * 0.10 +
    p(f.pci_dss)            * 0.10 +
    p(f.hipaa_baa)          * 0.10 +
    p(f.encryption_at_rest) * 0.10 +
    p(f.encryption_in_transit) * 0.10 +
    p(f.tenant_segregation) * 0.10
  )
}

// ── Sub-score E: GenAI-Specific Risk (10%) ─────────────────────
function scoreGenAIRisk(f: AppFields): number {
  return (
    p(f.model_provider_clear)    * 0.15 +
    n(f.trains_on_customer_data) * 0.25 +
    p(f.opt_out_of_training)     * 0.20 +
    p(f.prompt_retention_controls) * 0.15 +
    p(f.private_instance)        * 0.15 +
    n(f.connectors_agents_risk)  * 0.10
  )
}

// ── Sub-score F: Breach History & Transparency (5%) ───────────
function scoreBreachTransparency(b: BreachInfo): number {
  return (
    n(b.recent_breach)    * 0.40 +
    n(b.older_breach)     * 0.25 +
    p(b.breach_disclosed) * 0.15 +
    p(b.source_disclosure) * 0.10 +
    p(b.breach_remediated) * 0.10
  )
}

// ── Hard caps ─────────────────────────────────────────────────
function applyHardCaps(
  score: number,
  f: AppFields,
  dlp: DLPActivities,
  b: BreachInfo
): { score: number; cap: string | null } {
  let cap: string | null = null
  let max = 100

  if (f.enterprise_tier === 'no') { max = Math.min(max, 70); cap = 'No enterprise tier' }
  if (f.sso_saml === 'no' && f.admin_console === 'no' && f.user_audit_logs === 'no') {
    max = Math.min(max, 70); cap = 'No enterprise access controls'
  }
  if (f.trains_on_customer_data === 'yes' && f.opt_out_of_training === 'no') {
    max = Math.min(max, 60); cap = 'Training on customer data with no opt-out'
  }
  if (f.tenant_isolation === 'no') { max = Math.min(max, 70); cap = 'No tenant isolation' }
  if (dlp.post_prompt === 'not-supported' && dlp.upload === 'not-supported') {
    max = Math.min(max, 65); cap = 'Post/Prompt and Upload both not inspectable'
  }
  if (b.recent_breach === 'yes') { max = Math.min(max, 75); cap = 'Recent breach involving customer data' }
  // Most fields no-published
  const allFields = Object.values(f)
  const noPublishedCount = allFields.filter(v => v === 'no-published').length
  if (noPublishedCount > allFields.length * 0.6) {
    max = Math.min(max, 55); cap = 'Insufficient public information'
  }

  return { score: Math.min(score, max), cap }
}

// ── DLP activity count ─────────────────────────────────────────
function countDLPSupported(dlp: DLPActivities): number {
  return Object.values(dlp).filter(v =>
    v === 'enforcement' || v === 'monitoring' || v === 'partial'
  ).length
}

// ── System suggested classification ───────────────────────────
function suggestClassification(score: number): string {
  if (score >= 85) return 'Enterprise Approved'
  if (score >= 70) return 'Approved with Conditions'
  if (score >= 50) return 'Permitted with Restriction'
  if (score >= 30) return 'Unknown / High Review'
  return 'Prohibited Candidate'
}

// ── Main export ────────────────────────────────────────────────
export function computeTrustScore(
  fields: AppFields,
  dlp: DLPActivities,
  breach: BreachInfo
): TrustScores {
  const dg  = scoreDataGovernance(fields)
  const da  = scoreDLPActivity(dlp)
  const ea  = scoreEnterpriseAccess(fields)
  const sc  = scoreSecurityCompliance(fields)
  const gr  = scoreGenAIRisk(fields)
  const bt  = scoreBreachTransparency(breach)

  const raw = Math.round(
    dg * 0.25 + da * 0.25 + ea * 0.20 + sc * 0.15 + gr * 0.10 + bt * 0.05
  )

  const { score: capped, cap } = applyHardCaps(raw, fields, dlp, breach)
  // Score capped at 95 — never 100
  const final = Math.min(capped, 95)

  return {
    data_governance:       Math.round(dg),
    dlp_activity:          Math.round(da),
    enterprise_access:     Math.round(ea),
    security_compliance:   Math.round(sc),
    genai_risk:            Math.round(gr),
    breach_transparency:   Math.round(bt),
    raw_score:             raw,
    applied_cap:           cap,
    final_score:           final,
    suggested_classification: suggestClassification(final),
    dlp_activities_supported: countDLPSupported(dlp),
    dlp_activities_total:  7,
  }
}

// ── Display helpers ────────────────────────────────────────────
export const FIELD_LABELS: Record<string, string> = {
  // Data Governance
  dpa_available: 'DPA available',
  customer_owns_data: 'Customer owns data',
  trains_on_customer_data: 'Trains on customer data',
  opt_out_of_training: 'Opt out of training',
  data_retention: 'Data retention period',
  data_deletion: 'Data deletion timeline',
  data_residency: 'Data residency',
  subprocessor_list: 'Subprocessor list published',
  pii_sharing_third_parties: 'PII sharing with third parties',
  data_sharing_genai_vendor: 'Data sharing with GenAI vendor',
  // Enterprise
  enterprise_tier: 'Enterprise tier available',
  sso_saml: 'SSO / SAML support',
  mfa_support: 'MFA support',
  role_based_auth: 'Role-based authorisation',
  authorization_policies: 'Authorisation policies',
  admin_console: 'Admin console',
  user_audit_logs: 'User audit logs',
  data_access_audit_logs: 'Data access audit logs',
  tenant_isolation: 'Tenant isolation / private instance',
  // Security
  soc2: 'SOC 2',
  iso27001: 'ISO 27001',
  iso27018: 'ISO 27018',
  fedramp: 'FedRAMP',
  pci_dss: 'PCI DSS',
  hipaa_baa: 'HIPAA / BAA support',
  encryption_at_rest: 'Encryption at rest',
  encryption_in_transit: 'Encryption in transit',
  tenant_segregation: 'Tenant segregation',
  // GenAI
  model_provider_clear: 'Model provider clarity',
  prompt_retention_controls: 'Prompt / data retention controls',
  private_instance: 'Tenant / private instance support',
  connectors_agents_risk: 'Connectors / agents / external actions',
}

export const DLP_ACTIVITY_LABELS: Record<string, string> = {
  post_prompt: 'Post / Prompt inspection',
  upload: 'Upload inspection',
  login_instance: 'Login / Instance Detection',
  edit: 'Edit inspection',
  response: 'Response inspection',
  download: 'Download inspection',
  attach: 'Attach inspection',
}

export const VALUE_DISPLAY: Record<string, { label: string; color: string }> = {
  'yes':             { label: 'Yes',                 color: 'green'  },
  'no':              { label: 'No',                  color: 'red'    },
  'partial':         { label: 'Partial',             color: 'amber'  },
  'enterprise-only': { label: 'Enterprise only',     color: 'blue'   },
  'tier-dependent':  { label: 'Tier-dependent',      color: 'amber'  },
  'configurable':    { label: 'Configurable',        color: 'blue'   },
  'no-published':    { label: 'No published',        color: 'muted'  },
  'na':              { label: 'N/A',                 color: 'muted'  },
  'enforcement':     { label: 'Supported — enforcement', color: 'green' },
  'monitoring':      { label: 'Supported — monitoring', color: 'amber' },
  'not-supported':   { label: 'Not supported',       color: 'red'    },
}

export const CLASSIFICATION_LABELS: Record<string, { label: string; color: string }> = {
  'enterprise-approved':       { label: 'Enterprise Approved',       color: 'green'  },
  'approved-with-conditions':  { label: 'Approved with Conditions',  color: 'blue'   },
  'permitted-with-restriction':{ label: 'Permitted with Restriction', color: 'amber' },
  'personal':                  { label: 'Personal',                  color: 'purple' },
  'unknown':                   { label: 'Unknown',                   color: 'zinc'   },
  'prohibited':                { label: 'Prohibited',                color: 'red'    },
}
