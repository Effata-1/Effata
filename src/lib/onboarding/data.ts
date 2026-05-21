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

export interface DLPTool {
  id: string
  label: string
  description: string
  modules: Module[]
  category?: string[]
  channelCoverage?: DlpToolChannelCoverage
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
  { id: 'generic-email-dlp', label: 'Email DLP', description: 'Email body, attachment, forwarding, and outbound email controls.' },
  { id: 'generic-web-dlp', label: 'Web DLP', description: 'Browser upload, web post, file transfer, and public web controls.' },
  { id: 'generic-endpoint-dlp', label: 'Endpoint DLP', description: 'Local endpoint file activity and endpoint data controls.' },
  { id: 'generic-removable-media', label: 'Removable Media / Device Control', description: 'USB, external drive, removable media, and peripheral controls.' },
  { id: 'generic-printing-dlp', label: 'Printing DLP', description: 'Printing and print-to-PDF controls where available.' },
  { id: 'generic-saas-casb-inline', label: 'SaaS / CASB Inline', description: 'Inline SaaS and cloud app traffic controls.' },
  { id: 'generic-saas-api-rest', label: 'SaaS API / At-Rest Scanning', description: 'API-based SaaS scanning and remediation.' },
  { id: 'generic-cloud-storage', label: 'Cloud Storage / Object Storage DLP', description: 'Cloud storage discovery, bucket scanning, and object storage protection.' },
  { id: 'generic-genai-dlp', label: 'GenAI / AI Application DLP', description: 'AI prompt, upload, app, assistant, and connector controls.' },
  { id: 'generic-network-dlp', label: 'Network DLP', description: 'Network data-in-motion monitoring and enforcement.' },
  { id: 'generic-data-discovery', label: 'Data Discovery / Storage DLP', description: 'File share, endpoint storage, repository, and archive discovery.' },
  { id: 'generic-classification', label: 'Classification / Labeling', description: 'Data classification, labels, and protection integration.' },
  { id: 'generic-analytics', label: 'Analytics / Reporting', description: 'Dashboards, reporting, and incident analytics.' },
  { id: 'generic-insider-risk', label: 'Insider Risk / UEBA', description: 'User risk, behavioral analytics, and insider risk capabilities.' },
  { id: 'generic-other', label: 'Other / Custom Capability', description: 'Customer-defined capability.' },
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
      { id: 'sse-web-casb', label: 'SSE / Web & CASB Inline', description: 'Inline web, cloud, and SaaS traffic inspection and policy enforcement.' },
      { id: 'cloud-firewall-network', label: 'Cloud Firewall / Network Security', description: 'Network/security inspection depending on Netskope deployment.' },
      { id: 'saas-api-protection', label: 'SaaS API Protection', description: 'API-based scanning and remediation for supported SaaS applications.' },
      { id: 'cloud-storage-dspm', label: 'Cloud Storage / DSPM', description: 'Discovery and posture-oriented data security for cloud/object storage.' },
      { id: 'endpoint-dlp-agent', label: 'Endpoint DLP / Endpoint Agent', description: 'Endpoint data movement controls: USB, print, clipboard, Bluetooth, and local activities.' },
      { id: 'device-control', label: 'Device Control', description: 'Removable media and device-level controls.' },
      { id: 'genai-app-controls', label: 'GenAI App Controls', description: 'GenAI application visibility, coaching, and enforcement.' },
      { id: 'private-access-ztna', label: 'Private Access / ZTNA', description: 'Private application access context and traffic steering.' },
      { id: 'advanced-analytics', label: 'Advanced Analytics / Reporting', description: 'Analytics, dashboards, and reporting capability.' },
      { id: 'remote-browser-isolation', label: 'Remote Browser Isolation', description: 'Isolated browsing/data interaction where licensed.' },
      { id: 'netskope-other', label: 'Other / Custom Netskope Module', description: 'Customer-defined Netskope licence/module.' },
    ],
  },
  {
    id: 'microsoft-purview',
    label: 'Microsoft Purview',
    description: 'Microsoft-native DLP with deep M365 integration, endpoint agent, and compliance suite.',
    category: ['Email', 'Endpoint', 'CASB', 'Compliance'],
    channelCoverage: { email: 'full', web: 'full', 'saas-inline': 'partial', 'saas-api': 'full', endpoint: 'full', genai: 'partial', network: 'partial' },
    modules: [
      { id: 'purview-m365-e3', label: 'Microsoft 365 E3', description: 'Baseline M365 compliance and information protection capabilities.' },
      { id: 'purview-m365-e5', label: 'Microsoft 365 E5', description: 'Advanced compliance, security, and Purview capabilities.' },
      { id: 'purview-suite', label: 'Microsoft Purview Suite / Compliance Add-on', description: 'Advanced Purview compliance, DLP, insider risk, audit, eDiscovery, and governance.' },
      { id: 'purview-info-protection', label: 'Information Protection / Sensitivity Labels', description: 'Classification, labeling, encryption, and protection controls.' },
      { id: 'purview-dlp-exchange', label: 'DLP for Exchange', description: 'Email DLP for Exchange Online.' },
      { id: 'purview-dlp-sharepoint', label: 'DLP for SharePoint / OneDrive', description: 'DLP for stored/shared files in SharePoint and OneDrive.' },
      { id: 'purview-dlp-teams', label: 'DLP for Teams / Collaboration', description: 'DLP for Teams messages and collaboration contexts.' },
      { id: 'purview-endpoint-dlp', label: 'Endpoint DLP', description: 'Endpoint monitoring and controls for onboarded Windows/macOS devices.' },
      { id: 'purview-edge-dlp', label: 'Microsoft Edge / Browser DLP', description: 'Browser and inline web-related DLP controls.' },
      { id: 'purview-insider-risk', label: 'Insider Risk Management', description: 'User risk and insider risk workflows.' },
      { id: 'purview-comm-compliance', label: 'Communication Compliance', description: 'Communication review and compliance workflows.' },
      { id: 'purview-ediscovery', label: 'eDiscovery / Audit', description: 'Investigation, evidence, audit, and compliance review capabilities.' },
      { id: 'purview-data-lifecycle', label: 'Data Lifecycle / Records Management', description: 'Retention, lifecycle, and records governance.' },
      { id: 'purview-other', label: 'Other / Custom Microsoft Module', description: 'Customer-defined Microsoft/Purview licence/module.' },
    ],
  },
  {
    id: 'symantec-dlp',
    label: 'Symantec DLP / Broadcom DLP',
    description: 'Enterprise DLP with strong endpoint agent and network coverage. Now part of Broadcom.',
    category: ['Endpoint', 'Network', 'Email'],
    channelCoverage: { email: 'full', web: 'full', 'saas-inline': 'partial', 'saas-api': 'partial', endpoint: 'full', genai: 'none', network: 'full' },
    modules: [
      { id: 'symantec-enforce', label: 'Enforce Platform / Management Server', description: 'Central DLP management, policy, incident, and administration console.' },
      { id: 'symantec-endpoint-prevent', label: 'Endpoint Prevent', description: 'Endpoint activity monitoring and enforcement.' },
      { id: 'symantec-endpoint-discover', label: 'Endpoint Discover', description: 'Discovery of sensitive data on endpoint storage.' },
      { id: 'symantec-network-monitor', label: 'Network Monitor', description: 'Passive network monitoring for data in motion.' },
      { id: 'symantec-network-email', label: 'Network Prevent for Email', description: 'Email prevent/enforcement integration.' },
      { id: 'symantec-network-web', label: 'Network Prevent for Web', description: 'Web/proxy prevent/enforcement integration.' },
      { id: 'symantec-network-discover', label: 'Network Discover', description: 'Discovery of sensitive data in network repositories and file shares.' },
      { id: 'symantec-cloud-casb', label: 'Cloud / CASB Integration', description: 'Cloud or CASB-connected DLP use cases where integrated.' },
      { id: 'symantec-data-insight', label: 'Data Insight / Data Ownership Context', description: 'Data ownership and access context where available.' },
      { id: 'symantec-other', label: 'Other / Custom Symantec Module', description: 'Customer-defined Symantec/Broadcom DLP module.' },
    ],
  },
  {
    id: 'forcepoint-dlp',
    label: 'Forcepoint DLP / Forcepoint Data Security',
    description: 'Behaviour-based DLP with risk-adaptive policies across endpoint, network, and cloud.',
    category: ['Endpoint', 'Network', 'CASB'],
    channelCoverage: { email: 'full', web: 'full', 'saas-inline': 'partial', 'saas-api': 'partial', endpoint: 'full', genai: 'partial', network: 'full' },
    modules: [
      { id: 'fp-core', label: 'Forcepoint DLP Core / Management', description: 'Central DLP policy, incident, and management capability.' },
      { id: 'fp-email', label: 'DLP for Email', description: 'Outbound email DLP and email protection workflows.' },
      { id: 'fp-endpoint', label: 'DLP for Endpoint', description: 'Endpoint monitoring and control.' },
      { id: 'fp-network', label: 'DLP for Network', description: 'Data-in-motion/network DLP use cases.' },
      { id: 'fp-web', label: 'DLP for Web', description: 'Web channel DLP and web traffic protection.' },
      { id: 'fp-cloud', label: 'DLP for Cloud Applications', description: 'Cloud application and SaaS DLP controls.' },
      { id: 'fp-data-security-cloud', label: 'Data Security Cloud', description: 'Unified data security, discovery, classification, and enforcement platform.' },
      { id: 'fp-dspm', label: 'DSPM / Data Discovery', description: 'Data security posture, discovery, and data risk visibility.' },
      { id: 'fp-risk-adaptive', label: 'Risk-Adaptive Protection / Insider Risk', description: 'Risk-adaptive controls based on user and behavior context.' },
      { id: 'fp-genai', label: 'GenAI / ChatGPT Data Protection', description: 'AI usage/data protection controls where available.' },
      { id: 'fp-other', label: 'Other / Custom Forcepoint Module', description: 'Customer-defined Forcepoint module.' },
    ],
  },
  {
    id: 'zscaler-dlp',
    label: 'Zscaler DLP / Zscaler Data Protection',
    description: 'Cloud-native SWG and CASB with unified DLP policy engine across web and SaaS.',
    category: ['SWG', 'CASB', 'ZTNA'],
    channelCoverage: { email: 'none', web: 'full', 'saas-inline': 'full', 'saas-api': 'partial', endpoint: 'partial', genai: 'partial', network: 'full' },
    modules: [
      { id: 'zs-zia-cloud', label: 'Zscaler Internet Access / Cloud DLP', description: 'Inline cloud/web DLP through Zscaler Internet Access.' },
      { id: 'zs-edm', label: 'Exact Data Match / Indexed Data Matching', description: 'Structured data matching capability where licensed/configured.' },
      { id: 'zs-idm', label: 'Document Fingerprinting / IDM', description: 'Document or content fingerprinting where licensed/configured.' },
      { id: 'zs-saas-casb', label: 'SaaS / CASB Controls', description: 'SaaS application control and cloud app governance capabilities.' },
      { id: 'zs-endpoint', label: 'Endpoint DLP', description: 'Endpoint data protection and controls where licensed.' },
      { id: 'zs-browser-isolation', label: 'Browser Isolation', description: 'Isolated browsing and controlled data interaction.' },
      { id: 'zs-genai', label: 'GenAI / AI Data Protection', description: 'AI app visibility and data protection controls where available.' },
      { id: 'zs-device', label: 'Device / BYOD Controls', description: 'Device-based context and controls depending on deployment.' },
      { id: 'zs-dspm', label: 'Data Discovery / DSPM', description: 'Data discovery/posture capability where available.' },
      { id: 'zs-other', label: 'Other / Custom Zscaler Module', description: 'Customer-defined Zscaler module.' },
    ],
  },
  {
    id: 'digital-guardian',
    label: 'Digital Guardian / Fortra',
    description: 'Purpose-built endpoint DLP with deep content inspection and user activity monitoring.',
    category: ['Endpoint'],
    channelCoverage: { email: 'partial', web: 'partial', 'saas-inline': 'none', 'saas-api': 'none', endpoint: 'full', genai: 'none', network: 'partial' },
    modules: GENERIC_MODULES,
  },
  {
    id: 'trellix-dlp',
    label: 'Trellix DLP',
    description: 'Unified DLP across email, web, network, and endpoint. Formerly McAfee DLP.',
    category: ['Email', 'Endpoint', 'Network'],
    channelCoverage: { email: 'full', web: 'full', 'saas-inline': 'partial', 'saas-api': 'partial', endpoint: 'full', genai: 'none', network: 'full' },
    modules: GENERIC_MODULES,
  },
  {
    id: 'skyhigh-security',
    label: 'Skyhigh Security',
    description: 'CASB and SWG specialist with strong cloud data protection and inline inspection.',
    category: ['CASB', 'SWG'],
    channelCoverage: { email: 'none', web: 'full', 'saas-inline': 'full', 'saas-api': 'full', endpoint: 'none', genai: 'partial', network: 'full' },
    modules: GENERIC_MODULES,
  },
  {
    id: 'proofpoint-dlp',
    label: 'Proofpoint Enterprise DLP',
    description: 'Email-first DLP with insider threat detection and information protection.',
    category: ['Email', 'Insider Risk'],
    channelCoverage: { email: 'full', web: 'partial', 'saas-inline': 'partial', 'saas-api': 'partial', endpoint: 'partial', genai: 'none', network: 'none' },
    modules: GENERIC_MODULES,
  },
  {
    id: 'google-workspace-dlp',
    label: 'Google Workspace DLP',
    description: 'Native DLP for Google Workspace apps, Gmail, and Chrome Enterprise browser.',
    category: ['Email', 'CASB'],
    channelCoverage: { email: 'full', web: 'partial', 'saas-inline': 'full', 'saas-api': 'partial', endpoint: 'none', genai: 'partial', network: 'none' },
    modules: GENERIC_MODULES,
  },
  {
    id: 'palo-alto-dlp',
    label: 'Palo Alto Networks / Prisma Access / Enterprise DLP',
    description: 'Enterprise DLP via Prisma Access SASE with SWG and CASB inline coverage.',
    category: ['SWG', 'CASB', 'NGFW'],
    channelCoverage: { email: 'none', web: 'full', 'saas-inline': 'full', 'saas-api': 'partial', endpoint: 'partial', genai: 'partial', network: 'full' },
    modules: GENERIC_MODULES,
  },
  {
    id: 'cisco-dlp',
    label: 'Cisco Secure Access / Cisco DLP',
    description: 'Email and network DLP via Cisco Secure suite and Umbrella.',
    category: ['Email', 'Network'],
    channelCoverage: { email: 'full', web: 'partial', 'saas-inline': 'partial', 'saas-api': 'none', endpoint: 'partial', genai: 'none', network: 'partial' },
    modules: GENERIC_MODULES,
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
