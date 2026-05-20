-- ─────────────────────────────────────────────────────────────────────────────
-- 026_destination_catalog_expansion.sql
-- Adds ~100 destination profiles across 10 new subcategories:
-- hr_people, finance_accounting, crm_sales, data_platform, security_tools,
-- observability, design_creative, marketing, data_integration,
-- communication, customer_success, ecommerce, data_analytics, legal_compliance
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO catalog_destinations (slug, name, trust_tag, subcategory, description, examples, priority) VALUES

-- ══════════════════════════════════════════════════════════════════════════════
-- ENTERPRISE APPROVED
-- ══════════════════════════════════════════════════════════════════════════════

-- ── HR & People ────────────────────────────────────────────────────────────────
('adp_workforce_now',   'ADP Workforce Now',         'enterprise_approved', 'hr_people',
  'Cloud HR and payroll platform. Contains employee records, compensation, tax, and benefit data.',
  ARRAY['workforcenow.adp.com','adp.com'], 1),
('bamboohr_enterprise', 'BambooHR (Enterprise)',     'enterprise_approved', 'hr_people',
  'Cloud HR system for employee data, time tracking, and performance management. Managed with SSO.',
  ARRAY['bamboohr.com','*.bamboohr.com'], 2),
('greenhouse_ats',      'Greenhouse ATS',            'enterprise_approved', 'hr_people',
  'Applicant tracking system. Contains candidate PII, interview notes, and hiring decision data.',
  ARRAY['greenhouse.io','app.greenhouse.io'], 2),
('rippling',            'Rippling',                  'enterprise_approved', 'hr_people',
  'Unified HR, IT, and Finance platform. Contains employee profiles, device management, and payroll data.',
  ARRAY['rippling.com','app.rippling.com'], 2),
('lattice',             'Lattice',                   'enterprise_approved', 'hr_people',
  'Performance management and engagement platform. Contains performance reviews, OKRs, and feedback.',
  ARRAY['lattice.com','app.latticehq.com'], 3),
('culture_amp',         'Culture Amp',               'enterprise_approved', 'hr_people',
  'Employee engagement and performance analytics. Contains survey responses and sensitive HR data.',
  ARRAY['cultureamp.com','app.cultureamp.com'], 3),
('workday_recruit',     'Workday Recruiting',        'enterprise_approved', 'hr_people',
  'Recruiting module within Workday HCM. Contains candidate applications and interview assessments.',
  ARRAY['myworkday.com','workday.com'], 2),

-- ── Finance & Accounting ───────────────────────────────────────────────────────
('netsuite_erp',        'Oracle NetSuite',           'enterprise_approved', 'finance_accounting',
  'Cloud ERP covering financials, inventory, and e-commerce. Contains financial records and PII.',
  ARRAY['system.netsuite.com','*.netsuite.com'], 1),
('sap_concur',          'SAP Concur',                'enterprise_approved', 'finance_accounting',
  'Travel and expense management platform. Contains employee receipts, card data, and travel PII.',
  ARRAY['concursolutions.com','us.concursolutions.com'], 2),
('coupa',               'Coupa',                     'enterprise_approved', 'finance_accounting',
  'Business spend management platform. Contains purchase orders, supplier contracts, and financial data.',
  ARRAY['coupahost.com','app.coupahost.com'], 2),
('expensify_managed',   'Expensify (managed)',        'enterprise_approved', 'finance_accounting',
  'Expense reporting with corporate card controls enabled and policy enforcement.',
  ARRAY['expensify.com','app.expensify.com'], 3),
('brex',                'Brex',                      'enterprise_approved', 'finance_accounting',
  'Corporate card and spend management. Contains transaction data and financial controls.',
  ARRAY['brex.com','dashboard.brex.com'], 2),
('sage_intacct',        'Sage Intacct',              'enterprise_approved', 'finance_accounting',
  'Cloud financial management for mid-market. Contains GL, AP/AR, and financial reporting data.',
  ARRAY['intacct.com','*.intacct.com'], 2),
