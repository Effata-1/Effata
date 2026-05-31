import { createClient } from '@/lib/supabase/server'
import { NotificationList } from './_components/notification-list'
import type { CoachingNotification, ControlType, CoachingTone } from '@/lib/genai/types'

// Exception request line is rendered separately by the UI — do NOT include it in message text.
type SeedTemplate = {
  template_key:        string
  name:                string
  description:         string
  control_type:        ControlType
  title:               string
  subtitle:            string
  message:             string
  show_exception_line: boolean
  show_details:        boolean
  recommended_for:     string[]
  is_default:          true
  action_code:         'coach' | 'coach-ack' | 'coach-just'
  tone:                CoachingTone
}

const SEED_DEFAULTS: SeedTemplate[] = [
  {
    template_key:        'sensitive_data_blocked',
    name:                'Sensitive Data Blocked',
    description:         'Blocks Secret, Restricted, or highly sensitive data from being shared with GenAI tools.',
    control_type:        'block',
    title:               'Sensitive Data Blocked',
    subtitle:            'This action was blocked to protect confidential business information.',
    message:             'Your attempt to use {{APP}} was blocked because the content matched {{DATA_TYPE}} or the classification label {{LABEL}}.\n\nThis type of data must not be shared with GenAI tools unless it is explicitly approved by your organization.',
    show_exception_line: true,
    show_details:        true,
    recommended_for:     ['Secret data', 'Restricted data', 'Highly sensitive content', 'Legal data', 'Business-critical data'],
    is_default:          true,
    action_code:         'coach',
    tone:                'urgent',
  },
  {
    template_key:        'highly_confidential_upload_blocked',
    name:                'Highly Confidential Upload Blocked',
    description:         'Blocks Highly Confidential file uploads to GenAI applications.',
    control_type:        'block',
    title:               'Highly Confidential Upload Blocked',
    subtitle:            'This file cannot be uploaded to this GenAI application.',
    message:             'The file {{FILENAME}} appears to contain Highly Confidential information.\n\nUploading this data to {{APP}} is not allowed under the current GenAI usage policy.\n\nUse an approved enterprise GenAI tool or contact your security team if this upload is required for business purposes.',
    show_exception_line: true,
    show_details:        true,
    recommended_for:     ['Highly Confidential upload', 'Restricted GenAI', 'Prohibited GenAI', 'Sensitive file upload'],
    is_default:          true,
    action_code:         'coach',
    tone:                'urgent',
  },
  {
    template_key:        'confidential_data_detected',
    name:                'Confidential Data Detected',
    description:         'Coaching notice for Confidential content in Approved GenAI tools — user can stop or proceed.',
    control_type:        'coach_acknowledge',
    title:               'Confidential Data Detected',
    subtitle:            'Please confirm this information is allowed for GenAI use.',
    message:             'This action may include Confidential information detected through {{DETECTION_SOURCE}}.\n\nBefore proceeding, make sure the data is approved for use in {{APP}} and does not include customer data, secrets, credentials, personal data, or business-critical information.',
    show_exception_line: true,
    show_details:        true,
    recommended_for:     ['Confidential content in Approved GenAI', 'Approved with Conditions', 'Medium-risk GenAI usage'],
    is_default:          true,
    action_code:         'coach-ack',
    tone:                'warning',
  },
  {
    template_key:        'business_justification_required',
    name:                'Business Justification Required',
    description:         'Requires the user to provide a business reason before proceeding with a Confidential action.',
    control_type:        'coach_justification',
    title:               'Business Justification Required',
    subtitle:            'Please explain why this GenAI action is needed.',
    message:             'Your action involves Confidential information and requires a business justification before proceeding.\n\nOnly continue if this use is work-related, approved, and necessary.\n\nYour justification and activity details will be logged for review.',
    show_exception_line: true,
    show_details:        true,
    recommended_for:     ['Confidential data requiring justification', 'Regulated data', 'Approved with Conditions GenAI', 'Medium-risk activity'],
    is_default:          true,
    action_code:         'coach-just',
    tone:                'warning',
  },
  {
    template_key:        'genai_usage_reminder',
    name:                'GenAI Usage Reminder',
    description:         'Baseline acceptable use reminder for public or internal data in GenAI tools.',
    control_type:        'coach_acknowledge',
    title:               'GenAI Usage Reminder',
    subtitle:            'Use GenAI responsibly and avoid sharing sensitive information.',
    message:             'You are using {{APP}} for {{ACTIVITY}}.\n\nBefore proceeding, confirm that the content does not include confidential data, personal data, credentials, source code, customer information, or business-sensitive material.',
    show_exception_line: false,
    show_details:        false,
    recommended_for:     ['Public data', 'Internal data', 'Baseline GenAI reminder', 'Early rollout phase'],
    is_default:          true,
    action_code:         'coach-ack',
    tone:                'informational',
  },
  {
    template_key:        'sensitive_filename_detected',
    name:                'Sensitive File Name Detected',
    description:         'Triggered when a filename matches a sensitive document pattern (salary, contract, NDA, etc.).',
    control_type:        'coach_acknowledge',
    title:               'Sensitive File Name Detected',
    subtitle:            'The file name suggests this document may contain sensitive data.',
    message:             'The file {{FILENAME}} appears to match a sensitive document pattern.\n\nEven if the content is not fully classified, documents with this type of file name may contain confidential, legal, financial, HR, customer, or business-critical information.\n\nPlease confirm this file is approved for use with {{APP}} before proceeding.',
    show_exception_line: true,
    show_details:        true,
    recommended_for:     ['Filename-based detection', 'Salary files', 'Contract files', 'NDA files', 'Legal or finance documents'],
    is_default:          true,
    action_code:         'coach-ack',
    tone:                'warning',
  },
  {
    template_key:        'classified_data_detected',
    name:                'Classified Data Detected',
    description:         'Triggered when enterprise classification labels (Purview / MIP / custom) are detected.',
    control_type:        'coach_acknowledge',
    title:               'Classified Data Detected',
    subtitle:            'This action matched an enterprise data classification label.',
    message:             'The file or content is classified as {{LABEL}}.\n\nYour organization applies specific controls to this classification level when using GenAI tools.\n\nPlease follow the approved handling rules before sharing this information with {{APP}}.',
    show_exception_line: true,
    show_details:        true,
    recommended_for:     ['Classification label match', 'Purview / MIP labels', 'Enterprise DLP label controls'],
    is_default:          true,
    action_code:         'coach-ack',
    tone:                'warning',
  },
  {
    template_key:        'credential_sharing_blocked',
    name:                'Credential Sharing Blocked',
    description:         'Blocks API keys, tokens, passwords, certificates, private keys, and SSH keys.',
    control_type:        'block',
    title:               'Credential Sharing Blocked',
    subtitle:            'Secrets and access credentials must not be shared with GenAI tools.',
    message:             'This action was blocked because the content appears to contain credentials, secrets, tokens, certificates, or access keys.\n\nSharing credentials with GenAI tools can expose systems, accounts, source code, and production environments to risk.',
    show_exception_line: true,
    show_details:        true,
    recommended_for:     ['API keys', 'Passwords', 'Tokens', 'Certificates', 'Private keys', 'SSH keys', '.env files'],
    is_default:          true,
    action_code:         'coach',
    tone:                'urgent',
  },
  {
    template_key:        'regulated_data_detected',
    name:                'Regulated Data Detected',
    description:         'Coaching notice for PII, PCI, PHI, national ID, and other regulated data types.',
    control_type:        'coach_justification',
    title:               'Regulated Data Detected',
    subtitle:            'This content may include personal, financial, or regulated information.',
    message:             'This action matched {{DATA_TYPE}}, which may be subject to privacy, regulatory, or contractual protection requirements.\n\nOnly proceed if this data is approved for use in {{APP}}, properly anonymized, and necessary for a valid business purpose.\n\nYour action may be logged for security and compliance review.',
    show_exception_line: true,
    show_details:        true,
    recommended_for:     ['PII', 'PCI', 'PHI', 'National ID', 'Customer records', 'Employee records'],
    is_default:          true,
    action_code:         'coach-just',
    tone:                'warning',
  },
  {
    template_key:        'source_code_ip_detected',
    name:                'Source Code or Intellectual Property Detected',
    description:         'Coaching notice for source code, product logic, architecture files, and proprietary content.',
    control_type:        'coach_acknowledge',
    title:               'Source Code or Intellectual Property Detected',
    subtitle:            'Please verify this content is approved for GenAI use.',
    message:             'This action may include source code, product logic, design information, or intellectual property.\n\nBefore proceeding, confirm that sharing this content with {{APP}} is approved and does not expose proprietary business information.',
    show_exception_line: true,
    show_details:        true,
    recommended_for:     ['Source code', 'Product logic', 'Architecture files', 'Patents', 'Algorithms', 'Technical documentation'],
    is_default:          true,
    action_code:         'coach-ack',
    tone:                'warning',
  },
  {
    template_key:        'genai_application_blocked',
    name:                'GenAI Application Blocked',
    description:         'Blocks access to prohibited or unapproved GenAI applications.',
    control_type:        'block',
    title:               'GenAI Application Blocked',
    subtitle:            'This application is not approved for organizational use.',
    message:             'Access to {{APP}} is blocked because it falls under the {{CATEGORY}} category.\n\nUse an approved GenAI application provided by your organization.\n\nIf you believe this app is required for business use, contact {{SUPPORT_CONTACT}}.',
    show_exception_line: true,
    show_details:        false,
    recommended_for:     ['Prohibited GenAI', 'High-risk GenAI tools', 'Apps not allowed for corporate use'],
    is_default:          true,
    action_code:         'coach',
    tone:                'urgent',
  },
  {
    template_key:        'unapproved_genai_access_blocked',
    name:                'Unapproved GenAI Access Blocked',
    description:         'Blocks personal or consumer GenAI sessions not using an enterprise account.',
    control_type:        'block',
    title:               'Unapproved GenAI Access Blocked',
    subtitle:            'Use your approved enterprise GenAI account.',
    message:             'Access to this GenAI service was blocked because the session does not appear to be an approved enterprise or authenticated workspace session.\n\nPlease sign in using your organization-approved account or use the approved enterprise GenAI application.',
    show_exception_line: true,
    show_details:        false,
    recommended_for:     ['Personal GenAI account', 'Consumer login', 'Non-enterprise session', 'Personal Copilot access'],
    is_default:          true,
    action_code:         'coach',
    tone:                'urgent',
  },
  {
    template_key:        'bulk_data_sharing_detected',
    name:                'Bulk Data Sharing Detected',
    description:         'Coaching notice for large file uploads, datasets, CSV exports, or bulk records.',
    control_type:        'coach_justification',
    title:               'Bulk Data Sharing Detected',
    subtitle:            'Large data uploads require additional care.',
    message:             'This action may involve a large volume of data or structured records.\n\nBulk data uploads to GenAI tools can expose sensitive business, customer, employee, or regulated information at scale.\n\nProceed only if the dataset is approved, minimized, and safe for GenAI use.',
    show_exception_line: true,
    show_details:        true,
    recommended_for:     ['Large file uploads', 'Bulk records', 'CSV files', 'Database exports', 'Mass customer data'],
    is_default:          true,
    action_code:         'coach-just',
    tone:                'warning',
  },
  {
    template_key:        'approved_genai_usage',
    name:                'Approved GenAI Usage',
    description:         'Low-friction coaching reminder for approved enterprise GenAI applications.',
    control_type:        'coach_acknowledge',
    title:               'Approved GenAI Usage',
    subtitle:            'This app is approved, but sensitive data handling rules still apply.',
    message:             '{{APP}} is an Approved & Supported GenAI application.\n\nYou may proceed only if the content is allowed under your organization\'s data handling policy.\n\nDo not include secrets, credentials, restricted data, or information that is not approved for this GenAI use case.',
    show_exception_line: false,
    show_details:        false,
    recommended_for:     ['Approved & Supported GenAI', 'Enterprise GenAI apps', 'General acceptable use reminder'],
    is_default:          true,
    action_code:         'coach-ack',
    tone:                'informational',
  },
  {
    template_key:        'approved_with_conditions',
    name:                'Approved with Conditions',
    description:         'Coaching for GenAI apps that are allowed only under specific usage restrictions.',
    control_type:        'coach_acknowledge',
    title:               'Approved with Conditions',
    subtitle:            'This GenAI application has usage restrictions.',
    message:             '{{APP}} is allowed only under specific conditions.\n\nDo not upload or enter sensitive, regulated, confidential, customer, employee, credential, or source code information unless your organization has explicitly approved this use case.',
    show_exception_line: true,
    show_details:        false,
    recommended_for:     ['Approved with Conditions GenAI', 'Apps with upload restrictions', 'Apps allowing only public or internal data'],
    is_default:          true,
    action_code:         'coach-ack',
    tone:                'warning',
  },
  {
    template_key:        'restricted_unassessed_genai',
    name:                'Restricted or Unassessed GenAI',
    description:         'Warning for shadow AI tools or apps not yet reviewed by security.',
    control_type:        'coach_acknowledge',
    title:               'Restricted or Unassessed GenAI',
    subtitle:            'This GenAI application has not been fully reviewed for business use.',
    message:             '{{APP}} is categorized as {{CATEGORY}}.\n\nThis means the application may not have been reviewed for data protection, privacy, compliance, retention, or enterprise security controls.\n\nDo not share confidential, regulated, customer, employee, credential, source code, or business-sensitive information with this application.',
    show_exception_line: true,
    show_details:        false,
    recommended_for:     ['Restricted / Unassessed GenAI', 'Shadow AI tools', 'New AI tools pending approval'],
    is_default:          true,
    action_code:         'coach-ack',
    tone:                'warning',
  },
  {
    template_key:        'prohibited_genai_activity_blocked',
    name:                'Prohibited GenAI Activity Blocked',
    description:         'Blocks any upload or data sharing with Prohibited GenAI applications.',
    control_type:        'block',
    title:               'Prohibited GenAI Activity Blocked',
    subtitle:            'This GenAI activity is not allowed by your organization.',
    message:             'This action was blocked because {{APP}} is categorized as {{CATEGORY}}.\n\nYour organization does not allow this GenAI activity due to security, privacy, compliance, or business risk.\n\nUse an approved GenAI application or contact {{SUPPORT_CONTACT}} for guidance.',
    show_exception_line: true,
    show_details:        false,
    recommended_for:     ['Prohibited GenAI upload', 'Sensitive data in prohibited app', 'Full app restriction'],
    is_default:          true,
    action_code:         'coach',
    tone:                'urgent',
  },
  {
    template_key:        'custom_template',
    name:                'Custom GenAI Coaching Message',
    description:         'Starter template for customer-specific use cases, legal wording, or region-specific compliance.',
    control_type:        'coach_acknowledge',
    title:               'Custom GenAI Coaching Message',
    subtitle:            'This message can be customized by the administrator.',
    message:             'This is a custom coaching message. Edit this template to match your organization\'s tone, policy references, and required tokens.\n\nAvailable tokens: {{APP}}, {{CATEGORY}}, {{ACTIVITY}}, {{POLICY_NAME}}, {{DATA_TYPE}}, {{LABEL}}, {{FILENAME}}.',
    show_exception_line: true,
    show_details:        true,
    recommended_for:     ['Customer-specific use case', 'Legal wording', 'HR-approved message', 'Region-specific compliance'],
    is_default:          true,
    action_code:         'coach-ack',
    tone:                'informational',
  },
]

