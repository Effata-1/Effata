-- ─────────────────────────────────────────────────────────────────────────────
-- 025_destination_catalog.sql
-- Redesign Destinations to mirror Data Catalog architecture.
--   1. catalog_destinations   (system, public read — pre-seeded ~100 profiles)
--   2. org_destination_profiles (org selections + custom, RLS)
-- Migrates any existing org_destinations rows as custom profiles, then drops
-- the old table. catalog_apps (migration 024) is kept for app search.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. System catalog ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS catalog_destinations (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug         TEXT        UNIQUE NOT NULL,
  name         TEXT        NOT NULL,
  trust_tag    TEXT        NOT NULL CHECK (trust_tag IN (
    'enterprise_approved','approved_with_conditions','permitted_with_restriction',
    'personal','public','unknown','prohibited'
  )),
  subcategory  TEXT        NOT NULL,
  description  TEXT,
  examples     TEXT[]      NOT NULL DEFAULT '{}',
  notes        TEXT,
  priority     INT         NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 5),
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE catalog_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON catalog_destinations FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_catalog_destinations_trust_tag
  ON catalog_destinations (trust_tag);
CREATE INDEX IF NOT EXISTS idx_catalog_destinations_subcategory
  ON catalog_destinations (subcategory);

-- ─── 2. Seed ~100 well-known destination profiles ────────────────────────────

INSERT INTO catalog_destinations (slug, name, trust_tag, subcategory, description, examples, priority) VALUES

-- ── Enterprise Approved: Corporate SaaS ──────────────────────────────────────
('microsoft_365',       'Microsoft 365',            'enterprise_approved', 'corporate_saas',
  'Organisation-managed Microsoft productivity suite. Includes Word, Excel, PowerPoint, Outlook, and integrated cloud services.',
  ARRAY['office.com','outlook.office365.com','sharepoint.com'], 1),
('google_workspace',    'Google Workspace',          'enterprise_approved', 'corporate_saas',
  'Organisation-managed Google productivity suite. Includes Gmail, Drive, Docs, Sheets, and Meet.',
  ARRAY['workspace.google.com','drive.google.com','mail.google.com'], 1),
('salesforce_crm',      'Salesforce CRM',            'enterprise_approved', 'corporate_saas',
  'Enterprise CRM platform for sales, service, and marketing data. Often contains customer PII and pipeline data.',
  ARRAY['salesforce.com','force.com','lightning.force.com'], 1),
('workday',             'Workday',                   'enterprise_approved', 'corporate_saas',
  'Cloud HR and finance platform. Contains employee records, compensation, and performance data.',
  ARRAY['workday.com','myworkday.com'], 1),
('sap_erp',             'SAP ERP',                   'enterprise_approved', 'corporate_saas',
  'Enterprise resource planning system. Contains financial, supply chain, and operational data.',
  ARRAY['sap.com','*.sapbydesign.com'], 2),
('oracle_erp',          'Oracle ERP Cloud',          'enterprise_approved', 'corporate_saas',
  'Enterprise resource planning and finance platform from Oracle.',
  ARRAY['oracle.com','oraclecloud.com'], 2),
('servicenow',          'ServiceNow',                'enterprise_approved', 'corporate_saas',
  'Enterprise workflow and ITSM platform. Contains incident, change, and configuration data.',
  ARRAY['service-now.com','servicenow.com'], 2),
('hubspot_enterprise',  'HubSpot (Enterprise)',      'enterprise_approved', 'corporate_saas',
  'CRM and marketing automation platform. Contains lead, contact, and campaign data.',
  ARRAY['hubspot.com','app.hubspot.com'], 2),
('zendesk',             'Zendesk',                   'enterprise_approved', 'corporate_saas',
  'Customer support platform. Contains customer communications, tickets, and contact details.',
  ARRAY['zendesk.com','support.zendesk.com'], 2),
('jira',                'Jira',                      'enterprise_approved', 'corporate_saas',
  'Project and issue tracking platform. May contain internal project details and technical documentation.',
  ARRAY['atlassian.net','jira.com'], 2),