('quickbooks_enterprise','QuickBooks Enterprise',    'enterprise_approved', 'finance_accounting',
  'Accounting software for larger organisations. Contains financial records and customer billing data.',
  ARRAY['qbo.intuit.com','quickbooksonline.com'], 3),

-- ── CRM & Sales ────────────────────────────────────────────────────────────────
('outreach_io',         'Outreach',                  'enterprise_approved', 'crm_sales',
  'Sales execution platform. Contains prospect and customer contact data, email sequences, and call recordings.',
  ARRAY['outreach.io','app.outreach.io'], 2),
('salesloft',           'Salesloft',                 'enterprise_approved', 'crm_sales',
  'Revenue lifecycle management platform. Contains contact data, call recordings, and sales activity logs.',
  ARRAY['salesloft.com','app.salesloft.com'], 2),
('gong',                'Gong',                      'enterprise_approved', 'crm_sales',
  'Revenue intelligence platform. Contains call recordings, transcripts, and customer deal data — highly sensitive.',
  ARRAY['gong.io','app.gong.io'], 1),
('zoominfo',            'ZoomInfo',                  'enterprise_approved', 'crm_sales',
  'B2B contact and company data platform. Contains business PII. Ensure GDPR/CCPA compliant use.',
  ARRAY['zoominfo.com','app.zoominfo.com'], 2),
('linkedin_sales_nav',  'LinkedIn Sales Navigator',  'enterprise_approved', 'crm_sales',
  'Sales prospecting tool with LinkedIn data. Export controls required — do not bulk-export contact PII.',
  ARRAY['linkedin.com/sales','salesnav.linkedin.com'], 2),
('clari',               'Clari',                     'enterprise_approved', 'crm_sales',
  'Revenue operations platform for forecasting. Contains pipeline data and deal intelligence.',
  ARRAY['clari.com','app.clari.com'], 3),

-- ── Data Platform ─────────────────────────────────────────────────────────────
('snowflake',           'Snowflake',                 'enterprise_approved', 'data_platform',
  'Cloud data warehouse. May contain sensitive business data. Enforce column-level security and data masking.',
  ARRAY['*.snowflakecomputing.com'], 1),
('databricks',          'Databricks',                'enterprise_approved', 'data_platform',
  'Unified data and AI platform. Contains data lake assets and ML pipelines. Enforce workspace isolation.',
  ARRAY['*.azuredatabricks.net','*.databricks.com'], 1),
('google_bigquery',     'Google BigQuery',           'enterprise_approved', 'data_platform',
  'Serverless data warehouse. Governed by Google Workspace data controls and IAM policies.',
  ARRAY['console.cloud.google.com','bigquery.googleapis.com'], 1),
('aws_redshift',        'AWS Redshift',              'enterprise_approved', 'data_platform',
  'Managed cloud data warehouse. Enforce encryption, VPC isolation, and IAM-based access control.',
  ARRAY['*.redshift.amazonaws.com'], 2),
('azure_synapse',       'Azure Synapse Analytics',   'enterprise_approved', 'data_platform',
  'Enterprise analytics service combining data warehousing and big data. Governed by Azure RBAC.',
  ARRAY['*.azuresynapse.net','web.azuresynapse.net'], 2),
('dbt_cloud',           'dbt Cloud',                 'enterprise_approved', 'data_platform',
  'Data transformation platform. Contains SQL models and data pipeline logic. Manage access via SSO.',
  ARRAY['cloud.getdbt.com'], 3),

-- ── Security Tools ────────────────────────────────────────────────────────────
('okta',                'Okta',                      'enterprise_approved', 'security_tools',
  'Identity and access management platform. Contains authentication logs, user provisioning, and SSO configs.',
  ARRAY['okta.com','*.okta.com'], 1),
