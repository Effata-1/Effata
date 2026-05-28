-- ============================================================
-- GenAI App Seed Data — Expanded Catalog (25 additional apps)
-- Run AFTER 003_genai_apps.sql migration and 001_genai_apps.sql
-- ============================================================

INSERT INTO genai_apps (app_id, app_name, vendor, domain, app_type, logo_letter, logo_bg, status, app_group, last_updated) VALUES
  ('grok',               'Grok',                     'xAI',              'x.ai',                     'AI Assistant',         'G', '#1da1f2', 'active', 'AI Chatbots',                        '2026-05-01'),
  ('deepseek',           'DeepSeek',                 'DeepSeek AI',      'chat.deepseek.com',         'AI Assistant',         'D', '#1a73e8', 'active', 'AI Chatbots',                        '2026-05-01'),
  ('mistral',            'Mistral Chat',             'Mistral AI',       'chat.mistral.ai',            'AI Assistant',         'M', '#f74f00', 'active', 'AI Chatbots',                        '2026-05-01'),
  ('poe',                'Poe',                      'Quora',            'poe.com',                    'AI Assistant',         'P', '#6366f1', 'active', 'AI Chatbots',                        '2026-05-01'),
  ('character-ai',       'Character.AI',             'Character.AI',     'character.ai',               'AI Assistant',         'C', '#4f46e5', 'active', 'AI Chatbots',                        '2026-05-01'),
  ('cursor',             'Cursor',                   'Anysphere',        'cursor.com',                 'Code Assistant',       'C', '#1c1c1c', 'active', 'Coding Assistants',                  '2026-05-01'),
  ('codeium',            'Codeium',                  'Codeium',          'codeium.com',                'Code Assistant',       'C', '#09b6a2', 'active', 'Coding Assistants',                  '2026-05-01'),
  ('tabnine',            'Tabnine',                  'Tabnine',          'tabnine.com',                'Code Assistant',       'T', '#7c3aed', 'active', 'Coding Assistants',                  '2026-05-01'),
  ('replit-ai',          'Replit AI',                'Replit',           'replit.com',                 'Code Assistant',       'R', '#f26207', 'active', 'Coding Assistants',                  '2026-05-01'),
  ('amazon-q',           'Amazon Q',                 'Amazon Web Services', 'aws.amazon.com/q',        'AI Assistant',         'A', '#ff9900', 'active', 'AI Chatbots',                        '2026-05-01'),
  ('cohere',             'Cohere',                   'Cohere Inc.',      'coral.cohere.com',            'AI Assistant',         'C', '#39594d', 'active', 'Model Platforms & AI APIs',          '2026-05-01'),
  ('databricks-ai',      'Databricks AI',            'Databricks',       'databricks.com',             'AI Analytics',         'D', '#ff3621', 'active', 'Data Analysis AI',                   '2026-05-01'),
  ('glean',              'Glean',                    'Glean Technologies', 'glean.com',                'AI Search',            'G', '#1c64f2', 'active', 'Search & Knowledge AI',              '2026-05-01'),
  ('copy-ai',            'Copy.ai',                  'Copy.ai',          'copy.ai',                    'AI Writing',           'C', '#7c3aed', 'active', 'Document AI',                        '2026-05-01'),
  ('jasper',             'Jasper',                   'Jasper AI',        'jasper.ai',                  'AI Writing',           'J', '#ff8c42', 'active', 'Document AI',                        '2026-05-01'),
  ('writer',             'Writer',                   'Writer Inc.',      'writer.com',                 'AI Writing',           'W', '#2563eb', 'active', 'Document AI',                        '2026-05-01'),
  ('elevenlabs',         'ElevenLabs',               'ElevenLabs',       'elevenlabs.io',              'AI Communication',     'E', '#1a1a2e', 'active', 'Creative & Design AI',               '2026-05-01'),
  ('otter-ai',           'Otter.ai',                 'Otter.ai',         'otter.ai',                   'AI Communication',     'O', '#0ea5e9', 'active', 'Meeting & Transcription AI',         '2026-05-01'),
  ('fireflies-ai',       'Fireflies.ai',             'Fireflies.ai',     'fireflies.ai',               'AI Communication',     'F', '#6366f1', 'active', 'Meeting & Transcription AI',         '2026-05-01'),
  ('adobe-firefly',      'Adobe Firefly',            'Adobe',            'firefly.adobe.com',          'Image Generator',      'A', '#fa0f00', 'active', 'Creative & Design AI',               '2026-05-01'),
  ('canva-ai',           'Canva AI',                 'Canva',            'canva.com',                  'AI Productivity',      'C', '#00c4cc', 'active', 'Creative & Design AI',               '2026-05-01'),
  ('gong',               'Gong AI',                  'Gong.io',          'gong.io',                    'AI Analytics',         'G', '#f97316', 'active', 'Sales & CRM AI',                     '2026-05-01'),
  ('zendesk-ai',         'Zendesk AI',               'Zendesk',          'zendesk.com',                'AI Communication',     'Z', '#03363d', 'active', 'Customer Support AI',                '2026-05-01'),
  ('you-com',            'You.com',                  'You.com',          'you.com',                    'AI Search',            'Y', '#2563eb', 'active', 'Search & Knowledge AI',              '2026-05-01'),
  ('loom-ai',            'Loom AI',                  'Loom (Atlassian)', 'loom.com',                   'AI Communication',     'L', '#625df5', 'active', 'Meeting & Transcription AI',         '2026-05-01')
