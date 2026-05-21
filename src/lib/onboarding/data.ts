// All static data for the 5-step onboarding wizard

export interface Industry {
  id: string
  label: string
  description: string
}

export interface Region {
  id: string
  label: string
  description: string
}

export interface Module {
  id: string
  label: string
  description: string
  pricingTier?:   string
  keyFeatures?:   string[]
  prerequisites?: string[]
  officialUrl?:   string
}

export type ChannelCoverageLevel = 'full' | 'partial' | 'addon' | 'none'

export interface DlpToolChannelCoverage {
  email:         ChannelCoverageLevel
  web:           ChannelCoverageLevel
  'saas-inline': ChannelCoverageLevel
  'saas-api':    ChannelCoverageLevel
  endpoint:      ChannelCoverageLevel
  genai:         ChannelCoverageLevel
  network:       ChannelCoverageLevel
}

export interface ToolDocLink {
  type: 'product' | 'docs' | 'release-notes' | 'licensing' | 'support' | 'contact'
  label: string
  url: string
}

export interface DLPTool {
  id: string
  label: string
  description: string
  modules: Module[]
  category?: string[]
  channelCoverage?: DlpToolChannelCoverage
  toolLinks?: ToolDocLink[]
}

export interface CoverageArea {
  id: string
  label: string
  description: string
}

export interface CoverageState {
  id: string
  label: string
  color: string
}

export interface DataCategory {
  id: string
  label: string
  description: string
}

// ============================================================
// Q1.1 — Industries
// ============================================================
export const INDUSTRIES: Industry[] = [
  { id: 'financial-services', label: 'Financial Services', description: 'PCI, customer data, financial records, fraud, audit evidence, payment data.' },
  { id: 'banking', label: 'Banking', description: 'Customer records, transaction data, payment data, regulatory evidence, fraud investigations.' },
  { id: 'insurance', label: 'Insurance', description: 'Customer PII, policyholder data, claims data, financial records, health data.' },
  { id: 'healthcare', label: 'Healthcare', description: 'PHI, patient records, medical reports, insurance data, clinical documents.' },
  { id: 'life-sciences', label: 'Life Sciences / Pharma', description: 'Research data, clinical trial data, formulas, IP, regulatory submissions.' },
  { id: 'technology-saas', label: 'Technology / SaaS', description: 'Source code, customer data, secrets, product roadmaps, cloud data, AI usage.' },
  { id: 'software-engineering', label: 'Software / Product Engineering', description: 'Source code, repositories, build artifacts, secrets, infrastructure-as-code.' },
  { id: 'retail-ecommerce', label: 'Retail / E-commerce', description: 'Customer PII, PCI, order data, loyalty data, payment flows, marketing data.' },
  { id: 'manufacturing', label: 'Manufacturing', description: 'IP, designs, supplier data, contracts, production data, trade secrets.' },
  { id: 'automotive', label: 'Automotive', description: 'Design files, engineering data, supplier data, manufacturing IP, connected vehicle data.' },
  { id: 'energy-utilities', label: 'Energy / Utilities', description: 'Operational data, critical infrastructure, engineering data, customer data, safety records.' },
  { id: 'telecom', label: 'Telecom', description: 'Subscriber data, call records, network data, customer data, infrastructure information.' },
  { id: 'legal', label: 'Legal', description: 'Legal privilege, case files, contracts, litigation material, client data, evidence.' },
  { id: 'government', label: 'Government / Public Sector', description: 'Citizen data, restricted information, public records, investigations, regulatory mandates.' },
  { id: 'education', label: 'Education', description: 'Student records, research data, HR data, financial aid data, academic records.' },
  { id: 'media-entertainment', label: 'Media / Entertainment', description: 'IP, unreleased content, contracts, talent data, digital assets.' },
  { id: 'professional-services', label: 'Professional Services / Consulting', description: 'Client data, proposals, contracts, deliverables, credentials, confidential project materials.' },
  { id: 'logistics-transport', label: 'Logistics / Transportation', description: 'Customer data, shipment data, route data, supplier data, operational records, trade documents.' },
  { id: 'hospitality-travel', label: 'Hospitality / Travel', description: 'Guest data, payment data, booking data, loyalty data, travel records.' },
  { id: 'non-profit', label: 'Non-Profit / NGO', description: 'Donor data, beneficiary data, financial records, program data, sensitive field data.' },
  { id: 'other', label: 'Other / Custom', description: 'Define your own industry context.' },
]

// ============================================================
// Q1.2 — Regions
// ============================================================
export const REGIONS: Region[] = [
  { id: 'european-union', label: 'European Union', description: 'Activates GDPR and EU privacy context.' },
  { id: 'united-kingdom', label: 'United Kingdom', description: 'Activates UK GDPR and UK Data Protection Act context.' },
  { id: 'united-states', label: 'United States', description: 'Activates US privacy, sectoral, state privacy, healthcare, and financial compliance context.' },
  { id: 'canada', label: 'Canada', description: 'Activates Canadian privacy and data protection context.' },
  { id: 'india', label: 'India', description: 'Activates India DPDP and local privacy/data protection context.' },
  { id: 'middle-east', label: 'Middle East', description: 'Activates regional privacy, government, financial, and sector-specific data requirements.' },
  { id: 'saudi-arabia', label: 'Saudi Arabia', description: 'Activates Saudi PDPL and local regulatory context.' },
  { id: 'uae', label: 'United Arab Emirates', description: 'Activates UAE privacy and sector-specific compliance context.' },
  { id: 'singapore', label: 'Singapore', description: 'Activates PDPA and APAC privacy context.' },
  { id: 'australia', label: 'Australia', description: 'Activates Australian Privacy Act and APAC data protection context.' },
  { id: 'japan', label: 'Japan', description: 'Activates APPI and regional privacy context.' },
  { id: 'south-korea', label: 'South Korea', description: 'Activates PIPA and local privacy context.' },
  { id: 'china', label: 'China', description: 'Activates PIPL, data localization, and cross-border transfer context.' },
  { id: 'apac', label: 'APAC (Broader)', description: 'Activates broader Asia-Pacific privacy and regulatory context.' },
  { id: 'latin-america', label: 'Latin America', description: 'Activates LGPD and regional privacy context where applicable.' },
  { id: 'brazil', label: 'Brazil', description: 'Activates LGPD context.' },
  { id: 'africa', label: 'Africa', description: 'Activates regional and country-specific privacy context where applicable.' },
  { id: 'south-africa', label: 'South Africa', description: 'Activates POPIA context.' },
  { id: 'global', label: 'Global / Multiple', description: 'Activates multi-region compliance and cross-border data movement context.' },
  { id: 'other-region', label: 'Other / Custom', description: 'Define your own region or jurisdiction.' },
]

// ============================================================
// Generic capability modules (used by tools without specific tiles)
// ============================================================
const GENERIC_MODULES: Module[] = [
  {
    id: 'generic-email-dlp', label: 'Email DLP',
    description: 'Email body, attachment, forwarding, and outbound email controls.',
    keyFeatures: ['Outbound email content inspection and policy enforcement', 'Block, redirect, quarantine, or encrypt actions on outbound messages'],
  },
  {
    id: 'generic-web-dlp', label: 'Web DLP',
    description: 'Browser upload, web post, file transfer, and public web controls.',
    keyFeatures: ['Browser upload and web form DLP controls', 'HTTP/HTTPS traffic inspection and enforcement'],
  },
  {
    id: 'generic-endpoint-dlp', label: 'Endpoint DLP',
    description: 'Local endpoint file activity and endpoint data controls.',
    keyFeatures: ['File activity monitoring on Windows and macOS endpoints', 'Application-level controls for copy, paste, save, and upload actions'],
  },
  {
    id: 'generic-removable-media', label: 'Removable Media / Device Control',
    description: 'USB, external drive, removable media, and peripheral controls.',
    keyFeatures: ['USB and external media allow/block/encrypt rules', 'Device class policies covering storage, printers, and Bluetooth'],
  },
  {
    id: 'generic-printing-dlp', label: 'Printing DLP',
    description: 'Printing and print-to-PDF controls where available.',
    keyFeatures: ['Print job monitoring and blocking based on content sensitivity', 'Print-to-PDF interception and watermarking where supported'],
  },
  {
    id: 'generic-saas-casb-inline', label: 'SaaS / CASB Inline',
    description: 'Inline SaaS and cloud app traffic controls.',
    keyFeatures: ['Inline SaaS traffic inspection for uploads, downloads, and shares', 'App-level allow/block/coach actions across cloud applications'],
  },
  {
    id: 'generic-saas-api-rest', label: 'SaaS API / At-Rest Scanning',
    description: 'API-based SaaS scanning and remediation.',
    keyFeatures: ['Out-of-band API scanning of stored data in SaaS repositories', 'Retroactive remediation — quarantine, delete sharing, or notify owner'],
  },
  {
    id: 'generic-cloud-storage', label: 'Cloud Storage / Object Storage DLP',
    description: 'Cloud storage discovery, bucket scanning, and object storage protection.',
    keyFeatures: ['Bucket and object storage scanning for sensitive data exposure', 'Public access remediation and misconfiguration detection'],
  },
  {
    id: 'generic-genai-dlp', label: 'GenAI / AI Application DLP',
    description: 'AI prompt, upload, app, assistant, and connector controls.',
    keyFeatures: ['AI application visibility and prompt content inspection', 'Block or coach on sensitive data submitted to AI tools'],
  },
  {
    id: 'generic-network-dlp', label: 'Network DLP',
    description: 'Network data-in-motion monitoring and enforcement.',
    keyFeatures: ['Network traffic monitoring via ICAP or inline proxy integration', 'Data-in-motion enforcement across HTTP/S, FTP, SMTP, and other protocols'],
  },
  {
    id: 'generic-data-discovery', label: 'Data Discovery / Storage DLP',
    description: 'File share, endpoint storage, repository, and archive discovery.',
    keyFeatures: ['Automated discovery of sensitive data across file shares and repositories', 'Classification inventory and remediation workflow for discovered data'],
  },
  {
    id: 'generic-classification', label: 'Classification / Labeling',
    description: 'Data classification, labels, and protection integration.',
    keyFeatures: ['Sensitivity label assignment and visual classification markings', 'Integration with DLP policy engine for label-based enforcement'],
  },
  {
    id: 'generic-analytics', label: 'Analytics / Reporting',
    description: 'Dashboards, reporting, and incident analytics.',
    keyFeatures: ['Incident trend dashboards and risk scoring visualisation', 'Scheduled reports and SIEM/SOAR export capability'],
  },
  {
    id: 'generic-insider-risk', label: 'Insider Risk / UEBA',
    description: 'User risk, behavioral analytics, and insider risk capabilities.',
    keyFeatures: ['User behaviour analytics and risk scoring based on activity patterns', 'Risk-adaptive policy tightening for flagged or departing employees'],
  },
  {
    id: 'generic-other', label: 'Other / Custom Capability',
    description: 'Customer-defined capability.',
    keyFeatures: ['Vendor-defined capability — consult official documentation for details'],
  },
]

