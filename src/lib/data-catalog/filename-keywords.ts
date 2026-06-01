// Filename Detection Signal keyword lists.
// Used by the Data Catalog UI for display and by the filename matching engine.
//
// Matching engine normalization rule (both sides):
//   normalize = (s) => s.toLowerCase().replace(/[\s\-\.]+/g, '_')
//   match     = normalize(filename).includes(normalize(keyword))

export interface FilenameKeywordGroup {
  category:   string
  confidence: 'high' | 'medium'
  keywords:   string[]
}

export const SECRET_FILENAME_GROUPS: FilenameKeywordGroup[] = [
  {
    category:   'Private Keys & Certificates',
    confidence: 'high',
    keywords: [
      'private_key', 'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519',
      'secret.key', 'master.key', 'keystore.jks', 'truststore.jks',
      'encryption.key', 'aes.key', 'rsa_private', 'ssl_private',
      'tls_private', 'certificate.pem', 'private_cert', 'ca_private', 'signing_key',
    ],
  },
  {
    category:   'API Keys & Tokens',
    confidence: 'high',
    keywords: [
      'api_key', 'api_secret', 'api_credentials', 'client_secret', 'app_secret',
      'oauth_token', 'access_token', 'refresh_token', 'bearer_token',
      'service_account_key', 'gcp_credentials', 'aws_credentials',
      'azure_credentials', 'github_token', 'gitlab_token',
      'slack_token', 'stripe_key', 'twilio_auth', 'npm_token',
    ],
  },
  {
    category:   'Secrets & Credential Files',
    confidence: 'high',
    keywords: [
      '.env', '.env.local', '.env.production', '.env.staging',
      'secrets.yml', 'secrets.yaml', 'secrets.json',
      'credentials.json', 'credentials.yml',
      'auth_token', 'auth_config', 'session_secret',
    ],
  },
  {
    category:   'Database Credentials',
    confidence: 'high',
    keywords: [
      'db_password', 'database_credentials', 'db_config_prod',
      'connection_string', 'db_master_password',
    ],
  },
  {
    category:   'Network & VPN',
    confidence: 'high',
    keywords: [
      'vpn_credentials', 'network_credentials', 'wifi_password',
      'root_password', 'admin_credentials',
    ],
  },
  {
    category:   'Cloud & CI/CD',
    confidence: 'high',
    keywords: [
      'gcloud_credentials', 'boto_credentials', 's3_credentials',
      'azure_service_principal', 'terraform.tfvars',
      '.git_credentials', 'docker_credentials', 'deploy_keys',
      'jenkins_credentials', 'circleci_env', 'github_actions_secrets',
    ],
  },
  {
    category:   'Classification Markers',
    confidence: 'high',
    keywords: [
      'trade_secret', 'classified_document', 'eyes_only', 'restricted_access',
    ],
  },
  {
    category:   'Credential Backups',
    confidence: 'medium',
    keywords: [
      'password_backup', 'credential_backup', 'secrets_backup',
    ],
  },
]