('confluence',          'Confluence',                'enterprise_approved', 'corporate_saas',
  'Enterprise wiki and knowledge management. Contains internal documentation and business processes.',
  ARRAY['atlassian.net','confluence.com'], 2),

-- ── Enterprise Approved: Cloud Storage ───────────────────────────────────────
('sharepoint_online',   'SharePoint Online',         'enterprise_approved', 'cloud_storage',
  'Microsoft corporate document management and intranet. Managed by IT with DLP policies in place.',
  ARRAY['sharepoint.com','*.sharepoint.com'], 1),
('onedrive_managed',    'OneDrive (managed)',        'enterprise_approved', 'cloud_storage',
  'Microsoft corporate file storage, managed by the organisation with compliance controls.',
  ARRAY['onedrive.live.com','*.onedrive.com'], 1),
('google_drive_managed','Google Drive (managed)',    'enterprise_approved', 'cloud_storage',
  'Organisation-managed Google Drive with DLP and sharing controls enforced via Google Workspace.',
  ARRAY['drive.google.com','docs.google.com'], 1),
('box_managed',         'Box (managed)',             'enterprise_approved', 'cloud_storage',
  'Corporate Box account with enterprise security, access controls, and DLP integration.',
  ARRAY['box.com','app.box.com'], 1),
('dropbox_business',    'Dropbox Business',          'enterprise_approved', 'cloud_storage',
  'Organisation-managed Dropbox account with admin controls, sharing policies, and audit logs.',
  ARRAY['dropbox.com','dropboxbusiness.com'], 2),

-- ── Enterprise Approved: Collaboration ───────────────────────────────────────
('teams_managed',       'Microsoft Teams (managed)', 'enterprise_approved', 'collaboration',
  'Corporate messaging and video platform within the Microsoft 365 tenant, managed by IT.',
  ARRAY['teams.microsoft.com','teams.live.com'], 1),
('slack_enterprise',    'Slack Enterprise Grid',     'enterprise_approved', 'collaboration',
  'Enterprise Slack with DLP integration, message retention policies, and admin controls.',
  ARRAY['slack.com','*.enterprise.slack.com'], 1),
('zoom_managed',        'Zoom (managed)',             'enterprise_approved', 'collaboration',
  'Corporate Zoom account with meeting recording controls, waiting rooms, and data residency.',
  ARRAY['zoom.us','*.zoom.us'], 2),
('webex_managed',       'Webex (managed)',            'enterprise_approved', 'collaboration',
  'Corporate Cisco Webex with encryption, compliance recording, and access controls.',
  ARRAY['webex.com','*.webex.com'], 2),
('google_meet',         'Google Meet',               'enterprise_approved', 'collaboration',
  'Video conferencing within Google Workspace, governed by workspace DLP and admin policies.',
  ARRAY['meet.google.com'], 2),

-- ── Enterprise Approved: Developer Tools ─────────────────────────────────────
('github_enterprise',   'GitHub Enterprise',         'enterprise_approved', 'developer_tools',
  'Self-hosted or GitHub Enterprise Cloud instance with IP allowlists, SSO, and secret scanning.',
  ARRAY['github.enterprise.com','*.ghe.com'], 1),
('gitlab_selfhosted',   'GitLab (self-hosted)',      'enterprise_approved', 'developer_tools',
  'Self-managed GitLab instance with full access control, secret detection, and compliance pipelines.',
  ARRAY['gitlab.internal','*.selfhosted.gitlab'], 1),
('bitbucket_cloud',     'Bitbucket (Atlassian Cloud)','enterprise_approved','developer_tools',
  'Atlassian Bitbucket with IP allowlists, branch permissions, and secret detection.',
  ARRAY['bitbucket.org','*.atlassian.net'], 2),
('azure_devops',        'Azure DevOps',              'enterprise_approved', 'developer_tools',
  'Microsoft source control, pipelines, and boards. Governed by Azure AD and compliance policies.',
  ARRAY['dev.azure.com','visualstudio.com'], 2),
