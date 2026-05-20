export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'
export type CoverageStatus = 'not_assessed' | 'partial' | 'covered'
export type NetskopeSupportLevel = 'supported' | 'partial' | 'not_v1'

export interface SubchannelProtocol {
  name:      string
  category:  string
  ports:     string   // e.g. "TCP: 20, 21" or "UDP: 1812, 1813"
}

export interface ChannelSubchannel {
  name:       string
  description: string
  examples:   string
  protocols?: SubchannelProtocol[]
}

export interface ChannelActivity {
  name: string
  description: string
}

export interface ChannelRisk {
  area: string
  level: RiskLevel
  description: string
  example: string
}

export interface AssessmentQuestion {
  key: string
  area: string
  question: string
}

export interface Channel {
  slug: string
  name: string
  shortName: string
  definition: string
  netskopeSupport: NetskopeSupportLevel
  subchannels: ChannelSubchannel[]
  activities: ChannelActivity[]
  risks: ChannelRisk[]
  assessmentQuestions: AssessmentQuestion[]
}

export const CHANNELS: Channel[] = [
  // ─────────────────────────────────────────────────────────────────
  // 1. Email DLP
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'email-dlp',
    name: 'Email DLP',
    shortName: 'Email DLP',
    definition:
      'Covers data movement through email systems — body, attachments, forwarding, reply-all, distribution lists, shared mailboxes, auto-forwarding, calendar invitations, and mailbox exports. Email is one of the most common paths for accidental or intentional data leakage.',
    netskopeSupport: 'partial',
    subchannels: [],
    activities: [
      { name: 'Send',                    description: 'Send an email message.' },
      { name: 'Forward',                 description: 'Forward an existing email or thread.' },
      { name: 'Reply All',               description: 'Reply to all recipients in an email thread.' },
      { name: 'Attach File',             description: 'Attach a file to an email.' },
      { name: 'Paste in Body',           description: 'Paste content into the email body.' },
      { name: 'Add Recipient',           description: 'Add a recipient to an email.' },
      { name: 'Send to Distribution List', description: 'Send email to a group or mailing list.' },
      { name: 'Auto-Forward',            description: 'Forward email automatically through a mailbox rule.' },
      { name: 'Export Mailbox',          description: 'Export mailbox content or archive.' },
      { name: 'Download Attachment',     description: 'Download an email attachment.' },
      { name: 'Print Email',             description: 'Print an email or email attachment.' },
    ],
    risks: [
      { area: 'Misdelivery',              level: 'high',   description: 'Information may be sent to the wrong recipient due to autocomplete, manual address error, or similar names.',         example: 'Customer report sent to the wrong external address.' },
      { area: 'Personal Email Exfiltration', level: 'high', description: 'Data sent to personal email can leave corporate control and bypass retention or monitoring.',                       example: 'Customer list sent to Gmail.' },
      { area: 'Attachment Leakage',       level: 'high',   description: 'Files may be shared externally without appropriate classification, encryption, approval, or recipient validation.',   example: 'Payroll spreadsheet attached to external email.' },
      { area: 'Forwarding Leakage',       level: 'medium', description: 'Internal conversations and attached history may be forwarded to unauthorised users.',                               example: 'Internal legal thread forwarded to a vendor.' },
      { area: 'Auto-Forwarding Leakage',  level: 'high',   description: 'Mailbox rules may silently send email externally without user awareness or review.',                                example: 'Email auto-forwarded to personal mailbox.' },
      { area: 'Oversharing',              level: 'medium', description: 'Large distribution lists may expose sensitive data to unnecessary internal or external recipients.',                 example: 'Confidential report sent to all employees.' },
      { area: 'Mailbox Export Risk',      level: 'high',   description: 'Exported mailbox files may contain large volumes of historical business data.',                                     example: 'PST export containing years of customer emails.' },
      { area: 'Subject Line Exposure',    level: 'medium', description: 'Sensitive details in subject lines may be visible in notifications, previews, logs, and mobile screens.',           example: 'Incident details in email subject.' },
    ],
    assessmentQuestions: [
      { key: 'inspection_coverage',  area: 'Inspection Coverage',  question: 'Can the DLP tool inspect email body, subject, attachments, and compressed files?' },
      { key: 'recipient_context',    area: 'Recipient Context',    question: 'Can the tool distinguish internal, external business, and personal email recipients?' },
      { key: 'auto_forwarding',      area: 'Auto-Forwarding',      question: 'Can mailbox auto-forwarding and suspicious forwarding rules be detected or controlled?' },
      { key: 'large_volume',         area: 'Large Volume Movement', question: 'Can mailbox exports or bulk attachment movement be detected?' },
      { key: 'evidence',             area: 'Evidence',             question: 'Does the tool preserve enough evidence for review without overexposing sensitive data?' },
      { key: 'policy_options',       area: 'Policy Options',       question: 'Can controls be staged from monitor to coach/warn to block/quarantine?' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 2. Web DLP
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'web-dlp',
    name: 'Web DLP',
    shortName: 'Web DLP',
    definition:
      'Covers sensitive data movement through general web destinations and browser-based web activity — uploads, posts, pastes, and submissions to public websites, web portals, public file-transfer services, paste sites, forums, social media platforms, unknown websites, and uncategorized web destinations. Applies when the destination is a generic website or public web service, not a clearly identified SaaS business application.',
    netskopeSupport: 'supported',
    subchannels: [],
    activities: [
      { name: 'Upload',               description: 'Upload file or content to a website or web portal.' },
      { name: 'Post',                 description: 'Post content to a public website, forum, or social platform.' },
      { name: 'Submit Form',          description: 'Submit data through a web form.' },
      { name: 'Paste',                description: 'Paste content into a web field, paste site, or forum post.' },
      { name: 'Attach File',          description: 'Attach a file to a web-based form or message.' },
      { name: 'Download',             description: 'Download file or content from a website.' },
      { name: 'Drag and Drop Upload', description: 'Upload content via drag-and-drop to a web destination.' },
      { name: 'Publish',              description: 'Publish an article, document, or page to a public site.' },
      { name: 'Create Public Page',   description: 'Create a publicly accessible page or snippet.' },
      { name: 'Share Publicly',       description: 'Share content through a public link or social share action.' },
    ],
    risks: [
      { area: 'Unknown Web Destination',      level: 'high',     description: 'Sensitive data uploaded or submitted to websites with unknown ownership or trust level.',                          example: 'Confidential file uploaded to an uncategorized website.' },
      { area: 'Public Exposure',              level: 'high',     description: 'Content posted on public websites can be indexed, cached, copied, or viewed by anyone.',                          example: 'Internal project details posted on a public documentation site.' },
      { area: 'Public File Transfer Leakage', level: 'high',     description: 'Public file-transfer tools bypass approved corporate sharing and retention controls.',                            example: 'Payroll file sent through WeTransfer.' },
      { area: 'Web Form Leakage',             level: 'high',     description: 'Sensitive data entered into unapproved, unknown, or external online forms.',                                     example: 'Customer PII submitted into a public web form.' },
      { area: 'Paste / Snippet Exposure',     level: 'critical', description: 'Paste sites can expose credentials, source code, logs, or confidential text publicly and permanently.',          example: 'API key pasted into Pastebin.' },
      { area: 'Forum / Community Leakage',    level: 'high',     description: 'Internal technical details, logs, screenshots, or code posted into public communities.',                         example: 'Internal error logs posted on Stack Overflow.' },
      { area: 'Social Media Exposure',        level: 'high',     description: 'Business-sensitive data shared publicly through social media posts, comments, or screenshots.',                  example: 'Internal dashboard screenshot posted on LinkedIn.' },
      { area: 'External Portal Misuse',       level: 'medium',   description: 'Sensitive data submitted to legitimate external portals without classification, validation, or approval.',       example: 'Customer list uploaded to a vendor portal without approval.' },
      { area: 'Uncontrolled Publishing',      level: 'high',     description: 'Users publish documents, articles, or content containing sensitive business information.',                       example: 'Strategy document content published on a public documentation site.' },
      { area: 'Download Risk',                level: 'medium',   description: 'Files downloaded from unknown or external websites create uncontrolled copies outside corporate storage.',       example: 'Sensitive export downloaded from an external portal to a local device.' },
    ],
    assessmentQuestions: [
      { key: 'web_traffic_coverage',   area: 'Web Traffic Coverage',           question: 'Can the DLP tool inspect browser-based web traffic?' },
      { key: 'upload_inspection',      area: 'Upload Inspection',              question: 'Can the tool inspect file uploads to websites and web portals?' },
      { key: 'form_inspection',        area: 'Form Inspection',                question: 'Can the tool inspect data submitted through web forms?' },
      { key: 'paste_inspection',       area: 'Paste Inspection',               question: 'Can the tool inspect pasted content in web fields, forums, or public sites?' },
      { key: 'file_transfer_control',  area: 'Public File Transfer Control',   question: 'Can the tool detect and control uploads to public file-transfer services?' },
      { key: 'paste_site_control',     area: 'Paste Site Control',             question: 'Can the tool detect secrets, source code, or sensitive data posted to paste sites?' },
      { key: 'ssl_inspection',         area: 'SSL/TLS Inspection',             question: 'Are required web destinations decrypted and inspected where legally and technically allowed?' },
      { key: 'uncategorized_handling', area: 'Uncategorized Website Handling', question: 'Are unknown, newly registered, or uncategorized websites monitored or restricted?' },
      { key: 'bypass_handling',        area: 'Bypass Handling',                question: 'Are unmanaged browsers, VPN bypass, Do Not Decrypt rules, and proxy bypass scenarios understood?' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 3. SaaS Inline DLP
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'saas-inline',
    name: 'SaaS Inline DLP',
    shortName: 'SaaS Inline',
    definition:
      'Covers real-time inline inspection of data moving through business SaaS applications via browser or CASB traffic steering — including file uploads, downloads, posts, record creation, collaboration messages, public link creation, and external sharing in known SaaS platforms. Applies when the destination is a clearly identified SaaS business application. API-based scanning of data already stored in SaaS belongs under SaaS API / Data-at-Rest DLP.',
    netskopeSupport: 'supported',
    subchannels: [],
    activities: [
      { name: 'Upload',                    description: 'Upload file or content to a SaaS app through inline traffic.' },
      { name: 'Download',                  description: 'Download file or content from a SaaS app through inline path.' },
      { name: 'Post',                      description: 'Post content to a SaaS page, workspace, or collaboration tool.' },
      { name: 'Create Record',             description: 'Create record, ticket, case, or object in a SaaS app inline.' },
      { name: 'Attach File',               description: 'Attach file to a SaaS record, chat, or page inline.' },
      { name: 'Share',                     description: 'Share content through SaaS sharing controls inline.' },
      { name: 'Create Public Link',        description: 'Create anyone-with-link or public sharing link inline.' },
      { name: 'Add External Collaborator', description: 'Add guest, vendor, or external participant to a SaaS workspace inline.' },
    ],
    risks: [
      { area: 'SaaS Upload Leakage',    level: 'high',   description: 'Sensitive files may be uploaded to unapproved SaaS apps or inappropriate SaaS locations.',       example: 'HR report uploaded to an unapproved project management tool.' },
      { area: 'Personal SaaS Upload',   level: 'high',   description: 'Corporate data stored in personal SaaS accounts falls outside enterprise control.',               example: 'Business file uploaded to personal Google Drive.' },
      { area: 'Collaboration Leakage',  level: 'high',   description: 'Sensitive data posted into guest-enabled channels, shared workspaces, or external chats.',        example: 'Confidential customer details shared in an external Slack channel.' },
      { area: 'Browser Extension Risk', level: 'medium', description: 'Browser extensions may read or transmit sensitive page content outside approved control paths.',  example: 'Unknown extension captures data from a business SaaS portal.' },
    ],
    assessmentQuestions: [
      { key: 'saas_activity_support',  area: 'SaaS Activity Support',  question: 'Which activities are supported per SaaS app: upload, post, download, share, create record?' },
      { key: 'instance_separation',    area: 'Instance Separation',    question: 'Can the tool distinguish corporate SaaS instance from personal or consumer instance?' },
      { key: 'collaboration_controls', area: 'Collaboration Controls', question: 'Can external channels, shared workspaces, and guest collaboration be inspected?' },
      { key: 'ssl_inspection',         area: 'SSL/TLS Inspection',     question: 'Are required SaaS traffic paths decrypted and inspected where legally allowed?' },
      { key: 'bypass_handling',        area: 'Bypass Handling',        question: 'Are unmanaged browsers, extensions, and do-not-decrypt exceptions accounted for?' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 4. Endpoint & Device DLP
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'endpoint-device',
    name: 'Endpoint & Device DLP',
    shortName: 'Endpoint & Device',
    definition:
      'Covers local data movement and user actions performed on laptops, desktops, virtual desktops, and mobile devices — including removable media, printing, clipboard, screenshots, local file movement, local sync folders, Bluetooth sharing, and offline activity.',
    netskopeSupport: 'partial',
    subchannels: [
      { name: 'Endpoint Local Activity', description: 'Local file actions performed on an endpoint device.',                  examples: 'Copy file, move file, save as, rename file' },
      { name: 'Removable Media',         description: 'Data movement to or from external storage devices.',                   examples: 'USB drive, external hard disk, SD card' },
      { name: 'Printing',                description: 'Data sent to physical or virtual printers.',                           examples: 'Office printer, home printer, print to PDF' },
      { name: 'Clipboard',               description: 'Data copied or pasted between applications.',                          examples: 'Copy text, paste content, copy code snippet' },
      { name: 'Screen Capture',          description: 'Capture of content displayed on screen.',                              examples: 'Screenshot, snipping tool' },
      { name: 'Screen Recording',        description: 'Recording of content displayed on screen.',                            examples: 'Screen recording tool, meeting recording tool' },
      { name: 'Local Sync Folder',       description: 'Data moved into folders that sync with cloud services.',              examples: 'OneDrive sync folder, Dropbox sync folder, Google Drive desktop folder' },
      { name: 'Bluetooth / Nearby Sharing', description: 'Local wireless transfer from endpoint to another device.',         examples: 'Bluetooth transfer, nearby sharing, AirDrop-like sharing' },
      { name: 'Network Share Copy',      description: 'Data copied between endpoint and network shares.',                     examples: 'SMB share, NFS share, department drive, mapped drive' },
      { name: 'Local Archive / Compression', description: 'Creation or handling of compressed files on endpoint.',           examples: 'ZIP, RAR, 7z, TAR' },
      { name: 'Local Application Upload', description: 'Data uploaded through a locally installed application.',             examples: 'FTP client, desktop sync app, database client export' },
      { name: 'Offline Activity',        description: 'Data movement performed while endpoint is offline.',                   examples: 'Copy while offline, save local copy, archive while disconnected' },
      { name: 'Mobile Endpoint Activity', description: 'Data movement through mobile endpoint actions.',                     examples: 'Share sheet, open in app, mobile screenshot, mobile download' },
    ],
    activities: [
      { name: 'Copy',                   description: 'Copy data from one place to another.' },
      { name: 'Move',                   description: 'Move data from one place to another.' },
      { name: 'Save As',                description: 'Save data as a new file or to a new location.' },
      { name: 'Rename',                 description: 'Rename file or change file extension.' },
      { name: 'Archive',                description: 'Compress one or more files.' },
      { name: 'Print',                  description: 'Send content to a printer.' },
      { name: 'Print to PDF',           description: 'Convert content into PDF through print function.' },
      { name: 'Copy to Clipboard',      description: 'Copy content into clipboard.' },
      { name: 'Paste from Clipboard',   description: 'Paste clipboard content into another application.' },
      { name: 'Screenshot',             description: 'Capture screen content as an image.' },
      { name: 'Screen Record',          description: 'Record screen content as video.' },
      { name: 'Copy to USB',            description: 'Copy data to removable media.' },
      { name: 'Sync',                   description: 'Sync data using a local sync folder or sync client.' },
      { name: 'Open in App',            description: 'Open data in another local or mobile application.' },
      { name: 'Upload from App',        description: 'Upload data through a locally installed application.' },
    ],
    risks: [
      { area: 'Local Exfiltration',      level: 'medium', description: 'Data can be copied or saved locally outside approved repositories.',                                example: 'Customer file saved to local desktop.' },
      { area: 'Removable Media Leakage', level: 'high',   description: 'Data copied to removable media can physically leave corporate control.',                            example: 'Payroll file copied to USB drive.' },
      { area: 'Print Leakage',           level: 'medium', description: 'Printed documents can be lost, viewed, or shared without tracking.',                               example: 'Salary report printed at home.' },
      { area: 'Clipboard Leakage',       level: 'medium', description: 'Content copied to clipboard can be pasted into unsafe applications.',                              example: 'API key copied from terminal and pasted into chat.' },
      { area: 'Screen Capture Leakage',  level: 'medium', description: 'Screenshots or recordings can capture information outside file controls.',                         example: 'Customer dashboard screenshot shared externally.' },
      { area: 'Sync Folder Leakage',     level: 'high',   description: 'Data saved into sync folders may move to personal or unapproved cloud storage.',                   example: 'Source code saved into personal Dropbox folder.' },
      { area: 'Offline Movement',        level: 'high',   description: 'Data may be moved while the endpoint is disconnected from central controls.',                      example: 'User copies files to USB while offline.' },
      { area: 'Local Archive Bypass',    level: 'medium', description: 'Users may compress files to bypass simple file-type controls or hide content.',                    example: 'Confidential files zipped before upload.' },
      { area: 'Mobile Sharing Risk',     level: 'high',   description: 'Mobile share actions can send business data into personal apps.',                                  example: 'HR document shared through mobile share sheet.' },
    ],
    assessmentQuestions: [
      { key: 'device_coverage',     area: 'Device Coverage',     question: 'Which OS and device types are covered: Windows, macOS, VDI, mobile?' },
      { key: 'device_control',      area: 'Device Control',      question: 'Can removable media, printing, Bluetooth, clipboard, and screen capture be controlled?' },
      { key: 'offline_enforcement', area: 'Offline Enforcement', question: 'Can policies apply when the device is offline?' },
      { key: 'local_classification', area: 'Local Classification', question: 'Can labels or content inspection be applied to local files?' },
      { key: 'sync_folder_handling', area: 'Sync Folder Handling', question: 'Can local sync folders be differentiated from normal local folders?' },
      { key: 'user_experience',     area: 'User Experience',     question: 'Can the tool coach users before blocking high-risk local movement?' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 5. SaaS API / Data-at-Rest DLP
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'saas-api-data-at-rest',
    name: 'SaaS API / Data-at-Rest DLP',
    shortName: 'SaaS API / At-Rest',
    definition:
      'Covers API-based scanning, discovery, classification, exposure analysis, and remediation of data stored inside SaaS applications. This channel applies when DLP control is applied through an API connector — not real-time inline traffic inspection.',
    netskopeSupport: 'supported',
    subchannels: [
      {
        name: 'Near-Realtime Scan',
        description: 'Event-triggered API scanning that runs immediately when content is created, modified, or shared — typically within seconds to minutes of the triggering event. Provides continuous protection without waiting for a scheduled sweep.',
        examples: 'New file uploaded to SharePoint, new record created in Salesforce, new message posted in Slack workspace',
      },
      {
        name: 'Retroactive Scan',
        description: 'Scheduled or on-demand API scanning of all existing stored content in a SaaS application — used to discover historical exposure, establish a classification baseline, or audit after a policy change.',
        examples: 'Full SharePoint site content scan, historical Salesforce record audit, complete Slack workspace content review',
      },
    ],
    activities: [
      { name: 'Discover File',           description: 'Discover file, object, page, case, or record in SaaS.' },
      { name: 'Scan Object',             description: 'Scan stored object through API.' },
      { name: 'Classify Data',           description: 'Apply or detect sensitivity classification.' },
      { name: 'Detect Sensitive Data',   description: 'Find regulated, confidential, secret, or business-sensitive data.' },
      { name: 'Detect Public Link',      description: 'Identify public or anyone-with-link sharing.' },
      { name: 'Detect External Sharing', description: 'Identify external users, domains, or collaborators.' },
      { name: 'Detect Guest Access',     description: 'Identify guests in workspaces, channels, teams, or files.' },
      { name: 'Detect Over-Permission',  description: 'Identify broad access, all-employee access, or excessive permissions.' },
      { name: 'Quarantine File',         description: 'Restrict, isolate, or move file/object.' },
      { name: 'Remove Public Link',      description: 'Remove public or anonymous link.' },
      { name: 'Remove External Sharing', description: 'Remove or reduce external access.' },
      { name: 'Change Permission',       description: 'Modify access or sharing permissions.' },
      { name: 'Generate Exposure Report', description: 'Produce report of sensitive data exposure and remediation status.' },
    ],
    risks: [
      { area: 'Public Link Exposure',    level: 'high',   description: 'Files can be exposed to anyone with a link.',                                                    example: 'Customer PII file shared publicly.' },
      { area: 'External Sharing Risk',   level: 'high',   description: 'Sensitive content may be shared with external users or domains beyond the intended audience.',    example: 'Finance report shared with vendor domain.' },
      { area: 'Guest Access Risk',       level: 'high',   description: 'Guest users may retain access longer than required or gain access to sensitive spaces.',          example: 'Former vendor remains in project workspace.' },
      { area: 'Over-Permission Risk',    level: 'high',   description: 'Content may be accessible to too many internal users, groups, or all employees.',                 example: 'HR folder shared with all employees.' },
      { area: 'Sensitive Data Sprawl',   level: 'medium', description: 'Sensitive data may spread across many SaaS tools and become difficult to govern.',               example: 'Contracts stored in multiple collaboration platforms.' },
      { area: 'Stale Sharing',           level: 'medium', description: 'Old external shares may remain active after business need ends.',                                 example: 'Former partner still has access to project files.' },
      { area: 'SaaS Bulk Exposure',      level: 'high',   description: 'Large volumes of sensitive data may exist in SaaS repositories with weak sharing controls.',     example: 'Large folder of customer records externally shared.' },
    ],
    assessmentQuestions: [
      { key: 'connector_coverage',  area: 'Connector Coverage',        question: 'Which SaaS apps are integrated through API and at what permission scope?' },
      { key: 'scan_scope',          area: 'Scan Scope',                question: 'Does scanning cover files, comments, pages, records, attachments, and metadata?' },
      { key: 'sharing_visibility',  area: 'Sharing Visibility',        question: 'Can the tool detect public links, external users, guest access, and domain sharing?' },
      { key: 'remediation_actions', area: 'Remediation Actions',       question: 'Can it remove links, change permissions, quarantine, notify owners, or open tickets?' },
      { key: 'scan_frequency',      area: 'Scan Frequency',            question: 'How often are scans performed and how quickly are new exposures detected?' },
      { key: 'evidence_reporting',  area: 'Evidence and Reporting',    question: 'Can it generate exposure reports for admins, app owners, and auditors?' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 6. GenAI / AI Application DLP
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'genai-ai',
    name: 'GenAI / AI Application DLP',
    shortName: 'GenAI / AI Apps',
    definition:
      'Covers data movement into or through generative AI systems, AI assistants, AI agents, AI connectors, AI plugins, coding assistants, meeting assistants, and AI automation platforms. AI introduces distinct risks: prompt leakage, file upload exposure, connector overreach, and autonomous agent actions.',
    netskopeSupport: 'supported',
    subchannels: [
      {
        name: 'AI Web Applications',
        description: 'Browser-based access to publicly available or enterprise AI tools — the most common and highest-volume AI data movement path. Includes AI chat tools, AI research tools, and AI document tools accessed through a standard web browser.',
        examples: 'ChatGPT, Claude, Gemini, Perplexity, Grok, Microsoft Copilot web, Poe',
      },
      {
        name: 'AI API Access',
        description: 'Direct programmatic access to AI services from applications, scripts, pipelines, or developer workflows — typically carries structured or bulk business data and is harder to detect than browser-based usage.',
        examples: 'OpenAI API, Anthropic Claude API, Google Vertex AI, Azure OpenAI API, Cohere API',
      },
      {
        name: 'AI Desktop Applications',
        description: 'AI tools installed or embedded in local desktop environments — including IDE extensions, standalone AI desktop apps, and AI coding assistants running as editor plugins.',
        examples: 'GitHub Copilot (VS Code / JetBrains), Cursor, Windsurf, ChatGPT desktop app, Claude desktop app, Replit AI',
      },
      {
        name: 'AI Copilots & Embedded AI',
        description: 'AI assistants built directly into approved business applications — operating on enterprise data through service-level connectors and enterprise permissions. These have automatic broad access to business data (not just what a user pastes or uploads), require CASB API governance, and may take agentic autonomous actions inside approved business tools.',
        examples: 'Microsoft 365 Copilot, GitHub Copilot Enterprise, Salesforce Einstein, Google Gemini for Workspace, Slack AI, Zoom AI Companion',
      },
    ],
    activities: [
      { name: 'Prompt',             description: 'Submit text into AI prompt field.' },
      { name: 'Upload File',        description: 'Upload file to AI tool.' },
      { name: 'Paste Code',         description: 'Paste code, script, or configuration into AI tool.' },
      { name: 'Generate Response',  description: 'AI generates output based on user input or connected data.' },
      { name: 'Connector Read',     description: 'AI reads data from a connected source.' },
      { name: 'Agent Action',       description: 'AI agent performs an action such as send, update, post, or export.' },
      { name: 'Summarise Meeting',  description: 'AI processes meeting transcript, recording, or notes.' },
      { name: 'Train / Fine-Tune',  description: 'Data is used for model training or tuning.' },
      { name: 'Create Embedding',   description: 'Data is indexed or embedded for AI retrieval.' },
      { name: 'Export Output',      description: 'AI-generated output is exported or shared.' },
    ],
    risks: [
      { area: 'Prompt Leakage',               level: 'high',     description: 'Data pasted into AI prompts may leave approved controls or be processed in unapproved environments.',           example: 'Customer PII entered into consumer AI.' },
      { area: 'File Upload Exposure',         level: 'high',     description: 'Uploaded files may contain business, regulated, confidential, or secret data.',                                 example: 'Salary spreadsheet uploaded for summarisation.' },
      { area: 'Source Code Exposure',         level: 'high',     description: 'Proprietary code may be submitted to AI coding tools or AI chat systems.',                                      example: 'Internal code pasted into unapproved coding assistant.' },
      { area: 'Secret Leakage',               level: 'critical', description: 'Credentials, keys, tokens, private keys, or certificates may be pasted into AI tools.',                        example: 'API key submitted for debugging help.' },
      { area: 'Connector Overreach',          level: 'high',     description: 'AI connectors may access more business data than intended.',                                                   example: 'AI connected to broad mailbox or drive access.' },
      { area: 'Agentic Action Risk',          level: 'high',     description: 'AI agents may send, update, export, or move data without sufficient review.',                                  example: 'Agent emails sensitive report externally.' },
      { area: 'Meeting Summary Exposure',     level: 'medium',   description: 'AI-generated meeting summaries may contain sensitive discussions and be shared broadly.',                      example: 'Strategy meeting summarised and shared with broad group.' },
      { area: 'Retention or Training Concern', level: 'high',    description: 'Submitted data may be retained, logged, reused, embedded, or used for training beyond intended purpose.',      example: 'Internal document uploaded to consumer AI service.' },
    ],
    assessmentQuestions: [
      { key: 'ai_app_coverage',      area: 'AI App Coverage',            question: 'Which AI apps and AI categories are detected and controlled?' },
      { key: 'activity_coverage',    area: 'Activity Coverage',          question: 'Can the tool inspect prompt/post, upload, response, download, and connector read activity?' },
      { key: 'instance_separation',  area: 'Instance/Tenant Separation', question: 'Can enterprise AI instances be separated from consumer or personal AI usage?' },
      { key: 'connector_governance', area: 'Connector Governance',       question: 'Can connected sources, scopes, and permissions be assessed?' },
      { key: 'agent_control',        area: 'Agent Control',              question: 'Can agent actions be monitored, approved, blocked, or logged?' },
      { key: 'retention_risk',       area: 'Retention Risk',             question: 'Can the application record whether the AI service has enterprise retention and training controls?' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 7. Network & Protocol Egress DLP
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'network-protocol-egress',
    name: 'Network & Protocol Egress DLP',
    shortName: 'Network Egress',
    definition:
      'Covers sensitive data leaving through network-level or protocol-level paths not fully represented as Email, Web/SaaS Inline, Endpoint, SaaS API, or GenAI — including FTP, SFTP, SMTP relay, HTTP/S from workloads, SMB/NFS, DNS tunnelling, and legacy network paths.',
    netskopeSupport: 'supported',
    subchannels: [
      {
        name: 'FTP Transfer',
        description: 'Plaintext file transfer using the File Transfer Protocol — a primary DLP egress path for bulk data movement to external servers.',
        examples: 'FTP to external server, vendor file drop, batch data export',
        protocols: [
          { name: 'FTP', category: 'File Access', ports: 'TCP: 20, 21' },
        ],
      },
      {
        name: 'SFTP Transfer',
        description: 'Encrypted file transfer over SSH — commonly used for automated server-to-server transfers and vendor integrations.',
        examples: 'SFTP to unknown host, automated payroll export, vendor data feed',
        protocols: [
          { name: 'SSH / SFTP', category: 'Remote Access', ports: 'TCP: 22' },
        ],
      },
      {
        name: 'FTPS Transfer',
        description: 'FTP secured with TLS/SSL — used for legacy encrypted file transfers where SFTP is not supported.',
        examples: 'FTPS vendor transfer, legacy banking file exchange',
        protocols: [
          { name: 'FTPS', category: 'Network Services', ports: 'TCP/UDP: 989, 990' },
        ],
      },
      {
        name: 'SMTP Relay',
        description: 'Email relay traffic from application servers or mail gateways — outside the standard monitored email channel.',
        examples: 'App server SMTP relay, transactional email with sensitive data, outbound mail relay',
        protocols: [
          { name: 'SMTP',  category: 'Email', ports: 'TCP: 25, 587' },
          { name: 'SMTPS', category: 'Email', ports: 'TCP: 465' },
        ],
      },
      {
        name: 'HTTP Egress',
        description: 'Data transmitted over HTTP or HTTP/3 (QUIC) from workloads, servers, or cloud-native applications to external destinations.',
        examples: 'Server posts data to external site, application webhook, QUIC-based transfer',
        protocols: [
          { name: 'QUIC (HTTP/3)', category: 'Network Services', ports: 'UDP: 443' },
        ],
      },
      {
        name: 'HTTPS Egress',
        description: 'Encrypted HTTPS traffic from workloads or data centre servers to external hosts — difficult to inspect without TLS decryption.',
        examples: 'Workload uploads data to external host, cloud-to-cloud API call, server-side SaaS integration',
        protocols: [],
      },
      {
        name: 'SMB Network Transfer',
        description: 'File movement over SMB/CIFS protocol between servers or to untrusted network paths.',
        examples: 'SMB transfer to untrusted path, file copy to external share, lateral movement via network share',
        protocols: [
          { name: 'SMB / CIFS', category: 'File Access', ports: 'TCP/UDP: 137–139, 445' },
        ],
      },
      {
        name: 'NFS Network Transfer',
        description: 'File movement over NFS or TFTP protocol to external or untrusted mounts.',
        examples: 'NFS copy to external mount, TFTP firmware/config transfer',
        protocols: [
          { name: 'NFS',  category: 'File Access', ports: 'TCP/UDP: 111, 2049' },
          { name: 'TFTP', category: 'File Access', ports: 'UDP: 69' },
        ],
      },
      {
        name: 'Database Protocol Egress',
        description: 'Database-related network movement — bulk data leaving via database protocols rather than application layers.',
        examples: 'SQL export over network, database replication to external host, direct DB connection from external client',
        protocols: [],
      },
      {
        name: 'DNS Tunneling Indicator',
        description: 'Suspicious DNS-based data movement — DNS is frequently abused for covert data exfiltration due to its universal firewall allowance.',
        examples: 'Abnormal DNS payload, high-volume DNS queries, data encoded in DNS subdomains',
        protocols: [
          { name: 'DNS',          category: 'Network Services', ports: 'TCP/UDP: 53' },
          { name: 'DNS over TLS', category: 'Network Services', ports: 'TCP: 853' },
          { name: 'mDNS',         category: 'Network Services', ports: 'TCP/UDP: 5353' },
        ],
      },
      {
        name: 'Data Center Egress',
        description: 'Data leaving the controlled data centre network boundary — typically server-originated traffic not tied to a specific user session.',
        examples: 'Server to external IP transfer, batch export from on-prem server, data centre to cloud sync',
        protocols: [],
      },
      {
        name: 'Cloud Workload Egress',
        description: 'Data leaving cloud workloads or cloud network — VM, container, or serverless function sending data externally.',
        examples: 'VM sends logs with sensitive data externally, Lambda writes to external S3, container sends data to vendor API',
        protocols: [],
      },
      {
        name: 'Legacy Protocol',
        description: 'Older or unencrypted protocols that lack modern security, user context, or DLP inspection support — high risk due to absence of visibility.',
        examples: 'Mainframe transfer, legacy app egress, Telnet session, IMAP/POP3 external mail access',
        protocols: [
          { name: 'Telnet',    category: 'Remote Access', ports: 'TCP: 23' },
          { name: 'X-Windows', category: 'Remote Access', ports: 'TCP: 6000–6063' },
          { name: 'WINS',      category: 'Remote Access', ports: 'TCP/UDP: 1512' },
          { name: 'PPTP',      category: 'Tunneling',     ports: 'TCP: 1723' },
          { name: 'L2TP',      category: 'Tunneling',     ports: 'TCP/UDP: 1701' },
          { name: 'IMAP',      category: 'Email',         ports: 'TCP: 143' },
          { name: 'IMAPS',     category: 'Email',         ports: 'TCP: 993' },
          { name: 'POP3',      category: 'Email',         ports: 'TCP: 110' },
          { name: 'POP3S',     category: 'Email',         ports: 'TCP: 995' },
        ],
      },
      {
        name: 'Unmanaged Protocol',
        description: 'Protocols not mapped to an approved business application — traffic that cannot be tied to a known owner, workload, or data flow.',
        examples: 'Unknown TCP/UDP transfer, RDP to external host, VNC over internet, LDAP to external directory, SOCKS proxy',
        protocols: [
          { name: 'RDP',         category: 'Remote Access',    ports: 'TCP/UDP: 3389' },
          { name: 'VNC',         category: 'Remote Access',    ports: 'TCP: 5900' },
          { name: 'WinRM-HTTP',  category: 'Remote Access',    ports: 'TCP: 5985' },
          { name: 'WinRM-HTTPS', category: 'Remote Access',    ports: 'TCP: 5986' },
          { name: 'SOCKS',       category: 'Tunneling',        ports: 'TCP/UDP: 1080' },
          { name: 'IPSec NAT-T', category: 'Tunneling',        ports: 'UDP: 4500' },
          { name: 'IKE',         category: 'Tunneling',        ports: 'UDP: 500' },
          { name: 'STUN',        category: 'Network Services', ports: 'TCP/UDP: 3478 · UDP: 3478–3481' },
          { name: 'STUNS',       category: 'Network Services', ports: 'TCP/UDP: 5349' },
          { name: 'BGP',         category: 'Network Services', ports: 'TCP: 179' },
          { name: 'SSDP',        category: 'Network Services', ports: 'TCP/UDP: 1900' },
          { name: 'SNMP',        category: 'Network Services', ports: 'TCP/UDP: 161, 162' },
          { name: 'SYSLOG',      category: 'Network Services', ports: 'UDP: 514 · TCP/UDP: 601, 6514' },
          { name: 'NTP',         category: 'Network Services', ports: 'TCP/UDP: 123' },
          { name: 'DHCP',        category: 'Network Services', ports: 'UDP: 67, 68' },
          { name: 'DHCP6',       category: 'Network Services', ports: 'UDP: 546, 547' },
          { name: 'LDAP',        category: 'Authentication',   ports: 'TCP/UDP: 389, 3268' },
          { name: 'LDAPS',       category: 'Authentication',   ports: 'TCP: 636 · TCP/UDP: 3269' },
          { name: 'Kerberos',    category: 'Authentication',   ports: 'TCP/UDP: 88, 464' },
          { name: 'RADIUS',      category: 'Authentication',   ports: 'UDP: 1812, 1813' },
        ],
      },
    ],
    activities: [
      { name: 'Transmit',               description: 'Transmit data over network.' },
      { name: 'Upload',                 description: 'Upload data over protocol.' },
      { name: 'Download',               description: 'Download data over protocol.' },
      { name: 'Stream',                 description: 'Send continuous data stream.' },
      { name: 'Post',                   description: 'Send data using HTTP/S post or equivalent.' },
      { name: 'Connect',                description: 'Establish connection to external host.' },
      { name: 'Transfer File',          description: 'Transfer file over protocol.' },
      { name: 'Relay',                  description: 'Relay message or payload through server/protocol.' },
      { name: 'Exfiltration Indicator', description: 'Detect suspicious network exfiltration pattern.' },
    ],
    risks: [
      { area: 'Protocol-Level Exfiltration', level: 'high',     description: 'Data may leave outside normal application controls.',                                             example: 'Customer data sent over FTP.' },
      { area: 'Legacy Transfer Risk',        level: 'high',     description: 'Older protocols may lack modern security, user context, encryption, and monitoring.',              example: 'Legacy app sends file externally.' },
      { area: 'Server Egress Risk',          level: 'high',     description: 'Workloads may send data directly to external hosts without normal user-level control.',            example: 'Server uploads report to unknown IP.' },
      { area: 'Unmanaged Protocol Risk',     level: 'high',     description: 'Data may move through protocols not tied to approved business applications.',                      example: 'Unknown TCP transfer carrying sensitive content.' },
      { area: 'Unencrypted Transfer',        level: 'high',     description: 'Data may travel without adequate transport protection.',                                           example: 'HR file sent over unencrypted protocol.' },
      { area: 'Data Centre Leakage',         level: 'high',     description: 'Data may leave controlled data centre networks.',                                                  example: 'Database export sent outside network.' },
      { area: 'Cloud Workload Leakage',      level: 'high',     description: 'Cloud workloads may transmit data externally through uncontrolled egress paths.',                  example: 'VM sends logs with sensitive data externally.' },
      { area: 'DNS Tunneling Risk',          level: 'critical', description: 'DNS traffic may indicate hidden or suspicious data movement.',                                     example: 'Abnormal DNS queries carrying encoded data.' },
    ],
    assessmentQuestions: [
      { key: 'protocol_coverage',     area: 'Protocol Coverage',         question: 'Which protocols are inspected: FTP, SFTP, HTTP/S, SMTP relay, SMB, NFS, database protocols, DNS?' },
      { key: 'egress_visibility',     area: 'Egress Visibility',         question: 'Can the tool identify sensitive data leaving data centre or cloud workload networks?' },
      { key: 'encryption_handling',   area: 'Encryption Handling',       question: 'Can encrypted traffic be inspected where allowed, or at least identified by metadata?' },
      { key: 'application_mapping',   area: 'Application Mapping',       question: 'Can protocol traffic be mapped to application, owner, server, or workload?' },
      { key: 'legacy_coverage',       area: 'Legacy Coverage',           question: 'Are legacy systems and unmanaged protocols included in assessment?' },
      { key: 'separation_from_other', area: 'Separation from Web/Email', question: 'Are email and web controls tracked separately to avoid duplicate scoring?' },
    ],
  },
]

export const CHANNEL_SLUGS = CHANNELS.map(c => c.slug)

export function getChannel(slug: string): Channel | undefined {
  return CHANNELS.find(c => c.slug === slug)
}
