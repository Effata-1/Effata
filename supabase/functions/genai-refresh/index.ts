import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'

// ── Time budget ──────────────────────────────────────────────────────────────
// Supabase Edge Functions have a 150s execution ceiling.
// Stop processing apps when 30s remain so the DB finalise write always completes.
const MAX_SECONDS       = 150
const BUDGET_RESERVE    = 30
const STARTED_AT        = Date.now()
const secondsElapsed    = () => (Date.now() - STARTED_AT) / 1000
const budgetExceeded    = () => secondsElapsed() > MAX_SECONDS - BUDGET_RESERVE

// ── Types ─────────────────────────────────────────────────────────────────────
type ValidField = 'yes'|'no'|'partial'|'enterprise-only'|'tier-dependent'|'configurable'|'no-published'|'na'
type ValidDLP   = 'enforcement'|'monitoring'|'partial'|'no-published'|'not-supported'

interface AppFields {
  dpa_available: ValidField; customer_owns_data: ValidField; trains_on_customer_data: ValidField
  opt_out_of_training: ValidField; data_retention: ValidField; data_deletion: ValidField
  data_residency: ValidField; subprocessor_list: ValidField; pii_sharing_third_parties: ValidField
  data_sharing_genai_vendor: ValidField; enterprise_tier: ValidField; sso_saml: ValidField
  mfa_support: ValidField; role_based_auth: ValidField; authorization_policies: ValidField
  admin_console: ValidField; user_audit_logs: ValidField; data_access_audit_logs: ValidField
  tenant_isolation: ValidField; soc2: ValidField; iso27001: ValidField; iso27018: ValidField
  fedramp: ValidField; pci_dss: ValidField; hipaa_baa: ValidField; encryption_at_rest: ValidField
  encryption_in_transit: ValidField; tenant_segregation: ValidField; model_provider_clear: ValidField
  prompt_retention_controls: ValidField; private_instance: ValidField; connectors_agents_risk: ValidField
}
interface DLPActivities {
  post_prompt: ValidDLP; upload: ValidDLP; login_instance: ValidDLP; edit: ValidDLP
  response: ValidDLP; download: ValidDLP; attach: ValidDLP
}
interface BreachInfo {
  recent_breach: ValidField; older_breach: ValidField; breach_disclosed: ValidField
  source_disclosure: ValidField; breach_remediated: ValidField
  breach_name?: string; breach_date?: string; breach_description?: string
}
interface FieldChange {
  app_id: string; app_name: string; field: string; old_value: string; new_value: string
}

// ── Value clamps ──────────────────────────────────────────────────────────────
const VALID_FIELDS = ['yes','no','partial','enterprise-only','tier-dependent','configurable','no-published','na']
const VALID_DLP    = ['enforcement','monitoring','partial','no-published','not-supported']
const clampField   = (v: unknown): ValidField => VALID_FIELDS.includes(v as string) ? v as ValidField : 'no-published'
const clampDLP     = (v: unknown): ValidDLP   => VALID_DLP.includes(v as string)    ? v as ValidDLP   : 'no-published'