('aws_codecommit',      'AWS CodeCommit',            'enterprise_approved', 'developer_tools',
  'Managed Git in AWS, integrated with IAM for access control and CloudTrail for audit.',
  ARRAY['codecommit.us-east-1.amazonaws.com'], 2),

-- ── Enterprise Approved: ITSM ─────────────────────────────────────────────────
('pagerduty',           'PagerDuty',                 'enterprise_approved', 'itsm',
  'Incident management and on-call scheduling. Contains operational runbooks and alert data.',
  ARRAY['pagerduty.com','app.pagerduty.com'], 3),
('opsgenie',            'Opsgenie (Atlassian)',      'enterprise_approved', 'itsm',
  'Alert management and on-call scheduling, integrated with Atlassian ecosystem.',
  ARRAY['opsgenie.com','app.opsgenie.com'], 3),
('freshservice',        'Freshservice',              'enterprise_approved', 'itsm',
  'IT service management platform for tickets, assets, and change management.',
  ARRAY['freshservice.com','*.freshservice.com'], 3),

-- ── Enterprise Approved: Analytics ───────────────────────────────────────────
('tableau_server',      'Tableau Server (managed)',  'enterprise_approved', 'analytics',
  'Self-managed or Tableau Cloud with row-level security and data governance controls.',
  ARRAY['tableau.com','*.tableau.com'], 3),
('power_bi',            'Power BI (managed)',        'enterprise_approved', 'analytics',
  'Microsoft business intelligence platform within the M365 tenant with workspace-level controls.',
  ARRAY['powerbi.com','app.powerbi.com'], 3),

-- ── Approved with Conditions: AI Tools ───────────────────────────────────────
('ms_copilot_m365',     'Microsoft Copilot (M365)', 'approved_with_conditions', 'ai_tools',
  'AI assistant integrated into Microsoft 365, bounded by the organisation''s M365 data boundary. Review acceptable use policy before use with sensitive data.',
  ARRAY['copilot.microsoft.com','m365.cloud.microsoft'], 1),
('github_copilot',      'GitHub Copilot (managed)', 'approved_with_conditions', 'ai_tools',
  'AI code completion tool. Approved for use on internal repos only. Disable for files containing secrets or PII.',
  ARRAY['copilot.github.com'], 1),
('google_duet_ai',      'Google Duet AI',           'approved_with_conditions', 'ai_tools',
  'AI assistant in Google Workspace. Bounded by Workspace tenant. Review before use with regulated data.',
  ARRAY['workspace.google.com'], 2),
('aws_bedrock',         'AWS Bedrock',              'approved_with_conditions', 'ai_tools',
  'Managed foundation models via AWS. Data stays in AWS region. Requires approved use-case and data classification review.',
  ARRAY['bedrock.amazonaws.com'], 2),
('azure_openai',        'Azure OpenAI Service',     'approved_with_conditions', 'ai_tools',
  'OpenAI models hosted in Azure with data residency commitments. Approved for internal tooling — requires DPO sign-off for PII.',
  ARRAY['openai.azure.com','*.openai.azure.com'], 2),

-- ── Approved with Conditions: Cloud Storage ───────────────────────────────────
('dropbox_unmanaged',   'Dropbox (unmanaged)',       'approved_with_conditions', 'cloud_storage',
  'Personal or non-managed Dropbox account. Permitted for non-confidential file sharing. Block confidential and above.',
  ARRAY['dropbox.com'], 3),
('box_personal',        'Box (personal)',            'approved_with_conditions', 'cloud_storage',
  'Personal Box account. Permitted for low-sensitivity file exchange. Monitor for confidential uploads.',
  ARRAY['box.com'], 3),
('notion',              'Notion',                   'approved_with_conditions', 'cloud_storage',
  'Collaborative workspace. Permitted for internal documentation — block external page sharing of confidential content.',
  ARRAY['notion.so','*.notion.site'], 2),