('crowdstrike',         'CrowdStrike Falcon',        'enterprise_approved', 'security_tools',
  'Endpoint detection and response platform. Contains threat intelligence, incident data, and device telemetry.',
  ARRAY['falcon.crowdstrike.com','*.crowdstrike.com'], 1),
('splunk_enterprise',   'Splunk Enterprise',         'enterprise_approved', 'security_tools',
  'Security information and event management (SIEM). Contains log data, alerts, and security incidents.',
  ARRAY['*.splunkcloud.com','splunk.com'], 1),
('ms_defender',         'Microsoft Defender',        'enterprise_approved', 'security_tools',
  'Endpoint protection and threat intelligence within Microsoft 365. Governed by M365 tenant controls.',
  ARRAY['security.microsoft.com','*.microsoft.com'], 1),
('palo_alto_prisma',    'Palo Alto Prisma Cloud',   'enterprise_approved', 'security_tools',
  'Cloud-native security platform. Contains cloud posture data, vulnerability findings, and compliance results.',
  ARRAY['prismacloud.io','app.prismacloud.io'], 2),
('sentinelone',         'SentinelOne',               'enterprise_approved', 'security_tools',
  'AI-powered endpoint security. Contains threat detections, forensic data, and device health telemetry.',
  ARRAY['usea1.sentinelone.net','*.sentinelone.net'], 2),
('tenable',             'Tenable.io',                'enterprise_approved', 'security_tools',
  'Vulnerability management platform. Contains asset inventory, scan results, and risk scores.',
  ARRAY['cloud.tenable.com','tenable.io'], 2),

-- ── Observability ─────────────────────────────────────────────────────────────
('datadog',             'Datadog',                   'enterprise_approved', 'observability',
  'Cloud monitoring and observability platform. Contains infrastructure metrics, logs, and APM traces.',
  ARRAY['app.datadoghq.com','*.datadoghq.com'], 1),
('new_relic',           'New Relic',                 'enterprise_approved', 'observability',
  'Full-stack observability platform. Contains application performance data and infrastructure telemetry.',
  ARRAY['one.newrelic.com','*.newrelic.com'], 2),
('dynatrace',           'Dynatrace',                 'enterprise_approved', 'observability',
  'AIOps and observability platform. Contains application traces, user sessions, and infrastructure data.',
  ARRAY['*.live.dynatrace.com','dynatrace.com'], 2),
('grafana_enterprise',  'Grafana Enterprise',        'enterprise_approved', 'observability',
  'Enterprise observability and dashboarding. Self-hosted or Grafana Cloud with SSO and RBAC.',
  ARRAY['grafana.com','*.grafana.net'], 3),
('elastic_cloud',       'Elastic Cloud',             'enterprise_approved', 'observability',
  'Managed Elasticsearch for logs, search, and observability. Enforce index-level access control.',
  ARRAY['cloud.elastic.co','*.elastic-cloud.com'], 3),

-- ── Design & Creative ─────────────────────────────────────────────────────────
('figma_enterprise',    'Figma Enterprise',          'enterprise_approved', 'design_creative',
  'Collaborative design tool with enterprise SSO, org-level admin controls, and audit logs.',
  ARRAY['figma.com','*.figma.com'], 2),
('adobe_creative_cloud','Adobe Creative Cloud (managed)','enterprise_approved','design_creative',
  'Organisation-managed Adobe suite with enterprise identity, storage limits, and sharing controls.',
  ARRAY['adobe.com','creativecloud.adobe.com'], 2),

-- ── Marketing ─────────────────────────────────────────────────────────────────
('marketo',             'Adobe Marketo Engage',      'enterprise_approved', 'marketing',
  'Marketing automation platform. Contains lead data, campaign analytics, and customer segments.',
  ARRAY['marketo.com','app.marketo.com','*.marketo.net'], 1),