function parseFields(raw: Record<string, unknown>): AppFields {
  return {
    dpa_available: clampField(raw.dpa_available), customer_owns_data: clampField(raw.customer_owns_data),
    trains_on_customer_data: clampField(raw.trains_on_customer_data), opt_out_of_training: clampField(raw.opt_out_of_training),
    data_retention: clampField(raw.data_retention), data_deletion: clampField(raw.data_deletion),
    data_residency: clampField(raw.data_residency), subprocessor_list: clampField(raw.subprocessor_list),
    pii_sharing_third_parties: clampField(raw.pii_sharing_third_parties), data_sharing_genai_vendor: clampField(raw.data_sharing_genai_vendor),
    enterprise_tier: clampField(raw.enterprise_tier), sso_saml: clampField(raw.sso_saml),
    mfa_support: clampField(raw.mfa_support), role_based_auth: clampField(raw.role_based_auth),
    authorization_policies: clampField(raw.authorization_policies), admin_console: clampField(raw.admin_console),
    user_audit_logs: clampField(raw.user_audit_logs), data_access_audit_logs: clampField(raw.data_access_audit_logs),
    tenant_isolation: clampField(raw.tenant_isolation), soc2: clampField(raw.soc2),
    iso27001: clampField(raw.iso27001), iso27018: clampField(raw.iso27018),
    fedramp: clampField(raw.fedramp), pci_dss: clampField(raw.pci_dss), hipaa_baa: clampField(raw.hipaa_baa),
    encryption_at_rest: clampField(raw.encryption_at_rest), encryption_in_transit: clampField(raw.encryption_in_transit),
    tenant_segregation: clampField(raw.tenant_segregation), model_provider_clear: clampField(raw.model_provider_clear),
    prompt_retention_controls: clampField(raw.prompt_retention_controls), private_instance: clampField(raw.private_instance),
    connectors_agents_risk: clampField(raw.connectors_agents_risk),
  }
}
function parseDLP(raw: Record<string, unknown>): DLPActivities {
  return {
    post_prompt: clampDLP(raw.post_prompt), upload: clampDLP(raw.upload), login_instance: clampDLP(raw.login_instance),
    edit: clampDLP(raw.edit), response: clampDLP(raw.response), download: clampDLP(raw.download), attach: clampDLP(raw.attach),
  }
}
function parseBreach(raw: Record<string, unknown>): BreachInfo {
  return {
    recent_breach: clampField(raw.recent_breach), older_breach: clampField(raw.older_breach),
    breach_disclosed: clampField(raw.breach_disclosed), source_disclosure: clampField(raw.source_disclosure),
    breach_remediated: clampField(raw.breach_remediated),
    breach_name:        typeof raw.breach_name === 'string' ? raw.breach_name : undefined,
    breach_date:        typeof raw.breach_date === 'string' ? raw.breach_date : undefined,
    breach_description: typeof raw.breach_description === 'string' ? raw.breach_description : undefined,
  }
}

// ── Anthropic client + prompts ────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

const SYSTEM_PROMPT = `You are a DLP security researcher. You evaluate GenAI applications for enterprise security posture.
Respond ONLY with valid JSON. No markdown, no prose, no code blocks.

Field values MUST be one of exactly:
- AppFields: "yes" | "no" | "partial" | "enterprise-only" | "tier-dependent" | "configurable" | "no-published" | "na"
- DLPActivities: "enforcement" | "monitoring" | "partial" | "no-published" | "not-supported"
- BreachInfo positive fields: same as AppFields
- BreachInfo negative fields (recent_breach, older_breach): "yes" = bad, "no" = good

Use "no-published" when you cannot verify a claim. Do not guess.`

async function researchApp(app: { app_id: string; app_name: string; vendor: string; domain: string; app_type: string }) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Research this GenAI application for enterprise DLP security posture.

App: ${app.app_name}
Vendor: ${app.vendor}
Domain: ${app.domain}
Type: ${app.app_type}