-- ── Approved with Conditions: Collaboration ───────────────────────────────────
('slack_free',          'Slack (Free/Pro)',          'approved_with_conditions', 'collaboration',
  'Non-enterprise Slack without message retention or DLP controls. Permitted for non-sensitive team use.',
  ARRAY['slack.com','app.slack.com'], 3),
('asana',               'Asana',                    'approved_with_conditions', 'collaboration',
  'Project management platform. Permitted for general task management — restrict sharing of confidential project data.',
  ARRAY['asana.com','app.asana.com'], 3),
('monday_com',          'Monday.com',               'approved_with_conditions', 'collaboration',
  'Work management platform. Permitted for project tracking — review external guest access policies.',
  ARRAY['monday.com','*.monday.com'], 3),
('trello',              'Trello',                   'approved_with_conditions', 'collaboration',
  'Kanban board tool. Permitted for non-sensitive project tracking. Ensure boards are not set to public.',
  ARRAY['trello.com','*.trello.com'], 4),
('airtable',            'Airtable',                 'approved_with_conditions', 'collaboration',
  'Database-spreadsheet hybrid. Permitted for operational data — restrict if tables contain PII.',
  ARRAY['airtable.com','*.airtable.com'], 4),
('clickup',             'ClickUp',                  'approved_with_conditions', 'collaboration',
  'Project management platform. Permitted for task management — review sharing settings for confidential spaces.',
  ARRAY['clickup.com','app.clickup.com'], 4),

-- ── Approved with Conditions: Developer Tools ────────────────────────────────
('github_public',       'GitHub.com (public repos)','approved_with_conditions', 'developer_tools',
  'Public GitHub repositories. Approved only for open-source code. Secret scanning must be enabled. Never push credentials.',
  ARRAY['github.com'], 2),
('gitlab_com',          'GitLab.com',               'approved_with_conditions', 'developer_tools',
  'SaaS GitLab. Approved for non-sensitive code — use private repositories. Enable secret detection pipelines.',
  ARRAY['gitlab.com'], 2),
('npm_registry',        'npm Registry',             'approved_with_conditions', 'developer_tools',
  'JavaScript package registry. Approved for publishing public packages — use scoped private packages for internal libs.',
  ARRAY['registry.npmjs.org','npmjs.com'], 3),
('docker_hub',          'Docker Hub',               'approved_with_conditions', 'developer_tools',
  'Container image registry. Approved for public base images — use private repositories for internal images.',
  ARRAY['hub.docker.com','registry-1.docker.io'], 3),
('pypi',                'PyPI',                     'approved_with_conditions', 'developer_tools',
  'Python package index. Approved for public package publishing — review before uploading proprietary code.',
  ARRAY['pypi.org','files.pythonhosted.org'], 3),

-- ── Permitted with Restriction: AI Tools ─────────────────────────────────────
('chatgpt',             'ChatGPT (OpenAI)',          'permitted_with_restriction', 'ai_tools',
  'Consumer AI assistant. Permitted for general tasks only. Never enter confidential, PII, or secret data. No file uploads of internal documents.',
  ARRAY['chat.openai.com','chatgpt.com'], 2),
('claude_ai',           'Claude.ai (Anthropic)',     'permitted_with_restriction', 'ai_tools',
  'Consumer AI assistant. Permitted for general productivity tasks. Restrict uploads of internal or regulated documents.',
  ARRAY['claude.ai'], 2),
('gemini',              'Google Gemini',             'permitted_with_restriction', 'ai_tools',
  'Consumer Google AI assistant. Permitted for general tasks — restrict when used outside Workspace boundary (gemini.google.com).',
  ARRAY['gemini.google.com'], 2),
('perplexity',          'Perplexity AI',             'permitted_with_restriction', 'ai_tools',
  'AI search assistant. Permitted for research — do not paste internal documents, source code, or customer data.',
  ARRAY['perplexity.ai','labs.perplexity.ai'], 3),
('midjourney',          'Midjourney',                'permitted_with_restriction', 'ai_tools',
  'AI image generation. Permitted for marketing use — review intellectual property implications. No use of proprietary designs as prompts.',
  ARRAY['midjourney.com','discord.com'], 4),

