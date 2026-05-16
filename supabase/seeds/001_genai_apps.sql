-- ============================================================
-- GenAI App Seed Data — 12 major GenAI apps
-- Run AFTER 003_genai_apps.sql migration
-- ============================================================

INSERT INTO genai_apps (app_id, app_name, vendor, domain, app_type, logo_letter, logo_bg, status, last_updated) VALUES
  ('chatgpt',          'ChatGPT',                     'OpenAI',        'chat.openai.com',          'General Purpose AI Assistant',   'C', '#10a37f', 'active', '2026-05-01'),
  ('gemini',           'Google Gemini',               'Google',        'gemini.google.com',         'General Purpose AI Assistant',   'G', '#4285f4', 'active', '2026-05-01'),
  ('copilot-m365',     'Microsoft Copilot (M365)',    'Microsoft',     'copilot.microsoft.com',     'Enterprise AI Assistant',        'M', '#0078d4', 'active', '2026-05-01'),
  ('claude',           'Claude',                      'Anthropic',     'claude.ai',                 'General Purpose AI Assistant',   'A', '#d97706', 'active', '2026-05-01'),
  ('perplexity',       'Perplexity AI',               'Perplexity',    'perplexity.ai',             'AI Search & Research Assistant', 'P', '#7c3aed', 'active', '2026-05-01'),
  ('github-copilot',   'GitHub Copilot',              'Microsoft',     'github.com/copilot',        'AI Code Assistant',              'G', '#24292f', 'active', '2026-05-01'),
  ('notion-ai',        'Notion AI',                   'Notion Labs',   'notion.so',                 'AI Productivity Assistant',      'N', '#000000', 'active', '2026-05-01'),
  ('grammarly',        'Grammarly Business',          'Grammarly',     'grammarly.com',             'AI Writing & Communication',     'G', '#15c39a', 'active', '2026-05-01'),
  ('midjourney',       'Midjourney',                  'Midjourney',    'midjourney.com',            'AI Image Generation',            'M', '#f97316', 'active', '2026-05-01'),
  ('salesforce-einstein', 'Salesforce Einstein AI',  'Salesforce',    'salesforce.com',            'Enterprise CRM AI',              'S', '#00a1e0', 'active', '2026-05-01'),
  ('slack-ai',         'Slack AI',                    'Salesforce',    'slack.com',                 'AI Collaboration Assistant',     'S', '#4a154b', 'active', '2026-05-01'),
  ('zoom-ai',          'Zoom AI Companion',           'Zoom',          'zoom.us',                   'AI Meeting & Collaboration',     'Z', '#2d8cff', 'active', '2026-05-01')
ON CONFLICT (app_id) DO NOTHING;

-- ============================================================
-- ChatGPT — Enterprise Mode
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'chatgpt', 'enterprise',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "yes",
    "trains_on_customer_data": "no",
    "opt_out_of_training": "yes",
    "data_retention": "configurable",
    "data_deletion": "partial",
    "data_residency": "partial",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "yes",
    "data_sharing_genai_vendor": "yes",
    "enterprise_tier": "yes",
    "sso_saml": "yes",
    "mfa_support": "yes",
    "role_based_auth": "yes",
    "authorization_policies": "yes",
    "admin_console": "yes",
    "user_audit_logs": "yes",
    "data_access_audit_logs": "yes",
    "tenant_isolation": "yes",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "no-published",
    "fedramp": "yes",
    "pci_dss": "yes",
    "hipaa_baa": "partial",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "yes",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "configurable",
    "private_instance": "yes",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "enforcement",
    "edit": "monitoring",
    "response": "monitoring",
    "download": "monitoring",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "yes",
    "breach_disclosed": "yes",
    "source_disclosure": "yes",
    "breach_remediated": "yes",
    "breach_name": "ChatGPT Bug — Conversation History Exposure",
    "breach_date": "2023-03-20",
    "breach_description": "Bug exposed user conversation history and partial payment information to other users."
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ChatGPT — Personal Mode
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'chatgpt', 'personal',
  '{
    "dpa_available": "no-published",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "tier-dependent",
    "opt_out_of_training": "yes",
    "data_retention": "partial",
    "data_deletion": "partial",
    "data_residency": "no-published",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "yes",
    "data_sharing_genai_vendor": "yes",
    "enterprise_tier": "no",
    "sso_saml": "no",
    "mfa_support": "yes",
    "role_based_auth": "no",
    "authorization_policies": "no",
    "admin_console": "no",
    "user_audit_logs": "no",
    "data_access_audit_logs": "no",
    "tenant_isolation": "no-published",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "yes",
    "hipaa_baa": "no",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "partial",
    "private_instance": "no",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "partial",
    "edit": "no-published",
    "response": "monitoring",
    "download": "monitoring",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "yes",
    "breach_disclosed": "yes",
    "source_disclosure": "yes",
    "breach_remediated": "yes",
    "breach_name": "ChatGPT Bug — Conversation History Exposure",
    "breach_date": "2023-03-20",
    "breach_description": "Bug exposed user conversation history and partial payment information to other users."
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- Google Gemini — Enterprise Mode
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'gemini', 'enterprise',
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
    "enterprise_tier": "yes",
    "sso_saml": "yes",
    "mfa_support": "yes",
    "role_based_auth": "yes",
    "authorization_policies": "yes",
    "admin_console": "yes",
    "user_audit_logs": "yes",
    "data_access_audit_logs": "yes",
    "tenant_isolation": "yes",
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
    "prompt_retention_controls": "configurable",
    "private_instance": "partial",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "enforcement",
    "edit": "monitoring",
    "response": "monitoring",
    "download": "partial",
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