function extractTokens(...inputs: (string | null | undefined)[]): string[] {
  const combined = inputs.filter(Boolean).join(' ')
  const matches = combined.match(/\{\{[A-Z_]+\}\}/g) ?? []
  return Array.from(new Set(matches))
}

async function ensureDefaultTemplates(orgId: string) {
  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('org_coaching_notifications')
      .select('template_key')
      .eq('org_id', orgId)
      .not('template_key', 'is', null)

    const existingKeys = new Set((existing ?? []).map((r: { template_key: string | null }) => r.template_key))
    const missing = SEED_DEFAULTS.filter(t => !existingKeys.has(t.template_key))

    if (missing.length === 0) return

    // Insert directly via supabase client — do NOT go through upsertNotification (which
    // calls requireRole) so that seeding works regardless of the viewer's role.
    const rows = missing.map(t => ({
      org_id:              orgId,
      template_key:        t.template_key,
      name:                t.name,
      description:         t.description,
      control_type:        t.control_type,
      title:               t.title,
      subtitle:            t.subtitle,
      message:             t.message,
      show_exception_line: t.show_exception_line,
      show_details:        t.show_details,
      recommended_for:     t.recommended_for,
      tokens_used:         extractTokens(t.title, t.subtitle, t.message),
      action_code:         t.action_code,
      tone:                t.tone,
      is_default:          true,
      is_active:           true,
      updated_at:          new Date().toISOString(),
    }))

    await supabase.from('org_coaching_notifications').insert(rows)
  } catch {
    // Table may not exist yet — migration pending
  }
}

export default async function CoachingNotificationsPage() {
  const supabase = await createClient()

  const sessionResult = await supabase.auth.getSession()
  const orgId: string | null = sessionResult.data.session?.access_token
    ? (JSON.parse(atob(sessionResult.data.session.access_token.split('.')[1]))?.org_id ?? null)
    : null

  if (orgId) {
    await ensureDefaultTemplates(orgId)
  }

  let notifications: CoachingNotification[] = []

  try {
    const result = orgId
      ? await supabase
          .from('org_coaching_notifications')
          .select('*')
          .eq('org_id', orgId)
          .order('is_default', { ascending: false })
          .order('created_at')
      : { data: [] as CoachingNotification[] }
    notifications = (result.data ?? []) as CoachingNotification[]
  } catch {
    // Table may not exist yet — migration pending
  }

  const activeCount = notifications.filter(n => n.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Coaching Message Templates</h1>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Messages shown to users when a DLP policy triggers a coaching, block, or notification action.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-foreground">{notifications.length}</p>
          <p className="text-xs text-muted-foreground/60">{activeCount} active</p>
        </div>
      </div>

      <NotificationList notifications={notifications} />
    </div>
  )
}