-- ── Permitted with Restriction: Social Media ─────────────────────────────────
('linkedin',            'LinkedIn',                  'permitted_with_restriction', 'social_media',
  'Professional social network. Permitted for external communications and recruiting. Restrict sharing of confidential business data.',
  ARRAY['linkedin.com','*.linkedin.com'], 2),
('twitter_x',           'Twitter / X',              'permitted_with_restriction', 'social_media',
  'Social media platform. Permitted for approved communications and marketing. Block internal document uploads.',
  ARRAY['twitter.com','x.com','*.x.com'], 3),
('youtube',             'YouTube',                  'permitted_with_restriction', 'social_media',
  'Video hosting platform. Permitted for public-facing content. Restrict uploads of internal recordings or meeting clips.',
  ARRAY['youtube.com','youtu.be'], 3),
('reddit',              'Reddit',                   'permitted_with_restriction', 'social_media',
  'Social discussion platform. Permitted for community engagement — block posts containing confidential or internal data.',
  ARRAY['reddit.com','*.reddit.com'], 4),
('quora',               'Quora',                    'permitted_with_restriction', 'social_media',
  'Q&A platform. Permitted for knowledge sharing — restrict answers that reveal confidential business information.',
  ARRAY['quora.com'], 5),

-- ── Permitted with Restriction: File Transfer ─────────────────────────────────
('we_transfer',         'WeTransfer',               'permitted_with_restriction', 'file_transfer',
  'File transfer service. Permitted for non-sensitive files only. Block confidential and above. Links expire after 7 days.',
  ARRAY['wetransfer.com','we.tl'], 3),
('dropbox_transfer',    'Dropbox Transfer',         'permitted_with_restriction', 'file_transfer',
  'One-way file delivery via Dropbox. Permitted for low-sensitivity external file delivery — inspect content before transfer.',
  ARRAY['dropbox.com/transfer'], 3),

-- ── Permitted with Restriction: Collaboration ─────────────────────────────────
('whatsapp_business',   'WhatsApp Business',        'permitted_with_restriction', 'collaboration',
  'Mobile messaging platform. Permitted for customer communications — restrict forwarding of internal documents.',
  ARRAY['web.whatsapp.com','*.whatsapp.com'], 3),
('telegram',            'Telegram',                 'permitted_with_restriction', 'collaboration',
  'Encrypted messaging. Permitted for external partner comms only — block confidential file attachments.',
  ARRAY['web.telegram.org','telegram.org'], 4),

-- ── Personal: Email ───────────────────────────────────────────────────────────
('gmail_personal',      'Gmail (personal)',          'personal', 'email',
  'Personal consumer Gmail account. Not managed by the organisation. Monitor for corporate data exfiltration via personal email.',
  ARRAY['mail.google.com','gmail.com'], 2),
('outlook_personal',    'Outlook.com (personal)',   'personal', 'email',
  'Personal Microsoft email account. Not governed by corporate policies. Monitor uploads and forwards from corporate accounts.',
  ARRAY['outlook.live.com','hotmail.com'], 2),
('yahoo_mail',          'Yahoo Mail',               'personal', 'email',
  'Consumer email service. Not managed by the organisation. Flag corporate data transfers to Yahoo addresses.',
  ARRAY['mail.yahoo.com','yahoomail.com'], 3),
('icloud_mail',         'iCloud Mail',              'personal', 'email',
  'Apple iCloud email service. Consumer account. Monitor for corporate file attachments.',
  ARRAY['icloud.com','me.com'], 3),

-- ── Personal: Cloud Storage ────────────────────────────────────────────────────
('gdrive_personal',     'Google Drive (personal)',  'personal', 'cloud_storage',
  'Personal Google Drive account. Not governed by Workspace DLP. High risk for unintended data leakage via sync.',
  ARRAY['drive.google.com'], 2),
('icloud_drive',        'iCloud Drive',             'personal', 'cloud_storage',
  'Apple personal cloud storage. Not managed. Monitor for corporate files uploaded via browser or sync client.',
  ARRAY['icloud.com','*.icloud.com'], 3),
