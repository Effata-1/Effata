// React-PDF-native only: Document, Page, View, Text, StyleSheet.
// No Tailwind, no Lucide, no DOM APIs, no app UI components.
//
// IMPORTANT: every explanation in this document is DETERMINISTIC — derived from
// policy_key and structured fields. No AI-generated rationale (project rule:
// "AI explains in-app; the database/engine provides the actual policy facts").
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type {
  NetskopePolicy, RequiredObjects, LimitationEntry, ValidationItem,
} from '@/lib/genai/netskope/types'
import { readableDate } from './export-utils'

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily:  'Helvetica',
    fontSize:    9,
    color:       '#1a1a1a',
    paddingTop:    36,
    paddingBottom: 44,
    paddingHorizontal: 34,
    lineHeight:  1.45,
  },
  // Header / cover
  docTitle:    { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  docSubtitle: { fontSize: 10, color: '#6b7280', marginBottom: 14 },
  metaGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginBottom: 4 },
  metaItem:    { flexDirection: 'row' },
  metaLabel:   { color: '#6b7280', marginRight: 4 },
  metaValue:   { fontFamily: 'Helvetica-Bold' },
  // Section
  section:      { marginTop: 18 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 6,
                  borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 3 },
  sectionIntro: { fontSize: 9, color: '#4b5563', marginBottom: 8 },
  para:         { fontSize: 9, color: '#374151', marginBottom: 5 },
  bulletRow:    { flexDirection: 'row', marginBottom: 3 },
  bulletDot:    { width: 12, color: '#9ca3af' },
  bulletText:   { flex: 1, fontSize: 9, color: '#374151' },
  // Stat cards
  statRow:   { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard:  { borderWidth: 0.5, borderColor: '#e5e7eb', borderRadius: 4,
               padding: 8, minWidth: 92, backgroundColor: '#fafafa' },
  statNum:   { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  statLabel: { fontSize: 7.5, color: '#6b7280', marginTop: 2 },
  // Summary table
  tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 4,
                 paddingHorizontal: 5, borderBottomWidth: 0.5, borderBottomColor: '#d1d5db' },
  tableRow:    { flexDirection: 'row', paddingVertical: 3.5, paddingHorizontal: 5,
                 borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 3.5, paddingHorizontal: 5,
                 borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', backgroundColor: '#fafafa' },
  th:          { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#374151' },
  td:          { fontSize: 8, color: '#374151' },
  // Summary table column widths (portrait A4, ~527pt usable)
  colPrio:  { width: 38 },
  colName:  { width: 120, paddingRight: 4 },
  colSrc:   { width: 85, paddingRight: 4 },
  colDest:  { width: 95, paddingRight: 4 },
  colProf:  { width: 140, paddingRight: 4 },
  colAct:   { width: 48 },
  // Limitations table column widths
  limArea:  { width: 90, paddingRight: 4 },
  limLim:   { width: 175, paddingRight: 4 },
  limImp:   { width: 175, paddingRight: 4 },
  limRisk:  { width: 55 },
  // Per-policy detail block
  policyBlock:   { borderWidth: 0.5, borderColor: '#e5e7eb', borderRadius: 4,
                   padding: 9, marginBottom: 9 },
  policyHead:    { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  policyPrio:    { fontSize: 9, fontFamily: 'Helvetica-Bold', backgroundColor: '#eef2ff',
                   color: '#4338ca', paddingVertical: 1.5, paddingHorizontal: 5,
                   borderRadius: 3, marginRight: 6 },
  policyName:    { fontSize: 10.5, fontFamily: 'Helvetica-Bold', flex: 1 },
  policyTag:     { fontSize: 7, color: '#6b7280', borderWidth: 0.5, borderColor: '#d1d5db',
                   borderRadius: 3, paddingVertical: 1, paddingHorizontal: 4 },
  purpose:       { fontSize: 9, color: '#374151', marginBottom: 6, fontStyle: 'italic' },
  kvRow:         { flexDirection: 'row', marginBottom: 2 },
  kvKey:         { width: 78, fontSize: 8, color: '#6b7280' },
  kvVal:         { flex: 1, fontSize: 8, color: '#374151' },
  profLine:      { flexDirection: 'row', marginBottom: 1.5, marginLeft: 78 },
  profName:      { flex: 1, fontSize: 8, color: '#374151' },
  profAction:    { fontSize: 8, fontFamily: 'Helvetica-Bold', width: 60, textAlign: 'right' },
  noteBox:       { marginTop: 6, paddingTop: 5, borderTopWidth: 0.5, borderTopColor: '#f0f0f0' },
  noteLabel:     { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280',
                   textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  noteText:      { fontSize: 8, color: '#4b5563' },
  // Required objects
  objGroup:      { marginBottom: 8, width: 168 },
  objGroupLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 3 },
  objItem:       { flexDirection: 'row', marginLeft: 6, marginBottom: 1 },
  // Checklist
  checkItem:    { flexDirection: 'row', marginBottom: 3 },
  checkBullet:  { width: 62, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  checkText:    { flex: 1, fontSize: 9, color: '#374151' },
  // Footer
  footer:       { position: 'absolute', bottom: 22, left: 34, right: 34,
                  flexDirection: 'row', justifyContent: 'space-between',
                  borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 4 },
  footerText:   { fontSize: 7, color: '#9ca3af' },
})

// ── Deterministic explanation helpers ───────────────────────────────────────

function topologyLabel(topology: string): string {
  return topology === 'hybrid_category_based' ? 'Hybrid Category-Based' :
         topology === 'consolidated'          ? 'Consolidated'          :
         topology === 'per_risk_family'       ? 'Per Risk Family'       :
         topology
}

function policyGroupTag(policy: NetskopePolicy): string {
  const k = policy.policy_key
  if (k === 'netskope:prohibited_access_block')  return 'Access Control'
  if (k === 'netskope:always_block_global_dlp')  return 'Global DLP'
  if (k.startsWith('netskope:scoped:'))          return 'Scoped'
  if (k === 'netskope:approved_supported')       return 'Category'
  if (k === 'netskope:approved_with_conditions') return 'Category'
  if (k.startsWith('netskope:custom:'))          return 'Custom Category'
  if (k === 'netskope:restricted_unassessed')    return 'Fallback'
  if (k.startsWith('manual:'))                   return 'Manual'
  return 'Policy'
}

// What the policy does and why it sits where it does — keyed off policy_key.
function policyPurpose(policy: NetskopePolicy): string {
  const k = policy.policy_key
  if (k === 'netskope:prohibited_access_block')
    return 'Blocks network access to apps your organisation has explicitly prohibited. As an access-control policy it sits at the very top of the stack so prohibited apps are stopped before any content inspection runs.'
  if (k === 'netskope:always_block_global_dlp')
    return 'Globally blocks the most sensitive data classes (credentials, keys, secrets) across every GenAI app regardless of approval status. Placed early so secrets can never leak — even to otherwise-approved tools.'
  if (k.startsWith('netskope:scoped:'))
    return 'A narrowly scoped policy targeting a specific user group, app instance, or destination. It runs ahead of the broad category policies so that the more specific rule wins when both could match.'
  if (k === 'netskope:approved_supported')
    return 'Applies DLP controls to apps your organisation has approved and fully supports. Enforcement here is typically the most permissive of the category policies because these apps are trusted for sanctioned use.'
  if (k === 'netskope:approved_with_conditions')
    return 'Applies stricter DLP controls to apps that are approved only under specific conditions. Sits below the fully-approved category so conditional apps inherit tighter handling.'
  if (k.startsWith('netskope:custom:'))
    return 'Enforces DLP controls for a custom governance category your organisation defined. Position reflects the category priority set in the Control Matrix.'
  if (k === 'netskope:restricted_unassessed')
    return 'Catch-all fallback for apps that are restricted or not yet assessed. It has the lowest priority so it only applies when no more specific policy matched first.'
  if (k.startsWith('manual:'))
    return 'A manually authored or AI-generated custom policy. It is placed in the stack according to the Netskope priority you set in the Policy Editor.'
  return 'Enforces DLP controls for the matched destination and data classes below.'
}

function sourceLabel(policy: NetskopePolicy): string {
  const { type, value } = policy.source
  if (type === 'all_users') return 'All Users'
  return value ? `${type.replace(/_/g, ' ')}: ${value}` : type.replace(/_/g, ' ')
}

function sourceLabelFull(policy: NetskopePolicy): string {
  let base = sourceLabel(policy)
  const ex = policy.source.exclusions
  if (ex && ex.length > 0) {
    base += `  (excluding ${ex.map(e => `${e.type.replace(/_/g, ' ')}: ${e.value}`).join('; ')})`
  }
  return base
}

function destLabel(policy: NetskopePolicy): string {
  const d = policy.destination
  if (d.strategy === 'app_category') {
    return d.cci_app_tag ? `${d.tag_or_category} / ${d.cci_app_tag}` : d.tag_or_category
  }
  return `${d.strategy.replace(/_/g, ' ')}: ${d.tag_or_category}`
}

function destLabelFull(policy: NetskopePolicy): string {
  const d = policy.destination
  if (d.strategy === 'app_category') {
    return d.cci_app_tag
      ? `Category "${d.tag_or_category}" constrained to CCI App Tag "${d.cci_app_tag}"`
      : `Category "${d.tag_or_category}"`
  }
  const label =
    d.strategy === 'app_instance'        ? 'App Instance'        :
    d.strategy === 'destination_profile' ? 'Destination Profile' :
    d.strategy === 'cloud_app'           ? 'Cloud App'           :
    d.strategy.replace(/_/g, ' ')
  return `${label} "${d.tag_or_category}"`
}

function activitiesLabel(policy: NetskopePolicy): string {
  if (policy.activities.length === 0) return 'All activities'
  return policy.activities.map(a => a.replace(/_/g, ' ')).join(', ')
}

function profilesLabel(policy: NetskopePolicy): string {
  if (policy.profiles.length === 0) return '—'
  const names = policy.profiles.map(p => p.profile)
  const visible = names.slice(0, 3).join(', ')
  return names.length > 3 ? `${visible} +${names.length - 3} more` : visible
}

function actionLabel(policy: NetskopePolicy): string {
  if (policy.profiles.length === 0) {
    return policy.policy_type === 'access_control' ? 'Block' : (policy.no_match_action ?? 'Allow')
  }
  const actions = [...new Set(policy.profiles.map(p => p.profile_action))]
  return actions.length === 1
    ? actions[0].charAt(0).toUpperCase() + actions[0].slice(1)
    : 'Mixed'
}

function cap(v: string): string { return v.charAt(0).toUpperCase() + v.slice(1) }

function noMatchExplanation(policy: NetskopePolicy): string {
  if (policy.no_match_action) {
    return `If none of the listed DLP profiles matches, the policy applies: ${cap(policy.no_match_action)}.`
  }
  if (policy.policy_key === 'netskope:always_block_global_dlp' || policy.policy_key.startsWith('netskope:scoped:')) {
    return 'No DLP profile match = no decision. Traffic passes through to the next policy in the stack. This is the correct Netskope default for this policy — no extra configuration needed.'
  }
  return 'No-match action is not configured. Decide the no-match behaviour (Allow / Alert / Block) for this policy in Netskope before deploying.'
}

function implementationNote(policy: NetskopePolicy): string {
  if (policy.policy_type === 'access_control') {
    return `Create a Real-time Protection policy. Set the destination to ${destLabelFull(policy)} and the action to Block. No DLP profile is required for this access-control policy.`
  }
  return `Create a Real-time Protection policy. Set the destination to ${destLabelFull(policy)}, then add the listed DLP profiles with their per-profile actions. ${noMatchExplanation(policy)}`
}

const REQUIRED_OBJECT_LABELS: Partial<Record<keyof RequiredObjects, string>> = {
  dlp_profiles:                  'DLP Profiles',
  classification_label_profiles: 'Classification Labels',
  filename_profiles:             'Filename Profiles',
  filetype_profiles:             'Filetype Profiles',
  notification_templates:        'Notification Templates',
  cci_app_tags:                  'CCI App Tags',
  app_categories:                'App Categories',
  app_instances:                 'App Instances',
  app_instance_tags:             'App Instance Tags',
  destination_profiles:          'Destination Profiles',
  cloud_apps:                    'Cloud Apps',
  user_groups:                   'User Groups',
  ad_groups:                     'AD Groups',
  users:                         'Users',
  organizational_units:          'Organizational Units',
  // policy_order intentionally excluded — covered by Policy Stack section
}

// ── PDF document ──────────────────────────────────────────────────────────────

export interface RecommendationPdfProps {
  policies:             NetskopePolicy[]
  required_objects:     RequiredObjects
  limitations:          LimitationEntry[]
  validation_checklist: ValidationItem[]
  why_selected:         string[]
  topology:             string
  confidence:           string
  score:                number
  generated_at:         string
}

export function RecommendationPdf({
  policies,
  required_objects,
  limitations,
  validation_checklist,
  why_selected,
  topology,
  confidence,
  score,
  generated_at,
}: RecommendationPdfProps) {
  const total       = policies.length
  const scopedCount = policies.filter(p => p.policy_key.startsWith('netskope:scoped:')).length
  const manualCount = policies.filter(p => p.policy_key.startsWith('manual:')).length
  const accessCount = policies.filter(p => p.policy_type === 'access_control').length
  const rtCount     = total - accessCount

  return (
    <Document title="Netskope DLP Policy Recommendation Pack">
      <Page size="A4" style={s.page}>

        {/* ── Cover / Header ──────────────────────────────────────────── */}
        <Text style={s.docTitle}>Netskope DLP Policy Recommendation Pack</Text>
        <Text style={s.docSubtitle}>
          GenAI Real-time Protection policy stack generated by DLP Shield
        </Text>
        <View style={s.metaGrid}>
          <View style={s.metaItem}><Text style={s.metaLabel}>Topology</Text><Text style={s.metaValue}>{topologyLabel(topology)}</Text></View>
          <View style={s.metaItem}><Text style={s.metaLabel}>Confidence</Text><Text style={s.metaValue}>{cap(confidence)}</Text></View>
          <View style={s.metaItem}><Text style={s.metaLabel}>Score</Text><Text style={s.metaValue}>{score} / 100</Text></View>
          <View style={s.metaItem}><Text style={s.metaLabel}>Generated</Text><Text style={s.metaValue}>{readableDate(generated_at)}</Text></View>
        </View>

        {/* ── About this document ─────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>About This Document</Text>
          <Text style={s.para}>
            This pack translates your organisation&apos;s GenAI governance configuration into a
            concrete set of Netskope Real-time Protection policies, ordered for top-to-bottom
            evaluation. Netskope applies the first policy whose source, destination, and content
            conditions match, so policy order is significant.
          </Text>
          <Text style={s.para}>
            Use it as a configuration reference alongside the Netskope console: each policy below
            states its purpose, its source and destination scope, the DLP profiles to attach, and
            the action to take. All configuration values are derived from your structured
            governance data — verify object names against your own Netskope tenant before enforcing.
          </Text>
        </View>

        {/* ── Executive summary ───────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Executive Summary</Text>
          <View style={s.statRow}>
            <View style={s.statCard}><Text style={s.statNum}>{total}</Text><Text style={s.statLabel}>Total Policies</Text></View>
            <View style={s.statCard}><Text style={s.statNum}>{rtCount}</Text><Text style={s.statLabel}>Real-time Protection</Text></View>
            <View style={s.statCard}><Text style={s.statNum}>{accessCount}</Text><Text style={s.statLabel}>Access Control</Text></View>
            <View style={s.statCard}><Text style={s.statNum}>{scopedCount}</Text><Text style={s.statLabel}>Scoped</Text></View>
            <View style={s.statCard}><Text style={s.statNum}>{manualCount}</Text><Text style={s.statLabel}>Manual / Custom</Text></View>
          </View>
          {why_selected.length > 0 && (
            <>
              <Text style={[s.sectionIntro, { marginBottom: 4 }]}>
                Why the {topologyLabel(topology)} topology was selected:
              </Text>
              {why_selected.map((reason, i) => (
                <View key={i} style={s.bulletRow}>
                  <Text style={s.bulletDot}>•</Text>
                  <Text style={s.bulletText}>{reason}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ── Section 1: Policy Stack overview ────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>1. Policy Stack — Deployment Order</Text>
          <Text style={s.sectionIntro}>
            Deploy in this order. Lower priority numbers are evaluated first.
          </Text>
          <View style={s.tableHeader}>
            <Text style={[s.th, s.colPrio]}>Priority</Text>
            <Text style={[s.th, s.colName]}>Policy Name</Text>
            <Text style={[s.th, s.colSrc]}>Source</Text>
            <Text style={[s.th, s.colDest]}>Destination</Text>
            <Text style={[s.th, s.colProf]}>Profiles</Text>
            <Text style={[s.th, s.colAct]}>Action</Text>
          </View>
          {policies.map((p, i) => (
            <View key={p.policy_key} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.td, s.colPrio]}>P{p.priority}</Text>
              <Text style={[s.td, s.colName]}>{p.name}</Text>
              <Text style={[s.td, s.colSrc]}>{sourceLabel(p)}</Text>
              <Text style={[s.td, s.colDest]}>{destLabel(p)}</Text>
              <Text style={[s.td, s.colProf]}>{profilesLabel(p)}</Text>
              <Text style={[s.td, s.colAct]}>{actionLabel(p)}</Text>
            </View>
          ))}
        </View>

        {/* ── Section 2: Detailed policy breakdown ────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>2. Detailed Policy Breakdown</Text>
          <Text style={s.sectionIntro}>
            Each policy below explains its purpose, scope, and how to configure it in Netskope.
          </Text>
          {policies.map((p) => (
            <View key={p.policy_key} style={s.policyBlock}>
              {/* Keep heading + purpose line together — never orphan just the title */}
              <View style={s.policyHead} wrap={false}>
                <Text style={s.policyPrio}>P{p.priority}</Text>
                <Text style={s.policyName}>{p.name}</Text>
                <Text style={s.policyTag}>{policyGroupTag(p)}</Text>
              </View>

              <Text style={s.purpose}>{policyPurpose(p)}</Text>

              <View style={s.kvRow}>
                <Text style={s.kvKey}>Policy Type</Text>
                <Text style={s.kvVal}>{p.policy_type === 'access_control' ? 'Access Control' : 'Real-time Protection'}</Text>
              </View>
              <View style={s.kvRow}>
                <Text style={s.kvKey}>Source</Text>
                <Text style={s.kvVal}>{sourceLabelFull(p)}</Text>
              </View>
              <View style={s.kvRow}>
                <Text style={s.kvKey}>Destination</Text>
                <Text style={s.kvVal}>{destLabelFull(p)}</Text>
              </View>
              <View style={s.kvRow}>
                <Text style={s.kvKey}>Activities</Text>
                <Text style={s.kvVal}>{activitiesLabel(p)}</Text>
              </View>

              {p.profiles.length > 0 ? (
                <>
                  <View style={s.kvRow}>
                    <Text style={s.kvKey}>DLP Profiles</Text>
                    <Text style={s.kvVal}>{p.profiles.length} profile{p.profiles.length === 1 ? '' : 's'} — action per profile below:</Text>
                  </View>
                  {p.profiles.map((prof, i) => (
                    <View key={i} style={s.profLine}>
                      <Text style={s.profName}>
                        {prof.profile}
                        {prof.coaching_template ? `  (coaching: ${prof.coaching_template})` : ''}
                      </Text>
                      <Text style={s.profAction}>{cap(prof.profile_action)}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <View style={s.kvRow}>
                  <Text style={s.kvKey}>DLP Profiles</Text>
                  <Text style={s.kvVal}>
                    {p.policy_type === 'access_control'
                      ? 'None — access blocked at app/category level.'
                      : 'None — action applies to all content matching the activities.'}
                  </Text>
                </View>
              )}

              <View style={s.noteBox}>
                <Text style={s.noteLabel}>How to implement in Netskope</Text>
                <Text style={s.noteText}>{implementationNote(p)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Section 3: Required Objects ─────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>3. Required Objects</Text>
          <Text style={s.sectionIntro}>
            Create or confirm these objects in Netskope before deploying the policies above.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {(Object.entries(REQUIRED_OBJECT_LABELS) as [keyof RequiredObjects, string][])
              .map(([key, label]) => {
                const items = required_objects[key] as string[] | undefined
                if (!items || items.length === 0) return null
                return (
                  <View key={key} style={s.objGroup}>
                    <Text style={s.objGroupLabel}>{label} ({items.length})</Text>
                    {items.map((item, i) => (
                      <View key={i} style={s.objItem}>
                        <Text style={s.bulletDot}>-</Text>
                        <Text style={{ flex: 1, fontSize: 8, color: '#374151' }}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )
              })
              .filter(Boolean)}
          </View>
        </View>

        {/* ── Section 4: Limitations ──────────────────────────────────── */}
        {limitations.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>4. Known Limitations &amp; Risk Acceptance</Text>
            <View style={s.tableHeader}>
              <Text style={[s.th, s.limArea]}>Area</Text>
              <Text style={[s.th, s.limLim]}>Limitation</Text>
              <Text style={[s.th, s.limImp]}>Practical Impact</Text>
              <Text style={[s.th, s.limRisk]}>Risk</Text>
            </View>
            {limitations.map((l, i) => (
              <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
                <Text style={[s.td, s.limArea]}>{l.area}</Text>
                <Text style={[s.td, s.limLim]}>{l.limitation}</Text>
                <Text style={[s.td, s.limImp]}>{l.practical_impact}</Text>
                <Text style={[s.td, s.limRisk]}>{l.risk_acceptance}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Section 5: Validation Checklist ─────────────────────────── */}
        {validation_checklist.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>5. Validation Checklist</Text>
            <Text style={s.sectionIntro}>
              Confirm each item before enforcement. Items marked [CRITICAL] must be resolved.
            </Text>
            {validation_checklist.map((item) => (
              <View key={item.id} style={s.checkItem} wrap={false}>
                <Text style={[s.checkBullet, { color: item.critical ? '#b91c1c' : '#6b7280' }]}>
                  {item.critical ? '[CRITICAL]' : '[ ]'}
                </Text>
                <Text style={s.checkText}>{item.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated by DLP Shield · {readableDate(generated_at)} · For internal use only</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