// ============================================================
// Q2 — DLP Tools with their modules
// ============================================================
export const DLP_TOOLS: DLPTool[] = [
  {
    id: 'netskope',
    label: 'Netskope',
    description: 'Cloud-native SSE platform with best-in-class CASB inline and GenAI security controls.',
    category: ['CASB', 'SWG', 'ZTNA'],
    channelCoverage: { email: 'partial', web: 'full', 'saas-inline': 'full', 'saas-api': 'full', endpoint: 'partial', genai: 'full', network: 'full' },
    modules: [
      {
        id: 'sse-web-casb', label: 'SSE / Web & CASB Inline',
        description: 'Inline web, cloud, and SaaS traffic inspection and policy enforcement.',
        pricingTier: 'Core platform licence',
        keyFeatures: [
          'Inline web and SaaS traffic inspection with full SSL/TLS decryption',
          'Real-time DLP policy enforcement across 50,000+ cloud apps',
          'Threat protection, URL filtering, and app risk scoring',
          'Traffic steering for ZTNA and private app access',
        ],
        officialUrl: 'https://docs.netskope.com',
      },
      {
        id: 'cloud-firewall-network', label: 'Cloud Firewall / Network Security',
        description: 'Network/security inspection depending on Netskope deployment.',
        pricingTier: 'Included in SSE platform',
        keyFeatures: [
          'Layer 4–7 network traffic steering and firewall-as-a-service',
          'Non-HTTP/S protocol coverage including SSH, FTP, and custom ports',
          'DNS security and egress traffic filtering',
        ],
        prerequisites: ['Netskope SSE base licence'],
        officialUrl: 'https://docs.netskope.com',
      },
      {
        id: 'saas-api-protection', label: 'SaaS API Protection',
        description: 'API-based scanning and remediation for supported SaaS applications.',
        pricingTier: 'Add-on module',
        keyFeatures: [
          'Out-of-band API scanning for 50+ SaaS apps including Salesforce, Box, Slack, and Teams',
          'Retroactive DLP scan of stored data with quarantine and notify actions',
          'Misconfiguration and oversharing detection across cloud repositories',
          'Near-real-time and scheduled scan modes',
        ],
        prerequisites: ['Netskope SSE base licence'],
        officialUrl: 'https://docs.netskope.com',
      },
      {
        id: 'cloud-storage-dspm', label: 'Cloud Storage / DSPM',
        description: 'Discovery and posture-oriented data security for cloud/object storage.',
        pricingTier: 'Add-on module',
        keyFeatures: [
          'S3, Azure Blob, and GCS bucket scanning for sensitive data exposure',
          'Sensitivity classification and public-access remediation',
          'Data Security Posture Management (DSPM) risk visualisation',
        ],
        prerequisites: ['Netskope SSE base licence'],
        officialUrl: 'https://docs.netskope.com',
      },
      {
        id: 'endpoint-dlp-agent', label: 'Endpoint DLP / Endpoint Agent',
        description: 'Endpoint data movement controls: USB, print, clipboard, Bluetooth, and local activities.',
        pricingTier: 'Endpoint add-on licence',
        keyFeatures: [
          'USB and removable media allow/block/encrypt enforcement',
          'Print job monitoring and blocking based on content sensitivity',
          'Clipboard, screen capture, and local application controls',
          'Offline policy enforcement when not on corporate network',
        ],
        prerequisites: ['Netskope SSE base licence'],
        officialUrl: 'https://docs.netskope.com',
      },
      {
        id: 'device-control', label: 'Device Control',
        description: 'Removable media and device-level controls.',
        pricingTier: 'Included with Endpoint agent',
        keyFeatures: [
          'Removable media allow/block/encrypt rules by device class',
          'Bluetooth, camera, and peripheral device policies',
        ],
        prerequisites: ['Netskope Endpoint add-on'],
        officialUrl: 'https://docs.netskope.com',
      },
      {
        id: 'genai-app-controls', label: 'GenAI App Controls',
        description: 'GenAI application visibility, coaching, and enforcement.',
        pricingTier: 'Included in SSE platform',
        keyFeatures: [
          'Visibility and control for ChatGPT, Gemini, Copilot, Claude, and 1,000+ AI apps',
          'Prompt and file-upload DLP inspection with real-time coaching',
          'App-level allow/block/coach/isolate policy actions',
          'AI app risk scoring and shadow AI discovery',
        ],
        prerequisites: ['Netskope SSE base licence'],
        officialUrl: 'https://docs.netskope.com',
      },
      {
        id: 'private-access-ztna', label: 'Private Access / ZTNA',
        description: 'Private application access context and traffic steering.',
        pricingTier: 'ZTNA add-on licence',
        keyFeatures: [
          'Zero-trust private application access replacing legacy VPN',
          'Continuous trust scoring with context-aware adaptive access',
          'Device posture checks and identity-aware access policies',
        ],
        prerequisites: ['Netskope SSE base licence'],
        officialUrl: 'https://docs.netskope.com',
      },
      {
        id: 'advanced-analytics', label: 'Advanced Analytics / Reporting',
        description: 'Analytics, dashboards, and reporting capability.',
        pricingTier: 'Included in SSE platform',
        keyFeatures: [
          'Incident and risk trend dashboards with customisable views',
          'SIEM/SOAR export and API access for incident data',
          'Custom report builder and scheduled email reports',
        ],
        prerequisites: ['Netskope SSE base licence'],
        officialUrl: 'https://docs.netskope.com',
      },
      {
        id: 'remote-browser-isolation', label: 'Remote Browser Isolation',
        description: 'Isolated browsing/data interaction where licensed.',
        pricingTier: 'RBI add-on licence',
        keyFeatures: [
          'Pixel-rendered remote browser isolation for risky or unknown sites',
          'Read-only, watermark, and clipboard restriction modes',
          'Local browser isolation option for reduced latency',
        ],
        prerequisites: ['Netskope SSE base licence'],
        officialUrl: 'https://docs.netskope.com',
      },
      { id: 'netskope-other', label: 'Other / Custom Netskope Module', description: 'Customer-defined Netskope licence/module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Netskope One Platform',  url: 'https://www.netskope.com/' },
      { type: 'docs',    label: 'Netskope Documentation', url: 'https://docs.netskope.com/' },
      { type: 'support', label: 'Support Portal',         url: 'https://support.netskope.com/' },
      { type: 'contact', label: 'Contact Netskope',       url: 'https://www.netskope.com/contact/' },
    ],
  },
  {
    id: 'microsoft-purview',
    label: 'Microsoft Purview',
    description: 'Microsoft-native DLP with deep M365 integration, endpoint agent, and compliance suite.',
    category: ['Email', 'Endpoint', 'CASB', 'Compliance'],
    channelCoverage: { email: 'full', web: 'full', 'saas-inline': 'partial', 'saas-api': 'full', endpoint: 'full', genai: 'partial', network: 'partial' },
    modules: [
      {
        id: 'purview-m365-e3', label: 'Microsoft 365 E3',
        description: 'Baseline M365 compliance and information protection capabilities.',
        pricingTier: 'Microsoft 365 E3 licence',
        keyFeatures: [
          'Exchange, SharePoint, and OneDrive DLP policies',
          'Basic sensitivity labels and manual classification',
          'Compliance centre access with standard audit logging',
          'Retention policies and basic eDiscovery',
        ],
        prerequisites: ['Microsoft 365 tenant'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/dlp-learn-about-dlp',
      },
      {
        id: 'purview-m365-e5', label: 'Microsoft 365 E5',
        description: 'Advanced compliance, security, and Purview capabilities.',
        pricingTier: 'Microsoft 365 E5 licence',
        keyFeatures: [
          'All E3 capabilities plus advanced Purview compliance suite',
          'Microsoft Defender integration and advanced threat analytics',
          'Expanded audit logging and advanced eDiscovery (Premium)',
          'Insider Risk Management and Communication Compliance included',
        ],
        prerequisites: ['Microsoft 365 E3'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/dlp-learn-about-dlp',
      },
      {
        id: 'purview-suite', label: 'Microsoft Purview Suite / Compliance Add-on',
        description: 'Advanced Purview compliance, DLP, insider risk, audit, eDiscovery, and governance.',
        pricingTier: 'Microsoft Purview add-on (per user)',
        keyFeatures: [
          'Full Purview platform — DLP, IRM, eDiscovery, audit, and lifecycle in one SKU',
          'Adaptive Protection integrating Insider Risk with DLP policies',
          'Advanced auto-labelling and trainable classifiers',
          'Premium audit and advanced compliance features',
        ],
        prerequisites: ['Microsoft 365 E3'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/dlp-learn-about-dlp',
      },
      {
        id: 'purview-info-protection', label: 'Information Protection / Sensitivity Labels',
        description: 'Classification, labeling, encryption, and protection controls.',
        pricingTier: 'Included in M365 E3/E5',
        keyFeatures: [
          'Sensitivity labels with visual markings, encryption, and access restrictions',
          'Auto-labelling using content inspection and trainable classifiers',
          'Label-based DLP policy integration and enforcement',
        ],
        prerequisites: ['Microsoft 365 tenant'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/information-protection',
      },
      {
        id: 'purview-dlp-exchange', label: 'DLP for Exchange',
        description: 'Email DLP for Exchange Online.',
        pricingTier: 'Included in M365 E3',
        keyFeatures: [
          'Email content inspection using sensitive information types and sensitivity labels',
          'Mail flow rule integration for block, redirect, encrypt, and notify actions',
          'Policy tips in Outlook to coach users before sending',
        ],
        prerequisites: ['Microsoft 365 tenant'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/dlp-learn-about-dlp',
      },
      {
        id: 'purview-dlp-sharepoint', label: 'DLP for SharePoint / OneDrive',
        description: 'DLP for stored/shared files in SharePoint and OneDrive.',
        pricingTier: 'Included in M365 E3',
        keyFeatures: [
          'File-level DLP policies on stored SharePoint and OneDrive content',
          'Sharing restriction and access revocation for sensitive files',
          'Policy tips surfaced in SharePoint and OneDrive UI',
        ],
        prerequisites: ['Microsoft 365 tenant'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/dlp-learn-about-dlp',
      },
      {
        id: 'purview-dlp-teams', label: 'DLP for Teams / Collaboration',
        description: 'DLP for Teams messages and collaboration contexts.',
        pricingTier: 'Included in M365 E3',
        keyFeatures: [
          'DLP policy enforcement in Teams channels, chats, and meeting transcripts',
          'File sharing inspection within Teams conversations',
          'Policy tips surfaced in Teams to coach users in real time',
        ],
        prerequisites: ['Microsoft 365 tenant'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/dlp-learn-about-dlp',
      },
      {
        id: 'purview-endpoint-dlp', label: 'Endpoint DLP',
        description: 'Endpoint monitoring and controls for onboarded Windows/macOS devices.',
        pricingTier: 'Included in M365 E3 with Defender onboarding',
        keyFeatures: [
          'Windows and macOS endpoint DLP for onboarded Defender-managed devices',
          'USB, print, clipboard, browser upload, and application transfer controls',
          'Sensitive file activity audit and enforcement with offline support',
        ],
        prerequisites: ['Microsoft 365 tenant', 'Microsoft Defender for Endpoint onboarding'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/endpoint-dlp-learn-about',
      },
      {
        id: 'purview-edge-dlp', label: 'Microsoft Edge / Browser DLP',
        description: 'Browser and inline web-related DLP controls.',
        pricingTier: 'Included in M365 E3',
        keyFeatures: [
          'Browser upload monitoring and blocking for sensitive data via Edge',
          'Sensitive site restriction and DLP-aware browsing policies',
          'Integration with Endpoint DLP agent for unified browser + endpoint coverage',
        ],
        prerequisites: ['Microsoft 365 tenant', 'Microsoft Edge enterprise deployment'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/dlp-learn-about-dlp',
      },
      {
        id: 'purview-insider-risk', label: 'Insider Risk Management',
        description: 'User risk and insider risk workflows.',
        pricingTier: 'Included in M365 E5 / Purview add-on',
        keyFeatures: [
          'Risk scoring based on user activity, HR signals, and sequence detection',
          'Departing employee and disgruntled user risk policies',
          'Adaptive Protection: DLP policy tightening for high-risk users',
          'HR connector, ServiceNow integration, and reviewer workflow',
        ],
        prerequisites: ['Microsoft 365 E5 or Purview add-on'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/insider-risk-management',
      },
      {
        id: 'purview-comm-compliance', label: 'Communication Compliance',
        description: 'Communication review and compliance workflows.',
        pricingTier: 'Included in M365 E5 / Purview add-on',
        keyFeatures: [
          'Communication review using ML classifiers for Teams, Exchange, and Viva Engage',
          'Regulatory and policy violation detection with reviewer workflow',
          'Supervision policy scoped by user, group, or communication channel',
        ],
        prerequisites: ['Microsoft 365 E5 or Purview add-on'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/communication-compliance',
      },
      {
        id: 'purview-ediscovery', label: 'eDiscovery / Audit',
        description: 'Investigation, evidence, audit, and compliance review capabilities.',
        pricingTier: 'Included in M365 E3/E5',
        keyFeatures: [
          'Legal hold, content search, and case management across M365 workloads',
          'eDiscovery Standard (E3) and Premium (E5) with advanced review workflows',
          'Unified audit log with up to 10 years of audit retention (E5/add-on)',
        ],
        prerequisites: ['Microsoft 365 tenant'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/ediscovery',
      },
      {
        id: 'purview-data-lifecycle', label: 'Data Lifecycle / Records Management',
        description: 'Retention, lifecycle, and records governance.',
        pricingTier: 'Included in M365 E3',
        keyFeatures: [
          'Retention labels and retention policies across M365 workloads',
          'Event-based retention triggered by business events',
          'Records management with disposition review and compliance records',
        ],
        prerequisites: ['Microsoft 365 tenant'],
        officialUrl: 'https://learn.microsoft.com/en-us/purview/data-lifecycle-management',
      },
      { id: 'purview-other', label: 'Other / Custom Microsoft Module', description: 'Customer-defined Microsoft/Purview licence/module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Microsoft Purview',    url: 'https://www.microsoft.com/en-us/security/business/microsoft-purview' },
      { type: 'docs',    label: 'Purview Documentation', url: 'https://learn.microsoft.com/en-us/purview/' },
      { type: 'support', label: 'Microsoft Support',    url: 'https://support.microsoft.com/' },
      { type: 'contact', label: 'Contact Microsoft',    url: 'https://www.microsoft.com/en-us/contact' },
    ],
  },
  {
    id: 'symantec-dlp',
    label: 'Symantec DLP / Broadcom DLP',
    description: 'Enterprise DLP with strong endpoint agent and network coverage. Now part of Broadcom.',
    category: ['Endpoint', 'Network', 'Email'],
    channelCoverage: { email: 'full', web: 'full', 'saas-inline': 'partial', 'saas-api': 'partial', endpoint: 'full', genai: 'none', network: 'full' },
    modules: [
      {
        id: 'symantec-enforce', label: 'Enforce Platform / Management Server',
        description: 'Central DLP management, policy, incident, and administration console.',
        pricingTier: 'Required base platform',
        keyFeatures: [
          'Centralised DLP policy authoring, management, and version control',
          'Incident remediation workflow with smart response rules',
          'Unified reporting across all detection servers',
          'Role-based administration and audit logging',
        ],
        officialUrl: 'https://techdocs.broadcom.com/us/en/symantec-security-software/information-security/data-loss-prevention/16-0.html',
      },
      {
        id: 'symantec-endpoint-prevent', label: 'Endpoint Prevent',
        description: 'Endpoint activity monitoring and enforcement.',
        pricingTier: 'Endpoint Prevent licence',
        keyFeatures: [
          'Windows and macOS endpoint agent with offline policy enforcement',
          'USB, print, clipboard, and application-level transfer controls',
          'Application file access monitoring and sensitive data enforcement',
        ],
        prerequisites: ['Symantec Enforce platform'],
        officialUrl: 'https://techdocs.broadcom.com/us/en/symantec-security-software/information-security/data-loss-prevention/16-0.html',
      },
      {
        id: 'symantec-endpoint-discover', label: 'Endpoint Discover',
        description: 'Discovery of sensitive data on endpoint storage.',
        pricingTier: 'Endpoint Discover licence',
        keyFeatures: [
          'Scheduled and on-demand scans of endpoint file system storage',
          'Sensitive data classification and inventory across endpoints',
          'Automated or manual remediation of discovered data',
        ],
        prerequisites: ['Symantec Enforce platform'],
        officialUrl: 'https://techdocs.broadcom.com/us/en/symantec-security-software/information-security/data-loss-prevention/16-0.html',
      },
      {
        id: 'symantec-network-monitor', label: 'Network Monitor',
        description: 'Passive network monitoring for data in motion.',
        pricingTier: 'Network Monitor licence',
        keyFeatures: [
          'Passive network traffic monitoring via SPAN/TAP for visibility without enforcement',
          'Email, HTTP/S, FTP, and IM protocol inspection',
          'Incident generation for policy violations detected on the wire',
        ],
        prerequisites: ['Symantec Enforce platform'],
        officialUrl: 'https://techdocs.broadcom.com/us/en/symantec-security-software/information-security/data-loss-prevention/16-0.html',
      },
      {
        id: 'symantec-network-email', label: 'Network Prevent for Email',
        description: 'Email prevent/enforcement integration.',
        pricingTier: 'Network Prevent for Email licence',
        keyFeatures: [
          'Inline email DLP via MTA integration (Postfix, Sendmail, or dedicated relay)',
          'Block, redirect, encrypt, quarantine, or notify actions on outbound email',
          'Attachment inspection and body content analysis',
        ],
        prerequisites: ['Symantec Enforce platform', 'MTA integration'],
        officialUrl: 'https://techdocs.broadcom.com/us/en/symantec-security-software/information-security/data-loss-prevention/16-0.html',
      },
      {
        id: 'symantec-network-web', label: 'Network Prevent for Web',
        description: 'Web/proxy prevent/enforcement integration.',
        pricingTier: 'Network Prevent for Web licence',
        keyFeatures: [
          'Inline web DLP via ICAP proxy integration',
          'HTTP/HTTPS upload blocking and coaching via proxy enforcement',
          'Integration with Blue Coat, Squid, and other ICAP-capable proxies',
        ],
        prerequisites: ['Symantec Enforce platform', 'ICAP proxy integration'],
        officialUrl: 'https://techdocs.broadcom.com/us/en/symantec-security-software/information-security/data-loss-prevention/16-0.html',
      },
      {
        id: 'symantec-network-discover', label: 'Network Discover',
        description: 'Discovery of sensitive data in network repositories and file shares.',
        pricingTier: 'Network Discover licence',
        keyFeatures: [
          'Scanning of file shares, NAS, SharePoint, and Exchange public folders',
          'Data-at-rest sensitive data inventory across network storage',
          'Automated or manual remediation including quarantine and delete',
        ],
        prerequisites: ['Symantec Enforce platform'],
        officialUrl: 'https://techdocs.broadcom.com/us/en/symantec-security-software/information-security/data-loss-prevention/16-0.html',
      },
      {
        id: 'symantec-cloud-casb', label: 'Cloud / CASB Integration',
        description: 'Cloud or CASB-connected DLP use cases where integrated.',
        pricingTier: 'Cloud / CASB add-on',
        keyFeatures: [
          'API-based cloud scanning using Symantec CloudSOC or third-party CASB integration',
          'Policy enforcement and remediation for cloud-stored sensitive data',
        ],
        prerequisites: ['Symantec Enforce platform'],
        officialUrl: 'https://techdocs.broadcom.com/us/en/symantec-security-software/information-security/data-loss-prevention/16-0.html',
      },
      {
        id: 'symantec-data-insight', label: 'Data Insight / Data Ownership Context',
        description: 'Data ownership and access context where available.',
        pricingTier: 'Data Insight add-on',
        keyFeatures: [
          'Data ownership attribution and access pattern analysis',
          'Stale, orphaned, and over-shared data identification',
          'Risk-based prioritisation of remediation based on data access context',
        ],
        prerequisites: ['Symantec Enforce platform'],
        officialUrl: 'https://techdocs.broadcom.com/us/en/symantec-security-software/information-security/data-loss-prevention/16-0.html',
      },
      { id: 'symantec-other', label: 'Other / Custom Symantec Module', description: 'Customer-defined Symantec/Broadcom DLP module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Symantec DLP',         url: 'https://www.broadcom.com/products/cybersecurity/information-protection' },
      { type: 'docs',    label: 'Broadcom TechDocs',    url: 'https://techdocs.broadcom.com/' },
      { type: 'support', label: 'Broadcom Support',     url: 'https://support.broadcom.com/' },
      { type: 'contact', label: 'Contact Broadcom',     url: 'https://www.broadcom.com/support/contact-us' },
    ],
  },
  {
    id: 'forcepoint-dlp',
    label: 'Forcepoint DLP / Forcepoint Data Security',
    description: 'Behaviour-based DLP with risk-adaptive policies across endpoint, network, and cloud.',
    category: ['Endpoint', 'Network', 'CASB'],
    channelCoverage: { email: 'full', web: 'full', 'saas-inline': 'partial', 'saas-api': 'partial', endpoint: 'full', genai: 'partial', network: 'full' },
    modules: [
      {
        id: 'fp-core', label: 'Forcepoint DLP Core / Management',
        description: 'Central DLP policy, incident, and management capability.',
        pricingTier: 'Required base platform',
        keyFeatures: [
          'Centralised DLP policy management, incident workflow, and reporting',
          'REST API for SIEM/SOAR and automation integration',
          'Pre-built policy templates for GDPR, HIPAA, PCI-DSS, and more',
          'Role-based administration and audit logging',
        ],
        officialUrl: 'https://docs.forcepoint.com/bundle/dlp',
      },
      {
        id: 'fp-email', label: 'DLP for Email',
        description: 'Outbound email DLP and email protection workflows.',
        pricingTier: 'Email module add-on',
        keyFeatures: [
          'SMTP-based outbound email DLP with MTA integration',
          'Block, encrypt, redirect, and notify actions on sensitive outbound email',
          'Attachment inspection and message body analysis',
        ],
        prerequisites: ['Forcepoint DLP Core'],
        officialUrl: 'https://docs.forcepoint.com/bundle/dlp',
      },
      {
        id: 'fp-endpoint', label: 'DLP for Endpoint',
        description: 'Endpoint monitoring and control.',
        pricingTier: 'Endpoint module add-on',
        keyFeatures: [
          'Windows and macOS endpoint agent with offline policy enforcement',
          'USB, print, clipboard, and application-level data transfer controls',
          'File activity monitoring and sensitive data enforcement at the OS level',
        ],
        prerequisites: ['Forcepoint DLP Core'],
        officialUrl: 'https://docs.forcepoint.com/bundle/dlp',
      },
      {
        id: 'fp-network', label: 'DLP for Network',
        description: 'Data-in-motion/network DLP use cases.',
        pricingTier: 'Network module add-on',
        keyFeatures: [
          'Inline network DLP via ICAP integration with web gateways',
          'Protocol-level inspection covering HTTP/S, FTP, and SMTP',
          'Network traffic enforcement with block, coach, and notify actions',
        ],
        prerequisites: ['Forcepoint DLP Core'],
        officialUrl: 'https://docs.forcepoint.com/bundle/dlp',
      },
      {
        id: 'fp-web', label: 'DLP for Web',
        description: 'Web channel DLP and web traffic protection.',
        pricingTier: 'Web module add-on',
        keyFeatures: [
          'Web proxy DLP for browser uploads, form submissions, and web posts',
          'Integration with Forcepoint Web Security or third-party ICAP proxy',
          'Real-time coaching and blocking for sensitive web uploads',
        ],
        prerequisites: ['Forcepoint DLP Core'],
        officialUrl: 'https://docs.forcepoint.com/bundle/dlp',
      },
      {
        id: 'fp-cloud', label: 'DLP for Cloud Applications',
        description: 'Cloud application and SaaS DLP controls.',
        pricingTier: 'Cloud Applications add-on',
        keyFeatures: [
          'SaaS and CASB integration for cloud app upload/download/share controls',
          'Shadow IT visibility and app risk scoring',
          'Policy enforcement for managed SaaS applications',
        ],
        prerequisites: ['Forcepoint DLP Core'],
        officialUrl: 'https://docs.forcepoint.com/bundle/dlp',
      },
      {
        id: 'fp-data-security-cloud', label: 'Data Security Cloud',
        description: 'Unified data security, discovery, classification, and enforcement platform.',
        pricingTier: 'Data Security Cloud licence (SaaS delivery)',
        keyFeatures: [
          'Cloud-native unified DLP replacing traditional on-prem module architecture',
          'Integrated data discovery, classification, and enforcement in a single SaaS platform',
          'API-first design with connectors for SIEM, SOAR, and identity platforms',
          'Forcepoint\'s next-generation DLP strategy — recommended for new deployments',
        ],
        officialUrl: 'https://docs.forcepoint.com/bundle/dlp',
      },
      {
        id: 'fp-dspm', label: 'DSPM / Data Discovery',
        description: 'Data security posture, discovery, and data risk visibility.',
        pricingTier: 'DSPM add-on',
        keyFeatures: [
          'Cloud data discovery across AWS, Azure, GCP, and SaaS repositories',
          'Data risk posture scoring with remediation recommendations',
          'Sensitive data classification inventory and exposure reporting',
        ],
        prerequisites: ['Forcepoint DLP Core or Data Security Cloud'],
        officialUrl: 'https://docs.forcepoint.com/bundle/dlp',
      },
      {
        id: 'fp-risk-adaptive', label: 'Risk-Adaptive Protection / Insider Risk',
        description: 'Risk-adaptive controls based on user and behavior context.',
        pricingTier: 'Risk-Adaptive Protection add-on',
        keyFeatures: [
          'User risk scoring based on behavioural analytics and activity signals',
          'Automatic DLP policy tightening for high-risk or anomalous users',
          'HR system integration for departing employee policy escalation',
        ],
        prerequisites: ['Forcepoint DLP Core', 'User analytics feed'],
        officialUrl: 'https://docs.forcepoint.com/bundle/dlp',
      },
      {
        id: 'fp-genai', label: 'GenAI / ChatGPT Data Protection',
        description: 'AI usage/data protection controls where available.',
        pricingTier: 'GenAI Protection add-on',
        keyFeatures: [
          'ChatGPT, Copilot, and AI tool prompt inspection and DLP enforcement',
          'File upload and sensitive data submission controls for AI platforms',
          'AI app visibility and usage policy enforcement',
        ],
        prerequisites: ['Forcepoint DLP Core or Data Security Cloud'],
        officialUrl: 'https://docs.forcepoint.com/bundle/dlp',
      },
      { id: 'fp-other', label: 'Other / Custom Forcepoint Module', description: 'Customer-defined Forcepoint module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Forcepoint DLP',       url: 'https://www.forcepoint.com/product/dlp' },
      { type: 'docs',    label: 'Forcepoint Docs',      url: 'https://docs.forcepoint.com/' },
      { type: 'support', label: 'Support Portal',       url: 'https://support.forcepoint.com/' },
      { type: 'contact', label: 'Contact Forcepoint',   url: 'https://www.forcepoint.com/company/contact-us' },
    ],
  },
  {
    id: 'zscaler-dlp',
    label: 'Zscaler DLP / Zscaler Data Protection',
    description: 'Cloud-native SWG and CASB with unified DLP policy engine across web and SaaS.',
    category: ['SWG', 'CASB', 'ZTNA'],
    channelCoverage: { email: 'none', web: 'full', 'saas-inline': 'full', 'saas-api': 'partial', endpoint: 'partial', genai: 'partial', network: 'full' },
    modules: [
      {
        id: 'zs-zia-cloud', label: 'Zscaler Internet Access / Cloud DLP',
        description: 'Inline cloud/web DLP through Zscaler Internet Access.',
        pricingTier: 'Included in ZIA base licence',
        keyFeatures: [
          'Inline web and SaaS DLP with full SSL/TLS inspection',
          'Real-time policy enforcement across HTTP/S and cloud traffic',
          'Pre-built DLP dictionaries and sensitive information type libraries',
          'Traffic forwarding via Zscaler Client Connector, PAC file, or GRE/IPSec tunnel',
        ],
        prerequisites: ['Zscaler Internet Access (ZIA) subscription'],
        officialUrl: 'https://help.zscaler.com/zia/data-loss-prevention',
      },
      {
        id: 'zs-edm', label: 'Exact Data Match / Indexed Data Matching',
        description: 'Structured data matching capability where licensed/configured.',
        pricingTier: 'EDM add-on',
        keyFeatures: [
          'Exact data match for structured data from HR, customer, or financial databases',
          'Database fingerprinting with indexed token matching for ultra-low false-positive rates',
          'Supports up to 100M records per indexed data set',
        ],
        prerequisites: ['Zscaler ZIA base licence'],
        officialUrl: 'https://help.zscaler.com/zia/data-loss-prevention',
      },
      {
        id: 'zs-idm', label: 'Document Fingerprinting / IDM',
        description: 'Document or content fingerprinting where licensed/configured.',
        pricingTier: 'IDM add-on',
        keyFeatures: [
          'Indexed document matching for unstructured data — contracts, designs, source code',
          'Partial-content matching detects even heavily modified copies of source documents',
          'Supports Word, PDF, Excel, CAD, and other document types',
        ],
        prerequisites: ['Zscaler ZIA base licence'],
        officialUrl: 'https://help.zscaler.com/zia/data-loss-prevention',
      },
      {
        id: 'zs-saas-casb', label: 'SaaS / CASB Controls',
        description: 'SaaS application control and cloud app governance capabilities.',
        pricingTier: 'Included in ZIA base / CASB add-on',
        keyFeatures: [
          'SaaS app visibility and risk scoring across 20,000+ applications',
          'Inline and API-mode SaaS access controls and DLP enforcement',
          'Shadow IT discovery and unsanctioned app blocking',
          'Cloud app governance policies for Microsoft 365, Google Workspace, Box, and more',
        ],
        prerequisites: ['Zscaler ZIA base licence'],
        officialUrl: 'https://help.zscaler.com/zia/data-loss-prevention',
      },
      {
        id: 'zs-endpoint', label: 'Endpoint DLP',
        description: 'Endpoint data protection and controls where licensed.',
        pricingTier: 'Endpoint DLP add-on',
        keyFeatures: [
          'Windows and macOS endpoint data movement controls',
          'USB, print, clipboard, and application-level DLP enforcement',
          'Offline policy enforcement when disconnected from Zscaler',
        ],
        prerequisites: ['Zscaler Client Connector deployment'],
        officialUrl: 'https://help.zscaler.com/zia/data-loss-prevention',
      },
      {
        id: 'zs-browser-isolation', label: 'Browser Isolation',
        description: 'Isolated browsing and controlled data interaction.',
        pricingTier: 'Browser Isolation add-on',
        keyFeatures: [
          'Remote browser isolation for risky, unmanaged, or unknown sites',
          'Read-only, watermarking, and clipboard restriction modes',
          'Local browser isolation option for reduced latency in Zscaler deployments',
        ],
        prerequisites: ['Zscaler ZIA base licence'],
        officialUrl: 'https://help.zscaler.com/zia/data-loss-prevention',
      },
      {
        id: 'zs-genai', label: 'GenAI / AI Data Protection',
        description: 'AI app visibility and data protection controls where available.',
        pricingTier: 'Included in ZIA base (newer tenants)',
        keyFeatures: [
          'GenAI app visibility and risk classification across ChatGPT, Copilot, Gemini, and 800+ AI tools',
          'Prompt and file upload DLP inspection with allow/block/coach actions',
          'GenAI usage analytics and policy enforcement reporting',
        ],
        prerequisites: ['Zscaler ZIA base licence'],
        officialUrl: 'https://help.zscaler.com/zia/data-loss-prevention',
      },
      {
        id: 'zs-device', label: 'Device / BYOD Controls',
        description: 'Device-based context and controls depending on deployment.',
        pricingTier: 'Included in ZIA',
        keyFeatures: [
          'Device posture enforcement via certificate, MDM compliance, or OS version checks',
          'BYOD quarantine and limited access profile for unmanaged devices',
          'Context-aware access policies tied to device trust level',
        ],
        prerequisites: ['Zscaler ZIA', 'Zscaler Client Connector'],
        officialUrl: 'https://help.zscaler.com/zia/data-loss-prevention',
      },
      {
        id: 'zs-dspm', label: 'Data Discovery / DSPM',
        description: 'Data discovery/posture capability where available.',
        pricingTier: 'DSPM / Data Discovery add-on',
        keyFeatures: [
          'Cloud data discovery across AWS S3, Azure Blob, GCS, and SaaS repositories',
          'Sensitive data inventory and posture scoring with risk prioritisation',
          'Automated remediation recommendations for discovered exposures',
        ],
        prerequisites: ['Zscaler ZIA', 'Cloud API access configured'],
        officialUrl: 'https://help.zscaler.com/zia/data-loss-prevention',
      },
      { id: 'zs-other', label: 'Other / Custom Zscaler Module', description: 'Customer-defined Zscaler module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Zscaler Internet Access', url: 'https://www.zscaler.com/products-and-solutions/zscaler-internet-access' },
      { type: 'docs',    label: 'Zscaler ZIA Help',        url: 'https://help.zscaler.com/zia' },
      { type: 'support', label: 'Zscaler Help Portal',     url: 'https://help.zscaler.com/' },
      { type: 'contact', label: 'Contact Zscaler',         url: 'https://www.zscaler.com/contact' },
    ],
  },
  {
    id: 'digital-guardian',
    label: 'Digital Guardian / Fortra',
    description: 'Purpose-built endpoint DLP with deep content inspection and user activity monitoring.',
    category: ['Endpoint'],
    channelCoverage: { email: 'partial', web: 'partial', 'saas-inline': 'none', 'saas-api': 'none', endpoint: 'full', genai: 'none', network: 'partial' },
    modules: [
      {
        id: 'dg-arc-platform', label: 'ARC Management Console',
        description: 'Cloud-native ARC management console for centralised DLP policy, incident management, and analytics.',
        pricingTier: 'Required base platform (SaaS ARC or on-prem Enforce)',
        keyFeatures: [
          'Centralised DLP management console for policy authoring and incident remediation',
          'Cloud-native ARC architecture or on-premises server deployment option',
          'Cross-channel incident workflow, case management, and SIEM export',
          'Risk scoring dashboards and custom report builder',
        ],
        officialUrl: 'https://help.digitalguardian.com',
      },
      {
        id: 'dg-endpoint-prevent', label: 'Endpoint DLP / Prevent',
        description: 'Agent-based endpoint DLP with kernel-level monitoring and device controls.',
        pricingTier: 'Endpoint module add-on',
        keyFeatures: [
          'Windows and macOS endpoint agent with kernel-level file activity monitoring',
          'USB, printer, Bluetooth, and peripheral device allow/block/encrypt rules',
          'Application-level controls for copy/paste, screenshot, and file save',
          'Offline enforcement — policies applied without network connectivity',
        ],
        prerequisites: ['DG ARC Management Console'],
        officialUrl: 'https://help.digitalguardian.com',
      },
      {
        id: 'dg-network-dlp', label: 'Network DLP / Prevent',
        description: 'Email and web egress DLP via SMTP gateway and proxy integration.',
        pricingTier: 'Network module add-on',
        keyFeatures: [
          'Outbound email DLP via SMTP gateway integration',
          'Web proxy and HTTP/S upload inspection and enforcement',
          'Block, coach, encrypt, or quarantine on sensitive transmission detection',
        ],
        prerequisites: ['DG ARC Management Console'],
        officialUrl: 'https://help.digitalguardian.com',
      },
      {
        id: 'dg-cloud-dlp', label: 'Cloud / SaaS DLP',
        description: 'Cloud application upload and share inspection for major SaaS platforms.',
        pricingTier: 'Cloud module add-on',
        keyFeatures: [
          'Cloud application upload and share inspection for M365, Google Workspace, Box, and Salesforce',
          'SaaS activity controls with block, coach, and notify actions',
        ],
        prerequisites: ['DG ARC Management Console'],
        officialUrl: 'https://help.digitalguardian.com',
      },
      {
        id: 'dg-data-discovery', label: 'Data Discovery / Classification',
        description: 'Automated sensitive data discovery across endpoints, file shares, and cloud repositories.',
        pricingTier: 'Discovery add-on',
        keyFeatures: [
          'Automated sensitive data discovery across endpoints, file shares, and cloud repositories',
          'Classification inventory with risk prioritisation and exposure remediation workflows',
        ],
        prerequisites: ['DG ARC Management Console'],
        officialUrl: 'https://help.digitalguardian.com',
      },
      { id: 'dg-other', label: 'Other / Custom Digital Guardian Module', description: 'Customer-defined Digital Guardian module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Digital Guardian by Fortra', url: 'https://www.fortra.com/digital-guardian' },
      { type: 'docs',    label: 'Fortra Technical Docs',      url: 'https://hstechdocs.helpsystems.com/' },
      { type: 'support', label: 'Fortra Support',             url: 'https://support.fortra.com/' },
      { type: 'contact', label: 'Contact Fortra',             url: 'https://www.fortra.com/support' },
    ],
  },
  {
    id: 'trellix-dlp',
    label: 'Trellix DLP',
    description: 'Unified DLP across email, web, network, and endpoint. Formerly McAfee DLP.',
    category: ['Email', 'Endpoint', 'Network'],
    channelCoverage: { email: 'full', web: 'full', 'saas-inline': 'partial', 'saas-api': 'partial', endpoint: 'full', genai: 'none', network: 'full' },
    modules: [
      {
        id: 'trellix-manager', label: 'Trellix DLP Manager',
        description: 'Central management console for all Trellix DLP modules and incident workflow.',
        pricingTier: 'Required base platform',
        keyFeatures: [
          'Centralised DLP policy management across all Trellix DLP modules',
          'Incident management, workflow, and remediation console with case escalation',
          'REST API and SIEM/SOAR integration for automated incident export',
          'Risk dashboards with incident trends, policy hit rates, and user risk scoring',
        ],
        officialUrl: 'https://docs.trellix.com/bundle/dlp-manager',
      },
      {
        id: 'trellix-prevent', label: 'Trellix DLP Prevent',
        description: 'Network egress DLP for outbound email and web proxy channels.',
        pricingTier: 'DLP Prevent module add-on',
        keyFeatures: [
          'Outbound email DLP via SMTP gateway and MTA integration',
          'Web proxy integration for HTTP/S upload and web posting controls',
          'Block, redirect, encrypt, quarantine, or notify actions on sensitive transmissions',
        ],
        prerequisites: ['Trellix DLP Manager'],
        officialUrl: 'https://docs.trellix.com/bundle/dlp-prevent',
      },
      {
        id: 'trellix-monitor', label: 'Trellix DLP Monitor',
        description: 'Passive network traffic capture and inspection for forensic DLP.',
        pricingTier: 'DLP Monitor module add-on',
        keyFeatures: [
          'Passive network traffic monitoring with deep content capture across email, web, and FTP',
          'Protocol inspection across SMTP, HTTP/S, FTP, and IM channels',
          'Forensic evidence capture and traffic replay for incident investigation',
        ],
        prerequisites: ['Trellix DLP Manager'],
        officialUrl: 'https://docs.trellix.com/bundle/dlp-monitor',
      },
      {
        id: 'trellix-endpoint', label: 'Trellix DLP Endpoint',
        description: 'Agent-based endpoint DLP for Windows and macOS with device controls.',
        pricingTier: 'DLP Endpoint module add-on',
        keyFeatures: [
          'Windows and macOS endpoint agent with kernel-level file activity monitoring',
          'USB, print, clipboard, and application-level copy/upload controls',
          'Offline policy enforcement without network connectivity',
        ],
        prerequisites: ['Trellix DLP Manager'],
        officialUrl: 'https://docs.trellix.com/bundle/dlp-endpoint',
      },
      {
        id: 'trellix-discover', label: 'Trellix DLP Discover',
        description: 'Storage scanning and data-at-rest discovery across file shares, NAS, and SharePoint.',
        pricingTier: 'DLP Discover module add-on',
        keyFeatures: [
          'File share, NAS, SharePoint, and endpoint storage discovery scanning',
          'Sensitive data inventory with classification tagging and risk prioritisation',
          'Automated remediation: quarantine, delete, encrypt, or notify data owner',
        ],
        prerequisites: ['Trellix DLP Manager'],
        officialUrl: 'https://docs.trellix.com/bundle/dlp-discover',
      },
      { id: 'trellix-other', label: 'Other / Custom Trellix Module', description: 'Customer-defined Trellix DLP module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Trellix DLP',        url: 'https://www.trellix.com/products/dlp/' },
      { type: 'docs',    label: 'Trellix Doc Portal',  url: 'https://docs.trellix.com/' },
      { type: 'support', label: 'Trellix Support',     url: 'https://kcm.trellix.com/' },
      { type: 'contact', label: 'Contact Trellix',     url: 'https://www.trellix.com/contact-us/' },
    ],
  },
  {
    id: 'skyhigh-security',
    label: 'Skyhigh Security',
    description: 'CASB and SWG specialist with strong cloud data protection and inline inspection.',
    category: ['CASB', 'SWG'],
    channelCoverage: { email: 'none', web: 'full', 'saas-inline': 'full', 'saas-api': 'full', endpoint: 'none', genai: 'partial', network: 'full' },
    modules: [
      {
        id: 'skyhigh-sse', label: 'Skyhigh Security Service Edge (SSE)',
        description: 'Cloud-native SSE base platform integrating SWG, CASB, and Private Access with unified DLP.',
        pricingTier: 'Required SSE base platform',
        keyFeatures: [
          'Cloud-native SSE platform with integrated SWG, CASB, and Private Access',
          'SSL/TLS inspection with advanced threat protection and DLP inline',
          'Unified policy engine across web, cloud, and private access channels',
        ],
        officialUrl: 'https://success.skyhighsecurity.com',
      },
      {
        id: 'skyhigh-swg', label: 'Secure Web Gateway (SWG)',
        description: 'Full web proxy with inline DLP for HTTP/S traffic, uploads, and web posting.',
        pricingTier: 'Included in SSE platform',
        keyFeatures: [
          'Full web proxy with inline DLP policy enforcement on all HTTP/S traffic',
          'Upload, download, and web posting controls with coaching prompts',
          'Remote Browser Isolation (RBI) add-on for sensitive site and risky user controls',
        ],
        prerequisites: ['Skyhigh SSE base platform'],
        officialUrl: 'https://success.skyhighsecurity.com/Skyhigh_Secure_Web_Gateway',
      },
      {
        id: 'skyhigh-casb-inline', label: 'CASB Inline',
        description: 'Inline forward proxy inspection of SaaS application traffic.',
        pricingTier: 'Included in SSE platform',
        keyFeatures: [
          'Inline forward proxy inspection of SaaS traffic for M365, Salesforce, Box, and more',
          'Upload, download, and share controls with shadow IT visibility',
          'Real-time coaching and contextual step-up authentication for risky actions',
        ],
        prerequisites: ['Skyhigh SSE base platform'],
        officialUrl: 'https://success.skyhighsecurity.com/Skyhigh_CASB',
      },
      {
        id: 'skyhigh-casb-api', label: 'CASB API / At-Rest Scanning',
        description: 'Out-of-band API scanning of stored data across major SaaS platforms.',
        pricingTier: 'API scanning add-on to CASB licence',
        keyFeatures: [
          'Out-of-band API scanning of stored data in M365, Google Workspace, Box, and Salesforce',
          'Retroactive remediation: quarantine, unshare, delete, or notify data owner',
          'Data-at-rest discovery and sensitive data inventory across SaaS platforms',
        ],
        prerequisites: ['Skyhigh SSE base platform', 'CASB inline licence'],
        officialUrl: 'https://success.skyhighsecurity.com/Skyhigh_CASB',
      },
      {
        id: 'skyhigh-private-access', label: 'Private Access (ZTNA)',
        description: 'Zero-trust private application access replacing legacy VPN.',
        pricingTier: 'ZTNA add-on module',
        keyFeatures: [
          'Zero-trust application access replacing legacy VPN for corporate applications',
          'Continuous trust evaluation and context-aware access decisions',
          'DLP inspection on private app traffic for sensitive data detection',
        ],
        prerequisites: ['Skyhigh SSE base platform'],
        officialUrl: 'https://success.skyhighsecurity.com/Skyhigh_Private_Access',
      },
      { id: 'skyhigh-other', label: 'Other / Custom Skyhigh Module', description: 'Customer-defined Skyhigh Security module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Skyhigh Security',       url: 'https://www.skyhighsecurity.com/' },
      { type: 'docs',    label: 'Skyhigh Success Centre',  url: 'https://success.skyhighsecurity.com/' },
      { type: 'support', label: 'Skyhigh Support',         url: 'https://www.skyhighsecurity.com/support.html' },
      { type: 'contact', label: 'Contact Skyhigh',         url: 'https://www.skyhighsecurity.com/about/contact/' },
    ],
  },
  {
    id: 'proofpoint-dlp',
    label: 'Proofpoint Enterprise DLP',
    description: 'Email-first DLP with insider threat detection and information protection.',
    category: ['Email', 'Insider Risk'],
    channelCoverage: { email: 'full', web: 'partial', 'saas-inline': 'partial', 'saas-api': 'partial', endpoint: 'partial', genai: 'none', network: 'none' },
    modules: [
      {
        id: 'pp-email-dlp', label: 'Proofpoint Email Protection / DLP',
        description: 'Core email DLP platform with pre-built classifiers for outbound data loss prevention.',
        pricingTier: 'Required base platform',
        keyFeatures: [
          'Inbound and outbound email DLP with content classification and attachment inspection',
          'Pre-built DLP classifiers for PII, PCI, PHI, financial data, and source code',
          'Block, encrypt, quarantine, redirect, or notify actions on policy match',
          'Email gateway integration supporting all major MTA platforms',
        ],
        officialUrl: 'https://help.proofpoint.com/Proofpoint_Essentials/Email_Security/Administrator_Topics/Data_Loss_Prevention',
      },
      {
        id: 'pp-itm', label: 'Proofpoint ITM / Insider Threat Management',
        description: 'User activity risk scoring and departing employee monitoring.',
        pricingTier: 'ITM add-on module',
        keyFeatures: [
          'User risk scoring based on file activity, email, uploads, and endpoint behaviour',
          'Departing employee monitoring with automatic risk policy tightening',
          'Timeline view of risky activities across email, web, cloud, and endpoint channels',
          'Integration with Proofpoint SIEM connectors and SOAR for automated case management',
        ],
        prerequisites: ['Proofpoint Email Protection base licence'],
        officialUrl: 'https://www.proofpoint.com/us/products/information-protection/insider-threat-management',
      },
      {
        id: 'pp-casb', label: 'Proofpoint CASB',
        description: 'SaaS application visibility and API-based data-at-rest scanning.',
        pricingTier: 'CASB add-on module',
        keyFeatures: [
          'SaaS application visibility and inline inspection for upload and share controls',
          'API-based scanning of stored data in M365, Google Workspace, Salesforce, and Slack',
          'Shadow IT discovery and cloud application risk scoring',
        ],
        prerequisites: ['Proofpoint Email Protection base licence'],
        officialUrl: 'https://www.proofpoint.com/us/products/information-protection/cloud-app-security-broker',
      },
      {
        id: 'pp-endpoint', label: 'Proofpoint Endpoint DLP',
        description: 'Endpoint agent integrating with email and web DLP policies for unified enforcement.',
        pricingTier: 'Endpoint add-on module',
        keyFeatures: [
          'Windows and macOS endpoint agent integrating with email and web DLP policies',
          'File copy, print, removable media, and application upload controls',
          'Correlates endpoint file activity with email and web events for insider risk context',
        ],
        prerequisites: ['Proofpoint Email Protection base licence'],
        officialUrl: 'https://www.proofpoint.com/us/products/information-protection/enterprise-dlp',
      },
      { id: 'pp-other', label: 'Other / Custom Proofpoint Module', description: 'Customer-defined Proofpoint module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Proofpoint Enterprise DLP', url: 'https://www.proofpoint.com/us/products/information-protection/enterprise-dlp' },
      { type: 'docs',    label: 'Proofpoint Help',           url: 'https://help.proofpoint.com/' },
      { type: 'support', label: 'Proofpoint Support',        url: 'https://www.proofpoint.com/us/support' },
      { type: 'contact', label: 'Contact Proofpoint',        url: 'https://www.proofpoint.com/us/contact' },
    ],
  },
  {
    id: 'google-workspace-dlp',
    label: 'Google Workspace DLP',
    description: 'Native DLP for Google Workspace apps, Gmail, and Chrome Enterprise browser.',
    category: ['Email', 'CASB'],
    channelCoverage: { email: 'full', web: 'partial', 'saas-inline': 'full', 'saas-api': 'partial', endpoint: 'none', genai: 'partial', network: 'none' },
    modules: [
      {
        id: 'gw-business-plus', label: 'Google Workspace Business Plus',
        description: 'Entry-level Gmail and Drive DLP rules included in Business Plus tier.',
        pricingTier: 'Included in Google Workspace Business Plus (USD 18/user/month)',
        keyFeatures: [
          'Basic Gmail DLP rules — block or quarantine outbound email on sensitive content',
          'Google Drive sharing restriction rules to prevent external data exposure',
          'Compliance access controls and full audit logging across Workspace apps',
        ],
        prerequisites: ['Google Workspace Business Plus licence or higher'],
        officialUrl: 'https://support.google.com/a/answer/9646351',
      },
      {
        id: 'gw-enterprise-dlp', label: 'Google Workspace Enterprise DLP',
        description: 'Advanced DLP rules for Gmail, Drive, Chat, and Meet with OCR and context-aware access.',
        pricingTier: 'Included in Google Workspace Enterprise Standard or Plus',
        keyFeatures: [
          'Advanced DLP rules for Gmail, Drive, Chat, and Meet with 100+ built-in data type detectors',
          'Optical character recognition (OCR) DLP for images and scanned document inspection',
          'Context-aware access with DLP condition matching for risky destinations',
          'PII, PCI, PHI, and financial data pre-built detectors with custom rule builder',
        ],
        prerequisites: ['Google Workspace Enterprise Standard or Enterprise Plus'],
        officialUrl: 'https://support.google.com/a/answer/9646351',
      },
      {
        id: 'gw-drive-dlp', label: 'Google Drive DLP / Sharing Controls',
        description: 'API-based Drive scanning and sharing restriction with label-based enforcement.',
        pricingTier: 'Included in Enterprise tiers',
        keyFeatures: [
          'API-based scanning of existing Drive content for sensitive data exposure',
          'Sharing restriction rules preventing external or public Drive file sharing',
          'Drive DLP label integration — apply information protection labels automatically',
        ],
        prerequisites: ['Google Workspace Enterprise Standard or Plus'],
        officialUrl: 'https://support.google.com/a/answer/9646351',
      },
      {
        id: 'gw-chrome-dlp', label: 'Chrome Enterprise DLP',
        description: 'Browser-level DLP for upload, download, print, and clipboard via Chrome Enterprise.',
        pricingTier: 'Requires Chrome Enterprise Premium (included in select Enterprise tiers)',
        keyFeatures: [
          'Browser-level DLP for upload, download, print, and clipboard actions on managed Chrome',
          'Screen capture restriction on sensitive web destinations',
          'Managed Chrome profile enforcement for BYOD and corporate device controls',
        ],
        prerequisites: ['Google Workspace Enterprise', 'Chrome Enterprise Premium licence'],
        officialUrl: 'https://support.google.com/chrome/a/answer/9685363',
      },
      {
        id: 'gw-dlp-api', label: 'Sensitive Data Protection API',
        description: 'Google Cloud DLP API for programmatic inspection and de-identification of sensitive data.',
        pricingTier: 'Pay-per-use API (Google Cloud Sensitive Data Protection)',
        keyFeatures: [
          'Cloud-native API for inspecting, classifying, and de-identifying sensitive data at scale',
          'Integrates with BigQuery, Cloud Storage, Datastore, and custom applications',
          'Data discovery across GCP with risk scoring and public exposure reporting',
        ],
        prerequisites: ['Google Cloud Platform account'],
        officialUrl: 'https://cloud.google.com/sensitive-data-protection/docs',
      },
      { id: 'gw-other', label: 'Other / Custom Google Workspace Module', description: 'Customer-defined Google Workspace DLP capability.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Google Workspace',          url: 'https://workspace.google.com/' },
      { type: 'docs',    label: 'Workspace Admin Help',      url: 'https://support.google.com/a/' },
      { type: 'support', label: 'Google Workspace Support',  url: 'https://support.google.com/a/' },
      { type: 'contact', label: 'Contact Google Workspace',  url: 'https://workspace.google.com/contact/' },
    ],
  },
  {
    id: 'palo-alto-dlp',
    label: 'Palo Alto Networks / Prisma Access / Enterprise DLP',
    description: 'Enterprise DLP via Prisma Access SASE with SWG and CASB inline coverage.',
    category: ['SWG', 'CASB', 'NGFW'],
    channelCoverage: { email: 'none', web: 'full', 'saas-inline': 'full', 'saas-api': 'partial', endpoint: 'partial', genai: 'partial', network: 'full' },
    modules: [
      {
        id: 'pa-prisma-access', label: 'Prisma Access (SASE)',
        description: 'Cloud-native SASE platform with integrated SWG, CASB, and ZTNA.',
        pricingTier: 'Required Prisma Access base licence',
        keyFeatures: [
          'Cloud-native SASE platform with integrated SWG, CASB, ZTNA, and SD-WAN',
          'App-ID and User-ID for fine-grained per-application and per-user DLP policy',
          'Global POP network for low-latency inline inspection worldwide',
        ],
        officialUrl: 'https://docs.paloaltonetworks.com/enterprise-dlp',
      },
      {
        id: 'pa-enterprise-dlp', label: 'Palo Alto Enterprise DLP',
        description: 'AI-powered unified DLP add-on shared across Prisma Access, NGFW, and Prisma Cloud.',
        pricingTier: 'Enterprise DLP add-on licence (cross-platform)',
        keyFeatures: [
          'AI-powered DLP engine shared across Prisma Access, NGFW, and Prisma Cloud in one licence',
          'Unified DLP policies across web, email, SaaS, endpoint, and network channels',
          '600+ built-in sensitive data patterns with ML-enhanced accuracy and low false-positive rate',
          'Exact data match (EDM) and document fingerprinting for structured and unstructured data',
        ],
        prerequisites: ['Prisma Access or NGFW with active subscriptions'],
        officialUrl: 'https://docs.paloaltonetworks.com/enterprise-dlp',
      },
      {
        id: 'pa-ngfw-dlp', label: 'NGFW / Panorama DLP',
        description: 'On-premises NGFW-based DLP for network traffic with Panorama centralised management.',
        pricingTier: 'Included with Enterprise DLP subscription on NGFW',
        keyFeatures: [
          'On-premises NGFW-based DLP covering 3,000+ application protocols via App-ID',
          'Panorama integration for centralised DLP policy management across all NGFW devices',
          'Deep packet inspection with SSL decryption for full visibility into encrypted traffic',
        ],
        prerequisites: ['Palo Alto NGFW hardware or VM', 'Enterprise DLP add-on subscription'],
        officialUrl: 'https://docs.paloaltonetworks.com/enterprise-dlp',
      },
      {
        id: 'pa-prisma-cloud', label: 'Prisma Cloud Data Security / DSPM',
        description: 'Cloud data security posture management and sensitive data discovery across AWS, Azure, GCP.',
        pricingTier: 'Prisma Cloud Data Security add-on',
        keyFeatures: [
          'Cloud data discovery across AWS S3, Azure Blob Storage, and GCP Cloud Storage',
          'Data Security Posture Management (DSPM) with sensitive data risk scoring',
          'Automated remediation recommendations for public exposure and misconfiguration findings',
        ],
        prerequisites: ['Prisma Cloud subscription (Compute or CSPM tier)'],
        officialUrl: 'https://docs.paloaltonetworks.com/prisma/prisma-cloud',
      },
      { id: 'pa-other', label: 'Other / Custom Palo Alto Module', description: 'Customer-defined Palo Alto Networks DLP module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Palo Alto Enterprise DLP', url: 'https://www.paloaltonetworks.com/products/enterprise-dlp' },
      { type: 'docs',    label: 'Enterprise DLP Docs',      url: 'https://docs.paloaltonetworks.com/enterprise-dlp' },
      { type: 'support', label: 'Palo Alto Support',        url: 'https://support.paloaltonetworks.com/' },
      { type: 'contact', label: 'Contact Sales',            url: 'https://www.paloaltonetworks.com/company/contact-sales' },
    ],
  },
  {
    id: 'cisco-dlp',
    label: 'Cisco Secure Access / Cisco DLP',
    description: 'Email and network DLP via Cisco Secure suite and Umbrella.',
    category: ['Email', 'Network'],
    channelCoverage: { email: 'full', web: 'partial', 'saas-inline': 'partial', 'saas-api': 'none', endpoint: 'partial', genai: 'none', network: 'partial' },
    modules: [
      {
        id: 'cisco-secure-email', label: 'Cisco Secure Email DLP',
        description: 'Outbound email DLP via Cisco Secure Email Gateway with compliance-ready actions.',
        pricingTier: 'Included in Cisco Secure Email Gateway licence',
        keyFeatures: [
          'Outbound email content inspection with Cisco and RSA DLP engine integration',
          'Block, encrypt, quarantine, or redirect actions on sensitive outbound email',
          'Pre-built DLP policies for HIPAA, PCI, GDPR, and financial data compliance',
          'Attachment inspection including Office documents, PDFs, and compressed archives',
        ],
        officialUrl: 'https://www.cisco.com/c/en/us/support/security/email-security-appliance/series.html',
      },
      {
        id: 'cisco-umbrella', label: 'Cisco Umbrella / Secure Internet Gateway',
        description: 'DNS-layer and cloud-delivered web proxy with DLP inspection for outbound web traffic.',
        pricingTier: 'Included in Umbrella Secure Internet Gateway tier',
        keyFeatures: [
          'DNS-layer security with cloud-delivered web proxy and DLP policy enforcement',
          'HTTP/S traffic inspection for upload and data exfiltration via web channels',
          'Shadow IT discovery and SaaS application visibility with cloud risk scoring',
        ],
        prerequisites: ['Cisco Umbrella Secure Internet Gateway subscription'],
        officialUrl: 'https://docs.umbrella.com/umbrella-user-guide/docs/dlp-overview',
      },
      {
        id: 'cisco-secure-endpoint', label: 'Cisco Secure Endpoint (EDR)',
        description: 'Endpoint detection and response with file activity monitoring and USB controls.',
        pricingTier: 'Included in Cisco Secure Endpoint Premier or Advanced',
        keyFeatures: [
          'Endpoint detection and response (EDR) with continuous file activity monitoring',
          'USB and removable storage monitoring with policy-based device controls',
          'Integration with Cisco XDR for cross-channel incident correlation across email and web',
        ],
        prerequisites: ['Cisco Secure Endpoint Premier or Advanced licence'],
        officialUrl: 'https://www.cisco.com/c/en/us/products/security/amp-for-endpoints/',
      },
      {
        id: 'cisco-ise', label: 'Cisco ISE (Network Access Policy)',
        description: 'Network access control with device posture enforcement and BYOD quarantine.',
        pricingTier: 'Cisco ISE Base, Plus, or Apex licence',
        keyFeatures: [
          'Network access control integrating with DLP policy for device posture enforcement',
          'BYOD quarantine and limited access profiles for non-compliant or unmanaged devices',
          'Micro-segmentation and network segmentation policy support for zero-trust architectures',
        ],
        prerequisites: ['Cisco ISE licence'],
        officialUrl: 'https://www.cisco.com/c/en/us/products/security/identity-services-engine/',
      },
      { id: 'cisco-other', label: 'Other / Custom Cisco Module', description: 'Customer-defined Cisco DLP module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Cisco Security Products', url: 'https://www.cisco.com/c/en/us/products/security/' },
      { type: 'docs',    label: 'Cisco Security Docs',     url: 'https://www.cisco.com/c/en/us/support/security/' },
      { type: 'support', label: 'Cisco Support',           url: 'https://www.cisco.com/c/en/us/support/' },
      { type: 'contact', label: 'Contact Cisco',           url: 'https://www.cisco.com/c/en/us/about/contact-cisco.html' },
    ],
  },
  // ── Nightfall DLP ────────────────────────────────────────────────────────────
  {
    id: 'nightfall',
    label: 'Nightfall DLP',
    description: 'Cloud-native, API-first DLP platform built for SaaS, cloud, and developer environments.',
    category: ['Cloud-native DLP', 'API-based'],
    channelCoverage: {
      email:         'partial',
      web:           'none',
      'saas-inline': 'partial',
      'saas-api':    'full',
      endpoint:      'none',
      genai:         'partial',
      network:       'none',
    },
    modules: [
      {
        id: 'nightfall-discovery', label: 'SaaS Data Discovery',
        description: 'API-based sensitive data discovery and DLP across SaaS apps — Slack, Google Drive, GitHub, Jira, Confluence, Salesforce.',
        pricingTier: 'Core platform licence',
        keyFeatures: [
          'Automated sensitive data discovery across 100+ SaaS apps via API',
          'Real-time alerting, remediation workflows, and policy enforcement',
          'PII, PCI, PHI, and secrets detection with pre-built classifiers',
        ],
      },
      {
        id: 'nightfall-slack', label: 'Slack DLP',
        description: 'Real-time DLP scanning for Slack channels, DMs, and file uploads.',
        pricingTier: 'Included in core or Slack-specific plan',
        keyFeatures: [
          'Scan Slack messages and files for sensitive data in real time',
          'Auto-redact, alert, or quarantine sensitive content',
        ],
      },
      {
        id: 'nightfall-github', label: 'GitHub / Developer DLP',
        description: 'DLP scanning for secrets and sensitive data in GitHub repos, CI/CD, and code.',
        pricingTier: 'Developer Security add-on',
        keyFeatures: [
          'Pre-commit and historical repo scanning for secrets and credentials',
          'Integration with GitHub Actions for pipeline enforcement',
        ],
      },
      {
        id: 'nightfall-google-drive', label: 'Google Drive / Workspace DLP',
        description: 'API-based scanning of Google Drive, Docs, Sheets, and Workspace content.',
        pricingTier: 'Included in core platform',
        keyFeatures: [
          'Retroactive and continuous scanning of Google Drive stored content',
          'Policy-based access removal and user notification',
        ],
      },
      {
        id: 'nightfall-genai', label: 'GenAI & LLM Firewall',
        description: 'DLP for AI tools — inspect prompts and prevent sensitive data from entering AI models.',
        pricingTier: 'Add-on module',
        keyFeatures: [
          'Real-time prompt inspection before reaching LLMs (ChatGPT, Gemini, Claude)',
          'Sensitive data detection in AI API calls and responses',
        ],
      },
      { id: 'nightfall-other', label: 'Other / Custom Nightfall Module', description: 'Customer-defined Nightfall integration or module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Nightfall DLP',      url: 'https://www.nightfall.ai/' },
      { type: 'docs',    label: 'Nightfall Docs',     url: 'https://docs.nightfall.ai/' },
      { type: 'support', label: 'Nightfall Support',  url: 'https://www.nightfall.ai/support' },
      { type: 'contact', label: 'Contact Nightfall',  url: 'https://www.nightfall.ai/contact' },
    ],
  },

  // ── Code42 Incydr ─────────────────────────────────────────────────────────
  {
    id: 'code42',
    label: 'Code42 Incydr',
    description: 'Insider risk and data exfiltration detection platform focused on endpoint and cloud data movement.',
    category: ['Insider Risk', 'Endpoint'],
    channelCoverage: {
      email:         'none',
      web:           'partial',
      'saas-inline': 'none',
      'saas-api':    'partial',
      endpoint:      'full',
      genai:         'none',
      network:       'none',
    },
    modules: [
      {
        id: 'incydr-core', label: 'Incydr Core',
        description: 'Core insider risk detection — file movement monitoring across endpoint, web, and cloud sync.',
        pricingTier: 'Base Incydr licence',
        keyFeatures: [
          'File read, move, copy, and exfiltration detection across all vectors',
          'Risk scoring by event volume, destination type, and user context',
          'Departing employee and privilege escalation risk tracking',
        ],
      },
      {
        id: 'incydr-endpoint', label: 'Endpoint Exfiltration Detection',
        description: 'Endpoint agent for USB, cloud sync, browser upload, and local file activity monitoring.',
        pricingTier: 'Included in core licence',
        keyFeatures: [
          'USB and removable media exfiltration detection',
          'Cloud sync destination tracking (Google Drive, Dropbox, Box, OneDrive)',
          'Airdrop and email attachment activity detection on macOS/Windows',
        ],
      },
      {
        id: 'incydr-cloud', label: 'Cloud Data Movement',
        description: 'SaaS and cloud storage upload/download monitoring via API and endpoint agent.',
        pricingTier: 'Included in core licence',
        keyFeatures: [
          'Corporate vs personal cloud app destination differentiation',
          'Google Drive, OneDrive, SharePoint file movement tracking',
        ],
      },
      {
        id: 'incydr-lens', label: 'Incydr Lens / Investigation',
        description: 'Investigator workflow for alert triage, case management, and evidence collection.',
        pricingTier: 'Investigation add-on',
        keyFeatures: [
          'Timeline-based case investigation across all data movement events',
          'Integration with SIEM, SOAR, and HR systems for context',
        ],
      },
      { id: 'incydr-other', label: 'Other / Custom Code42 Module', description: 'Customer-defined Code42/Incydr module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Code42 Incydr',    url: 'https://www.code42.com/' },
      { type: 'docs',    label: 'Incydr Docs',      url: 'https://support.code42.com/hc/en-us' },
      { type: 'support', label: 'Code42 Support',   url: 'https://support.code42.com/' },
      { type: 'contact', label: 'Contact Code42',   url: 'https://www.code42.com/contact/' },
    ],
  },

  // ── Teramind ──────────────────────────────────────────────────────────────
  {
    id: 'teramind',
    label: 'Teramind',
    description: 'Employee monitoring and DLP platform combining user activity monitoring with outbound data controls.',
    category: ['Endpoint', 'User Activity Monitoring'],
    channelCoverage: {
      email:         'full',
      web:           'full',
      'saas-inline': 'partial',
      'saas-api':    'none',
      endpoint:      'full',
      genai:         'none',
      network:       'partial',
    },
    modules: [
      {
        id: 'teramind-starter', label: 'Teramind Starter',
        description: 'User activity monitoring with basic DLP controls for endpoints and web.',
        pricingTier: 'Starter licence',
        keyFeatures: [
          'Screen recording, keystroke logging, and application monitoring',
          'Basic web and email activity tracking',
        ],
      },
      {
        id: 'teramind-uam', label: 'User Activity Monitoring (UAM)',
        description: 'Full user behaviour analytics with risk scoring, anomaly detection, and productivity monitoring.',
        pricingTier: 'UAM licence',
        keyFeatures: [
          'Behavioural baseline and anomaly detection per user',
          'Risk scoring based on activity patterns and policy violations',
          'Integration with HR systems for departing employee workflows',
        ],
      },
      {
        id: 'teramind-dlp', label: 'DLP Module',
        description: 'Content-aware DLP controls for email, web, endpoint, and network channels.',
        pricingTier: 'DLP add-on licence',
        keyFeatures: [
          'Outbound email and web upload content inspection with block/alert/notify',
          'USB and removable media controls with content-aware policies',
          'Print, clipboard, and screenshot DLP controls',
          'Network protocol monitoring (FTP, HTTP/S, SMTP)',
        ],
      },
      {
        id: 'teramind-enterprise', label: 'Enterprise / Cloud',
        description: 'Cloud-deployed or on-premises enterprise deployment with SIEM integration.',
        pricingTier: 'Enterprise licence',
        keyFeatures: [
          'Cloud (SaaS), on-prem, and private cloud deployment options',
          'SIEM, SOAR, and ticketing system integration',
        ],
      },
      { id: 'teramind-other', label: 'Other / Custom Teramind Module', description: 'Customer-defined Teramind module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Teramind',          url: 'https://www.teramind.co/' },
      { type: 'docs',    label: 'Teramind Docs',     url: 'https://support.teramind.co/' },
      { type: 'support', label: 'Teramind Support',  url: 'https://support.teramind.co/' },
      { type: 'contact', label: 'Contact Teramind',  url: 'https://www.teramind.co/contact/' },
    ],
  },

  // ── Varonis ───────────────────────────────────────────────────────────────
  {
    id: 'varonis',
    label: 'Varonis Data Security',
    description: 'Data-centric security platform for data discovery, classification, access governance, and threat detection across cloud and on-prem.',
    category: ['DSPM', 'Data Classification', 'Insider Risk'],
    channelCoverage: {
      email:         'none',
      web:           'none',
      'saas-inline': 'none',
      'saas-api':    'full',
      endpoint:      'partial',
      genai:         'partial',
      network:       'none',
    },
    modules: [
      {
        id: 'varonis-datadvantage', label: 'DatAdvantage',
        description: 'Core data access governance — maps who has access to what data and surfaces over-exposed sensitive files.',
        pricingTier: 'Core platform licence',
        keyFeatures: [
          'Sensitive data classification across file shares, SharePoint, cloud storage',
          'Access rights analysis — who has access, who actually uses it',
          'Data exposure risk scoring and least-privilege recommendations',
        ],
      },
      {
        id: 'varonis-datalert', label: 'DatAlert / Threat Detection',
        description: 'Behavioural threat detection and insider risk alerting based on data access patterns.',
        pricingTier: 'Included in core or add-on',
        keyFeatures: [
          'UBA-based anomaly detection on data access patterns',
          'Ransomware and mass-deletion detection with automated response',
          'Alert correlation across Active Directory, DNS, VPN, and data activity',
        ],
      },
      {
        id: 'varonis-automation', label: 'Automation Engine',
        description: 'Automated remediation of stale permissions, over-exposed data, and access issues.',
        pricingTier: 'Automation add-on',
        keyFeatures: [
          'Automated access reviews and stale permission removal',
          'Zero-touch remediation workflows with audit trail',
        ],
      },
      {
        id: 'varonis-saas', label: 'SaaS / Cloud DLP',
        description: 'Data security for SaaS apps — Salesforce, GitHub, Okta, Google Workspace, Microsoft 365.',
        pricingTier: 'SaaS security add-on',
        keyFeatures: [
          'Sensitive data discovery and misconfigurations across SaaS apps',
          'GitHub secrets scanning, Salesforce exposure, Okta permission review',
        ],
      },
      {
        id: 'varonis-dspm', label: 'DSPM / Cloud Data Security',
        description: 'Cloud data security posture management for AWS, Azure, and GCP.',
        pricingTier: 'DSPM add-on',
        keyFeatures: [
          'Cloud data store discovery (S3, Azure Blob, BigQuery, Snowflake)',
          'Sensitive data inventory, misconfiguration detection, and blast-radius analysis',
        ],
      },
      { id: 'varonis-other', label: 'Other / Custom Varonis Module', description: 'Customer-defined Varonis module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Varonis',           url: 'https://www.varonis.com/' },
      { type: 'docs',    label: 'Varonis Docs',      url: 'https://documentation.varonis.com/' },
      { type: 'support', label: 'Varonis Support',   url: 'https://support.varonis.com/' },
      { type: 'contact', label: 'Contact Varonis',   url: 'https://www.varonis.com/contact' },
    ],
  },

  // ── Safetica ──────────────────────────────────────────────────────────────
  {
    id: 'safetica',
    label: 'Safetica',
    description: 'SMB and mid-market endpoint, email, and web DLP with insider risk detection. Part of the Fortra portfolio.',
    category: ['Endpoint', 'SMB DLP'],
    channelCoverage: {
      email:         'full',
      web:           'full',
      'saas-inline': 'partial',
      'saas-api':    'none',
      endpoint:      'full',
      genai:         'none',
      network:       'partial',
    },
    modules: [
      {
        id: 'safetica-one', label: 'Safetica ONE',
        description: 'Unified DLP platform combining endpoint, email, web, and cloud app data protection.',
        pricingTier: 'Base platform licence (SaaS or on-prem)',
        keyFeatures: [
          'Endpoint DLP: USB, print, clipboard, application controls on Windows/macOS',
          'Email DLP for Outlook and Gmail with block/notify/encrypt actions',
          'Web upload controls and web category-based policies',
        ],
      },
      {
        id: 'safetica-insider', label: 'Insider Risk Detection',
        description: 'Insider threat detection through behaviour analytics and data movement monitoring.',
        pricingTier: 'Included in Safetica ONE',
        keyFeatures: [
          'Risk scoring based on user activity and data access patterns',
          'Departing employee and anomalous behaviour alerting',
        ],
      },
      {
        id: 'safetica-cloud', label: 'Cloud App Controls',
        description: 'SaaS application upload controls and shadow IT detection.',
        pricingTier: 'Add-on module',
        keyFeatures: [
          'Cloud app upload/download monitoring via endpoint agent',
          'Shadow IT detection and app allow/block policies',
        ],
      },
      {
        id: 'safetica-nxt', label: 'Safetica NXT (Cloud-native)',
        description: 'Cloud-native SaaS-delivered version of Safetica with lightweight endpoint agent.',
        pricingTier: 'Safetica NXT licence',
        keyFeatures: [
          'Cloud-managed deployment, no on-prem server required',
          'Same DLP capabilities delivered via cloud-managed lightweight agent',
        ],
      },
      { id: 'safetica-other', label: 'Other / Custom Safetica Module', description: 'Customer-defined Safetica module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Safetica',          url: 'https://www.safetica.com/' },
      { type: 'docs',    label: 'Safetica Docs',     url: 'https://docs.safetica.com/' },
      { type: 'support', label: 'Safetica Support',  url: 'https://support.safetica.com/' },
      { type: 'contact', label: 'Contact Safetica',  url: 'https://www.safetica.com/contact/' },
    ],
  },

  // ── CoSoSys Endpoint Protector ────────────────────────────────────────────
  {
    id: 'endpoint-protector',
    label: 'CoSoSys Endpoint Protector',
    description: 'Cross-platform endpoint DLP and device control for Windows, macOS, and Linux.',
    category: ['Endpoint', 'Device Control'],
    channelCoverage: {
      email:         'none',
      web:           'partial',
      'saas-inline': 'none',
      'saas-api':    'none',
      endpoint:      'full',
      genai:         'none',
      network:       'none',
    },
    modules: [
      {
        id: 'epp-device-control', label: 'Device Control',
        description: 'USB and removable media control with device class policies and encryption enforcement.',
        pricingTier: 'Base licence (Device Control only available standalone)',
        keyFeatures: [
          'USB, external drive, Bluetooth, and mobile device allow/block/encrypt rules',
          'Device class and trusted device policies with audit logging',
          'Cross-platform: Windows, macOS, and Linux agent support',
        ],
      },
      {
        id: 'epp-content-aware', label: 'Content Aware Protection (CAP)',
        description: 'Content inspection DLP for files leaving endpoints via USB, web upload, email, and clipboard.',
        pricingTier: 'CAP add-on licence',
        keyFeatures: [
          'Content-based policies for file transfers, uploads, email attachments',
          'Regex, dictionary, file type, and fingerprint detection',
          'Clipboard, screenshot, and print controls',
        ],
      },
      {
        id: 'epp-enforced-encryption', label: 'Enforced Encryption',
        description: 'Automatic encryption of sensitive files copied to USB or external storage.',
        pricingTier: 'Enforced Encryption add-on',
        keyFeatures: [
          'Password-based encryption for files written to removable media',
          'Central key management and remote device wipe capability',
        ],
      },
      {
        id: 'epp-ediscovery', label: 'eDiscovery',
        description: 'Endpoint storage scanning to locate sensitive data at rest on managed devices.',
        pricingTier: 'eDiscovery add-on',
        keyFeatures: [
          'Sensitive data discovery across endpoint hard drives and network shares',
          'Remediation actions: encrypt, delete, or quarantine discovered data',
        ],
      },
      { id: 'epp-other', label: 'Other / Custom EPP Module', description: 'Customer-defined CoSoSys module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Endpoint Protector',         url: 'https://www.endpointprotector.com/' },
      { type: 'docs',    label: 'EPP Help Center',            url: 'https://helpcenter.endpointprotector.com/' },
      { type: 'support', label: 'CoSoSys Support',            url: 'https://www.endpointprotector.com/support' },
      { type: 'contact', label: 'Contact CoSoSys',            url: 'https://www.endpointprotector.com/contact/' },
    ],
  },

  // ── GTB Technologies ──────────────────────────────────────────────────────
  {
    id: 'gtb',
    label: 'GTB Technologies',
    description: 'Enterprise DLP platform with deep network, email, web, and endpoint inspection capabilities.',
    category: ['Network DLP', 'Enterprise DLP'],
    channelCoverage: {
      email:         'full',
      web:           'full',
      'saas-inline': 'partial',
      'saas-api':    'none',
      endpoint:      'partial',
      genai:         'none',
      network:       'full',
    },
    modules: [
      {
        id: 'gtb-inspector', label: 'GTB Inspector',
        description: 'Core network DLP engine for deep packet inspection across all protocols.',
        pricingTier: 'Core platform licence',
        keyFeatures: [
          'Deep packet inspection for HTTP/S, SMTP, FTP, and custom protocols',
          'Real-time block, alert, redirect, and quarantine actions',
          'Inline and out-of-band deployment modes',
        ],
      },
      {
        id: 'gtb-endpoint', label: 'GTB Endpoint Prevent',
        description: 'Endpoint agent for USB, print, clipboard, and application data controls.',
        pricingTier: 'Endpoint add-on licence',
        keyFeatures: [
          'Endpoint agent for Windows with USB, print, and clipboard controls',
          'Offline enforcement when disconnected from network',
        ],
      },
      {
        id: 'gtb-cloud', label: 'Cloud / SaaS DLP',
        description: 'Inline CASB and cloud app upload/download controls.',
        pricingTier: 'Cloud DLP add-on',
        keyFeatures: [
          'Cloud application upload control via inline proxy or API',
          'Shadow IT detection and cloud app risk classification',
        ],
      },
      {
        id: 'gtb-intercept-x', label: 'Intercept X Integration',
        description: 'Advanced detection with fingerprinting, EDM, and ML classifiers.',
        pricingTier: 'Advanced detection add-on',
        keyFeatures: [
          'Exact Data Match (EDM) for structured data detection',
          'Document fingerprinting and ML-based content classification',
        ],
      },
      { id: 'gtb-other', label: 'Other / Custom GTB Module', description: 'Customer-defined GTB Technologies module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'GTB Technologies',   url: 'https://www.gtbtechnologies.com/' },
      { type: 'docs',    label: 'GTB Resources',      url: 'https://www.gtbtechnologies.com/resources/' },
      { type: 'support', label: 'GTB Support',        url: 'https://support.gtbtechnologies.com/' },
      { type: 'contact', label: 'Contact GTB',        url: 'https://www.gtbtechnologies.com/contact/' },
    ],
  },

  // ── Spirion ───────────────────────────────────────────────────────────────
  {
    id: 'spirion',
    label: 'Spirion',
    description: 'Sensitive data discovery, classification, and remediation platform for endpoints, servers, and cloud storage.',
    category: ['Data Discovery', 'Classification', 'DSPM'],
    channelCoverage: {
      email:         'none',
      web:           'none',
      'saas-inline': 'none',
      'saas-api':    'full',
      endpoint:      'partial',
      genai:         'none',
      network:       'none',
    },
    modules: [
      {
        id: 'spirion-sdm', label: 'Sensitive Data Manager',
        description: 'Core platform for discovering, classifying, and managing sensitive data across the enterprise.',
        pricingTier: 'Core platform licence',
        keyFeatures: [
          'Sensitive data discovery across endpoints, file servers, and cloud repositories',
          'Pattern-based and ML-assisted classification for PII, PCI, PHI, and custom types',
          'Centralised inventory of sensitive data with risk prioritisation',
        ],
      },
      {
        id: 'spirion-discovery', label: 'Data Discovery',
        description: 'Automated scanning of endpoints, NAS, SharePoint, and cloud storage for sensitive data.',
        pricingTier: 'Included in core platform',
        keyFeatures: [
          'Endpoint and server scanning for sensitive files at rest',
          'SharePoint, OneDrive, Google Drive, and cloud bucket discovery',
          'Scheduled and on-demand scan policies',
        ],
      },
      {
        id: 'spirion-classification', label: 'Data Classification',
        description: 'User-driven and automated data classification labels and protection tagging.',
        pricingTier: 'Classification add-on',
        keyFeatures: [
          'Sensitivity label application to discovered data',
          'Integration with Microsoft Purview and other label frameworks',
        ],
      },
      {
        id: 'spirion-remediation', label: 'Automated Remediation',
        description: 'Automated actions on discovered sensitive data: encrypt, move, delete, or quarantine.',
        pricingTier: 'Remediation add-on',
        keyFeatures: [
          'Policy-based automated remediation on sensitive data at rest',
          'Encryption, quarantine, deletion, and access restriction workflows',
        ],
      },
      { id: 'spirion-other', label: 'Other / Custom Spirion Module', description: 'Customer-defined Spirion module.' },
    ],
    toolLinks: [
      { type: 'product', label: 'Spirion',            url: 'https://www.spirion.com/' },
      { type: 'docs',    label: 'Spirion Resources',  url: 'https://www.spirion.com/resources/' },
      { type: 'support', label: 'Spirion Support',    url: 'https://support.spirion.com/' },
      { type: 'contact', label: 'Contact Spirion',    url: 'https://www.spirion.com/contact/' },
    ],
  },

  {
    id: 'no-tool',
    label: 'No Dedicated DLP Tool',
    description: 'No dedicated DLP product yet — assess your readiness and plan your first implementation.',
    modules: [],
  },
  {
    id: 'other-tool',
    label: 'Other / Custom Tool',
    description: 'Customer-defined DLP, CASB, SSE, endpoint, email, or data security tool.',
    modules: GENERIC_MODULES,
  },
]

// ============================================================
// Q3 — Coverage Areas
// ============================================================
export const COVERAGE_AREAS: CoverageArea[] = [
  { id: 'email-dlp', label: 'Email DLP', description: 'Email body, attachments, outbound email, forwarding, auto-forwarding, mailbox-based leakage.' },
  { id: 'web-dlp', label: 'Web DLP / Browser DLP', description: 'Browser uploads, web posts, form submissions, webmail, public file transfer sites, paste sites.' },
  { id: 'endpoint-dlp', label: 'Endpoint DLP', description: 'Local file activity, copy/move/save, endpoint file use, local app activity.' },
  { id: 'removable-media', label: 'Removable Media / Device Control', description: 'USB, external drives, SD cards, mobile storage, removable devices.' },
  { id: 'printing-dlp', label: 'Printing DLP', description: 'Physical printing, network printing, print-to-PDF where supported.' },
  { id: 'saas-casb-inline', label: 'SaaS / CASB Inline DLP', description: 'Inline control for SaaS/cloud app uploads, downloads, posts, shares, and app activities.' },
  { id: 'saas-api-rest', label: 'SaaS API / At-Rest DLP', description: 'API-based scanning of stored data in SaaS apps: SharePoint, OneDrive, Google Drive, Salesforce, Box.' },
  { id: 'cloud-storage-dlp', label: 'Cloud Storage / Object Storage DLP', description: 'S3, Azure Blob, Google Cloud Storage, cloud buckets, and cloud data repositories.' },
  { id: 'genai-ai-dlp', label: 'GenAI / AI Application DLP', description: 'AI prompts, file uploads to AI tools, AI assistants, AI agents, and AI meeting assistants.' },
  { id: 'network-dlp', label: 'Network DLP', description: 'Data-in-motion monitoring across network traffic, gateways, proxies, SMTP relay, HTTP/S, FTP/SFTP.' },
  { id: 'data-discovery', label: 'Data Discovery / Storage DLP', description: 'File shares, endpoint storage, on-prem repositories, SharePoint, cloud repositories, and archived data.' },
  { id: 'other-coverage', label: 'Other / Custom Coverage Area', description: 'Customer-defined coverage area or vendor-specific capability.' },
]

// ============================================================
// Q3 — Coverage States
// ============================================================
export const COVERAGE_STATES: CoverageState[] = [
  { id: 'not-owned', label: 'Not Owned', color: 'zinc' },
  { id: 'licence-not-configured', label: 'Licence Owned — Not Configured', color: 'red' },
  { id: 'visibility-only', label: 'Visibility Only', color: 'blue' },
  { id: 'monitor-alert', label: 'Monitor / Alert', color: 'yellow' },
  { id: 'coach-warn', label: 'Coach / Warn', color: 'orange' },
  { id: 'actively-blocking', label: 'Actively Blocking', color: 'green' },
  { id: 'partially-covered', label: 'Partially Covered', color: 'purple' },
  { id: 'unknown', label: 'Unknown / Not Sure', color: 'zinc' },
  { id: 'other-state', label: 'Other / Custom', color: 'zinc' },
]

// ============================================================
// Coverage inference: module ID → coverage area IDs
// ============================================================
export const MODULE_TO_AREAS: Record<string, string[]> = {
  // Netskope
  'sse-web-casb':           ['web-dlp', 'saas-casb-inline'],
  'cloud-firewall-network': ['network-dlp'],
  'saas-api-protection':    ['saas-api-rest'],
  'cloud-storage-dspm':     ['cloud-storage-dlp', 'data-discovery'],
  'endpoint-dlp-agent':     ['endpoint-dlp', 'removable-media', 'printing-dlp'],
  'device-control':         ['removable-media'],
  'genai-app-controls':     ['genai-ai-dlp'],
  'remote-browser-isolation': ['web-dlp'],
  // Microsoft Purview
  'purview-dlp-exchange':   ['email-dlp'],
  'purview-dlp-sharepoint': ['saas-api-rest'],
  'purview-dlp-teams':      ['saas-casb-inline'],
  'purview-endpoint-dlp':   ['endpoint-dlp', 'removable-media', 'printing-dlp'],
  'purview-edge-dlp':       ['web-dlp'],
  'purview-ediscovery':     ['data-discovery'],
  'purview-data-lifecycle': ['data-discovery'],
  'purview-info-protection': ['email-dlp', 'saas-api-rest'],
  'purview-m365-e3':        ['email-dlp', 'saas-api-rest'],
  'purview-m365-e5':        ['email-dlp', 'saas-api-rest', 'saas-casb-inline'],
  'purview-suite':          ['email-dlp', 'saas-api-rest', 'saas-casb-inline', 'endpoint-dlp', 'data-discovery'],
  // Symantec
  'symantec-endpoint-prevent':  ['endpoint-dlp', 'removable-media', 'printing-dlp'],
  'symantec-endpoint-discover': ['data-discovery'],
  'symantec-network-monitor':   ['network-dlp'],
  'symantec-network-email':     ['email-dlp'],
  'symantec-network-web':       ['web-dlp'],
  'symantec-network-discover':  ['data-discovery'],
  'symantec-cloud-casb':        ['saas-casb-inline'],
  // Forcepoint
  'fp-email':              ['email-dlp'],
  'fp-endpoint':           ['endpoint-dlp', 'removable-media', 'printing-dlp'],
  'fp-network':            ['network-dlp'],
  'fp-web':                ['web-dlp'],
  'fp-cloud':              ['saas-casb-inline'],
  'fp-data-security-cloud': ['saas-api-rest', 'cloud-storage-dlp'],
  'fp-dspm':               ['data-discovery', 'cloud-storage-dlp'],
  'fp-genai':              ['genai-ai-dlp'],
  // Zscaler
  'zs-zia-cloud':     ['web-dlp', 'saas-casb-inline'],
  'zs-saas-casb':     ['saas-casb-inline', 'saas-api-rest'],
  'zs-endpoint':      ['endpoint-dlp'],
  'zs-browser-isolation': ['web-dlp'],
  'zs-genai':         ['genai-ai-dlp'],
  'zs-dspm':          ['data-discovery', 'cloud-storage-dlp'],
  // Digital Guardian
  'dg-endpoint-prevent':        ['endpoint-dlp', 'removable-media', 'printing-dlp'],
  'dg-network-dlp':             ['email-dlp', 'web-dlp', 'network-dlp'],
  'dg-cloud-dlp':               ['saas-casb-inline'],
  'dg-data-discovery':          ['data-discovery'],
  // Trellix
  'trellix-prevent':            ['email-dlp', 'web-dlp', 'network-dlp'],
  'trellix-monitor':            ['network-dlp'],
  'trellix-endpoint':           ['endpoint-dlp', 'removable-media', 'printing-dlp'],
  'trellix-discover':           ['data-discovery'],
  // Skyhigh
  'skyhigh-swg':                ['web-dlp', 'network-dlp'],
  'skyhigh-casb-inline':        ['saas-casb-inline', 'genai-ai-dlp'],
  'skyhigh-casb-api':           ['saas-api-rest'],
  // Proofpoint
  'pp-email-dlp':               ['email-dlp'],
  'pp-casb':                    ['saas-casb-inline', 'saas-api-rest'],
  'pp-endpoint':                ['endpoint-dlp', 'removable-media', 'printing-dlp', 'web-dlp'],
  // Google Workspace
  'gw-business-plus':           ['email-dlp'],
  'gw-enterprise-dlp':          ['email-dlp', 'saas-casb-inline'],
  'gw-drive-dlp':               ['saas-api-rest'],
  'gw-chrome-dlp':              ['web-dlp', 'endpoint-dlp'],
  'gw-dlp-api':                 ['data-discovery', 'cloud-storage-dlp'],
  // Palo Alto
  'pa-prisma-access':           ['web-dlp', 'saas-casb-inline', 'network-dlp'],
  'pa-enterprise-dlp':          ['email-dlp', 'web-dlp', 'saas-casb-inline', 'saas-api-rest', 'genai-ai-dlp', 'network-dlp'],
  'pa-ngfw-dlp':                ['network-dlp'],
  'pa-prisma-cloud':            ['data-discovery', 'cloud-storage-dlp'],
  // Cisco
  'cisco-secure-email':         ['email-dlp'],
  'cisco-umbrella':             ['web-dlp', 'saas-casb-inline', 'network-dlp'],
  'cisco-secure-endpoint':      ['endpoint-dlp', 'removable-media'],
  'cisco-ise':                  ['network-dlp'],
  // Nightfall
  'nightfall-discovery':     ['saas-api-rest', 'data-discovery'],
  'nightfall-slack':         ['saas-api-rest', 'saas-casb-inline'],
  'nightfall-github':        ['saas-api-rest', 'data-discovery'],
  'nightfall-google-drive':  ['saas-api-rest', 'cloud-storage-dlp'],
  'nightfall-genai':         ['genai-ai-dlp'],
  // Code42
  'incydr-core':             ['endpoint-dlp', 'web-dlp', 'saas-api-rest'],
  'incydr-endpoint':         ['endpoint-dlp', 'removable-media'],
  'incydr-cloud':            ['saas-api-rest', 'cloud-storage-dlp'],
  'incydr-lens':             ['endpoint-dlp'],
  // Teramind
  'teramind-starter':        ['endpoint-dlp', 'web-dlp', 'email-dlp'],
  'teramind-uam':            ['endpoint-dlp'],
  'teramind-dlp':            ['email-dlp', 'web-dlp', 'endpoint-dlp', 'removable-media', 'printing-dlp', 'network-dlp'],
  'teramind-enterprise':     ['endpoint-dlp', 'network-dlp'],
  // Varonis
  'varonis-datadvantage':    ['saas-api-rest', 'data-discovery'],
  'varonis-datalert':        ['saas-api-rest', 'endpoint-dlp'],
  'varonis-automation':      ['saas-api-rest', 'data-discovery'],
  'varonis-saas':            ['saas-api-rest', 'cloud-storage-dlp'],
  'varonis-dspm':            ['cloud-storage-dlp', 'data-discovery'],
  // Safetica
  'safetica-one':            ['endpoint-dlp', 'removable-media', 'printing-dlp', 'email-dlp', 'web-dlp'],
  'safetica-insider':        ['endpoint-dlp'],
  'safetica-cloud':          ['saas-casb-inline', 'web-dlp'],
  'safetica-nxt':            ['endpoint-dlp', 'email-dlp', 'web-dlp'],
  // CoSoSys Endpoint Protector
  'epp-device-control':      ['endpoint-dlp', 'removable-media'],
  'epp-content-aware':       ['endpoint-dlp', 'removable-media', 'printing-dlp', 'web-dlp', 'email-dlp'],
  'epp-enforced-encryption': ['removable-media'],
  'epp-ediscovery':          ['data-discovery', 'endpoint-dlp'],
  // GTB Technologies
  'gtb-inspector':           ['network-dlp', 'email-dlp', 'web-dlp'],
  'gtb-endpoint':            ['endpoint-dlp', 'removable-media', 'printing-dlp'],
  'gtb-cloud':               ['saas-casb-inline', 'web-dlp'],
  'gtb-intercept-x':         ['network-dlp', 'email-dlp', 'web-dlp'],
  // Spirion
  'spirion-sdm':             ['data-discovery', 'endpoint-dlp', 'saas-api-rest'],
  'spirion-discovery':       ['data-discovery', 'endpoint-dlp', 'saas-api-rest', 'cloud-storage-dlp'],
  'spirion-classification':  ['data-discovery'],
  'spirion-remediation':     ['data-discovery', 'endpoint-dlp', 'cloud-storage-dlp'],
  // Generic
  'generic-email-dlp':          ['email-dlp'],
  'generic-web-dlp':            ['web-dlp'],
  'generic-endpoint-dlp':       ['endpoint-dlp'],
  'generic-removable-media':    ['removable-media'],
  'generic-printing-dlp':       ['printing-dlp'],
  'generic-saas-casb-inline':   ['saas-casb-inline'],
  'generic-saas-api-rest':      ['saas-api-rest'],
  'generic-cloud-storage':      ['cloud-storage-dlp'],
  'generic-genai-dlp':          ['genai-ai-dlp'],
  'generic-network-dlp':        ['network-dlp'],
  'generic-data-discovery':     ['data-discovery'],
  'generic-other':              ['other-coverage'],
}

export function inferCoverageAreas(modules: Record<string, string[]>): Set<string> {
  const areas = new Set<string>()
  for (const selectedModules of Object.values(modules)) {
    for (const moduleId of selectedModules) {
      const inferred = MODULE_TO_AREAS[moduleId] ?? []
      inferred.forEach(a => areas.add(a))
    }
  }
  return areas
}

// ============================================================
// Q4 — Policy maturity options
// ============================================================
export const POLICY_PRESENCE_OPTIONS = ['Yes', 'No', 'Partial', 'Not Sure', 'Other']
export const POLICY_MODE_OPTIONS = ['Monitor', 'Coach', 'Block', 'Mixed', 'Not Sure', 'Other']
export const INCIDENT_REVIEW_OPTIONS = ['Yes', 'No', 'Partial', 'Not Sure', 'Other']

// ============================================================
// Q5 — Data Categories
// ============================================================
export const DATA_CATEGORIES: DataCategory[] = [
  { id: 'pii', label: 'PII / Personal Data', description: 'Names, IDs, contact details, personal identifiers, national IDs, personal records.' },
  { id: 'pci', label: 'PCI / Payment Card Data', description: 'Card numbers, payment card details, cardholder data, payment processing records.' },
  { id: 'phi', label: 'PHI / Health Data', description: 'Patient records, medical details, health insurance data, clinical data.' },
  { id: 'financial-data', label: 'Financial Data', description: 'Financial statements, budgets, invoices, payment records, tax records, forecasts.' },
  { id: 'hr-payroll', label: 'HR / Payroll Data', description: 'Employee records, salary, payroll, performance reviews, benefits, onboarding/offboarding data.' },
  { id: 'legal-contracts', label: 'Legal / Contract Data', description: 'Contracts, legal advice, litigation files, case documents, regulatory submissions.' },
  { id: 'source-code', label: 'Source Code', description: 'Application code, scripts, repositories, build artifacts, proprietary algorithms.' },
  { id: 'secrets-credentials', label: 'Secrets / API Keys / Credentials', description: 'Passwords, tokens, private keys, certificates, API keys, credentials, config secrets.' },
  { id: 'customer-data', label: 'Customer Data', description: 'Customer records, customer lists, account data, contracts, usage records, support history.' },
  { id: 'intellectual-property', label: 'Intellectual Property', description: 'Designs, formulas, product plans, trade secrets, research, proprietary methods.' },
  { id: 'strategy-ma', label: 'Strategy / M&A / Board Data', description: 'Strategy decks, board materials, merger/acquisition data, investment plans.' },
  { id: 'security-incident', label: 'Security / Incident Data', description: 'Security logs, incident reports, vulnerability reports, forensic evidence, SOC data.' },
  { id: 'regulated-data', label: 'Regulated Data', description: 'Data protected by specific regulations or contractual obligations.' },
  { id: 'identity-data', label: 'Authentication / Identity Data', description: 'User credentials, identity attributes, IAM exports, access tokens, group membership data.' },
  { id: 'cloud-infra', label: 'Cloud / Infrastructure Data', description: 'Cloud configs, Terraform, Kubernetes manifests, architecture diagrams, firewall rules.' },
  { id: 'ai-model-data', label: 'AI / Model Data', description: 'Prompts, embeddings, model outputs, training data, fine-tuning data, model artifacts.' },
  { id: 'research-rnd', label: 'Research / R&D Data', description: 'Research results, prototypes, experiments, designs, product innovation data.' },
  { id: 'supplier-vendor', label: 'Supplier / Vendor Data', description: 'Supplier contracts, vendor pricing, third-party records, procurement data.' },
  { id: 'operational-data', label: 'Operational Data', description: 'Logistics, manufacturing, service delivery, process data, OT/IoT records.' },
  { id: 'other-data', label: 'Other / Custom Data Category', description: 'Customer-defined data type.' },
]
