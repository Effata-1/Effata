export interface DlpControl {
  key: string
  label: string
  description: string
  channel: string
  gdpr_articles: string[]    // article IDs that this control addresses
  hipaa_sections: string[]
  pci_requirements: string[]
  universal: boolean         // true = relevant to most/all regulations
}

export const DLP_CONTROLS: DlpControl[] = [
  {
    key: 'data_classification',
    label: 'Data Classification Policy',
    description: 'Identifying, labelling, and categorising data assets by sensitivity level — the foundation all other DLP controls depend on.',
    channel: 'Foundation',
    gdpr_articles: ['Art. 5(1)(f)', 'Art. 25', 'Art. 32'],
    hipaa_sections: ['§164.308(a)(1)', '§164.312(c)(1)'],
    pci_requirements: ['Req 3', 'Req 7'],
    universal: true,
  },
  {
    key: 'dlp_web',
    label: 'Web Channel DLP',
    description: 'Preventing exfiltration via browser uploads, web forms, paste sites, and personal file-sharing services.',
    channel: 'Web',
    gdpr_articles: ['Art. 5(1)(f)', 'Art. 32'],
    hipaa_sections: ['§164.312(e)(1)'],
    pci_requirements: ['Req 4'],
    universal: true,
  },
  {
    key: 'dlp_email',
    label: 'Email DLP',
    description: 'Blocking or alerting on sensitive data sent via email — including attachments, body content, and auto-forwarding rules.',
    channel: 'Email',
    gdpr_articles: ['Art. 32', 'Art. 33'],
    hipaa_sections: ['§164.312(e)(1)'],
    pci_requirements: ['Req 4'],
    universal: true,
  },
  {
    key: 'dlp_endpoint',
    label: 'Endpoint Controls',
    description: 'Controlling data movement on endpoints — USB/removable media, printing, local clipboard, and screen capture.',
    channel: 'Endpoint',
    gdpr_articles: ['Art. 32'],
    hipaa_sections: ['§164.312(a)(1)', '§164.312(c)(1)'],
    pci_requirements: ['Req 3', 'Req 7'],
    universal: false,
  },
  {
    key: 'dlp_saas',
    label: 'SaaS & Cloud App Controls',
    description: 'Preventing sensitive data from being uploaded to or shared via cloud applications (SharePoint, Google Drive, Slack, Salesforce, etc.).',
    channel: 'SaaS',
    gdpr_articles: ['Art. 25', 'Art. 32'],
    hipaa_sections: ['§164.312(a)(1)'],
    pci_requirements: ['Req 7'],
    universal: true,
  },
  {
    key: 'genai_controls',
    label: 'GenAI App Controls',
    description: 'Blocking or monitoring submission of sensitive or regulated data to AI/LLM tools (ChatGPT, Gemini, Copilot, etc.).',
    channel: 'GenAI',
    gdpr_articles: ['Art. 5(1)(f)', 'Art. 32'],
    hipaa_sections: ['§164.312(e)(1)'],
    pci_requirements: [],
    universal: true,
  },
  {
    key: 'audit_logging',
    label: 'Audit Logging & Monitoring',
    description: 'Maintaining comprehensive logs of who accessed, moved, or transmitted regulated data — required for breach investigation and regulatory evidence.',
    channel: 'Foundation',
    gdpr_articles: ['Art. 33'],
    hipaa_sections: ['§164.312(b)'],
    pci_requirements: ['Req 10'],
    universal: true,
  },
  {
    key: 'breach_detection',
    label: 'Breach Detection & Response',
    description: 'Identifying data exfiltration events and triggering incident response — enables meeting breach notification timelines across all regulations.',
    channel: 'Foundation',
    gdpr_articles: ['Art. 33', 'Art. 34'],
    hipaa_sections: ['§164.308(a)(1)'],
    pci_requirements: ['Req 10'],
    universal: true,
  },
  {
    key: 'encryption_transit',
    label: 'Encryption in Transit',
    description: 'Ensuring all regulated data is encrypted when transmitted over networks — enforced via DLP policies that block unencrypted transmission.',
    channel: 'Network',
    gdpr_articles: ['Art. 32'],
    hipaa_sections: ['§164.312(e)(1)'],
    pci_requirements: ['Req 4'],
    universal: true,
  },
  {
    key: 'access_controls',
    label: 'Access Controls & Authentication',
    description: 'Enforcing least-privilege access to regulated data — MFA, role-based access, and DLP policies that restrict data movement to authorised users.',
    channel: 'Foundation',
    gdpr_articles: ['Art. 25', 'Art. 32'],
    hipaa_sections: ['§164.312(a)(1)', '§164.312(d)'],
    pci_requirements: ['Req 7'],
    universal: true,
  },
]

export const CONTROL_STATUS_OPTIONS = [
  { value: 'not_assessed', label: 'Not Assessed',      color: 'text-zinc-400', bg: 'bg-zinc-800/60' },
  { value: 'implemented',  label: 'Implemented',       color: 'text-green-400', bg: 'bg-green-500/10' },
  { value: 'partial',      label: 'Partial',            color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { value: 'not_implemented', label: 'Not Implemented', color: 'text-red-400',   bg: 'bg-red-500/10' },
] as const

export type ControlStatus = 'not_assessed' | 'implemented' | 'partial' | 'not_implemented'

// Fine exposure weights per control (for gap report risk calculation)
export const CONTROL_GDPR_FINE_WEIGHT: Record<string, number> = {
  data_classification: 0.10,
  dlp_web:            0.15,
  dlp_email:          0.15,
  dlp_endpoint:       0.10,
  dlp_saas:           0.10,
  genai_controls:     0.10,
  audit_logging:      0.10,
  breach_detection:   0.10,
  encryption_transit: 0.05,
  access_controls:    0.05,
}