export const HC_FILENAME_GROUPS: FilenameKeywordGroup[] = [
  {
    category:   'Personal Identifiable Information',
    confidence: 'high',
    keywords: [
      'passport_scan', 'national_id', 'ssn_records', 'tax_id',
      'birth_certificate', 'drivers_license', 'medical_id', 'insurance_card',
    ],
  },
  {
    category:   'Financial Data',
    confidence: 'high',
    keywords: [
      'payroll_data', 'salary_information', 'bank_statements', 'tax_returns',
      'financial_projections', 'credit_card_data', 'pci_data',
      'revenue_forecast', 'budget_confidential', 'investor_data', 'cap_table',
    ],
  },
  {
    category:   'Healthcare / Medical',
    confidence: 'high',
    keywords: [
      'patient_records', 'medical_records', 'hipaa_data', 'clinical_data',
      'health_records', 'lab_results', 'prescription_data',
      'medical_history', 'emr_export', 'ehr_export', 'phi_data',
    ],
  },
  {
    category:   'HR & Personnel',
    confidence: 'high',
    keywords: [
      'employee_records', 'hr_records', 'personnel_file',
      'performance_review', 'disciplinary_record', 'compensation_data',
      'headcount_plan', 'org_chart_confidential',
      'termination_records', 'background_check',
    ],
  },
  {
    category:   'M&A & Deals',
    confidence: 'high',
    keywords: [
      'merger_agreement', 'acquisition_target', 'due_diligence',
      'term_sheet_draft', 'loi_confidential', 'deal_memo',
      'investment_proposal', 'valuation_model', 'cap_table_draft',
    ],
  },
  {
    category:   'Legal & Contracts',
    confidence: 'high',
    keywords: [
      'legal_agreement', 'nda_signed', 'contract_confidential',
      'litigation_file', 'settlement_agreement', 'legal_opinion', 'outside_counsel',
    ],
  },
  {
    category:   'IP & Source Code',
    confidence: 'high',
    keywords: [
      'source_code_archive', 'proprietary_algorithm', 'patent_draft',
      'product_roadmap_internal', 'design_specification',
      'architectural_blueprint', 'research_findings_confidential',
      'competitive_analysis_internal',
    ],
  },
  {
    category:   'Executive & Board',
    confidence: 'high',
    keywords: [
      'board_presentation', 'executive_briefing', 'ceo_communication',
      'strategic_plan_confidential', 'board_minutes',
      'shareholder_report_draft', 'earnings_preview',
    ],
  },
  {
    category:   'Customer & Client Data',
    confidence: 'medium',
    keywords: [
      'customer_database', 'client_list_confidential', 'account_data',
      'crm_export', 'customer_contracts', 'pii_export', 'user_data_export',
    ],
  },
  {
    category:   'Security & Audit',
    confidence: 'high',
    keywords: [
      'penetration_test_report', 'vulnerability_assessment', 'security_audit',
      'network_diagram_internal', 'incident_report_confidential',
    ],
  },
  {
    category:   'Classification Markers',
    confidence: 'medium',
    keywords: [
      'highly_confidential', 'for_internal_use_only', 'do_not_distribute',
    ],
  },
]

export interface FilenameDetectionEntry {
  id:              'secret_filename' | 'highly_confidential_filename'
  label:           string
  dotColor:        string
  textColor:       string
  chipColorHigh:   string
  chipColorMedium: string
  description:     string
  groups:          FilenameKeywordGroup[]
  totalCount:      number
}

export const FILENAME_DETECTION_ENTRIES: FilenameDetectionEntry[] = [
  {
    id:              'secret_filename',
    label:           'Secret Filename',
    dotColor:        'bg-red-500',
    textColor:       'text-red-400',
    chipColorHigh:   'text-red-300 bg-red-500/10 border-red-500/20',
    chipColorMedium: 'text-red-300/60 bg-red-500/5 border-red-500/10',
    description:     'Filenames containing these patterns indicate the file likely holds credentials, private keys, tokens, or other secret-level content.',
    groups:          SECRET_FILENAME_GROUPS,
    totalCount:      SECRET_FILENAME_GROUPS.reduce((n, g) => n + g.keywords.length, 0),
  },
  {
    id:              'highly_confidential_filename',
    label:           'Highly Confidential Filename',
    dotColor:        'bg-orange-400',
    textColor:       'text-orange-400',
    chipColorHigh:   'text-orange-300 bg-orange-500/10 border-orange-500/20',
    chipColorMedium: 'text-orange-300/60 bg-orange-500/5 border-orange-500/10',
    description:     'Filenames containing these patterns indicate the file likely holds PII, financial records, medical data, M&A material, or other highly confidential content.',
    groups:          HC_FILENAME_GROUPS,
    totalCount:      HC_FILENAME_GROUPS.reduce((n, g) => n + g.keywords.length, 0),
  },
]