ON CONFLICT (app_id) DO NOTHING;

-- ============================================================
-- GROK (xAI) — Personal (primary access mode)
-- High risk: limited data governance, X/Twitter integration
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'grok', 'personal',
  '{
    "dpa_available": "no-published",
    "customer_owns_data": "no",
    "trains_on_customer_data": "yes",
    "opt_out_of_training": "no",
    "data_retention": "no-published",
    "data_deletion": "no-published",
    "data_residency": "no-published",
    "subprocessor_list": "no-published",
    "pii_sharing_third_parties": "yes",
    "data_sharing_genai_vendor": "yes",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "no-published",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "no",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "monitoring",
    "upload": "monitoring",
    "login_instance": "monitoring",
    "edit": "not-supported",
    "response": "monitoring",
    "download": "not-supported",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- DEEPSEEK — Personal
-- Very high risk: Chinese company, data sent to China servers,
-- limited data governance transparency
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'deepseek', 'personal',
  '{
    "dpa_available": "no-published",
    "customer_owns_data": "no",
    "trains_on_customer_data": "yes",
    "opt_out_of_training": "no",
    "data_retention": "no-published",
    "data_deletion": "no-published",
    "data_residency": "no",
    "subprocessor_list": "no-published",
    "pii_sharing_third_parties": "yes",
    "data_sharing_genai_vendor": "yes",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "no-published",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "monitoring",
    "upload": "monitoring",
    "login_instance": "monitoring",
    "edit": "not-supported",
    "response": "monitoring",
    "download": "not-supported",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "yes",
    "older_breach": "no",
    "breach_disclosed": "partial",
    "source_disclosure": "yes",
    "breach_remediated": "partial",
    "breach_name": "DeepSeek Database Exposure",
    "breach_date": "2025-01-29",
    "breach_description": "Security researchers discovered a publicly accessible ClickHouse database containing over 1 million log entries with chat history, API keys, and backend metadata."
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- MISTRAL CHAT — Personal
-- French AI company, stronger EU data governance
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'mistral', 'personal',
  '{
    "dpa_available": "partial",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "partial",
    "data_retention": "no-published",
    "data_deletion": "partial",
    "data_residency": "partial",
    "subprocessor_list": "partial",
    "pii_sharing_third_parties": "no-published",
    "data_sharing_genai_vendor": "partial",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "monitoring",
    "upload": "monitoring",
    "login_instance": "monitoring",
    "edit": "not-supported",
    "response": "monitoring",
    "download": "not-supported",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- POE (Quora) — Personal