-- Gemini — Personal Mode
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'gemini', 'personal',
  '{
    "dpa_available": "no-published",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "tier-dependent",
    "opt_out_of_training": "partial",
    "data_retention": "partial",
    "data_deletion": "partial",
    "data_residency": "no-published",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "yes",
    "data_sharing_genai_vendor": "yes",
    "enterprise_tier": "no",
    "sso_saml": "no",
    "mfa_support": "yes",
    "role_based_auth": "no",
    "authorization_policies": "no",
    "admin_console": "no",
    "user_audit_logs": "no",
    "data_access_audit_logs": "no",
    "tenant_isolation": "no",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "yes",
    "fedramp": "no-published",
    "pci_dss": "yes",
    "hipaa_baa": "no",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "partial",
    "private_instance": "no",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "partial",
    "edit": "no-published",
    "response": "no-published",
    "download": "no-published",
    "attach": "no-published"
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
-- Microsoft Copilot M365 — Enterprise Mode
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'copilot-m365', 'enterprise',
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
    "enterprise_tier": "yes",
    "sso_saml": "yes",
    "mfa_support": "yes",
    "role_based_auth": "yes",
    "authorization_policies": "yes",
    "admin_console": "yes",
    "user_audit_logs": "yes",
    "data_access_audit_logs": "yes",
    "tenant_isolation": "yes",
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
    "private_instance": "yes",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "enforcement",
    "edit": "enforcement",
    "response": "monitoring",
    "download": "enforcement",
    "attach": "enforcement"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- Copilot M365 — Personal Mode
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'copilot-m365', 'personal',
  '{
    "dpa_available": "no-published",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "tier-dependent",
    "opt_out_of_training": "partial",
    "data_retention": "partial",
    "data_deletion": "partial",
    "data_residency": "no-published",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "yes",
    "data_sharing_genai_vendor": "yes",
    "enterprise_tier": "no",
    "sso_saml": "no",
    "mfa_support": "yes",
    "role_based_auth": "no",
    "authorization_policies": "no",
    "admin_console": "no",
    "user_audit_logs": "no",
    "data_access_audit_logs": "no",
    "tenant_isolation": "no",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "yes",
    "fedramp": "no-published",
    "pci_dss": "yes",
    "hipaa_baa": "no",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "partial",
    "private_instance": "no",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "partial",
    "upload": "partial",
    "login_instance": "partial",
    "edit": "no-published",
    "response": "no-published",
    "download": "no-published",
    "attach": "no-published"
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
-- Claude (Anthropic) — Enterprise Mode
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'claude', 'enterprise',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "yes",
    "trains_on_customer_data": "no",
    "opt_out_of_training": "yes",
    "data_retention": "partial",
    "data_deletion": "yes",
    "data_residency": "partial",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "no",
    "data_sharing_genai_vendor": "no",
    "enterprise_tier": "yes",
    "sso_saml": "yes",
    "mfa_support": "yes",
    "role_based_auth": "yes",
    "authorization_policies": "partial",
    "admin_console": "yes",
    "user_audit_logs": "partial",
    "data_access_audit_logs": "partial",
    "tenant_isolation": "partial",
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
    "prompt_retention_controls": "configurable",
    "private_instance": "partial",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "enforcement",
    "edit": "monitoring",
    "response": "monitoring",
    "download": "monitoring",
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