('sf_marketing_cloud',  'Salesforce Marketing Cloud','enterprise_approved', 'marketing',
  'Digital marketing platform. Contains customer profiles, journey data, and campaign content.',
  ARRAY['exacttarget.com','marketing.salesforce.com','*.exacttarget.com'], 1),
('google_ads_managed',  'Google Ads (managed)',      'enterprise_approved', 'marketing',
  'Paid advertising platform managed under a corporate Google account with MCC controls.',
  ARRAY['ads.google.com','adwords.google.com'], 2),
('semrush_enterprise',  'Semrush Enterprise',        'enterprise_approved', 'marketing',
  'SEO and competitive intelligence. Contains keyword data, site audit results, and traffic analytics.',
  ARRAY['semrush.com','app.semrush.com'], 3),

-- ── Communication ─────────────────────────────────────────────────────────────
('ringcentral_managed', 'RingCentral (managed)',     'enterprise_approved', 'communication',
  'UCaaS platform for voice, video, and messaging. Managed with call recording controls and compliance.',
  ARRAY['ringcentral.com','app.ringcentral.com'], 2),
('dialpad_managed',     'Dialpad (managed)',         'enterprise_approved', 'communication',
  'AI-powered voice and messaging platform. Managed with call recordings, transcripts, and admin controls.',
  ARRAY['dialpad.com','app.dialpad.com'], 2),
('eight_by_eight',      '8x8',                       'enterprise_approved', 'communication',
  'Cloud communications platform (voice, video, chat). Managed with compliance recording capabilities.',
  ARRAY['8x8.com','app.8x8.com'], 3),

-- ── Customer Success ──────────────────────────────────────────────────────────
('gainsight',           'Gainsight',                 'enterprise_approved', 'customer_success',
  'Customer success platform. Contains customer health scores, usage data, and account risk signals.',
  ARRAY['gainsight.com','app.gainsight.com'], 2),
('totango',             'Totango',                   'enterprise_approved', 'customer_success',
  'Customer success management. Contains account segments, journey data, and health metrics.',
  ARRAY['totango.com','app.totango.com'], 3),

-- ── Legal & Compliance ────────────────────────────────────────────────────────
('docusign_enterprise', 'DocuSign (Enterprise)',     'enterprise_approved', 'legal_compliance',
  'Electronic signature and contract management with enterprise controls, audit trails, and retention.',
  ARRAY['docusign.com','app.docusign.com'], 1),
('ironclad_clm',        'Ironclad CLM',              'enterprise_approved', 'legal_compliance',
  'Contract lifecycle management. Contains legal agreements, NDA data, and contract obligations.',
  ARRAY['ironcladapp.com','app.ironcladapp.com'], 2),
('relativity',          'Relativity',                'enterprise_approved', 'legal_compliance',
  'Legal review and eDiscovery platform. Contains privileged legal communications and evidence data.',
  ARRAY['relativity.com','*.relativity.one'], 1),

-- ── eCommerce ─────────────────────────────────────────────────────────────────
('shopify_plus',        'Shopify Plus',              'enterprise_approved', 'ecommerce',
  'Enterprise ecommerce platform. Contains customer PII, order history, and payment method metadata.',
  ARRAY['myshopify.com','*.shopifycloud.com'], 2),

-- ══════════════════════════════════════════════════════════════════════════════
-- APPROVED WITH CONDITIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- ── CRM & Sales ────────────────────────────────────────────────────────────────
('pipedrive',           'Pipedrive',                 'approved_with_conditions', 'crm_sales',
  'CRM for sales teams. Permitted with restricted external sharing — ensure customer PII is not exported.',
  ARRAY['pipedrive.com','app.pipedrive.com'], 3),
('apollo_io',           'Apollo.io',                 'approved_with_conditions', 'crm_sales',
  'B2B prospecting and sales engagement. Contains business contact PII. Ensure GDPR-compliant use.',
  ARRAY['apollo.io','app.apollo.io'], 3),