-- AI aggregator: routes prompts to multiple underlying models
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'poe', 'personal',
  '{
    "dpa_available": "no-published",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "no-published",
    "data_retention": "no-published",
    "data_deletion": "no-published",
    "data_residency": "no-published",
    "subprocessor_list": "no-published",
    "pii_sharing_third_parties": "yes",
    "data_sharing_genai_vendor": "yes",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "no-published",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "monitoring",
    "upload": "monitoring",
    "login_instance": "monitoring",
    "edit": "not-supported",
    "response": "monitoring",
    "download": "not-supported",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- CHARACTER.AI — Personal
-- Consumer-only, very high usage risk: no enterprise controls
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'character-ai', 'personal',
  '{
    "dpa_available": "no-published",
    "customer_owns_data": "no",
    "trains_on_customer_data": "yes",
    "opt_out_of_training": "no",
    "data_retention": "no-published",
    "data_deletion": "no-published",
    "data_residency": "no-published",
    "subprocessor_list": "no-published",
    "pii_sharing_third_parties": "yes",
    "data_sharing_genai_vendor": "yes",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "no-published",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "no",
    "connectors_agents_risk": "no"
  }',
  '{
    "post_prompt": "monitoring",
    "upload": "not-supported",
    "login_instance": "monitoring",
    "edit": "not-supported",
    "response": "monitoring",
    "download": "not-supported",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- CURSOR — Personal (IDE-based code assistant)
-- High DLP blind spot: primarily runs via IDE extension
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'cursor', 'personal',
  '{
    "dpa_available": "partial",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "tier-dependent",
    "opt_out_of_training": "partial",
    "data_retention": "no-published",
    "data_deletion": "no-published",
    "data_residency": "no-published",
    "subprocessor_list": "partial",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "yes",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "no-published",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "not-supported",
    "upload": "not-supported",
    "login_instance": "partial",
    "edit": "not-supported",
    "response": "not-supported",
    "download": "not-supported",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- CODEIUM (Windsurf) — Personal
-- IDE plugin + web interface, moderate DLP visibility
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'codeium', 'personal',
  '{
    "dpa_available": "partial",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "partial",
    "data_retention": "no-published",
    "data_deletion": "no-published",
    "data_residency": "no-published",
    "subprocessor_list": "no-published",
    "pii_sharing_third_parties": "no-published",
    "data_sharing_genai_vendor": "partial",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "no-published",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "not-supported",
    "upload": "not-supported",
    "login_instance": "partial",
    "edit": "not-supported",
    "response": "not-supported",
    "download": "not-supported",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- TABNINE — Personal
-- IDE-based, on-prem option available for enterprise
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'tabnine', 'personal',
  '{
    "dpa_available": "partial",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "tier-dependent",
    "opt_out_of_training": "partial",
    "data_retention": "no-published",
    "data_deletion": "no-published",
    "data_residency": "no-published",
    "subprocessor_list": "no-published",
    "pii_sharing_third_parties": "no-published",
    "data_sharing_genai_vendor": "partial",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "no-published",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "not-supported",
    "upload": "not-supported",
    "login_instance": "partial",
    "edit": "not-supported",
    "response": "not-supported",
    "download": "not-supported",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- REPLIT AI — Personal
-- Cloud IDE with AI: code AND data live in browser
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'replit-ai', 'personal',
  '{
    "dpa_available": "partial",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "no-published",
    "data_retention": "no-published",
    "data_deletion": "no-published",
    "data_residency": "no-published",
    "subprocessor_list": "no-published",
    "pii_sharing_third_parties": "no-published",
    "data_sharing_genai_vendor": "yes",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "monitoring",
    "upload": "monitoring",
    "login_instance": "monitoring",
    "edit": "monitoring",
    "response": "monitoring",
    "download": "partial",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- AMAZON Q — Enterprise
