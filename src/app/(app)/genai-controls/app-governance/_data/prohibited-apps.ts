// Static reference catalog for Prohibited GenAI apps.
// This data is practitioner-maintained — not AI-generated at runtime.

export type RiskTag =
  | 'data-exfiltration'
  | 'no-enterprise-controls'
  | 'no-dpa'
  | 'trains-on-data'
  | 'biometric-data'
  | 'inappropriate-content'
  | 'autonomous-access'
  | 'impersonation-risk'
  | 'legal-risk'
  | 'malware-capable'
  | 'broad-oauth-access'

export const RISK_TAG_META: Record<RiskTag, { label: string; cls: string }> = {
  'data-exfiltration':       { label: 'Data Exfiltration',    cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  'no-enterprise-controls':  { label: 'No Ent. Controls',     cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  'no-dpa':                  { label: 'No DPA',               cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  'trains-on-data':          { label: 'Trains on Data',       cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  'biometric-data':          { label: 'Biometric Data',       cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  'inappropriate-content':   { label: 'Inappropriate',        cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  'autonomous-access':       { label: 'Autonomous Access',    cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  'impersonation-risk':      { label: 'Impersonation Risk',   cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  'legal-risk':              { label: 'Legal Risk',           cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  'malware-capable':         { label: 'Malware / Abuse Risk', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  'broad-oauth-access':      { label: 'Broad OAuth Access',   cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
}

export interface ProhibitedApp {
  slug:          string
  name:          string
  url:           string
  description:   string
  dlp_treatment: string
  risk_level:    'critical' | 'high'
  risk_tags:     RiskTag[]
}

export interface ProhibitedGroup {
  slug:        string
  name:        string
  description: string
  dlp_control: string
  apps:        ProhibitedApp[]
}

export const PROHIBITED_GROUPS: ProhibitedGroup[] = [
  {
    slug: 'ai-companion-roleplay',
    name: 'AI Companion & Roleplay Bots',
    description: 'Personal AI companions and roleplay platforms with no enterprise controls, no DPA, and conversation data used for model training. Users routinely share sensitive work context with these systems.',
    dlp_control: 'Block',
    apps: [
      {
        slug: 'character-ai',
        name: 'Character.AI',
        url: 'https://character.ai',
        description: 'AI roleplay platform allowing users to create and interact with custom AI personas. No enterprise DPA or audit logging. All conversations are used for model training by default. Users frequently share work context with fictional characters, creating an uncontrolled data exfiltration vector.',
        dlp_treatment: 'Block all HTTP/HTTPS access at proxy. Display acceptable-use policy coaching message on every access attempt. No exceptions without explicit CISO sign-off.',
        risk_level: 'high',
        risk_tags: ['data-exfiltration', 'no-dpa', 'trains-on-data', 'no-enterprise-controls'],
      },
      {
        slug: 'replika',
        name: 'Replika',
        url: 'https://replika.com',
        description: 'AI companion app designed for emotional support and personal conversation. Stores all conversation data indefinitely on third-party infrastructure. No enterprise DPA available. Users commonly share personal and professional context, making it an uncontrolled data store.',
        dlp_treatment: 'Block all access. Display coaching message with wellness resource links as an alternative support option.',
        risk_level: 'high',
        risk_tags: ['data-exfiltration', 'no-dpa', 'trains-on-data'],
      },
      {
        slug: 'chai',
        name: 'Chai',
        url: 'https://chai.ml',
        description: 'Consumer AI chatbot platform with user-created bots and no content moderation. No enterprise controls, SSO, or audit logging. Any work data shared with bots is processed on external infrastructure with no data handling controls.',
        dlp_treatment: 'Block all access.',
        risk_level: 'high',
        risk_tags: ['data-exfiltration', 'no-enterprise-controls', 'no-dpa'],
      },
      {
        slug: 'janitorai',
        name: 'JanitorAI',
        url: 'https://janitorai.com',
        description: 'Uncensored AI roleplay platform with adult content and no access controls. No enterprise DPA. Poses simultaneous HR, legal, and data security risks. Access from work devices constitutes a policy violation and potential GDPR Art. 5 breach if work data is included.',
        dlp_treatment: 'Block all access. Log violations. Repeated access should trigger HR review escalation.',
        risk_level: 'critical',
        risk_tags: ['inappropriate-content', 'data-exfiltration', 'no-dpa', 'no-enterprise-controls', 'legal-risk'],
      },
      {
        slug: 'spicychat',
        name: 'SpicyChat AI',
        url: 'https://spicychat.ai',
        description: 'Adult AI chatbot platform with explicit content and no enterprise safeguards. Accessing from work devices constitutes an AUP violation in virtually all organisations. No DPA, no data deletion guarantees.',
        dlp_treatment: 'Block all access. Escalate repeated violations to HR and Legal.',
        risk_level: 'critical',
        risk_tags: ['inappropriate-content', 'legal-risk', 'no-enterprise-controls', 'no-dpa'],
      },
    ],
  },
  {
    slug: 'nsfw-adult-ai',
    name: 'NSFW & Adult AI Platforms',
    description: 'AI platforms built primarily for adult or explicit content. These represent simultaneous HR, legal, and data security violations when accessed from enterprise devices or networks.',
    dlp_control: 'Block',
    apps: [
      {
        slug: 'crushon-ai',
        name: 'CrushOn AI',
        url: 'https://crushon.ai',
        description: 'Adult AI companion platform with NSFW characters and explicit roleplay. No enterprise data processing controls. Access from work infrastructure creates liability under harassment and AUP policies.',
        dlp_treatment: 'Block all access. Log for HR review. Enforce at both DNS and HTTPS proxy levels.',
        risk_level: 'critical',
        risk_tags: ['inappropriate-content', 'legal-risk', 'no-enterprise-controls', 'no-dpa'],
      },
      {
        slug: 'candy-ai',
        name: 'Candy AI',
        url: 'https://candy.ai',
        description: 'Adult AI companion and relationship simulator. Stores all interaction data on external servers with no enterprise DPA. Poses combined HR violation and data exfiltration risks.',
        dlp_treatment: 'Block all access. Enforce at network level.',
        risk_level: 'critical',
        risk_tags: ['inappropriate-content', 'data-exfiltration', 'no-dpa'],
      },
      {
        slug: 'dreamgf',
        name: 'DreamGF',
        url: 'https://dreamgf.ai',
        description: 'Adult AI girlfriend platform with image generation. No enterprise controls. If users upload photos for customisation, those images — including potentially biometric data — are processed on external servers with no deletion guarantees.',
        dlp_treatment: 'Block all access. Block associated domains at DNS level.',
        risk_level: 'critical',
        risk_tags: ['inappropriate-content', 'legal-risk', 'biometric-data', 'no-dpa'],
      },
      {
        slug: 'anima-ai',
        name: 'Anima AI',
        url: 'https://myanima.ai',
        description: 'AI companion with roleplay and relationship features. Stores conversation data with no enterprise DPA or data deletion guarantees. Users may disclose work information during "personal" conversations.',
        dlp_treatment: 'Block all access.',
        risk_level: 'high',
        risk_tags: ['inappropriate-content', 'no-dpa', 'data-exfiltration'],
      },
    ],
  },
  {
    slug: 'deepfake-faceswap',
    name: 'Deepfake & Face-Swap Tools',
    description: 'AI tools for face-swapping and synthetic media creation. High risk of executive/staff impersonation, creation of non-consensual images, and biometric data leakage under GDPR Art. 9 (special category data).',
    dlp_control: 'Block',
    apps: [
      {
        slug: 'deepswap',
        name: 'DeepSwap',
        url: 'https://deepswap.ai',
        description: 'AI face-swap platform for photos and videos. All uploaded content processed on external servers with no enterprise DPA. Risk of creating deceptive executive impersonation content and biometric data leakage. GDPR Art. 9 (biometric data) compliance risk.',
        dlp_treatment: 'Block all access. Block file upload to this domain at DLP proxy level.',
        risk_level: 'critical',
        risk_tags: ['biometric-data', 'impersonation-risk', 'no-dpa', 'legal-risk'],
      },
      {
        slug: 'facemagic',
        name: 'FaceMagic',
        url: 'https://www.facemagic.ai',
        description: 'AI face-swap app for photos and videos. Processes facial biometric data on third-party servers. No enterprise DPA or data deletion guarantees. GDPR special-category data risk.',
        dlp_treatment: 'Block all access. Block image and video uploads to this domain.',
        risk_level: 'high',
        risk_tags: ['biometric-data', 'impersonation-risk', 'no-dpa'],
      },
      {
        slug: 'reface',
        name: 'Reface',
        url: 'https://reface.ai',
        description: 'Face-swap and AI avatar creation app. Collects and processes facial biometric data under GDPR Art. 9 (special category data requiring explicit consent). No enterprise DPA available.',
        dlp_treatment: 'Block all access. Note GDPR biometric data risk in incident log.',
        risk_level: 'high',
        risk_tags: ['biometric-data', 'legal-risk', 'no-dpa'],
      },
      {
        slug: 'faceapp',
        name: 'FaceApp',
        url: 'https://www.faceapp.com',
        description: 'AI photo editing app that processes facial biometrics. Broad terms of service allow extensive use of facial data. Previously reviewed for data residency concerns in regulated industries. No enterprise DPA.',
        dlp_treatment: 'Block all access. Flag in data inventory as biometric data processor.',
        risk_level: 'high',
        risk_tags: ['biometric-data', 'legal-risk', 'no-dpa'],
      },
    ],
  },
  {
    slug: 'voice-cloning',
    name: 'Voice Cloning & Impersonation Tools',
    description: 'AI tools that clone or synthesise human voices from short audio samples. Critical risk of executive/staff impersonation for fraud, vishing attacks, and CEO fraud. Also raises biometric consent issues under GDPR.',
    dlp_control: 'Block (personal tier)',
    apps: [
      {
        slug: 'voice-ai',
        name: 'Voice.ai',
        url: 'https://voice.ai',
        description: 'Real-time voice changer and cloning tool. Can impersonate any person\'s voice in real time during live calls without the listener knowing. Poses serious executive fraud and vishing risk if used by malicious insiders or compromised accounts.',
        dlp_treatment: 'Block all access. Block application installation on managed endpoints. Include in voice-fraud awareness training programme.',
        risk_level: 'critical',
        risk_tags: ['impersonation-risk', 'no-enterprise-controls', 'no-dpa'],
      },
      {
        slug: 'elevenlabs-personal',
        name: 'ElevenLabs (Personal / Free Tier)',
        url: 'https://elevenlabs.io',
        description: 'High-quality AI voice cloning platform. Personal and free tiers can clone any voice from a 1-minute audio sample. Enterprise tier with controls may be permitted under a separate approval. Personal use is prohibited due to impersonation and biometric data risk.',
        dlp_treatment: 'Block personal/free-tier access. Enterprise-licensed use only, with DPA and approved workflow. Verify tier at onboarding.',
        risk_level: 'critical',
        risk_tags: ['impersonation-risk', 'biometric-data', 'legal-risk'],
      },
      {
        slug: 'playht-voice-clone',
        name: 'PlayHT (Personal)',
        url: 'https://play.ht',
        description: 'Text-to-speech platform with voice cloning capability. Cloned voice models can produce convincing audio impersonations. Personal tier has no enterprise data isolation or deletion controls.',
        dlp_treatment: 'Block personal-tier access. Enterprise licensing requires CISO approval and DPA.',
        risk_level: 'high',
        risk_tags: ['impersonation-risk', 'biometric-data', 'no-dpa'],
      },
      {
        slug: 'resemble-ai-personal',
        name: 'Resemble AI (Personal)',
        url: 'https://resemble.ai',
        description: 'Voice cloning and synthesis platform. Personal accounts store voice models on external infrastructure with no enterprise isolation or guaranteed deletion on account closure.',
        dlp_treatment: 'Block personal-tier access. Enterprise contract requires data handling review.',
        risk_level: 'high',
        risk_tags: ['impersonation-risk', 'biometric-data', 'no-dpa'],
      },
    ],
  },
  {
    slug: 'autonomous-ai-agents',
    name: 'Unapproved Autonomous AI Agents',
    description: 'AI agents with autonomous access to the web, file systems, or external APIs. No per-action human oversight. Can exfiltrate data, execute unintended actions, or cause irreversible changes across connected systems.',
    dlp_control: 'Block',
    apps: [
      {
        slug: 'agentgpt',
        name: 'AgentGPT',
        url: 'https://agentgpt.reworkd.ai',
        description: 'Web-based autonomous AI agent that executes multi-step tasks including web browsing, data collection, and API calls without per-action approval. High risk of unintended data exfiltration and exposure of internal context to the agent.',
        dlp_treatment: 'Block all access. Block associated domains at network/DNS level.',
        risk_level: 'critical',
        risk_tags: ['autonomous-access', 'data-exfiltration', 'no-enterprise-controls'],
      },
      {
        slug: 'manus-ai',
        name: 'Manus',
        url: 'https://manus.im',
        description: 'Autonomous AI agent with broad system access including file management, browser control, code execution, and external API calls. No enterprise audit trail or permission controls. Can access and transmit any data visible in the user\'s session.',
        dlp_treatment: 'Block all access. Block associated domains at network level. Include in endpoint application blocklist.',
        risk_level: 'critical',
        risk_tags: ['autonomous-access', 'data-exfiltration', 'no-enterprise-controls', 'no-dpa'],
      },
      {
        slug: 'multion',
        name: 'MultiOn',
        url: 'https://multion.ai',
        description: 'AI browser agent that operates authenticated web applications on the user\'s behalf. Can read and submit data in any open browser session — including email, CRM, cloud storage — without per-action approval.',
        dlp_treatment: 'Block all access. Block browser extension installation via MDM. Block domain at network level.',
        risk_level: 'critical',
        risk_tags: ['autonomous-access', 'data-exfiltration', 'broad-oauth-access'],
      },
      {
        slug: 'openinterpreter-cloud',
        name: 'Open Interpreter (Cloud)',
        url: 'https://openinterpreter.com',
        description: 'Cloud-hosted code execution agent that can run arbitrary Python and shell commands, access local files, and make API calls. Potential for complete local system compromise if run with elevated privileges.',
        dlp_treatment: 'Block cloud-hosted access. Self-hosted deployment requires security architecture review and network isolation.',
        risk_level: 'critical',
        risk_tags: ['autonomous-access', 'data-exfiltration', 'no-enterprise-controls'],
      },
    ],
  },
  {
    slug: 'ai-meeting-bots-unapproved',
    name: 'AI Meeting Bots (Unapproved)',
    description: 'AI meeting recorders that join calls and store full audio/transcript on third-party infrastructure. Consent and GDPR Art. 6 compliance issues arise when recording external participants. Enterprise-approved alternatives exist for most of these.',
    dlp_control: 'Block unless enterprise-approved',
    apps: [
      {
        slug: 'otter-ai-personal',
        name: 'Otter.ai (Personal)',
        url: 'https://otter.ai',
        description: 'AI meeting transcription service. Personal/free tier has no enterprise data controls, no DPA, and stores all audio recordings and transcripts on Otter\'s servers indefinitely. Enterprise plan with DPA may be permitted — personal tier is not.',
        dlp_treatment: 'Block personal-tier access. Enterprise plan requires DPA and explicit opt-in from your DLP team.',
        risk_level: 'high',
        risk_tags: ['data-exfiltration', 'no-dpa', 'legal-risk'],
      },
      {
        slug: 'fireflies-personal',
        name: 'Fireflies.ai (Personal)',
        url: 'https://fireflies.ai',
        description: 'AI notetaker that auto-joins calendar meetings and records without guaranteed individual participant notification. Creates GDPR Art. 6 (lawful basis) and Art. 13 (transparency) compliance issues when recording external parties.',
        dlp_treatment: 'Block personal-tier use. Block domain unless enterprise plan with full DPA is active.',
        risk_level: 'high',
        risk_tags: ['data-exfiltration', 'no-dpa', 'legal-risk'],
      },
      {
        slug: 'read-ai',
        name: 'Read.ai',
        url: 'https://read.ai',
        description: 'AI meeting analytics platform that captures audio, video, and biometric engagement signals (facial expression analysis). The biometric processing makes this a GDPR Art. 9 (special category) controller unless explicit consent is obtained from all participants.',
        dlp_treatment: 'Block all access unless enterprise contract with explicit GDPR Art. 9 DPA is in place and participant consent is verified.',
        risk_level: 'high',
        risk_tags: ['biometric-data', 'data-exfiltration', 'legal-risk', 'no-dpa'],
      },
      {
        slug: 'tldv',
        name: 'tl;dv',
        url: 'https://tldv.io',
        description: 'Meeting recorder and AI summariser. Records meetings and stores transcripts externally. Free tier has no enterprise data handling guarantees.',
        dlp_treatment: 'Block personal/free-tier use. Enterprise plan requires DPA review.',
        risk_level: 'high',
        risk_tags: ['data-exfiltration', 'no-dpa'],
      },
      {
        slug: 'fathom-personal',
        name: 'Fathom (Personal)',
        url: 'https://fathom.video',
        description: 'AI meeting recorder and summariser. Stores recordings on external servers. Personal tier lacks enterprise data isolation and DPA.',
        dlp_treatment: 'Block personal-tier use. Enterprise plan requires DPA review.',
        risk_level: 'high',
        risk_tags: ['data-exfiltration', 'no-dpa'],
      },
    ],
  },
  {
    slug: 'ai-scraping-automation',
    name: 'AI Scraping & Automation (Personal)',
    description: 'AI-powered automation tools with broad SaaS integration access. When connected to org accounts they can exfiltrate contacts, deals, messages, and files at scale without per-item audit trails.',
    dlp_control: 'Block unless approved',
    apps: [
      {
        slug: 'phantombuster',
        name: 'PhantomBuster (Personal)',
        url: 'https://phantombuster.com',
        description: 'AI-powered data scraping and automation platform. Requests OAuth access to LinkedIn, Slack, Google, and other org SaaS tools. Can exfiltrate contact data, internal messages, and CRM records at scale. No enterprise data handling controls on personal tier.',
        dlp_treatment: 'Block personal-tier access. Block OAuth authorisation requests from this service at IdP level.',
        risk_level: 'high',
        risk_tags: ['data-exfiltration', 'broad-oauth-access', 'no-enterprise-controls'],
      },
      {
        slug: 'clay-personal',
        name: 'Clay (Personal)',
        url: 'https://clay.com',
        description: 'AI data enrichment and automation tool with deep integrations into CRM, LinkedIn, email, and SaaS. Personal tier has no enterprise data isolation. Risk of bulk export of customer contacts, deal data, and internal communications.',
        dlp_treatment: 'Block personal-tier use. Enterprise plan requires data handling review and CISO approval.',
        risk_level: 'high',
        risk_tags: ['data-exfiltration', 'broad-oauth-access'],
      },
      {
        slug: 'bardeen-ai-personal',
        name: 'Bardeen AI (Personal)',
        url: 'https://bardeen.ai',
        description: 'AI browser automation and scraping tool. Accesses authenticated SaaS sessions and can extract and transfer data to external destinations. No per-action audit trail on personal tier.',
        dlp_treatment: 'Block browser extension installation via MDM. Block domain at network level.',
        risk_level: 'high',
        risk_tags: ['data-exfiltration', 'broad-oauth-access', 'autonomous-access'],
      },
    ],
  },
  {
    slug: 'ai-malware-hacking',
    name: 'AI Malware & Hacking Tools',
    description: 'AI tools explicitly designed or primarily used for cybercrime — phishing generation, malware authoring, social engineering, and credential theft. Zero legitimate enterprise use cases. Any access attempt should trigger SOC investigation.',
    dlp_control: 'Block + Alert SOC',
    apps: [
      {
        slug: 'wormgpt-style',
        name: 'WormGPT-style Tools',
        url: 'https://wormgpt.ai',
        description: 'Uncensored LLMs fine-tuned specifically for cybercrime — phishing email generation, malware code authoring, and social engineering scripting. No safety filters. Primarily distributed via dark web markets. Use constitutes a criminal offence under the Computer Misuse Act and equivalent legislation.',
        dlp_treatment: 'Block at DNS and proxy level. Alert SOC on any access attempt. Preserve logs for legal review.',
        risk_level: 'critical',
        risk_tags: ['malware-capable', 'legal-risk', 'no-enterprise-controls'],
      },
      {
        slug: 'fraudgpt-style',
        name: 'FraudGPT-style Tools',
        url: 'https://fraudgpt.app',
        description: 'AI tool marketed explicitly for creating fraudulent content — spear phishing campaigns, fake invoices, credential harvesting pages, and identity theft scripts. Active in underground forums. Any use constitutes a criminal offence.',
        dlp_treatment: 'Block at DNS and network layer. Any access attempt should trigger immediate security investigation and evidence preservation.',
        risk_level: 'critical',
        risk_tags: ['malware-capable', 'legal-risk'],
      },
    ],
  },
  {
    slug: 'jailbreak-bypass',
    name: 'AI Jailbreaking & Bypass Tools',
    description: 'Tools and marketplaces designed to bypass AI safety controls and circumvent DLP policies. Access signals intent to evade organisational controls and should trigger a security review.',
    dlp_control: 'Block + Alert',
    apps: [
      {
        slug: 'jailbreak-prompts',
        name: 'Jailbreak Prompt Marketplaces',
        url: 'https://www.jailbreakchat.com',
        description: 'Websites aggregating and selling prompts engineered to bypass AI safety filters. Users accessing these are actively seeking to circumvent your AI governance and DLP controls.',
        dlp_treatment: 'Block all known domains. Alert on access attempts — treat as a potential policy evasion indicator. Maintain domain blocklist updated quarterly.',
        risk_level: 'critical',
        risk_tags: ['malware-capable', 'no-enterprise-controls', 'legal-risk'],
      },
      {
        slug: 'uncensored-llm-mirrors',
        name: 'Uncensored LLM Frontends',
        url: 'https://flowgpt.com',
        description: 'Unofficial frontends to poorly-moderated or fully uncensored LLM instances. No safety filters, no data handling controls, operators often unknown. Data submitted may be logged or sold.',
        dlp_treatment: 'Block at proxy level. Maintain domain blocklist. Update quarterly as new mirrors emerge.',
        risk_level: 'critical',
        risk_tags: ['data-exfiltration', 'malware-capable', 'no-enterprise-controls', 'no-dpa'],
      },
    ],
  },
]