('onedrive_personal',   'OneDrive (personal)',      'personal', 'cloud_storage',
  'Personal Microsoft OneDrive (consumer account). Not governed by organisational policies.',
  ARRAY['onedrive.live.com'], 3),
('dropbox_personal',    'Dropbox (personal)',       'personal', 'cloud_storage',
  'Personal Dropbox free or Plus account. Not monitored or managed. Block sync of corporate folders.',
  ARRAY['dropbox.com'], 3),

-- ── Personal: Social Media ─────────────────────────────────────────────────────
('facebook',            'Facebook',                 'personal', 'social_media',
  'Consumer social media. Not for business use. Monitor for corporate data shared on personal profiles.',
  ARRAY['facebook.com','*.facebook.com'], 4),
('instagram',           'Instagram',                'personal', 'social_media',
  'Image and video social platform. Monitor for accidental disclosure of sensitive imagery or internal product details.',
  ARRAY['instagram.com','*.instagram.com'], 4),
('snapchat',            'Snapchat',                 'personal', 'social_media',
  'Ephemeral media platform. Not for business use. Block corporate file sharing.',
  ARRAY['snapchat.com','*.snap.com'], 5),
('pinterest',           'Pinterest',                'personal', 'social_media',
  'Visual bookmarking platform. Monitor for accidental sharing of internal design assets.',
  ARRAY['pinterest.com','*.pinterest.com'], 5),

-- ── Public: Web Publishing ────────────────────────────────────────────────────
('company_website',     'Company Website',          'public', 'web_publishing',
  'Officially approved public-facing website. All content published here is classified as Public.',
  ARRAY[]::TEXT[], 1),
('public_github_repos', 'Public GitHub Repositories','public', 'developer_tools',
  'Open-source code repositories approved for public release. Must pass secret scanning before push.',
  ARRAY['github.com'], 2),
('medium',              'Medium',                   'public', 'web_publishing',
  'Publishing platform for approved thought leadership and technical articles.',
  ARRAY['medium.com','*.medium.com'], 3),
('substack',            'Substack',                 'public', 'web_publishing',
  'Newsletter publishing platform. For approved external content only.',
  ARRAY['substack.com','*.substack.com'], 4),

-- ── Unknown: Unclassified ────────────────────────────────────────────────────
('unreviewed_saas',     'Unreviewed SaaS Application','unknown', 'unclassified',
  'A cloud application that has not yet been assessed by the security team. Treat as untrusted until reviewed.',
  ARRAY[]::TEXT[], 3),
('unknown_fileshare',   'Unknown File-Sharing Service','unknown', 'unclassified',
  'An unidentified file hosting or transfer URL. Block confidential data until service is identified and assessed.',
  ARRAY[]::TEXT[], 3),
('shadow_it_app',       'Shadow IT Application',    'unknown', 'unclassified',
  'Application discovered in network or DLP logs not on the approved software list. Requires security review.',
  ARRAY[]::TEXT[], 2),

-- ── Prohibited: AI Tools ──────────────────────────────────────────────────────
('deepseek',            'DeepSeek',                 'prohibited', 'ai_tools',
  'Chinese AI assistant with unclear data residency and privacy commitments. Prohibited due to data sovereignty and regulatory concerns.',
  ARRAY['deepseek.com','chat.deepseek.com'], 1),
('unvetted_ai',         'Unvetted AI Tools',        'prohibited', 'ai_tools',
  'Any AI assistant or code generation tool not on the approved list. Prohibit until a security and privacy assessment is complete.',
  ARRAY[]::TEXT[], 1),

-- ── Prohibited: File Transfer ─────────────────────────────────────────────────
('pastebin',            'Pastebin',                 'prohibited', 'file_transfer',
  'Public text and code sharing site. High exfiltration risk — any data pasted is potentially public. Block all uploads.',
  ARRAY['pastebin.com','pastebin.pl'], 1),