-- Claude — Personal Mode
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'claude', 'personal',
  '{
    "dpa_available": "no-published",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "no",
    "opt_out_of_training": "yes",
    "data_retention": "partial",
    "data_deletion": "partial",
    "data_residency": "no-published",
    "subprocessor_list": "partial",
    "pii_sharing_third_parties": "no",
    "data_sharing_genai_vendor": "no",
    "enterprise_tier": "no",
    "sso_saml": "no",
    "mfa_support": "yes",
    "role_based_auth": "no",
    "authorization_policies": "no",
    "admin_console": "no",
    "user_audit_logs": "no",
    "data_access_audit_logs": "no",
    "tenant_isolation": "no",
    "soc2": "yes",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no-published",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "partial",
    "private_instance": "no",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "partial",
    "edit": "no-published",
    "response": "monitoring",
    "download": "no-published",
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
-- Perplexity AI — Enterprise Mode
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'perplexity', 'enterprise',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "partial",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "no-published",
    "data_retention": "no-published",
    "data_deletion": "no-published",
    "data_residency": "no-published",
    "subprocessor_list": "partial",
    "pii_sharing_third_parties": "no-published",
    "data_sharing_genai_vendor": "yes",
    "enterprise_tier": "yes",
    "sso_saml": "yes",
    "mfa_support": "yes",
    "role_based_auth": "partial",
    "authorization_policies": "partial",
    "admin_console": "partial",
    "user_audit_logs": "no-published",
    "data_access_audit_logs": "no-published",
    "tenant_isolation": "no-published",
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
    "private_instance": "no-published",
    "connectors_agents_risk": "yes"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "partial",
    "login_instance": "partial",
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
-- GitHub Copilot — Enterprise Mode
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'github-copilot', 'enterprise',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "yes",
    "trains_on_customer_data": "no",
    "opt_out_of_training": "yes",
    "data_retention": "partial",
    "data_deletion": "yes",
    "data_residency": "partial",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "partial",
    "enterprise_tier": "yes",
    "sso_saml": "yes",
    "mfa_support": "yes",
    "role_based_auth": "yes",
    "authorization_policies": "yes",
    "admin_console": "yes",
    "user_audit_logs": "yes",
    "data_access_audit_logs": "yes",
    "tenant_isolation": "yes",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "no-published",
    "fedramp": "partial",
    "pci_dss": "yes",
    "hipaa_baa": "partial",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "yes",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "partial",
    "private_instance": "yes",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "not-supported",
    "login_instance": "enforcement",
    "edit": "monitoring",
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
-- Notion AI — Enterprise Mode
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'notion-ai', 'enterprise',
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
    "data_sharing_genai_vendor": "yes",
    "enterprise_tier": "yes",
    "sso_saml": "yes",
    "mfa_support": "yes",
    "role_based_auth": "yes",
    "authorization_policies": "partial",
    "admin_console": "yes",
    "user_audit_logs": "yes",
    "data_access_audit_logs": "partial",
    "tenant_isolation": "partial",
    "soc2": "yes",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "partial",
    "model_provider_clear": "partial",
    "prompt_retention_controls": "partial",
    "private_instance": "partial",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "partial",
    "upload": "partial",
    "login_instance": "enforcement",
    "edit": "partial",
    "response": "partial",
    "download": "partial",
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
-- Grammarly Business — Enterprise Mode
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'grammarly', 'enterprise',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "yes",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "yes",
    "data_retention": "partial",
    "data_deletion": "partial",
    "data_residency": "partial",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "partial",
    "enterprise_tier": "yes",
    "sso_saml": "yes",
    "mfa_support": "yes",
    "role_based_auth": "yes",
    "authorization_policies": "yes",
    "admin_console": "yes",
    "user_audit_logs": "yes",
    "data_access_audit_logs": "partial",
    "tenant_isolation": "yes",
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
    "private_instance": "partial",
    "connectors_agents_risk": "no"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "not-supported",
    "login_instance": "enforcement",
    "edit": "enforcement",
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
-- Midjourney — Personal Mode only (no enterprise tier)
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'midjourney', 'personal',
  '{
    "dpa_available": "no-published",
    "customer_owns_data": "no",
    "trains_on_customer_data": "yes",
    "opt_out_of_training": "no",
    "data_retention": "no-published",
    "data_deletion": "no-published",
    "data_residency": "no-published",
    "subprocessor_list": "no-published",
    "pii_sharing_third_parties": "no-published",
    "data_sharing_genai_vendor": "yes",
    "enterprise_tier": "no",
    "sso_saml": "no",
    "mfa_support": "no",
    "role_based_auth": "no",
    "authorization_policies": "no",
    "admin_console": "no",
    "user_audit_logs": "no",
    "data_access_audit_logs": "no",
    "tenant_isolation": "no",
    "soc2": "no-published",
    "iso27001": "no-published",
    "iso27018": "no-published",
    "fedramp": "no-published",
    "pci_dss": "no-published",
    "hipaa_baa": "no-published",
    "encryption_at_rest": "no-published",
    "encryption_in_transit": "yes",
    "tenant_segregation": "no",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "no-published",
    "private_instance": "no",
    "connectors_agents_risk": "no"
  }',
  '{
    "post_prompt": "partial",
    "upload": "partial",
    "login_instance": "partial",
    "edit": "not-supported",
    "response": "not-supported",
    "download": "not-supported",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "no",
    "older_breach": "no-published",
    "breach_disclosed": "no-published",
    "source_disclosure": "no-published",
    "breach_remediated": "no-published"
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;