('chorus_ai',           'Chorus.ai (ZoomInfo)',      'approved_with_conditions', 'crm_sales',
  'Conversation intelligence for sales calls. Contains call recordings and customer transcripts.',
  ARRAY['chorus.ai','app.chorus.ai'], 3),

-- ── Marketing ─────────────────────────────────────────────────────────────────
('mailchimp',           'Mailchimp',                 'approved_with_conditions', 'marketing',
  'Email marketing platform. Contains subscriber lists with PII. Ensure unsubscribe compliance and data minimisation.',
  ARRAY['mailchimp.com','us*.api.mailchimp.com'], 2),
('klaviyo',             'Klaviyo',                   'approved_with_conditions', 'marketing',
  'Marketing automation for e-commerce. Contains customer purchase history and behavioural data.',
  ARRAY['klaviyo.com','app.klaviyo.com'], 2),
('constant_contact',    'Constant Contact',          'approved_with_conditions', 'marketing',
  'Email marketing platform. Contains contact lists and campaign engagement data.',
  ARRAY['constantcontact.com','app.constantcontact.com'], 3),
('brevo',               'Brevo (Sendinblue)',        'approved_with_conditions', 'marketing',
  'CRM and email marketing. Contains contact data and transactional email logs.',
  ARRAY['brevo.com','app.brevo.com','sendinblue.com'], 3),
('google_analytics',    'Google Analytics 4',        'approved_with_conditions', 'marketing',
  'Web and app analytics. Contains pseudonymised user behaviour data — ensure cookie consent compliance.',
  ARRAY['analytics.google.com','*.google-analytics.com'], 2),
('hubspot_marketing',   'HubSpot Marketing Hub',     'approved_with_conditions', 'marketing',
  'Inbound marketing platform. Contains lead data, forms, and campaign analytics.',
  ARRAY['app.hubspot.com','hubspot.com'], 2),

-- ── HR & People ────────────────────────────────────────────────────────────────
('bamboohr_smb',        'BambooHR (SMB)',             'approved_with_conditions', 'hr_people',
  'HR platform for smaller teams without enterprise SSO. Restrict sensitive HR data exports.',
  ARRAY['bamboohr.com'], 3),
('gusto',               'Gusto',                     'approved_with_conditions', 'hr_people',
  'Payroll and benefits platform for SMBs. Contains sensitive payroll, tax, and benefit data.',
  ARRAY['gusto.com','app.gusto.com'], 3),
('fifteen_five',        '15Five',                    'approved_with_conditions', 'hr_people',
  'Employee engagement and performance tool. Contains check-in responses and sensitive feedback.',
  ARRAY['15five.com','app.15five.com'], 4),
('lever',               'Lever',                     'approved_with_conditions', 'hr_people',
  'Applicant tracking system. Contains candidate PII and interview assessments.',
  ARRAY['hire.lever.co','lever.co'], 3),

-- ── Design & Creative ─────────────────────────────────────────────────────────
('figma_pro',           'Figma (Pro)',                'approved_with_conditions', 'design_creative',
  'Collaborative design tool. Permitted for product and UX work — restrict external sharing of unreleased designs.',
  ARRAY['figma.com'], 2),
('canva_managed',       'Canva (managed)',            'approved_with_conditions', 'design_creative',
  'Visual design platform with team controls. Permitted for approved marketing assets — restrict confidential templates.',
  ARRAY['canva.com','*.canva.com'], 3),
('miro',                'Miro',                      'approved_with_conditions', 'design_creative',
  'Online whiteboarding and collaboration. Permitted for team workshops — restrict boards with confidential roadmaps.',
  ARRAY['miro.com','app.miro.com'], 3),
('invision',            'InVision',                  'approved_with_conditions', 'design_creative',
  'Design prototyping platform. Restrict sharing of prototype links containing unreleased product designs.',
  ARRAY['invisionapp.com','app.invisionapp.com'], 4),