Return a JSON object with exactly this structure:
{
  "enterprise": {
    "fields": { "dpa_available":"...","customer_owns_data":"...","trains_on_customer_data":"...","opt_out_of_training":"...","data_retention":"...","data_deletion":"...","data_residency":"...","subprocessor_list":"...","pii_sharing_third_parties":"...","data_sharing_genai_vendor":"...","enterprise_tier":"...","sso_saml":"...","mfa_support":"...","role_based_auth":"...","authorization_policies":"...","admin_console":"...","user_audit_logs":"...","data_access_audit_logs":"...","tenant_isolation":"...","soc2":"...","iso27001":"...","iso27018":"...","fedramp":"...","pci_dss":"...","hipaa_baa":"...","encryption_at_rest":"...","encryption_in_transit":"...","tenant_segregation":"...","model_provider_clear":"...","prompt_retention_controls":"...","private_instance":"...","connectors_agents_risk":"..." },
    "dlp": { "post_prompt":"...","upload":"...","login_instance":"...","edit":"...","response":"...","download":"...","attach":"..." },
    "breach_info": { "recent_breach":"...","older_breach":"...","breach_disclosed":"...","source_disclosure":"...","breach_remediated":"...","breach_name":null,"breach_date":null,"breach_description":null }
  },
  "personal": {
    "fields": { ... same 32 fields for the personal/free tier ... },
    "dlp": { ... same 7 activities ... },
    "breach_info": { ... same as enterprise ... }
  },
  "notes": "Brief factual summary of key security characteristics and any notable risks."
}`,
    }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = JSON.parse(text)
  return {
    enterprise: { fields: parseFields(parsed.enterprise.fields), dlp: parseDLP(parsed.enterprise.dlp), breach_info: parseBreach(parsed.enterprise.breach_info) },
    personal:   { fields: parseFields(parsed.personal.fields),   dlp: parseDLP(parsed.personal.dlp),   breach_info: parseBreach(parsed.personal.breach_info) },
    notes: typeof parsed.notes === 'string' ? parsed.notes : '',
  }
}

async function discoverNewApps(existingAppIds: string[]) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `You are a GenAI market researcher tracking enterprise-relevant AI applications.

Existing apps already in the catalog (do NOT suggest these):
${existingAppIds.join(', ')}

Identify up to 5 significant GenAI applications that enterprises are actively using or evaluating for work, that are NOT in the catalog above. Focus on productivity, coding, content, or data AI tools used by knowledge workers.

Return a JSON array (may be empty if nothing significant to add):
[{ "app_id":"lowercase-hyphenated-id","app_name":"Display Name","vendor":"Company Name","domain":"app.example.com","app_type":"one of: AI Assistant | Code Assistant | Image Generator | AI Writing | AI Search | AI Analytics | AI Communication | AI Productivity","logo_letter":"Single uppercase letter","logo_bg":"hex color like #1a1a2e" }]