-- AWS-native, strong enterprise controls and DLP support
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'amazon-q', 'personal',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "yes",
    "trains_on_customer_data": "no",
    "opt_out_of_training": "yes",
    "data_retention": "configurable",
    "data_deletion": "yes",
    "data_residency": "yes",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "partial",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "yes",
    "fedramp": "yes",
    "pci_dss": "yes",
    "hipaa_baa": "yes",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "yes",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "yes",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "monitoring",
    "upload": "monitoring",
    "login_instance": "enforcement",
    "edit": "not-supported",
    "response": "not-supported",
    "download": "not-supported",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- COHERE — Personal (API-first platform)
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'cohere', 'personal',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "tier-dependent",
    "opt_out_of_training": "partial",
    "data_retention": "no-published",
    "data_deletion": "partial",
    "data_residency": "partial",
    "subprocessor_list": "partial",
    "pii_sharing_third_parties": "no-published",
    "data_sharing_genai_vendor": "partial",
    "soc2": "yes",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "partial",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "partial",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "monitoring",
    "upload": "monitoring",
    "login_instance": "monitoring",
    "edit": "not-supported",
    "response": "monitoring",
    "download": "not-supported",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- DATABRICKS AI — Personal (browser-based data platform)
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'databricks-ai', 'personal',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "yes",
    "trains_on_customer_data": "no",
    "opt_out_of_training": "yes",
    "data_retention": "configurable",
    "data_deletion": "yes",
    "data_residency": "yes",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "partial",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "no-published",
    "fedramp": "partial",
    "pci_dss": "yes",
    "hipaa_baa": "yes",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "yes",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "partial",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "monitoring",
    "upload": "enforcement",
    "login_instance": "enforcement",
    "edit": "monitoring",
    "response": "monitoring",
    "download": "enforcement",
    "attach": "partial"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- GLEAN — Personal (enterprise search AI)
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'glean', 'personal',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "yes",
    "trains_on_customer_data": "no",
    "opt_out_of_training": "yes",
    "data_retention": "configurable",
    "data_deletion": "yes",
    "data_residency": "partial",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "partial",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "yes",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "yes",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "partial",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "not-supported",
    "login_instance": "enforcement",
    "edit": "not-supported",
    "response": "monitoring",
    "download": "partial",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- COPY.AI — Personal
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'copy-ai', 'personal',
  '{
    "dpa_available": "partial",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "no-published",
    "data_retention": "no-published",
    "data_deletion": "no-published",
    "data_residency": "no-published",
    "subprocessor_list": "partial",
    "pii_sharing_third_parties": "yes",
    "data_sharing_genai_vendor": "yes",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "not-supported",
    "login_instance": "monitoring",
    "edit": "monitoring",
    "response": "monitoring",
    "download": "partial",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- JASPER — Personal
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'jasper', 'personal',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "partial",
    "data_retention": "no-published",
    "data_deletion": "partial",
    "data_residency": "no-published",
    "subprocessor_list": "partial",
    "pii_sharing_third_parties": "yes",
    "data_sharing_genai_vendor": "yes",
    "soc2": "yes",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "partial",
    "login_instance": "monitoring",
    "edit": "monitoring",
    "response": "monitoring",
    "download": "partial",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- WRITER — Personal (enterprise-focused AI writing)
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'writer', 'personal',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "yes",
    "trains_on_customer_data": "no",
    "opt_out_of_training": "yes",
    "data_retention": "partial",
    "data_deletion": "partial",
    "data_residency": "partial",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "partial",
    "soc2": "yes",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "partial",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "partial",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "partial",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "partial",
    "login_instance": "enforcement",
    "edit": "monitoring",
    "response": "monitoring",
    "download": "partial",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- ELEVENLABS — Personal (AI voice generation)
-- Risk: voice cloning of executives/employees
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'elevenlabs', 'personal',
  '{
    "dpa_available": "partial",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "tier-dependent",
    "opt_out_of_training": "partial",
    "data_retention": "no-published",
    "data_deletion": "partial",
    "data_residency": "no-published",
    "subprocessor_list": "partial",
    "pii_sharing_third_parties": "no-published",
    "data_sharing_genai_vendor": "partial",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "monitoring",
    "edit": "not-supported",
    "response": "not-supported",
    "download": "partial",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- OTTER.AI — Personal (meeting transcription)
