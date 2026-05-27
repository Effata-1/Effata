import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { SetupWizard, type StepConfig } from './_components/setup-wizard'

export default async function GenAIControlsPage() {
  const user    = await requireRole('analyst')
  const supabase = await createClient()

  const [
    profileResult,
    classifiedAppsResult,
    inScopeDataResult,
    policyPackResult,
    chatResult,
    presentationResult,
  ] = await Promise.all([
    supabase
      .from('onboarding_profiles')
      .select('tools, genai_setup_flags')
      .eq('org_id', user.orgId)
      .maybeSingle(),

    supabase
      .from('genai_customer_classifications')
      .select('app_id', { count: 'exact', head: true })
      .eq('org_id', user.orgId)
      .neq('customer_classification', 'unknown'),

    supabase
      .from('org_data_types')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', user.orgId)
      .eq('is_in_scope', true),

    supabase
      .from('org_genai_policies')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', user.orgId)
      .eq('generated_from', 'policy-pack-agent'),

    supabase
      .from('genai_policy_chats')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', user.orgId),

    supabase
      .from('genai_presentations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', user.orgId),
  ])

  const profile    = profileResult.data
  const setupFlags = (profile?.genai_setup_flags as Record<string, boolean> | null) ?? {}
  const tools      = (profile?.tools as string[] | null) ?? []

  const steps: StepConfig[] = [
    {
      id:            'dlp-tools',
      title:         'Select your DLP tools',
      description:   'Tell Effata which DLP products your organisation uses so recommendations are tailored to your stack.',
      completed:     tools.length > 0,
      href:          '/dlp-tools/my-stack',
      customizeLabel: 'Go to My Stack',
    },
    {
      id:            'app-governance',
      title:         'Classify your GenAI apps',
      description:   'Categorise the GenAI apps in your environment — Approved, Conditional, Restricted, or Prohibited.',
      completed:     (classifiedAppsResult.count ?? 0) > 0,
      href:          '/genai-controls/app-governance',
      customizeLabel: 'Open App Governance',
      defaultLabel:  'Use Effata Defaults',
      defaultAction: 'app-governance',
    },
    {
      id:            'data-labels',
      title:         'Review data classification labels',
      description:   'Confirm the 5 standard classification levels (Secret → Public) or map your organisation\'s own labels.',
      completed:     setupFlags.labels_reviewed === true,
      href:          '/policies/classifications',
      customizeLabel: 'Customise Labels',
      defaultLabel:  'Accept Standard Labels',
      defaultAction: 'labels',
    },
    {
      id:            'data-catalog',
      title:         'Configure your data catalog',
      description:   'Select which data types are in scope for DLP. Effata defaults to Secret, Highly Confidential, and Confidential types.',
      completed:     (inScopeDataResult.count ?? 0) > 0,
      href:          '/policies/data-catalog',
      customizeLabel: 'Open Data Catalog',
      defaultLabel:  'Use Recommended Types',
      defaultAction: 'data-catalog',
    },
    {
      id:            'control-matrix',
      title:         'Review your control matrix',
      description:   'Review the recommended controls for each governance category and data classification level.',
      completed:     setupFlags.matrix_reviewed === true,
      href:          '/genai-controls/control-matrix',
      customizeLabel: 'Open Control Matrix',
      defaultLabel:  'Accept Recommendations',
      defaultAction: 'matrix',
    },
    {
      id:            'policy-pack',
      title:         'Generate AI policy recommendations',
      description:   'Claude reviews your tool stack, coverage gaps, and org profile to generate targeted draft policies.',
      completed:     (policyPackResult.count ?? 0) > 0,
      href:          '/genai-controls/policies',
      customizeLabel: 'Go to Policy Library',
    },
    {
      id:            'policy-chat',
      title:         'Refine policies with AI chat',
      description:   'Chat with Claude to adjust, improve, or add new policies based on your organisation\'s specific needs.',
      completed:     (chatResult.count ?? 0) > 0,
      href:          '/genai-controls/policies',
      customizeLabel: 'Open Policy Library',
      optional:      true,
    },
    {
      id:            'presentation',
      title:         'Create CISO presentation',
      description:   'Generate a shareable, print-ready policy pack for your security leadership and CISO.',
      completed:     (presentationResult.count ?? 0) > 0,
      href:          '/genai-controls/presentation',
      customizeLabel: 'Go to Presentation',
      optional:      true,
    },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">GenAI Controls Setup</h1>
        <p className="text-sm text-muted-foreground/70 mt-0.5">
          Follow these steps to configure your GenAI DLP posture and generate AI-powered policy recommendations.
        </p>
      </div>
      <SetupWizard steps={steps} />
    </div>
  )
}