-- ── Data Integration ─────────────────────────────────────────────────────────
('zapier',              'Zapier',                     'approved_with_conditions', 'data_integration',
  'No-code workflow automation. Review each Zap for data flows involving PII or confidential data before enabling.',
  ARRAY['zapier.com','hooks.zapier.com'], 2),
('make_integromat',     'Make (Integromat)',          'approved_with_conditions', 'data_integration',
  'Visual automation platform. Audit scenarios that process customer or financial data.',
  ARRAY['make.com','eu1.make.com','*.make.com'], 2),
('workato',             'Workato',                   'approved_with_conditions', 'data_integration',
  'Enterprise iPaaS platform. Contains integration recipes that may process sensitive business data.',
  ARRAY['workato.com','app.workato.com'], 2),
('mulesoft',            'MuleSoft Anypoint',         'approved_with_conditions', 'data_integration',
  'Enterprise integration platform. Routes data between enterprise systems — data classification review required.',
  ARRAY['anypoint.mulesoft.com','mulesoft.com'], 2),
('boomi',               'Boomi',                     'approved_with_conditions', 'data_integration',
  'Cloud integration and API management. Review process definitions that transfer regulated data.',
  ARRAY['boomi.com','platform.boomi.com'], 3),
('segment',             'Segment (Twilio)',           'approved_with_conditions', 'data_integration',
  'Customer data platform. Contains user event data and PII. Enforce destination filtering and GDPR compliance.',
  ARRAY['segment.com','app.segment.com'], 2),

-- ── Communication ─────────────────────────────────────────────────────────────
('discord_managed',     'Discord (managed server)',   'approved_with_conditions', 'communication',
  'Permitted for managed community or developer servers with moderation controls. Restrict internal data sharing.',
  ARRAY['discord.com','*.discord.com'], 4),
('twilio_dev',          'Twilio',                    'approved_with_conditions', 'communication',
  'Cloud communications API. Permitted for approved developer integrations — restrict logging of message content with PII.',
  ARRAY['twilio.com','api.twilio.com','console.twilio.com'], 3),
('zoom_personal',       'Zoom (personal account)',   'approved_with_conditions', 'communication',
  'Non-managed Zoom account. Permitted for external calls — restrict recording of sensitive meetings.',
  ARRAY['zoom.us'], 3),

-- ── Customer Success ──────────────────────────────────────────────────────────
('intercom',            'Intercom',                  'approved_with_conditions', 'customer_success',
  'Customer messaging platform. Contains customer conversations and support history.',
  ARRAY['intercom.com','app.intercom.com','*.intercomcdn.com'], 2),
('drift',               'Drift',                     'approved_with_conditions', 'customer_success',
  'Conversational marketing platform. Contains lead and customer chat transcripts.',
  ARRAY['drift.com','app.drift.com'], 3),
('freshdesk',           'Freshdesk',                 'approved_with_conditions', 'customer_success',
  'Customer support platform. Contains customer tickets and contact data — restrict bulk exports.',
  ARRAY['freshdesk.com','*.freshdesk.com'], 3),
('hubspot_service',     'HubSpot Service Hub',       'approved_with_conditions', 'customer_success',
  'Customer service platform. Contains support tickets and customer communications.',
  ARRAY['app.hubspot.com'], 3),

-- ── Data Analytics ────────────────────────────────────────────────────────────
('looker',              'Looker (Google)',            'approved_with_conditions', 'data_analytics',
  'Business intelligence and data exploration. Restrict access to dashboards containing PII or financial data.',
  ARRAY['looker.com','*.looker.com','*.cloud.looker.com'], 2),
('amplitude',           'Amplitude',                 'approved_with_conditions', 'data_analytics',
  'Product analytics platform. Contains pseudonymised user behaviour data — ensure data sampling and PII exclusion.',
  ARRAY['amplitude.com','app.amplitude.com'], 2),
