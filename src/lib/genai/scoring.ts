import type { AppFields, DLPActivities, BreachInfo, TrustScores, FieldValue, DLPValue, CustomerClass } from './types'

// ── Field value → score contribution ─────────────────────────────────────────
//
// Scoring rule:
//   field_contribution = field_weight × value_score
//   section_score      = Σ field_contribution   (no normalisation)
//
// This means:
//   • More verified positive evidence → higher score
//   • Missing evidence (no-published) → 0 contribution (honest, not neutral)
//   • Confirmed negative (no) → 0 for POS fields, or full weight for NEG fields
//   • na → excluded entirely (weight dropped)
//
// Maximum section score = 100 when all applicable fields have "yes" / "no"
// (fields sum to w=1.0 per section, score_multiplier max = 100).

const POS: Record<string, number> = {
  'yes':             100,
  'configurable':     80,
  'enterprise-only':  70,
  'tier-dependent':   60,
  'partial':          50,
  'no-published':      0,  // not verified — no contribution
  'no':                0,
}

const NEG: Record<string, number> = {
  'no':              100,  // confirmed no risk
  'configurable':     80,  // risk exists but is controllable
  'enterprise-only':  70,  // risk scoped to enterprise tier
  'tier-dependent':   60,
  'partial':          50,
  'no-published':      0,  // not verified — no contribution
  'yes':               0,  // confirmed risk, unmitigated
}

const DLP_SCORE: Record<string, number> = {
  'enforcement':   100,
  'monitoring':     65,
  'partial':        50,
  'no-published':    0,  // not verified
  'not-supported':   0,
}

// ── Section result ───────────────────────────────────────────────────────────

type Dir = 'pos' | 'neg'
type Item = { val: FieldValue; w: number; dir: Dir }

interface SectionResult {
  score:    number  // 0–100
  verified: number  // fields with a known (non-no-published, non-na) value
  total:    number  // applicable fields (excluding na)
}

// A field is "verified" when the vendor has publicly confirmed the value —
// i.e. it is NOT no-published (and NOT na which is excluded).
const UNVERIFIED: ReadonlySet<string> = new Set(['no-published'])

function scoreItems(items: Item[]): SectionResult {
  const applicable = items.filter(i => i.val !== 'na')
  if (applicable.length === 0) return { score: 50, verified: 0, total: 0 }

  const verified = applicable.filter(i => !UNVERIFIED.has(i.val as string)).length
  const score    = applicable.reduce((s, { val, w, dir }) => {
    const v = dir === 'pos' ? (POS[val] ?? 0) : (NEG[val] ?? 0)
    return s + v * w
  }, 0)

  return { score, verified, total: applicable.length }
}

function scoreDLPItems(items: Array<{ val: DLPValue; w: number }>): SectionResult {
  const verified = items.filter(i => i.val !== 'no-published' && i.val !== 'not-supported').length
  const score    = items.reduce((s, { val, w }) => s + (DLP_SCORE[val] ?? 0) * w, 0)
  return { score, verified, total: items.length }
}

// ── Sub-score A: Data Governance & Privacy (30% of final) ───────────────────
// trains_on_customer_data intentionally appears here AND in GenAI Risk (D).
function scoreDataGovernance(f: AppFields): SectionResult {
  return scoreItems([
    { val: f.trains_on_customer_data,    w: 0.20, dir: 'neg' },
    { val: f.opt_out_of_training,        w: 0.15, dir: 'pos' },
    { val: f.dpa_available,              w: 0.10, dir: 'pos' },
    { val: f.customer_owns_data,         w: 0.10, dir: 'pos' },
    { val: f.data_retention,             w: 0.10, dir: 'pos' },
    { val: f.data_deletion,              w: 0.10, dir: 'pos' },
    { val: f.data_residency,             w: 0.10, dir: 'pos' },
    { val: f.subprocessor_list,          w: 0.05, dir: 'pos' },
    { val: f.pii_sharing_third_parties,  w: 0.05, dir: 'neg' },
    { val: f.data_sharing_genai_vendor,  w: 0.05, dir: 'neg' },
  ])
}

// ── Sub-score B: DLP Activity Support (30% of final) ────────────────────────
function scoreDLPActivity(dlp: DLPActivities): SectionResult {
  return scoreDLPItems([
    { val: dlp.post_prompt,    w: 0.30 },
    { val: dlp.upload,         w: 0.30 },
    { val: dlp.login_instance, w: 0.15 },
    { val: dlp.edit,           w: 0.10 },
    { val: dlp.response,       w: 0.05 },
    { val: dlp.download,       w: 0.05 },
    { val: dlp.attach,         w: 0.05 },
  ])
}