Only include apps with significant enterprise adoption or strong growth trajectory. Return JSON only.`,
    }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  const parsed: unknown[] = JSON.parse(text)
  return parsed
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .filter(item => typeof item.app_id === 'string' && typeof item.app_name === 'string' && !existingAppIds.includes(item.app_id as string))
    .slice(0, 5)
    .map(item => ({
      app_id:      (item.app_id as string).toLowerCase().replace(/\s+/g, '-'),
      app_name:    item.app_name as string,
      vendor:      (item.vendor as string) ?? '',
      domain:      (item.domain as string) ?? '',
      app_type:    (item.app_type as string) ?? 'AI Assistant',
      logo_letter: ((item.logo_letter as string) ?? (item.app_name as string).charAt(0)).charAt(0).toUpperCase(),
      logo_bg:     (item.logo_bg as string) ?? '#1a1a2e',
    }))
}

// ── Diff helper ───────────────────────────────────────────────────────────────
function diffProfiles(appId: string, appName: string, oldFields: Record<string, string>, newFields: Record<string, string>, prefix = ''): FieldChange[] {
  const changes: FieldChange[] = []
  for (const [key, newVal] of Object.entries(newFields)) {
    const oldVal = oldFields[key]
    if (oldVal && oldVal !== newVal) {
      changes.push({ app_id: appId, app_name: appName, field: prefix + key, old_value: oldVal, new_value: newVal })
    }
  }
  return changes
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const errors: Array<{ app_id: string; error: string }> = []
  const allChanges: FieldChange[] = []

  // Mark stale running runs as timed_out
  await supabase
    .from('genai_research_runs')
    .update({ status: 'timed_out', completed_at: new Date().toISOString() })
    .eq('status', 'running')
    .lt('started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

  // Create run log
  const { data: run, error: runError } = await supabase
    .from('genai_research_runs')
    .insert({ status: 'running' })
    .select('id')
    .single()

  if (runError || !run) {
    return new Response(JSON.stringify({ error: 'Failed to create run log' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
  const runId: string = run.id

  let appsUpdated = 0
  let appsAdded   = 0
  let appsSkipped = 0

  try {
    const { data: apps } = await supabase.from('genai_apps').select('*').eq('status', 'active')
    const existingApps = (apps ?? []) as Array<{ app_id: string; app_name: string; vendor: string; domain: string; app_type: string; logo_letter: string; logo_bg: string; status: string; last_updated: string }>
    const existingIds  = existingApps.map(a => a.app_id)

    // Discover new apps
    const newApps = await discoverNewApps(existingIds)
    for (const app of newApps) {
      const { error: insertError } = await supabase.from('genai_apps').insert({
        app_id: app.app_id, app_name: app.app_name, vendor: app.vendor, domain: app.domain,
        app_type: app.app_type, logo_letter: app.logo_letter, logo_bg: app.logo_bg,
        status: 'active', auto_researched: true, last_updated: new Date().toISOString(),
      })
      if (insertError) {
        errors.push({ app_id: app.app_id, error: `Insert failed: ${insertError.message}` })
      } else {
        existingApps.push({ ...app, status: 'active', last_updated: new Date().toISOString() })
        appsAdded++
      }
    }

    // Research all apps — stop if budget is exhausted
    for (const app of existingApps) {
      if (budgetExceeded()) {
        appsSkipped = existingApps.length - appsUpdated - errors.length
        errors.push({ app_id: 'system', error: `Time budget reached after ${Math.round(secondsElapsed())}s — ${appsSkipped} apps deferred to next run` })
        break
      }
      try {
        const { data: existing } = await supabase.from('genai_app_profiles').select('fields, dlp').eq('app_id', app.app_id).eq('mode', 'enterprise').single()
        const profile = await researchApp(app)

        if (existing) {
          allChanges.push(
            ...diffProfiles(app.app_id, app.app_name, existing.fields as Record<string, string>, profile.enterprise.fields as unknown as Record<string, string>),
            ...diffProfiles(app.app_id, app.app_name, existing.dlp as Record<string, string>, profile.enterprise.dlp as unknown as Record<string, string>, 'dlp.'),
          )
        }

        const { error: eErr } = await supabase.from('genai_app_profiles').upsert(
          { app_id: app.app_id, mode: 'enterprise', fields: profile.enterprise.fields, dlp: profile.enterprise.dlp, breach_info: profile.enterprise.breach_info },
          { onConflict: 'app_id,mode' },
        )
        if (eErr) { errors.push({ app_id: app.app_id, error: `Enterprise upsert: ${eErr.message}` }); continue }

        const { error: pErr } = await supabase.from('genai_app_profiles').upsert(
          { app_id: app.app_id, mode: 'personal', fields: profile.personal.fields, dlp: profile.personal.dlp, breach_info: profile.personal.breach_info },
          { onConflict: 'app_id,mode' },
        )
        if (pErr) { errors.push({ app_id: app.app_id, error: `Personal upsert: ${pErr.message}` }); continue }

        await supabase.from('genai_apps').update({ last_updated: new Date().toISOString(), auto_researched: true, research_notes: profile.notes }).eq('app_id', app.app_id)
        appsUpdated++
      } catch (err) {
        errors.push({ app_id: app.app_id, error: err instanceof Error ? err.message : String(err) })
      }
    }

    const finalStatus = appsSkipped > 0 ? 'partial' : errors.length > 0 && appsUpdated === 0 ? 'failed' : 'completed'

    await supabase.from('genai_research_runs').update({
      completed_at: new Date().toISOString(),
      apps_updated: appsUpdated,
      apps_added:   appsAdded,
      errors:       errors,
      changes:      allChanges,
      status:       finalStatus,
    }).eq('id', runId)

    return new Response(JSON.stringify({ status: finalStatus, apps_updated: appsUpdated, apps_added: appsAdded, apps_skipped: appsSkipped, changes: allChanges.length, errors }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('genai_research_runs').update({ completed_at: new Date().toISOString(), status: 'failed', errors: [{ error: msg }] }).eq('id', runId)
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