('mixpanel',            'Mixpanel',                  'approved_with_conditions', 'data_analytics',
  'Product analytics platform. Contains user event data — review data governance policy before enabling PII properties.',
  ARRAY['mixpanel.com','api.mixpanel.com'], 2),
('metabase',            'Metabase',                  'approved_with_conditions', 'data_analytics',
  'Self-serve business intelligence tool. Restrict access to questions and dashboards with sensitive data.',
  ARRAY['metabase.com','*.metabaseapp.com'], 3),
('mode_analytics',      'Mode Analytics',            'approved_with_conditions', 'data_analytics',
  'Collaborative SQL and analytics platform. Restrict reports containing customer PII.',
  ARRAY['mode.com','app.mode.com'], 3),

-- ── eCommerce ─────────────────────────────────────────────────────────────────
('shopify_standard',    'Shopify (Standard)',         'approved_with_conditions', 'ecommerce',
  'eCommerce platform. Contains customer order data and payment metadata. Restrict bulk customer exports.',
  ARRAY['myshopify.com','admin.shopify.com'], 3),
('woocommerce',         'WooCommerce',               'approved_with_conditions', 'ecommerce',
  'WordPress eCommerce plugin. Contains order and customer data — ensure server-level encryption and access control.',
  ARRAY['woocommerce.com'], 3),
('stripe',              'Stripe',                    'approved_with_conditions', 'ecommerce',
  'Payment processing platform. Contains card metadata (not full PAN) and transaction records.',
  ARRAY['stripe.com','dashboard.stripe.com','api.stripe.com'], 2),

-- ── Legal & Compliance ────────────────────────────────────────────────────────
('docusign_free',       'DocuSign (standard)',        'approved_with_conditions', 'legal_compliance',
  'Electronic signature service. Permitted for standard agreements — use enterprise plan for regulated contracts.',
  ARRAY['docusign.com'], 3),
('pandadoc',            'PandaDoc',                  'approved_with_conditions', 'legal_compliance',
  'Document automation and e-signature. Restrict sharing of contracts with embedded PII or financial terms.',
  ARRAY['pandadoc.com','app.pandadoc.com'], 3),
('contractbook',        'Contractbook',              'approved_with_conditions', 'legal_compliance',
  'Contract management platform. Review access controls and external sharing settings.',
  ARRAY['contractbook.com','app.contractbook.com'], 4),

-- ══════════════════════════════════════════════════════════════════════════════
-- PERMITTED WITH RESTRICTION
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Design & Creative ─────────────────────────────────────────────────────────
('canva_personal',      'Canva (personal)',           'permitted_with_restriction', 'design_creative',
  'Personal Canva account. Permitted for public-facing content only — do not upload confidential images, logos, or internal documents.',
  ARRAY['canva.com'], 4),

-- ── Communication ─────────────────────────────────────────────────────────────
('discord_personal',    'Discord (personal)',         'permitted_with_restriction', 'communication',
  'Consumer Discord account. Permitted for personal use — block corporate file uploads and confidential content.',
  ARRAY['discord.com','discordapp.com'], 4),
('skype',               'Skype',                     'permitted_with_restriction', 'communication',
  'Consumer messaging and video. Permitted for external calls — restrict file sharing of corporate documents.',
  ARRAY['skype.com','web.skype.com'], 4),
('google_chat_personal','Google Chat (personal)',     'permitted_with_restriction', 'communication',
  'Consumer Google Chat. Permitted for personal use — restrict corporate document sharing outside Workspace.',
  ARRAY['chat.google.com'], 4),

-- ── Data Analytics ────────────────────────────────────────────────────────────
('hotjar',              'Hotjar',                     'permitted_with_restriction', 'data_analytics',
  'Behavioural analytics and heatmaps. Permitted for public-facing pages — mask form inputs and restrict PII capture.',
  ARRAY['hotjar.com','*.hotjar.com'], 3),
