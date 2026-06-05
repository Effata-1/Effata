// Shared NPJ enrichment — single source of truth for the structural / vendor-grade
// fields every neutral policy should carry (channels, decision severity, telemetry,
// exceptions, provenance). Used by:
//   • syncRecommendedPolicies()  — recommended policies from the Control Matrix
//   • createBlankPolicy()        — manual blank policy
//   • normalizeProposal()        — AI-assisted policy proposals
//
// This module is ISOMORPHIC — pure functions only, no 'use server' and no server-only
// imports — so it can run in both server actions and client components.

import {
  type NpjChannel,
  NPJ_CHANNELS_CONTENT_DETECTION,
  NPJ_CHANNELS_LABEL_DETECTION,
  NPJ_CHANNELS_FILENAME_DETECTION,
  NPJ_CHANNELS_APP_ACCESS,
} from './npj-schema'

// Bumped when the enriched NPJ shape changes in a way that requires re-translation.
// Translators compare this against the value stored on the policy row.
export const NPJ_COMPILER_VERSION = '2.0.0'

export interface DecisionEnrichment {
  severity:          'critical' | 'major' | 'minor' | 'info'
  preserve_evidence: boolean
  create_incident:   boolean
}

// Maps a decision mode to vendor-facing enforcement metadata.
export function computeDecisionEnrichment(mode: string): DecisionEnrichment {
  switch (mode) {
    case 'block':   return { severity: 'critical', preserve_evidence: true,  create_incident: true  }
    case 'alert':   return { severity: 'major',    preserve_evidence: true,  create_incident: true  }
    case 'coach':   return { severity: 'major',    preserve_evidence: false, create_incident: true  }
    case 'monitor': return { severity: 'minor',    preserve_evidence: false, create_incident: false }
    default:        return { severity: 'info',     preserve_evidence: false, create_incident: false }
  }
}

// Inspection channels for a policy family. Falls back to content-detection breadth
// for unknown / custom families (manual + AI policies), or app-access for access intent.
export function channelsForFamily(
  family: string | null | undefined,
  intent?: string,
): NpjChannel[] {
  switch (family) {
    case 'genai_content_detection': return NPJ_CHANNELS_CONTENT_DETECTION
    case 'genai_label_detection':   return NPJ_CHANNELS_LABEL_DETECTION
    case 'genai_filename':          return NPJ_CHANNELS_FILENAME_DETECTION
    case 'genai_app_access':        return NPJ_CHANNELS_APP_ACCESS
  }
  if (intent === 'govern_app_access') return NPJ_CHANNELS_APP_ACCESS
  return NPJ_CHANNELS_CONTENT_DETECTION
}

// Telemetry block. Evidence export defaults on for enforcing/alerting policies.
export function buildTelemetry(auditTag: string, mode: string): {
  incident_recipients: string[]
  export_evidence:     boolean
  audit_tags:          string[]
} {
  return {
    incident_recipients: [],
    export_evidence:     mode === 'block' || mode === 'alert',
    audit_tags:          [auditTag],
  }
}

// Backfills all structural enrichment fields on a partially-built NPJ without
// clobbering values already present (AI / user choices win). Used by the manual
// and AI creation paths so they produce the same enriched shape as recommended
// policies. Recommended-policy sync builds these fields inline per-section and
// does NOT use this helper.
export function enrichManualNpj(npj: Record<string, unknown>): Record<string, unknown> {
  const scope    = (npj.scope      as Record<string, unknown> | undefined) ?? {}
  const decision = (npj.decision   as Record<string, unknown> | undefined) ?? {}
  const prov     = (npj.provenance as Record<string, unknown> | undefined) ?? {}

  const mode     = (decision.mode as string | undefined) ?? 'allow'
  const family   = (npj.policy_family as string | null | undefined) ?? null
  const intent   = npj.intent as string | undefined
  const auditTag = family ?? intent ?? 'manual'

  const existingChannels = scope.channels as string[] | undefined

  return {
    ...npj,
    scope: {
      ...scope,
      channels: existingChannels?.length ? existingChannels : channelsForFamily(family, intent),
    },
    decision: {
      ...computeDecisionEnrichment(mode),  // defaults fill any gaps
      ...decision,                          // existing AI / user values win
      mode,                                 // guarantee mode is present
    },
    exceptions: (npj.exceptions as unknown[] | undefined) ?? [],
    telemetry:  (npj.telemetry  as Record<string, unknown> | undefined) ?? buildTelemetry(auditTag, mode),
    provenance: {
      generated_from:   'manual',
      compiler_version: NPJ_COMPILER_VERSION,
      ...prov,                              // existing provenance (e.g. generated_at) wins
    },
  }
}
