import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { AppFields, DLPActivities, BreachInfo } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_GENAI_Intellegence_PIPELINE! })

const VALID_FIELD_VALUES = ['yes','no','partial','enterprise-only','tier-dependent','configurable','no-published','na'] as const
const VALID_DLP_VALUES   = ['enforcement','monitoring','partial','no-published','not-supported'] as const

type ValidField = typeof VALID_FIELD_VALUES[number]
type ValidDLP   = typeof VALID_DLP_VALUES[number]

function clampField(v: unknown): ValidField {
  return VALID_FIELD_VALUES.includes(v as ValidField) ? (v as ValidField) : 'no-published'
}
function clampDLP(v: unknown): ValidDLP {
  return VALID_DLP_VALUES.includes(v as ValidDLP) ? (v as ValidDLP) : 'no-published'
}

function parseFields(raw: Record<string, unknown>): AppFields {
  return {
    dpa_available:              clampField(raw.dpa_available),
    customer_owns_data:         clampField(raw.customer_owns_data),
    trains_on_customer_data:    clampField(raw.trains_on_customer_data),
    opt_out_of_training:        clampField(raw.opt_out_of_training),
    data_retention:             clampField(raw.data_retention),
    data_deletion:              clampField(raw.data_deletion),
    data_residency:             clampField(raw.data_residency),
    subprocessor_list:          clampField(raw.subprocessor_list),
    pii_sharing_third_parties:  clampField(raw.pii_sharing_third_parties),
    data_sharing_genai_vendor:  clampField(raw.data_sharing_genai_vendor),
    enterprise_tier:            clampField(raw.enterprise_tier),
    sso_saml:                   clampField(raw.sso_saml),
    mfa_support:                clampField(raw.mfa_support),
    role_based_auth:            clampField(raw.role_based_auth),
    authorization_policies:     clampField(raw.authorization_policies),
    admin_console:              clampField(raw.admin_console),
    user_audit_logs:            clampField(raw.user_audit_logs),
    data_access_audit_logs:     clampField(raw.data_access_audit_logs),
    tenant_isolation:           clampField(raw.tenant_isolation),
    soc2:                       clampField(raw.soc2),
    iso27001:                   clampField(raw.iso27001),
    iso27018:                   clampField(raw.iso27018),
    fedramp:                    clampField(raw.fedramp),
    pci_dss:                    clampField(raw.pci_dss),
    hipaa_baa:                  clampField(raw.hipaa_baa),
    encryption_at_rest:         clampField(raw.encryption_at_rest),
    encryption_in_transit:      clampField(raw.encryption_in_transit),
    tenant_segregation:         clampField(raw.tenant_segregation),
    model_provider_clear:       clampField(raw.model_provider_clear),
    prompt_retention_controls:  clampField(raw.prompt_retention_controls),
    private_instance:           clampField(raw.private_instance),
    connectors_agents_risk:     clampField(raw.connectors_agents_risk),
  }
}

function parseDLP(raw: Record<string, unknown>): DLPActivities {
  return {
    post_prompt:    clampDLP(raw.post_prompt),
    upload:         clampDLP(raw.upload),
    login_instance: clampDLP(raw.login_instance),
    edit:           clampDLP(raw.edit),
    response:       clampDLP(raw.response),
    download:       clampDLP(raw.download),
    attach:         clampDLP(raw.attach),
  }
}

function parseBreach(raw: Record<string, unknown>): BreachInfo {
  return {
    recent_breach:      clampField(raw.recent_breach),
    older_breach:       clampField(raw.older_breach),
    breach_disclosed:   clampField(raw.breach_disclosed),
    source_disclosure:  clampField(raw.source_disclosure),
    breach_remediated:  clampField(raw.breach_remediated),
    breach_name:        typeof raw.breach_name === 'string' ? raw.breach_name : undefined,
    breach_date:        typeof raw.breach_date === 'string' ? raw.breach_date : undefined,
    breach_description: typeof raw.breach_description === 'string' ? raw.breach_description : undefined,
  }
}

const SYSTEM_PROMPT = `You are a DLP security researcher. You evaluate GenAI applications for enterprise security posture.
Respond ONLY with valid JSON. No markdown, no prose, no code blocks.

Field values MUST be one of exactly:
- AppFields: "yes" | "no" | "partial" | "enterprise-only" | "tier-dependent" | "configurable" | "no-published" | "na"
- DLPActivities: "enforcement" | "monitoring" | "partial" | "no-published" | "not-supported"
- BreachInfo positive fields: same as AppFields
- BreachInfo negative fields (recent_breach, older_breach): "yes" = bad, "no" = good

Definitions:
- yes: fully available/implemented
- no: not available/implemented
- partial: partly available but incomplete
- enterprise-only: only on enterprise tier
- tier-dependent: depends on subscription tier
- configurable: admin can configure it
- no-published: information not publicly available
- na: not applicable for this app type
- enforcement: DLP can block/enforce on this activity
- monitoring: DLP can observe but not enforce
- not-supported: DLP cannot intercept this activity at all

Use "no-published" when you cannot verify a claim. Do not guess.`