('fullstory',           'FullStory',                 'permitted_with_restriction', 'data_analytics',
  'Session replay and digital experience platform. Restrict PII capture via privacy mode configuration.',
  ARRAY['fullstory.com','*.fullstory.com'], 3),
('microsoft_clarity',   'Microsoft Clarity',         'permitted_with_restriction', 'data_analytics',
  'Free heatmap and session recording tool. Permitted for public pages — configure PII masking.',
  ARRAY['clarity.microsoft.com','*.clarity.ms'], 4),

-- ── Marketing ─────────────────────────────────────────────────────────────────
('mailchimp_free',      'Mailchimp (free tier)',      'permitted_with_restriction', 'marketing',
  'Email marketing (free plan, no admin controls). Permitted for small lists only — restrict bulk customer uploads.',
  ARRAY['mailchimp.com'], 4),
('linktree',            'Linktree',                  'permitted_with_restriction', 'marketing',
  'Link-in-bio tool. Permitted for approved public profiles. Do not include links to internal resources.',
  ARRAY['linktr.ee','*.linktr.ee'], 5),

-- ── File Transfer ─────────────────────────────────────────────────────────────
('filemail',            'Filemail',                  'permitted_with_restriction', 'file_transfer',
  'Large file transfer service. Permitted for non-sensitive files only — links are accessible to anyone with the URL.',
  ARRAY['filemail.com','*.filemail.com'], 3),
('smash',               'Smash',                     'permitted_with_restriction', 'file_transfer',
  'File transfer service. Permitted for public or low-sensitivity files — block confidential uploads.',
  ARRAY['fromsmash.com'], 3),

-- ══════════════════════════════════════════════════════════════════════════════
-- PROHIBITED
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Data Transfer (prohibited) ────────────────────────────────────────────────
('requestbin',          'RequestBin / Pipedream',    'prohibited', 'data_integration',
  'Public HTTP endpoint inspection tools. Any data sent is logged publicly. Block all corporate data.',
  ARRAY['requestbin.com','requestcatcher.com','pipedream.net'], 1),
('ngrok_public',        'Ngrok (public tunnels)',    'prohibited', 'data_integration',
  'Public tunnel service. Exposing internal services via public Ngrok URLs is a data exfiltration risk. Block.',
  ARRAY['ngrok.io','*.ngrok.io','ngrok-free.app'], 1),
('webhook_site',        'Webhook.site',              'prohibited', 'data_integration',
  'Public webhook inspection tool. Any data sent is stored publicly. Never forward corporate data.',
  ARRAY['webhook.site'], 1),

-- ── Communication (prohibited) ────────────────────────────────────────────────
('line_messaging',      'LINE',                      'prohibited', 'communication',
  'Asian messaging app. Prohibited on corporate devices due to data localisation in non-compliant jurisdictions.',
  ARRAY['line.me','*.line-scdn.net'], 2),

-- ── File Transfer (prohibited) ────────────────────────────────────────────────
('mega_nz',             'MEGA',                      'prohibited', 'file_transfer',
  'End-to-end encrypted cloud storage and file sharing. Prohibited — encryption prevents DLP inspection.',
  ARRAY['mega.nz','mega.co.nz'], 1),
('sendspace',           'SendSpace',                 'prohibited', 'file_transfer',
  'Public file hosting. No access controls or expiry guarantees. Block all corporate uploads.',
  ARRAY['sendspace.com','*.sendspace.com'], 2),

-- ── AI Tools (prohibited) ─────────────────────────────────────────────────────
('character_ai',        'Character.AI',              'prohibited', 'ai_tools',
  'Consumer AI roleplay platform. Prohibited — conversations are used for model training. No corporate data.',
  ARRAY['character.ai','beta.character.ai'], 1),
('poe_ai',              'Poe (Quora AI)',            'prohibited', 'ai_tools',
  'Multi-model AI chat platform. Prohibited — data handling and retention unclear. Use approved AI tools instead.',
  ARRAY['poe.com'], 1);
