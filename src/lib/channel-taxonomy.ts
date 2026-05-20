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
    subchannels: [
      { name: 'Internal Email',       description: 'Email sent within the organisation.',                              examples: 'Employee-to-employee email, team mailbox communication' },
      { name: 'External Business Email', description: 'Email sent to business recipients outside the organisation.',  examples: 'Customer, vendor, partner, regulator' },
      { name: 'Personal Email',        description: 'Email sent to personal or free-mail accounts.',                  examples: 'Gmail, Yahoo, Outlook.com, Proton Mail' },
      { name: 'Webmail',               description: 'Browser-based email usage.',                                     examples: 'Gmail in browser, Outlook web access' },
      { name: 'Email Attachment',      description: 'File attached to an email message.',                             examples: 'PDF, Word document, Excel sheet, ZIP file' },
      { name: 'Email Body',            description: 'Content included directly in the message body.',                 examples: 'Customer data pasted into email text' },
      { name: 'Subject Line',          description: 'Information included in the email subject.',                     examples: 'Customer name, case ID, incident title' },
      { name: 'Email Forward',         description: 'Existing email thread forwarded to another recipient.',          examples: 'Internal thread forwarded to vendor' },
      { name: 'Reply All',             description: 'Email thread expanded to a larger audience.',                    examples: 'Reply-all to internal and external users' },
      { name: 'Auto-Forwarding',       description: 'Mailbox rule that forwards email automatically.',               examples: 'Auto-forward to external mailbox' },
      { name: 'Shared Mailbox',        description: 'Email handled through a department or team mailbox.',            examples: 'HR mailbox, finance mailbox, support mailbox' },
      { name: 'Distribution List',     description: 'Email sent to a group or large audience.',                       examples: 'All employees, regional group, customer distribution list' },
      { name: 'Calendar Invite',       description: 'Information included in meeting invite.',                        examples: 'Legal meeting details, project attachments' },
      { name: 'Mailbox Export',        description: 'Export of mailbox or archive data.',                             examples: 'PST export, OST export, email archive download' },
    ],
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
  // 2. Web & SaaS Inline DLP
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'web-saas-inline',
    name: 'Web & SaaS Inline DLP',
    shortName: 'Web & SaaS Inline',
    definition:
      'Covers real-time browser, proxy, secure web gateway, CASB inline, or traffic steering inspection of data moving to websites and SaaS applications — including uploads, posts, form submissions, paste activity, file transfer sites, and collaboration tools.',
    netskopeSupport: 'supported',
    subchannels: [
      { name: 'Browser Upload',         description: 'File uploaded through a browser to a generic website.',              examples: 'Upload to unknown website, upload to web portal' },
      { name: 'Web Form Post',          description: 'Data submitted through an online form.',                              examples: 'Customer data entered into web form' },
      { name: 'SaaS Upload',            description: 'File or content uploaded to SaaS through inline path.',              examples: 'SharePoint upload, Google Drive upload, Salesforce attachment' },
      { name: 'SaaS Download',          description: 'File or content downloaded from SaaS through inline path.',          examples: 'Download report from SaaS app' },
      { name: 'SaaS Post / Create',     description: 'Record, comment, page, case, or message created in SaaS.',          examples: 'Create ServiceNow case, post Teams message' },
      { name: 'Public File Transfer',   description: 'Use of public file transfer services.',                              examples: 'WeTransfer, TransferNow, SendAnywhere' },
      { name: 'Paste Site',             description: 'Use of public paste or text sharing sites.',                         examples: 'Pastebin, public Gist' },
      { name: 'Forum / Community',      description: 'Posting content to public or semi-public communities.',             examples: 'Reddit, Stack Overflow, public forums' },
      { name: 'Social Media',           description: 'Posting or uploading data to social platforms.',                     examples: 'LinkedIn, X, Facebook' },
      { name: 'Collaboration Messaging', description: 'Chat, channel, meeting chat, or workspace messages.',              examples: 'Teams, Slack, Google Chat, Zoom Chat' },
      { name: 'Personal SaaS Instance', description: 'Non-corporate or personal instance of SaaS/cloud app.',             examples: 'Personal Drive, personal Dropbox, personal Notion' },
      { name: 'Unknown Website',        description: 'Website that is not categorised or trusted.',                       examples: 'New domain, uncategorised web app' },
      { name: 'Browser Extension',      description: 'Browser extension that can read, capture, or send content.',        examples: 'Unknown Chrome extension, data capture add-on' },
    ],
    activities: [
      { name: 'Upload',                 description: 'Upload file or content through a website or SaaS application.' },
      { name: 'Download',               description: 'Download file or content from a website or SaaS application.' },
      { name: 'Post',                   description: 'Post content to a website, SaaS page, forum, or collaboration space.' },
      { name: 'Submit Form',            description: 'Submit data through a web form.' },
      { name: 'Paste',                  description: 'Paste content into a web field.' },
      { name: 'Create Record',          description: 'Create a record, ticket, case, or object in SaaS.' },
      { name: 'Attach File',            description: 'Attach file to a SaaS record, chat, ticket, or page.' },
      { name: 'Share',                  description: 'Share content through SaaS or collaboration application.' },
      { name: 'Create Public Link',     description: 'Create anyone-with-link or public sharing link through inline workflow.' },
      { name: 'Add External Collaborator', description: 'Add guest, vendor, customer, or external participant.' },
      { name: 'Extension Read',         description: 'Browser extension reads page or file content.' },
      { name: 'Extension Send',         description: 'Browser extension sends content externally.' },
    ],
    risks: [
      { area: 'Unknown Web Destination', level: 'high',     description: 'Data may be uploaded to websites with unknown ownership, trust, or security posture.',         example: 'Confidential file uploaded to uncategorised site.' },
      { area: 'Public Exposure',         level: 'high',     description: 'Content posted to public sites can be indexed, copied, or viewed by anyone.',                  example: 'Internal notes posted to a public forum.' },
      { area: 'SaaS Upload Leakage',     level: 'high',     description: 'Sensitive files may be uploaded to unapproved SaaS apps or inappropriate SaaS locations.',     example: 'HR report uploaded to unapproved project tool.' },
      { area: 'Personal SaaS Upload',    level: 'high',     description: 'Corporate data may be stored in personal SaaS accounts outside enterprise control.',           example: 'Business file uploaded to personal Drive.' },
      { area: 'File Transfer Leakage',   level: 'high',     description: 'Public file transfer tools may bypass approved sharing controls.',                             example: 'Payroll file sent through public transfer service.' },
      { area: 'Form Submission Leakage', level: 'high',     description: 'Sensitive data may be submitted to unapproved, external, or unknown forms.',                   example: 'PII entered into unknown web form.' },
      { area: 'Paste Site Exposure',     level: 'critical', description: 'Paste sites can expose secrets, source code, or confidential text publicly.',                  example: 'API key posted to Pastebin.' },
      { area: 'Collaboration Leakage',   level: 'high',     description: 'Sensitive data may be posted into guest-enabled channels, shared workspaces, or external chats.', example: 'Confidential customer details shared in external Slack channel.' },
      { area: 'Browser Extension Risk',  level: 'medium',   description: 'Extensions may read or transmit sensitive page content outside approved control paths.',       example: 'Extension captures data from business portal.' },
    ],
    assessmentQuestions: [
      { key: 'inline_coverage',       area: 'Inline Coverage',        question: 'Can the tool inspect browser uploads, posts, form submissions, and paste activity?' },
      { key: 'saas_activity_support', area: 'SaaS Activity Support',  question: 'Which activities are supported per SaaS app: upload, post, download, share, create record?' },
      { key: 'instance_separation',   area: 'Instance Separation',    question: 'Can the tool distinguish corporate SaaS instance from personal or consumer instance?' },
      { key: 'collaboration_controls', area: 'Collaboration Controls', question: 'Can external channels, shared workspaces, and guest collaboration be inspected?' },
      { key: 'ssl_inspection',        area: 'SSL/TLS Inspection',      question: 'Are required traffic paths decrypted and inspected where allowed?' },
      { key: 'bypass_handling',       area: 'Bypass Handling',         question: 'Are unmanaged browsers, extensions, and do-not-decrypt exceptions understood?' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 3. Endpoint & Device DLP
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
  // 4. SaaS API / Data-at-Rest DLP
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'saas-api-data-at-rest',
    name: 'SaaS API / Data-at-Rest DLP',
    shortName: 'SaaS API / At-Rest',
    definition:
      'Covers API-based scanning, discovery, classification, exposure analysis, and remediation of data stored inside SaaS applications. This channel applies when DLP control is applied through an API connector — not real-time inline traffic inspection.',
    netskopeSupport: 'supported',
    subchannels: [
      { name: 'SaaS File Storage',       description: 'File storage, sync, and sharing platforms.',                          examples: 'SharePoint, OneDrive, Google Drive, Box, Dropbox' },
      { name: 'CRM Data',                description: 'Customer relationship management systems.',                           examples: 'Salesforce, Dynamics, HubSpot, Zoho CRM' },
      { name: 'Collaboration Workspace', description: 'Team collaboration and messaging workspaces.',                        examples: 'Teams, Slack, Google Chat' },
      { name: 'HR SaaS',                 description: 'Human resources applications.',                                       examples: 'Workday, SuccessFactors, BambooHR' },
      { name: 'Finance / ERP SaaS',      description: 'Finance and enterprise resource planning systems.',                   examples: 'SAP, Oracle ERP, NetSuite, Coupa, Concur' },
      { name: 'ITSM / Ticketing',        description: 'IT service management and ticketing tools.',                          examples: 'ServiceNow, Jira Service Management, Freshservice' },
      { name: 'Productivity SaaS',       description: 'Productivity and knowledge management platforms.',                    examples: 'Microsoft 365, Google Workspace, Notion, Confluence' },
      { name: 'BI / Analytics',          description: 'Reporting, dashboarding, and analytics tools.',                       examples: 'Power BI, Tableau, Looker' },
      { name: 'Design / Whiteboarding',  description: 'Design and collaborative whiteboarding platforms.',                   examples: 'Figma, Miro, FigJam, Canva' },
      { name: 'E-Signature',             description: 'Digital document signing platforms.',                                 examples: 'DocuSign, Adobe Sign' },
      { name: 'Customer Support SaaS',   description: 'Customer support and service tools.',                                 examples: 'Zendesk, Freshdesk, Intercom' },
      { name: 'Marketing SaaS',          description: 'Marketing automation and campaign platforms.',                        examples: 'Marketo, Mailchimp, HubSpot Marketing' },
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
      { key: 'connector_coverage', area: 'Connector Coverage', question: 'Which SaaS apps are integrated through API and at what permission scope?' },
      { key: 'scan_scope',         area: 'Scan Scope',         question: 'Does scanning cover files, comments, pages, records, attachments, and metadata?' },
      { key: 'sharing_visibility', area: 'Sharing Visibility', question: 'Can the tool detect public links, external users, guest access, and domain sharing?' },
      { key: 'remediation_actions', area: 'Remediation Actions', question: 'Can it remove links, change permissions, quarantine, notify owners, or open tickets?' },
      { key: 'scan_frequency',     area: 'Scan Frequency',    question: 'How often are scans performed and how quickly are new exposures detected?' },
      { key: 'evidence_reporting', area: 'Evidence and Reporting', question: 'Can it generate exposure reports for admins, app owners, and auditors?' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 5. Cloud / IaaS Data Protection
  // ─────────────────────────────────────────────────────────────────
  {
    slug: 'cloud-iaas',
    name: 'Cloud / IaaS Data Protection',
    shortName: 'Cloud / IaaS',
    definition:
      'Covers data stored or exposed in cloud-native infrastructure services — including object storage, cloud databases, data warehouses, data lakes, snapshots, backups, logs, container registries, secrets stores, and public cloud exposure risks.',
    netskopeSupport: 'partial',
    subchannels: [
      { name: 'Object Storage',         description: 'Cloud object storage services.',                                       examples: 'AWS S3, Azure Blob, Google Cloud Storage' },
      { name: 'Cloud File Share',        description: 'Managed cloud file share services.',                                  examples: 'Azure Files, AWS EFS, FSx' },
      { name: 'Cloud Database',         description: 'Managed relational or NoSQL cloud databases.',                         examples: 'RDS, Azure SQL, Cloud SQL, DynamoDB, Cosmos DB' },
      { name: 'Data Warehouse',         description: 'Cloud analytics and warehouse platforms.',                             examples: 'Snowflake, BigQuery, Redshift, Synapse' },
      { name: 'Data Lake',              description: 'Cloud data lake locations.',                                           examples: 'S3 data lake, ADLS, GCS data lake' },
      { name: 'Backup / Snapshot',      description: 'Backups and point-in-time images.',                                   examples: 'EBS snapshot, database backup, VM snapshot' },
      { name: 'Logs / Telemetry Storage', description: 'Logs, events, and telemetry stored in cloud.',                      examples: 'CloudWatch logs, Azure Monitor logs, GCP logs' },
      { name: 'Container Registry',     description: 'Container image or artifact registries.',                             examples: 'ECR, ACR, GCR, Artifact Registry' },
      { name: 'Secrets Store',          description: 'Cloud secret management services.',                                   examples: 'AWS Secrets Manager, Azure Key Vault, GCP Secret Manager' },
      { name: 'Public Bucket / Object', description: 'Publicly exposed object storage.',                                    examples: 'Public S3 bucket, public blob' },
      { name: 'Cross-Account Access',   description: 'Access shared to external cloud accounts.',                           examples: 'External account access, shared bucket policy' },
      { name: 'Cloud Workload Storage', description: 'Data stored by VM, container, or workload.',                          examples: 'VM disk, container volume, ephemeral storage' },
    ],
    activities: [
      { name: 'Discover Storage',        description: 'Discover cloud storage resources and datasets.' },
      { name: 'Scan Object',             description: 'Scan object storage content.' },
      { name: 'Scan Database',           description: 'Scan database, table, or dataset.' },
      { name: 'Detect Public Exposure',  description: 'Identify public bucket, public object, or internet exposure.' },
      { name: 'Detect Sensitive Data',   description: 'Find regulated or confidential data in cloud stores.' },
      { name: 'Detect Secret',           description: 'Find keys, tokens, credentials, or certificates.' },
      { name: 'Detect Over-Permission',  description: 'Identify excessive IAM, ACL, or policy permissions.' },
      { name: 'Detect Cross-Account Access', description: 'Identify access granted to external accounts.' },
      { name: 'Change Permission',       description: 'Modify cloud storage, IAM, or object permissions.' },
      { name: 'Remove Public Access',    description: 'Disable public access or anonymous exposure.' },
      { name: 'Encrypt Data',            description: 'Validate or apply encryption controls.' },
      { name: 'Quarantine Object',       description: 'Move or restrict high-risk object.' },
      { name: 'Generate Exposure Report', description: 'Produce cloud data exposure report.' },
    ],
    risks: [
      { area: 'Public Cloud Exposure',         level: 'critical', description: 'Data may be publicly accessible over the internet due to bucket, object, or policy misconfiguration.',     example: 'Public S3 bucket exposes customer records.' },
      { area: 'Sensitive Data in Object Storage', level: 'high', description: 'Sensitive data may be stored in cloud buckets without proper classification, encryption, or access control.', example: 'PII stored in unmanaged object storage.' },
      { area: 'Secrets in Cloud Storage',      level: 'critical', description: 'Keys, tokens, credentials, certificates, or private keys may be stored in exposed locations.',            example: 'Access key found in cloud log bucket.' },
      { area: 'Cross-Account Exposure',        level: 'high',     description: 'Data may be accessible by external cloud accounts or overly broad principals.',                           example: 'Bucket policy grants access to external account.' },
      { area: 'Cloud Database Exposure',       level: 'high',     description: 'Databases may contain sensitive data with excessive access or weak configuration.',                       example: 'Customer table exposed to broad service role.' },
      { area: 'Backup Exposure',               level: 'high',     description: 'Snapshots and backups may expose large historical datasets.',                                              example: 'Database backup shared externally.' },
      { area: 'Logging Data Leakage',          level: 'medium',   description: 'Logs may contain tokens, PII, request payloads, or sensitive business data.',                            example: 'API token captured in application log.' },
      { area: 'Container Artifact Exposure',   level: 'high',     description: 'Images or artifacts may contain source code, secrets, configuration files, or embedded credentials.',    example: 'Docker image contains private key.' },
    ],
    assessmentQuestions: [
      { key: 'cloud_coverage',      area: 'Cloud Coverage',      question: 'Which AWS, Azure, and GCP services are supported?' },
      { key: 'storage_discovery',   area: 'Storage Discovery',   question: 'Can the tool discover all object stores, databases, logs, backups, and snapshots?' },
      { key: 'exposure_detection',  area: 'Exposure Detection',  question: 'Can public access, cross-account access, and excessive IAM be detected?' },
      { key: 'data_inspection',     area: 'Data Inspection',     question: 'Can sensitive data and secrets be inspected at scale in cloud stores?' },
      { key: 'remediation',         area: 'Remediation',         question: 'Can public access be removed or permissions remediated automatically or through workflow?' },
      { key: 'ownership_mapping',   area: 'Ownership',           question: 'Can resources be mapped to application owners, cloud accounts, and business units?' },
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
      { name: 'AI Chat Prompt',         description: 'Text prompt submitted to AI chat system.',                             examples: 'ChatGPT, Gemini, Claude, Copilot' },
      { name: 'AI File Upload',         description: 'File uploaded for AI processing.',                                    examples: 'PDF, DOCX, XLSX, PPTX, source file' },
      { name: 'AI Coding Assistant',    description: 'Code or development context sent to coding AI.',                      examples: 'GitHub Copilot, Cursor, Windsurf, Replit AI' },
      { name: 'AI Meeting Assistant',   description: 'Meeting content processed by AI.',                                   examples: 'Meeting transcript, recording, summary' },
      { name: 'AI Search / Research',   description: 'AI-based search or research tool.',                                   examples: 'Perplexity, enterprise AI search' },
      { name: 'AI Agent',               description: 'Autonomous or semi-autonomous AI workflow.',                          examples: 'Agent reads, sends, updates, or posts data' },
      { name: 'AI Connector / Plugin',  description: 'AI connected to business data sources.',                             examples: 'Gmail, Drive, SharePoint, GitHub, Slack, CRM connector' },
      { name: 'AI Customer Support Bot', description: 'AI bot using customer or internal knowledge.',                      examples: 'Support chatbot, service assistant' },
      { name: 'AI Automation Platform', description: 'Workflow automation platform using AI.',                              examples: 'n8n AI, Zapier AI, Make AI' },
      { name: 'AI Document / Image Tool', description: 'AI tool used for document, OCR, image, or extraction tasks.',      examples: 'PDF summariser, OCR AI, image analysis tool' },
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
      { area: 'Prompt Leakage',         level: 'high',     description: 'Data pasted into AI prompts may leave approved controls or be processed in unapproved environments.',           example: 'Customer PII entered into consumer AI.' },
      { area: 'File Upload Exposure',   level: 'high',     description: 'Uploaded files may contain business, regulated, confidential, or secret data.',                                 example: 'Salary spreadsheet uploaded for summarisation.' },
      { area: 'Source Code Exposure',   level: 'high',     description: 'Proprietary code may be submitted to AI coding tools or AI chat systems.',                                      example: 'Internal code pasted into unapproved coding assistant.' },
      { area: 'Secret Leakage',         level: 'critical', description: 'Credentials, keys, tokens, private keys, or certificates may be pasted into AI tools.',                        example: 'API key submitted for debugging help.' },
      { area: 'Connector Overreach',    level: 'high',     description: 'AI connectors may access more business data than intended.',                                                   example: 'AI connected to broad mailbox or drive access.' },
      { area: 'Agentic Action Risk',    level: 'high',     description: 'AI agents may send, update, export, or move data without sufficient review.',                                  example: 'Agent emails sensitive report externally.' },
      { area: 'Meeting Summary Exposure', level: 'medium', description: 'AI-generated meeting summaries may contain sensitive discussions and be shared broadly.',                      example: 'Strategy meeting summarised and shared with broad group.' },
      { area: 'Retention or Training Concern', level: 'high', description: 'Submitted data may be retained, logged, reused, embedded, or used for training beyond intended purpose.', example: 'Internal document uploaded to consumer AI service.' },
    ],
    assessmentQuestions: [
      { key: 'ai_app_coverage',       area: 'AI App Coverage',       question: 'Which AI apps and AI categories are detected and controlled?' },
      { key: 'activity_coverage',     area: 'Activity Coverage',     question: 'Can the tool inspect prompt/post, upload, response, download, and connector read activity?' },
      { key: 'instance_separation',   area: 'Instance/Tenant Separation', question: 'Can enterprise AI instances be separated from consumer or personal AI usage?' },
      { key: 'connector_governance',  area: 'Connector Governance',  question: 'Can connected sources, scopes, and permissions be assessed?' },
      { key: 'agent_control',         area: 'Agent Control',         question: 'Can agent actions be monitored, approved, blocked, or logged?' },
      { key: 'retention_risk',        area: 'Retention Risk',        question: 'Can the application record whether the AI service has enterprise retention and training controls?' },
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
      'Covers sensitive data leaving through network-level or protocol-level paths not fully represented as Email, Web/SaaS Inline, Endpoint, SaaS API, Cloud, or GenAI — including FTP, SFTP, SMTP relay, HTTP/S from workloads, SMB/NFS, DNS tunnelling, and legacy network paths.',
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
      { key: 'protocol_coverage',     area: 'Protocol Coverage',    question: 'Which protocols are inspected: FTP, SFTP, HTTP/S, SMTP relay, SMB, NFS, database protocols, DNS?' },
      { key: 'egress_visibility',     area: 'Egress Visibility',    question: 'Can the tool identify sensitive data leaving data centre or cloud workload networks?' },
      { key: 'encryption_handling',   area: 'Encryption Handling',  question: 'Can encrypted traffic be inspected where allowed, or at least identified by metadata?' },
      { key: 'application_mapping',   area: 'Application Mapping',  question: 'Can protocol traffic be mapped to application, owner, server, or workload?' },
      { key: 'legacy_coverage',       area: 'Legacy Coverage',      question: 'Are legacy systems and unmanaged protocols included in assessment?' },
      { key: 'separation_from_other', area: 'Separation from Web/Email', question: 'Are email and web controls tracked separately to avoid duplicate scoring?' },
    ],
  },
]

export const CHANNEL_SLUGS = CHANNELS.map(c => c.slug)

export function getChannel(slug: string): Channel | undefined {
  return CHANNELS.find(c => c.slug === slug)
}