export interface ResearchedProfile {
  enterprise: { fields: AppFields; dlp: DLPActivities; breach_info: BreachInfo }
  personal:   { fields: AppFields; dlp: DLPActivities; breach_info: BreachInfo }
  notes: string
}

export async function researchApp(app: {
  app_id: string
  app_name: string
  vendor: string
  domain: string
  app_type: string
}): Promise<ResearchedProfile> {
  const prompt = `Research this GenAI application for enterprise DLP security posture.

App: ${app.app_name}
Vendor: ${app.vendor}
Domain: ${app.domain}
Type: ${app.app_type}

Return a JSON object with exactly this structure:
{
  "enterprise": {
    "fields": {
      "dpa_available": "...",
      "customer_owns_data": "...",
      "trains_on_customer_data": "...",
      "opt_out_of_training": "...",
      "data_retention": "...",
      "data_deletion": "...",
      "data_residency": "...",
      "subprocessor_list": "...",
      "pii_sharing_third_parties": "...",
      "data_sharing_genai_vendor": "...",
      "enterprise_tier": "...",
      "sso_saml": "...",
      "mfa_support": "...",
      "role_based_auth": "...",
      "authorization_policies": "...",
      "admin_console": "...",
      "user_audit_logs": "...",
      "data_access_audit_logs": "...",
      "tenant_isolation": "...",
      "soc2": "...",
      "iso27001": "...",
      "iso27018": "...",
      "fedramp": "...",
      "pci_dss": "...",
      "hipaa_baa": "...",
      "encryption_at_rest": "...",
      "encryption_in_transit": "...",
      "tenant_segregation": "...",
      "model_provider_clear": "...",
      "prompt_retention_controls": "...",
      "private_instance": "...",
      "connectors_agents_risk": "..."
    },
    "dlp": {
      "post_prompt": "...",
      "upload": "...",
      "login_instance": "...",
      "edit": "...",
      "response": "...",
      "download": "...",
      "attach": "..."
    },
    "breach_info": {
      "recent_breach": "...",
      "older_breach": "...",
      "breach_disclosed": "...",
      "source_disclosure": "...",
      "breach_remediated": "...",
      "breach_name": null,
      "breach_date": null,
      "breach_description": null
    }
  },
  "personal": {
    "fields": { ... same 32 fields for the personal/free tier ... },
    "dlp": { ... same 7 activities ... },
    "breach_info": { ... same as enterprise, breach info is the same ... }
  },
  "notes": "Brief factual summary of key security characteristics and any notable risks."
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = JSON.parse(text)

  return {
    enterprise: {
      fields:      parseFields(parsed.enterprise.fields),
      dlp:         parseDLP(parsed.enterprise.dlp),
      breach_info: parseBreach(parsed.enterprise.breach_info),
    },
    personal: {
      fields:      parseFields(parsed.personal.fields),
      dlp:         parseDLP(parsed.personal.dlp),
      breach_info: parseBreach(parsed.personal.breach_info),
    },
    notes: typeof parsed.notes === 'string' ? parsed.notes : '',
  }
}

export interface DiscoveredApp {
  app_id:     string
  app_name:   string
  vendor:     string
  domain:     string
  app_type:   string
  logo_letter: string
  logo_bg:    string
}

export async function discoverNewApps(existingAppIds: string[]): Promise<DiscoveredApp[]> {
  const prompt = `You are a GenAI market researcher tracking enterprise-relevant AI applications.

Existing apps already in the catalog (do NOT suggest these):
${existingAppIds.join(', ')}

Identify up to 5 significant GenAI applications that enterprises are actively using or evaluating for work, that are NOT in the catalog above. Focus on productivity, coding, content, or data AI tools used by knowledge workers.

Return a JSON array (may be empty if nothing significant to add):
[
  {
    "app_id": "lowercase-hyphenated-id",
    "app_name": "Display Name",
    "vendor": "Company Name",
    "domain": "app.example.com",
    "app_type": "one of: AI Assistant | Code Assistant | Image Generator | AI Writing | AI Search | AI Analytics | AI Communication | AI Productivity",
    "logo_letter": "Single uppercase letter",
    "logo_bg": "A hex color code like #1a1a2e that suits the brand"
  }
]

Only include apps with significant enterprise adoption or strong growth trajectory. Return JSON only.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  const parsed: unknown[] = JSON.parse(text)

  return parsed
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .filter(item =>
      typeof item.app_id === 'string' &&
      typeof item.app_name === 'string' &&
      typeof item.vendor === 'string' &&
      typeof item.domain === 'string' &&
      typeof item.app_type === 'string' &&
      typeof item.logo_letter === 'string' &&
      typeof item.logo_bg === 'string' &&
      !existingAppIds.includes(item.app_id as string)
    )
    .slice(0, 5)
    .map(item => ({
      app_id:      item.app_id as string,
      app_name:    item.app_name as string,
      vendor:      item.vendor as string,
      domain:      item.domain as string,
      app_type:    item.app_type as string,
      logo_letter: (item.logo_letter as string).charAt(0).toUpperCase(),
      logo_bg:     item.logo_bg as string,
    }))
}