// ── Sub-score C: Security & Compliance (20% of final) ───────────────────────
function scoreSecurityCompliance(f: AppFields): SectionResult {
  return scoreItems([
    { val: f.soc2,                  w: 0.15, dir: 'pos' },
    { val: f.iso27001,              w: 0.15, dir: 'pos' },
    { val: f.iso27018,              w: 0.10, dir: 'pos' },
    { val: f.fedramp,               w: 0.10, dir: 'pos' },
    { val: f.pci_dss,               w: 0.10, dir: 'pos' },
    { val: f.hipaa_baa,             w: 0.10, dir: 'pos' },
    { val: f.encryption_at_rest,    w: 0.10, dir: 'pos' },
    { val: f.encryption_in_transit, w: 0.10, dir: 'pos' },
    { val: f.tenant_segregation,    w: 0.10, dir: 'pos' },
  ])
}

// ── Sub-score D: GenAI-Specific Risk (15% of final) ─────────────────────────
function scoreGenAIRisk(f: AppFields): SectionResult {
  return scoreItems([
    { val: f.trains_on_customer_data,   w: 0.25, dir: 'neg' },
    { val: f.opt_out_of_training,       w: 0.25, dir: 'pos' },
    { val: f.prompt_retention_controls, w: 0.25, dir: 'pos' },
    { val: f.model_provider_clear,      w: 0.15, dir: 'pos' },
    { val: f.connectors_agents_risk,    w: 0.10, dir: 'neg' },
  ])
}

// ── Sub-score E: Breach History & Transparency (5% of final) ────────────────
function scoreBreachTransparency(b: BreachInfo): SectionResult {
  return scoreItems([
    { val: b.recent_breach,    w: 0.40, dir: 'neg' },
    { val: b.older_breach,     w: 0.25, dir: 'neg' },
    { val: b.breach_disclosed, w: 0.15, dir: 'pos' },
    { val: b.source_disclosure,w: 0.10, dir: 'pos' },
    { val: b.breach_remediated,w: 0.10, dir: 'pos' },
  ])
}

// ── Hard caps ────────────────────────────────────────────────────────────────
function applyHardCaps(
  score: number,
  f: AppFields,
  dlp: DLPActivities,
  b: BreachInfo,
): { score: number; cap: string | null } {
  let cap: string | null = null
  let max = 100

  if (f.trains_on_customer_data === 'yes' && f.opt_out_of_training === 'no') {
    if (max > 60) { max = 60; cap = 'Trains on customer data — no opt-out available' }
  }

  if (f.trains_on_customer_data === 'no-published' && f.opt_out_of_training === 'no-published') {
    if (max > 70) { max = 70; cap = 'Training and opt-out status not publicly disclosed' }
  }

  if (dlp.post_prompt === 'not-supported' && dlp.upload === 'not-supported') {
    if (max > 65) { max = 65; cap = 'Prompt and upload inspection both not supported' }
  }

  if (b.recent_breach === 'yes') {
    if (b.breach_remediated === 'no' || b.breach_remediated === 'no-published') {
      if (max > 70) { max = 70; cap = 'Recent breach — remediation not confirmed' }
    } else {
      if (max > 75) { max = 75; cap = 'Recent breach involving customer data' }
    }
  }

  if (f.dpa_available === 'no' && (f.customer_owns_data === 'no' || f.customer_owns_data === 'no-published')) {
    if (max > 70) { max = 70; cap = 'No DPA and data ownership unclear' }
  }

  if (dlp.login_instance === 'not-supported') {
    if (max > 80) { max = 80; cap = 'Tenant / instance identification not supported by DLP' }
  }

  return { score: Math.min(score, max), cap }
}

// ── DLP activity count ───────────────────────────────────────────────────────
function countDLPSupported(dlp: DLPActivities): number {
  return Object.values(dlp).filter(
    v => v === 'enforcement' || v === 'monitoring' || v === 'partial',
  ).length
}

// ── Suggested classification ─────────────────────────────────────────────────
function suggestClassification(score: number): CustomerClass {
  if (score >= 85) return 'enterprise-approved'
  if (score >= 70) return 'approved-with-conditions'
  if (score >= 50) return 'permitted-with-restriction'
  if (score >= 30) return 'unknown'
  return 'prohibited'
}