('hastebin',            'Hastebin',                 'prohibited', 'file_transfer',
  'Public code snippet sharing. No access control. Block all uploads of corporate content.',
  ARRAY['hastebin.com','toptal.com/developers/hastebin'], 1),
('anonfiles',           'Anonymous File Hosts',     'prohibited', 'file_transfer',
  'Anonymous file-hosting services (AnonFiles, GoFile, etc.). No accountability or data retention control. Block.',
  ARRAY['anonfiles.com','gofile.io','transfer.sh'], 1),
('privatebin_unapproved','PrivateBin (unapproved)',  'prohibited', 'file_transfer',
  'Public self-destructing paste service. Block unless an approved internal instance is deployed.',
  ARRAY['privatebin.net'], 2),

-- ── Prohibited: Social Media ──────────────────────────────────────────────────
('tiktok_corp',         'TikTok (on corporate devices)','prohibited', 'social_media',
  'Short-video platform. Prohibited on corporate devices due to data collection concerns and regulatory guidance in multiple jurisdictions.',
  ARRAY['tiktok.com','*.tiktok.com'], 1),
('vk',                  'VK (VKontakte)',            'prohibited', 'social_media',
  'Russian social network. Prohibited due to data sovereignty and geopolitical risk concerns.',
  ARRAY['vk.com','*.vk.com'], 1),
('wechat_unmanaged',    'WeChat (unmanaged)',        'prohibited', 'social_media',
  'Chinese messaging app. Prohibited on corporate devices unless an enterprise-controlled deployment is approved.',
  ARRAY['web.wechat.com','*.wechat.com'], 1),

-- ── Prohibited: Developer Tools ───────────────────────────────────────────────
('unapproved_repos',    'Unapproved External Code Repositories','prohibited','developer_tools',
  'Any external code repository (SourceForge, BitBucket personal, etc.) not on the approved list. Block source code uploads.',
  ARRAY['sourceforge.net'], 2)
ON CONFLICT (slug) DO NOTHING;

-- ─── 3. Org destination profiles ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_destination_profiles (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                 UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  catalog_destination_id UUID        REFERENCES catalog_destinations(id),
  name                   TEXT        NOT NULL,
  subcategory            TEXT,
  trust_tag              TEXT        NOT NULL CHECK (trust_tag IN (
    'enterprise_approved','approved_with_conditions','permitted_with_restriction',
    'personal','public','unknown','prohibited'
  )),
  applications           TEXT[]      NOT NULL DEFAULT '{}',
  notes                  TEXT,
  is_in_scope            BOOLEAN     NOT NULL DEFAULT TRUE,
  is_custom              BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE org_destination_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON org_destination_profiles
  USING  (org_id = (auth.jwt() ->> 'org_id')::UUID)
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID);

CREATE INDEX IF NOT EXISTS idx_org_dest_profiles_org_id
  ON org_destination_profiles (org_id);
CREATE INDEX IF NOT EXISTS idx_org_dest_profiles_trust_tag
  ON org_destination_profiles (org_id, trust_tag);

CREATE TRIGGER set_org_dest_profiles_updated_at
  BEFORE UPDATE ON org_destination_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 4. Migrate existing org_destinations → org_destination_profiles ─────────
-- Only runs if org_destinations table still exists (migrations 023/024 were applied).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'org_destinations') THEN
    INSERT INTO org_destination_profiles (
      org_id, catalog_destination_id, name, subcategory, trust_tag,
      applications, notes, is_in_scope, is_custom, created_at, updated_at
    )
    SELECT
      org_id,
      NULL,
      name,
      destination_type,
      trust_tag,
      COALESCE(applications, '{}'),
      NULLIF(
        TRIM(COALESCE(risk_notes, '') || CASE WHEN notes IS NOT NULL THEN E'\n' || notes ELSE '' END),
        ''
      ),
      TRUE,
      TRUE,
      created_at,
      updated_at
    FROM org_destinations;
  END IF;
END $$;

-- ─── 5. Drop superseded table ─────────────────────────────────────────────────

DROP TABLE IF EXISTS org_destinations CASCADE;