-- ============================================================
-- Salesforce Einstein AI — Enterprise Mode
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'salesforce-einstein', 'enterprise',
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
    "enterprise_tier": "yes",
    "sso_saml": "yes",
    "mfa_support": "yes",
    "role_based_auth": "yes",
    "authorization_policies": "yes",
    "admin_console": "yes",
    "user_audit_logs": "yes",
    "data_access_audit_logs": "yes",
    "tenant_isolation": "yes",
    "soc2": "yes",
    "iso27001": "yes",
    "iso27018": "no-published",
    "fedramp": "yes",
    "pci_dss": "yes",
    "hipaa_baa": "yes",
    "encryption_at_rest": "yes",
    "encryption_in_transit": "yes",
    "tenant_segregation": "yes",
    "model_provider_clear": "yes",
    "prompt_retention_controls": "yes",
    "private_instance": "yes",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "enforcement",
    "edit": "enforcement",
    "response": "monitoring",
    "download": "monitoring",
    "attach": "monitoring"
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
-- Slack AI — Enterprise Mode
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'slack-ai', 'enterprise',
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
    "enterprise_tier": "yes",
    "sso_saml": "yes",
    "mfa_support": "yes",
    "role_based_auth": "yes",
    "authorization_policies": "yes",
    "admin_console": "yes",
    "user_audit_logs": "yes",
    "data_access_audit_logs": "yes",
    "tenant_isolation": "yes",
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
    "prompt_retention_controls": "configurable",
    "private_instance": "yes",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "enforcement",
    "upload": "enforcement",
    "login_instance": "enforcement",
    "edit": "monitoring",
    "response": "monitoring",
    "download": "monitoring",
    "attach": "monitoring"
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
-- Zoom AI Companion — Enterprise Mode
-- ============================================================
INSERT INTO genai_app_profiles (app_id, mode, fields, dlp, breach_info) VALUES (
  'zoom-ai', 'enterprise',
  '{
    "dpa_available": "yes",
    "customer_owns_data": "yes",
    "trains_on_customer_data": "no-published",
    "opt_out_of_training": "yes",
    "data_retention": "configurable",
    "data_deletion": "yes",
    "data_residency": "partial",
    "subprocessor_list": "yes",
    "pii_sharing_third_parties": "partial",
    "data_sharing_genai_vendor": "partial",
    "enterprise_tier": "yes",
    "sso_saml": "yes",
    "mfa_support": "yes",
    "role_based_auth": "yes",
    "authorization_policies": "yes",
    "admin_console": "yes",
    "user_audit_logs": "yes",
    "data_access_audit_logs": "yes",
    "tenant_isolation": "yes",
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
    "private_instance": "yes",
    "connectors_agents_risk": "partial"
  }',
  '{
    "post_prompt": "not-supported",
    "upload": "partial",
    "login_instance": "enforcement",
    "edit": "not-supported",
    "response": "monitoring",
    "download": "partial",
    "attach": "not-supported"
  }',
  '{
    "recent_breach": "partial",
    "older_breach": "yes",
    "breach_disclosed": "yes",
    "source_disclosure": "yes",
    "breach_remediated": "yes",
    "breach_name": "Zoom Security Incidents",
    "breach_date": "2020-04-01",
    "breach_description": "Multiple security incidents in 2020 including Zoombombing and credential exposure."
  }'
) ON CONFLICT (app_id, mode) DO NOTHING;