// ── Main export ──────────────────────────────────────────────────────────────
export function computeTrustScore(
  fields: AppFields,
  dlp: DLPActivities,
  breach: BreachInfo,
): TrustScores {
  const dg = scoreDataGovernance(fields)
  const da = scoreDLPActivity(dlp)
  const sc = scoreSecurityCompliance(fields)
  const gr = scoreGenAIRisk(fields)
  const bt = scoreBreachTransparency(breach)

  const raw = Math.round(dg.score * 0.30 + da.score * 0.30 + sc.score * 0.20 + gr.score * 0.15 + bt.score * 0.05)
  const { score: capped, cap } = applyHardCaps(raw, fields, dlp, breach)
  const final = Math.min(capped, 95) // never 100

  return {
    data_governance:              Math.round(dg.score),
    data_governance_verified:     dg.verified,
    data_governance_total:        dg.total,
    dlp_activity:                 Math.round(da.score),
    security_compliance:          Math.round(sc.score),
    security_compliance_verified: sc.verified,
    security_compliance_total:    sc.total,
    genai_risk:                   Math.round(gr.score),
    genai_risk_verified:          gr.verified,
    genai_risk_total:             gr.total,
    breach_transparency:          Math.round(bt.score),
    breach_transparency_verified: bt.verified,
    breach_transparency_total:    bt.total,
    raw_score:                    raw,
    applied_cap:                  cap,
    final_score:                  final,
    suggested_classification:     suggestClassification(final),
    dlp_activities_supported:     countDLPSupported(dlp),
    dlp_activities_total:         7,
  }
}

// ── Display helpers ──────────────────────────────────────────────────────────
export const FIELD_LABELS: Record<string, string> = {
  // Data Governance
  dpa_available:             'DPA available',
  customer_owns_data:        'Customer owns data',
  trains_on_customer_data:   'Trains on customer data',
  opt_out_of_training:       'Opt out of training',
  data_retention:            'Data retention period',
  data_deletion:             'Data deletion timeline',
  data_residency:            'Data residency',
  subprocessor_list:         'Subprocessor list published',
  pii_sharing_third_parties: 'PII sharing with third parties',
  data_sharing_genai_vendor: 'Data sharing with GenAI vendor',
  // Security
  soc2:                      'SOC 2',
  iso27001:                  'ISO 27001',
  iso27018:                  'ISO 27018',
  fedramp:                   'FedRAMP',
  pci_dss:                   'PCI DSS',
  hipaa_baa:                 'HIPAA / BAA support',
  encryption_at_rest:        'Encryption at rest',
  encryption_in_transit:     'Encryption in transit',
  tenant_segregation:        'Tenant segregation',
  // GenAI
  model_provider_clear:      'Model provider clarity',
  prompt_retention_controls: 'Prompt / data retention controls',
  connectors_agents_risk:    'Connectors / agents / external actions',
}

export const DLP_ACTIVITY_LABELS: Record<string, string> = {
  post_prompt:    'Post / Prompt inspection',
  upload:         'Upload inspection',
  login_instance: 'Tenant / Instance Identification',
  edit:           'Edit inspection',
  response:       'Response inspection',
  download:       'Download inspection',
  attach:         'Attachment inspection',
}

export const VALUE_DISPLAY: Record<string, { label: string; color: string; note?: string }> = {
  'yes':             { label: 'Yes',                      color: 'green'  },
  'no':              { label: 'No',                       color: 'red'    },
  'partial':         { label: 'Partial',                  color: 'amber'  },
  'enterprise-only': { label: 'Enterprise only',          color: 'blue',
    note: 'Available — requires enterprise license or contract' },
  'tier-dependent':  { label: 'Tier-dependent',           color: 'amber'  },
  'configurable':    { label: 'Configurable',             color: 'blue'   },
  'no-published':    { label: 'Not publicly verified',    color: 'muted',
    note: 'No public evidence found — does not contribute to score' },
  'na':              { label: 'Not applicable',           color: 'muted',
    note: 'Excluded from scoring — not relevant to this app\'s context' },
  'enforcement':     { label: 'Supported — enforcement',  color: 'green'  },
  'monitoring':      { label: 'Supported — monitoring',   color: 'amber'  },
  'not-supported':   { label: 'Not supported',            color: 'red'    },
}

export const CLASSIFICATION_LABELS: Record<string, { label: string; color: string }> = {
  'enterprise-approved':        { label: 'Approved & Supported GenAI',    color: 'green'  },
  'approved-with-conditions':   { label: 'Approved with Conditions',      color: 'blue'   },
  'permitted-with-restriction': { label: 'Restricted / Unassessed GenAI', color: 'amber'  },
  'personal':                   { label: 'Personal',                      color: 'purple' },
  'unknown':                    { label: 'Unknown',                       color: 'zinc'   },
  'prohibited':                 { label: 'Prohibited GenAI',              color: 'red'    },
}