-- Risk: meeting audio/transcripts contain sensitive discussions
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'otter-ai', 'personal',
  '{
    "dpa_available": "partial",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "tier-dependent",
    "opt_out_of_training": "partial",
    "data_retention": "configurable",
    "data_deletion": "partial",
    "data_residency": "no-published",
    "subprocessor_list": "partial",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "yes",
    "soc2": "yes",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "not-supported",
    "upload": "partial",
    "login_instance": "monitoring",
    "edit": "not-supported",
    "response": "not-supported",
    "download": "partial",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- FIREFLIES.AI — Personal (meeting AI)
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'fireflies-ai', 'personal',
  '{
    "dpa_available": "partial",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "no-published",
    "data_retention": "no-published",
    "data_deletion": "partial",
    "data_residency": "no-published",
    "subprocessor_list": "partial",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "yes",
    "soc2": "partial",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "not-supported",
    "upload": "not-supported",
    "login_instance": "monitoring",
    "edit": "not-supported",
    "response": "not-supported",
    "download": "partial",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- ADOBE FIREFLY — Personal
-- Adobe ecosystem: strong compliance, but trains on content
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'adobe-firefly', 'personal',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "tier-dependent",
    "opt_out_of_training": "partial",
    "data_retention": "partial",
    "data_deletion": "partial",
    "data_residency": "partial",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "partial",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "yes",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "partial",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "partial",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "enforcement",
    "edit": "monitoring",
    "response": "monitoring",
    "download": "partial",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "partial",
    "breach_disclosed": "yes",
    "source_disclosure": "yes",
    "breach_remediated": "yes"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- CANVA AI — Personal
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'canva-ai', 'personal',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "tier-dependent",
    "opt_out_of_training": "partial",
    "data_retention": "partial",
    "data_deletion": "partial",
    "data_residency": "partial",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "yes",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "partial",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "enforcement",
    "edit": "monitoring",
    "response": "monitoring",
    "download": "enforcement",
    "attach": "partial"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "partial",
    "breach_disclosed": "yes",
    "source_disclosure": "yes",
    "breach_remediated": "yes",
    "breach_name": "Canva Data Breach",
    "breach_date": "2019-05-24",
    "breach_description": "139 million user records exposed including names, email addresses, and bcrypt password hashes."
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- GONG AI — Personal (sales conversation intelligence)
-- Processes customer call recordings — high sensitivity
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'gong', 'personal',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "yes",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "partial",
    "data_retention": "configurable",
    "data_deletion": "yes",
    "data_residency": "partial",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "partial",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "partial",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "yes",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "partial",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "not-supported",
    "upload": "not-supported",
    "login_instance": "enforcement",
    "edit": "not-supported",
    "response": "not-supported",
    "download": "partial",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- ZENDESK AI — Personal
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'zendesk-ai', 'personal',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "yes",
    "trains_on_customer_data": "no",
    "opt_out_of_training": "yes",
    "data_retention": "configurable",
    "data_deletion": "yes",
    "data_residency": "yes",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "partial",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "yes",
    "fedramp": "partial",
    "pci_dss": "yes",
    "hipaa_baa": "yes",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "yes",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "configurable",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "enforcement",
    "edit": "monitoring",
    "response": "monitoring",
    "download": "monitoring",
    "attach": "partial"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "partial",
    "breach_disclosed": "yes",
    "source_disclosure": "yes",
    "breach_remediated": "yes"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- YOU.COM — Personal (AI search)
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'you-com', 'personal',
  '{
    "dpa_available": "partial",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "no-published",
    "data_retention": "no-published",
    "data_deletion": "no-published",
    "data_residency": "no-published",
    "subprocessor_list": "no-published",
    "pii_sharing_third_parties": "yes",
    "data_sharing_genai_vendor": "yes",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "no-published",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "no-published",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "partial",
    "login_instance": "monitoring",
    "edit": "not-supported",
    "response": "monitoring",
    "download": "not-supported",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- LOOM AI — Personal (async video with AI summaries)
-- Atlassian-owned. Video recordings may contain sensitive content
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'loom-ai', 'personal',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "yes",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "partial",
    "data_retention": "configurable",
    "data_deletion": "yes",
    "data_residency": "partial",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "partial",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "yes",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "partial",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "not-supported",
    "upload": "enforcement",
    "login_instance": "enforcement",
    "edit": "not-supported",
    "response": "not-supported",
    "download": "partial",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;
