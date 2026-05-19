-- ─────────────────────────────────────────────────────────────────────────────
-- 021_data_catalog.sql
-- Data Protection Categories system
--   1. catalog_data_types          (system, public read — shared across all orgs)
--   2. org_classification_labels   (org-specific classification scheme)
--   3. org_data_types              (org selections + custom types)
--   4. org_data_type_classifications (mapping: org data type → org label)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Table 1: System catalog ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS catalog_data_types (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug         TEXT        UNIQUE NOT NULL,
  name         TEXT        NOT NULL,
  system_level TEXT        NOT NULL CHECK (system_level IN ('secret','highly_confidential','confidential','internal','public')),
  subcategory  TEXT,
  description  TEXT,
  examples     TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes        TEXT,
  priority     INT         NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 5),
  tags         TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE catalog_data_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON catalog_data_types FOR SELECT USING (true);

-- ─── Table 2: Org classification labels ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_classification_labels (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  system_level TEXT        CHECK (system_level IN ('secret','highly_confidential','confidential','internal','public')),
  name         TEXT        NOT NULL,
  color        TEXT        NOT NULL DEFAULT 'zinc',
  priority     INT         NOT NULL,
  description  TEXT,
  is_system    BOOLEAN     NOT NULL DEFAULT FALSE,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, name)
);

ALTER TABLE org_classification_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON org_classification_labels
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID);

CREATE TRIGGER set_org_classification_labels_updated_at
  BEFORE UPDATE ON org_classification_labels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Table 3: Org data type selections ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_data_types (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id               UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  catalog_data_type_id UUID        REFERENCES catalog_data_types(id),
  name                 TEXT        NOT NULL,
  description          TEXT,
  examples             TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes                TEXT,
  is_in_scope          BOOLEAN     NOT NULL DEFAULT TRUE,
  is_custom            BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, catalog_data_type_id)
);

ALTER TABLE org_data_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON org_data_types
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID);

CREATE TRIGGER set_org_data_types_updated_at
  BEFORE UPDATE ON org_data_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Table 4: Mapping (data type → classification label) ─────────────────────

CREATE TABLE IF NOT EXISTS org_data_type_classifications (
  id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  org_data_type_id            UUID        NOT NULL REFERENCES org_data_types(id) ON DELETE CASCADE,
  org_classification_label_id UUID        NOT NULL REFERENCES org_classification_labels(id),
  confidence                  FLOAT       CHECK (confidence BETWEEN 0 AND 1),
  mapped_by                   TEXT        NOT NULL DEFAULT 'system' CHECK (mapped_by IN ('system','ai','user')),
  mapped_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, org_data_type_id)
);

ALTER TABLE org_data_type_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON org_data_type_classifications
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID);

-- ─── Seed: System catalog data types ─────────────────────────────────────────
-- Idempotent: ON CONFLICT (slug) DO NOTHING

-- ══ PUBLIC ════════════════════════════════════════════════════════════════════

INSERT INTO catalog_data_types (slug, name, system_level, subcategory, examples, notes, priority, tags) VALUES
('published-website-content',    'Published Website Content',    'public', 'Public Content',    ARRAY['Public web pages','Product pages','Landing pages','FAQ pages'],  'Only after formal approval for public release', 5, ARRAY['public','web']),
('public-marketing-material',    'Public Marketing Material',    'public', 'Public Content',    ARRAY['Brochures','Flyers','Advertisements','Public campaign material'], NULL, 5, ARRAY['public','marketing']),
('press-releases',               'Press Releases',               'public', 'Public Content',    ARRAY['Approved press statements','Corporate announcements'],           NULL, 5, ARRAY['public','communications']),
('public-social-media-content',  'Public Social Media Content',  'public', 'Public Content',    ARRAY['Approved brand posts','Public campaign posts'],                  NULL, 5, ARRAY['public','social']),
('public-product-documentation', 'Public Product Documentation', 'public', 'Public Content',    ARRAY['Public user guides','Release notes','Public knowledge base'],    NULL, 5, ARRAY['public','docs']),
('public-legal-documents',       'Public Legal Documents',       'public', 'Public Content',    ARRAY['Published privacy policy','Cookie policy','Public terms'],       NULL, 5, ARRAY['public','legal']),
('public-investor-information',  'Public Investor Information',  'public', 'Public Content',    ARRAY['Published annual reports','Public investor presentations'],       NULL, 5, ARRAY['public','finance']),
('public-recruitment-content',   'Public Recruitment Content',   'public', 'Public Content',    ARRAY['Job postings','Career page content','Public recruitment ads'],    NULL, 5, ARRAY['public','hr']),
('public-event-information',     'Public Event Information',     'public', 'Public Content',    ARRAY['Webinar pages','Public event invitations','Conference pages'],    NULL, 5, ARRAY['public']),
('public-thought-leadership',    'Public Thought Leadership',    'public', 'Public Content',    ARRAY['Published blogs','Public whitepapers','Approved public case studies'], NULL, 5, ARRAY['public','content']),
('public-support-content',       'Public Support Content',       'public', 'Public Content',    ARRAY['Public troubleshooting guides','Public service status pages'],    NULL, 5, ARRAY['public','support']),
('public-certifications',        'Public Awards and Certifications', 'public', 'Public Content', ARRAY['Public certification badges','Public compliance statements'],   NULL, 5, ARRAY['public','compliance'])
ON CONFLICT (slug) DO NOTHING;

-- ══ INTERNAL ══════════════════════════════════════════════════════════════════

INSERT INTO catalog_data_types (slug, name, system_level, subcategory, examples, notes, priority, tags) VALUES
('internal-sop',              'Internal Standard Operating Procedures', 'internal', 'Internal Operations', ARRAY['Process guides','Workflow documentation','Operational procedures'], NULL, 4, ARRAY['internal','operations']),
('internal-training',         'Internal Training Material',   'internal', 'Internal Operations', ARRAY['Internal courses','Training guides','Onboarding material'],          NULL, 4, ARRAY['internal','hr']),
('internal-meeting-notes',    'Internal Meeting Notes',       'internal', 'Internal Operations', ARRAY['Meeting minutes','Action item lists','Team notes'],                   'Elevate if contains customer/HR/legal/security data', 4, ARRAY['internal']),
('internal-project-trackers', 'Internal Project Trackers',    'internal', 'Internal Operations', ARRAY['Task boards','Sprint logs','Project status updates'],                 'Elevate if contains customer or sensitive data', 4, ARRAY['internal','projects']),
('internal-it-guides',        'Internal IT User Guides',      'internal', 'Internal Operations', ARRAY['Internal IT support docs','App guides','Internal FAQs'],              'Elevate if contains security or privileged access details', 4, ARRAY['internal','it']),
('internal-communication',    'Internal Business Communication', 'internal', 'Internal Operations', ARRAY['Internal emails','Team announcements','Routine business updates'],  NULL, 4, ARRAY['internal','email']),
('internal-knowledge-base',   'Internal Knowledge Base',      'internal', 'Internal Operations', ARRAY['Internal wiki pages','How-to guides','Internal reference docs'],      NULL, 4, ARRAY['internal','docs']),
('internal-inventory',        'Internal Inventory Records',   'internal', 'Internal Operations', ARRAY['Non-sensitive asset lists','Equipment registers','Stationery inventory'], NULL, 4, ARRAY['internal','operations']),
('internal-event-plans',      'Internal Event Plans',         'internal', 'Internal Operations', ARRAY['Employee engagement plans','Internal event schedules'],               NULL, 4, ARRAY['internal','hr']),
('internal-governance-notes', 'Internal Governance Notes',    'internal', 'Internal Operations', ARRAY['Committee agendas','Governance meeting notes'],                       'Elevate if contains risk, legal, or financial details', 4, ARRAY['internal','governance']),
('internal-vendor-list',      'Internal Vendor List',         'internal', 'Internal Operations', ARRAY['Basic vendor names','General supplier contact lists'],                'Elevate if includes pricing, contracts, or commercial terms', 4, ARRAY['internal','vendor']),
('internal-app-inventory',    'Internal Application Inventory', 'internal', 'Internal Operations', ARRAY['App inventory without security details','General software list'], 'Elevate if includes access secrets or security architecture', 4, ARRAY['internal','it']),
('internal-operational-reports', 'Internal Operational Reports', 'internal', 'Internal Operations', ARRAY['Non-sensitive status reports','Operational metrics','Team updates'], NULL, 4, ARRAY['internal','reporting'])
ON CONFLICT (slug) DO NOTHING;

-- ══ CONFIDENTIAL ══════════════════════════════════════════════════════════════

INSERT INTO catalog_data_types (slug, name, system_level, subcategory, examples, notes, priority, tags) VALUES
-- Customer Business Data
('customer-business-data',     'Customer Business Data',       'confidential', 'Customer Business Data',   ARRAY['Customer names','Account owner details','Customer relationship info'],   'Elevate to HC if bulk PII or sensitive details', 3, ARRAY['customer','confidential']),
('customer-documents',         'Customer Project Documents',   'confidential', 'Customer Business Data',   ARRAY['Implementation plans','Customer-specific reports','Customer designs'],   'Elevate if contains security or regulated data', 3, ARRAY['customer','project']),
('customer-support-cases',     'Customer Support Cases',       'confidential', 'Customer Business Data',   ARRAY['Support tickets','Customer issue logs'],                                 'Elevate if contains personal, legal, financial data', 3, ARRAY['customer','support']),
-- Contractual Data
('ndas',                       'Non-Disclosure Agreements',    'confidential', 'Contractual Data',         ARRAY['NDAs','Confidentiality agreements'],                                     'Elevate if part of M&A or litigation', 3, ARRAY['legal','contracts']),
('master-service-agreements',  'Master Service Agreements',    'confidential', 'Contractual Data',         ARRAY['MSAs','SOWs','Vendor agreements','Customer agreements'],                  NULL, 3, ARRAY['legal','contracts']),
('vendor-contracts',           'Vendor Contracts',             'confidential', 'Contractual Data',         ARRAY['Supplier agreements','Service contracts','SLAs'],                        NULL, 3, ARRAY['vendor','contracts']),
-- Commercial Data
('pricing-data',               'Pricing Data',                 'confidential', 'Commercial Data',          ARRAY['Pricing sheets','Discount models','Rate cards','Commercial terms'],       NULL, 3, ARRAY['commercial','finance']),
('sales-proposals',            'Sales Proposals',              'confidential', 'Commercial Data',          ARRAY['Proposals','Quotations','RFP responses','Commercial offers'],             NULL, 3, ARRAY['sales','commercial']),
('sales-pipeline',             'Sales Pipeline Data',          'confidential', 'Commercial Data',          ARRAY['Opportunity reports','Pipeline forecasts','Deal strategy'],              NULL, 3, ARRAY['sales','commercial']),
('procurement-data',           'Procurement Data',             'confidential', 'Vendor and Procurement Data', ARRAY['Vendor evaluations','Commercial comparisons','Supplier negotiations'], NULL, 3, ARRAY['procurement','vendor']),
-- Product and Strategy
('product-roadmap',            'Product Roadmap',              'confidential', 'Product and Strategy Data', ARRAY['Product roadmap','Launch plans','Unreleased feature details'],          NULL, 3, ARRAY['product','strategy']),
('business-strategy',          'Business Strategy Documents',  'confidential', 'Product and Strategy Data', ARRAY['Department strategy','Market expansion plans','Competitive positioning'], NULL, 3, ARRAY['strategy','business']),
('market-research',            'Market Research',              'confidential', 'Product and Strategy Data', ARRAY['Competitive intelligence','Customer segmentation','Market studies'],   NULL, 3, ARRAY['strategy','business']),
-- Project Delivery
('project-deliverables',       'Project Deliverables',         'confidential', 'Project Delivery Data',    ARRAY['HLD documents','LLD documents','As-built documents','Deployment guides'], 'Elevate if contains credentials or security details', 3, ARRAY['project','technical']),
-- Internal Financial
('internal-financial-reports', 'Internal Financial Reports',   'confidential', 'Internal Financial Data',  ARRAY['Non-public revenue reports','Margin reports','Cost center reports'],     'Elevate if market-sensitive', 3, ARRAY['finance','confidential']),
('budget-planning',            'Budget and Forecast Data',     'confidential', 'Internal Financial Data',  ARRAY['Budget planning','Forecast reports','Revenue analysis','Cost models'],  NULL, 3, ARRAY['finance']),
-- Business Risk
('risk-registers',             'Business Risk Registers',      'confidential', 'Business Risk Data',       ARRAY['Risk registers','Business risk ratings','Control gap summaries'],        'Elevate if contains security details', 3, ARRAY['risk','governance']),
('audit-preparation',          'Audit Preparation Data',       'confidential', 'Business Risk Data',       ARRAY['Internal audit evidence','Audit planning notes'],                       'Elevate once finalized or submitted', 3, ARRAY['audit','compliance']),
('partner-data',               'Partner and Channel Data',     'confidential', 'Vendor and Procurement Data', ARRAY['Partner agreements','Channel strategy','Reseller details'],         NULL, 3, ARRAY['partner','commercial']),
('business-continuity-plans',  'Business Continuity Plans',    'confidential', 'Business Risk Data',       ARRAY['BCP documents','Recovery objectives'],                                   'Elevate if includes security architecture or crisis contacts', 3, ARRAY['operations','risk'])
ON CONFLICT (slug) DO NOTHING;

-- ══ HIGHLY CONFIDENTIAL ═══════════════════════════════════════════════════════

INSERT INTO catalog_data_types (slug, name, system_level, subcategory, examples, notes, priority, tags) VALUES
-- 9.3.1 Personal & Identity
('government-identity-numbers', 'Government Identity Numbers',  'highly_confidential', 'Personal and Identity Data', ARRAY['SSN','Aadhaar','PAN','National ID','Taxpayer ID','National Insurance Number'], NULL, 2, ARRAY['pii','gdpr','identity','regulated']),
('passport-data',               'Passport Data',               'highly_confidential', 'Personal and Identity Data', ARRAY['Passport number','Passport scan','Visa details','Immigration documents'], NULL, 2, ARRAY['pii','gdpr','identity']),
('driver-license-data',         'Driver License Data',         'highly_confidential', 'Personal and Identity Data', ARRAY['Driver license number','Scanned license images'], NULL, 2, ARRAY['pii','identity']),
('date-of-birth',               'Date of Birth',               'highly_confidential', 'Personal and Identity Data', ARRAY['DOB combined with name, ID, or address'], 'High risk when combined with other identifiers', 2, ARRAY['pii','gdpr']),
('personal-address',            'Personal Address',            'highly_confidential', 'Personal and Identity Data', ARRAY['Home address','Mailing address','Permanent address'], NULL, 2, ARRAY['pii','gdpr']),
('personal-contact-data',       'Personal Contact Data',       'highly_confidential', 'Personal and Identity Data', ARRAY['Personal phone number','Personal email address'], NULL, 2, ARRAY['pii','gdpr']),
('biometric-identifiers',       'Biometric Identifiers',       'highly_confidential', 'Personal and Identity Data', ARRAY['Fingerprints','Facial templates','Iris scans','Voiceprints'], NULL, 2, ARRAY['biometric','gdpr','special-category']),
('online-identifiers',          'Online Identifiers',          'highly_confidential', 'Personal and Identity Data', ARRAY['IP addresses linked to individuals','Cookie IDs','Device IDs','Advertising IDs'], 'High risk when linked to identifiable individuals', 2, ARRAY['pii','gdpr']),
('identity-verification-data',  'Identity Verification Data',  'highly_confidential', 'Personal and Identity Data', ARRAY['KYC forms','Proof of address','Selfie verification data'], NULL, 2, ARRAY['pii','kyc','identity']),
('background-verification',     'Background Verification Data','highly_confidential', 'Personal and Identity Data', ARRAY['Employment verification','Criminal checks','Reference checks'], NULL, 2, ARRAY['pii','hr']),
-- 9.3.2 Sensitive Personal / Special Category
('health-data',                 'Health Data',                 'highly_confidential', 'Sensitive Personal Data', ARRAY['Medical records','Prescriptions','Diagnosis','Lab reports','Disability records'], NULL, 2, ARRAY['health','gdpr','hipaa','special-category']),
('genetic-data',                'Genetic Data',                'highly_confidential', 'Sensitive Personal Data', ARRAY['Genetic test results','DNA profiles'], NULL, 2, ARRAY['genetic','gdpr','special-category']),
('biometric-identification',    'Biometric Data for Identification', 'highly_confidential', 'Sensitive Personal Data', ARRAY['Facial recognition templates','Fingerprint templates'], NULL, 2, ARRAY['biometric','gdpr','special-category']),
('religious-philosophical-data','Religious or Philosophical Data', 'highly_confidential', 'Sensitive Personal Data', ARRAY['Religious affiliation','Belief records'], NULL, 2, ARRAY['gdpr','special-category']),
('political-opinion-data',      'Political Opinion Data',      'highly_confidential', 'Sensitive Personal Data', ARRAY['Political views','Membership records','Affiliation records'], NULL, 2, ARRAY['gdpr','special-category']),
('trade-union-data',            'Trade Union Data',            'highly_confidential', 'Sensitive Personal Data', ARRAY['Union membership information'], NULL, 2, ARRAY['gdpr','special-category','hr']),
('racial-ethnic-data',          'Racial or Ethnic Origin Data','highly_confidential', 'Sensitive Personal Data', ARRAY['Ethnicity data where protected or sensitive by law'], NULL, 2, ARRAY['gdpr','special-category']),
('mental-health-data',          'Mental Health Data',          'highly_confidential', 'Sensitive Personal Data', ARRAY['Therapy notes','Mental health assessments','Support records'], NULL, 2, ARRAY['health','gdpr','hipaa','special-category']),
-- 9.3.3 Payment & Financial
('pci-cardholder-data',         'PCI / Cardholder Data',       'highly_confidential', 'Payment and Financial Sensitive Data', ARRAY['PAN (card number)','Cardholder name with PAN','Expiry date with PAN'], NULL, 2, ARRAY['pci','financial','regulated']),
('sensitive-auth-data',         'Sensitive Authentication Data','highly_confidential', 'Payment and Financial Sensitive Data', ARRAY['CVV/CVC/CID','PIN','Full track data','Magnetic stripe data'], 'Storage prohibited in most contexts under PCI DSS; treat as Secret in motion', 2, ARRAY['pci','financial','regulated']),
('bank-account-data',           'Bank Account Data',           'highly_confidential', 'Payment and Financial Sensitive Data', ARRAY['Account number','IFSC/SWIFT/IBAN','Routing number','Bank statements'], NULL, 2, ARRAY['financial','banking']),
('payment-records',             'Payment Records',             'highly_confidential', 'Payment and Financial Sensitive Data', ARRAY['Payment authorization data','Settlement files','Transaction files'], NULL, 2, ARRAY['pci','financial']),
('tax-data',                    'Tax Data',                    'highly_confidential', 'Payment and Financial Sensitive Data', ARRAY['Tax returns','Tax ID numbers','GST/VAT records','W-2 equivalents'], NULL, 2, ARRAY['financial','regulated']),
('payroll-files',               'Payroll Files',               'highly_confidential', 'Payment and Financial Sensitive Data', ARRAY['Payroll register','Salary disbursement file','Compensation payout files'], NULL, 2, ARRAY['hr','financial','payroll']),
('loan-credit-data',            'Loan and Credit Data',        'highly_confidential', 'Payment and Financial Sensitive Data', ARRAY['Credit scores','Loan applications','Credit card applications','Underwriting details'], NULL, 2, ARRAY['financial','credit']),
('financial-fraud-data',        'Financial Fraud Data',        'highly_confidential', 'Payment and Financial Sensitive Data', ARRAY['Fraud case files','Suspicious transaction reports','AML investigation data'], NULL, 2, ARRAY['financial','legal','fraud']),
-- 9.3.4 HR & Employee
('salary-compensation',         'Salary and Compensation Data','highly_confidential', 'HR and Employee Sensitive Data', ARRAY['Salary files','Bonus details','Pay slips','Compensation bands'], NULL, 2, ARRAY['hr','financial','employee']),
('performance-records',         'Performance Records',         'highly_confidential', 'HR and Employee Sensitive Data', ARRAY['Appraisals','Ratings','Promotion recommendations'], NULL, 2, ARRAY['hr','employee']),
('disciplinary-records',        'Disciplinary Records',        'highly_confidential', 'HR and Employee Sensitive Data', ARRAY['Warnings','Investigation outcomes','Misconduct records'], NULL, 2, ARRAY['hr','employee','legal']),
('employee-personal-file',      'Employee Personal File',      'highly_confidential', 'HR and Employee Sensitive Data', ARRAY['Personal HR documents','Emergency contacts','Employment records'], NULL, 2, ARRAY['hr','pii','employee']),
('leave-medical-records',       'Leave and Medical Records',   'highly_confidential', 'HR and Employee Sensitive Data', ARRAY['Sick leave records','Medical certificates','Disability accommodations'], NULL, 2, ARRAY['hr','health','employee']),
('grievance-records',           'Grievance and HR Case Records','highly_confidential', 'HR and Employee Sensitive Data', ARRAY['Complaints','Harassment reports','Employee relations cases'], NULL, 2, ARRAY['hr','legal','employee']),
('workforce-reduction-data',    'Workforce Reduction Data',    'highly_confidential', 'HR and Employee Sensitive Data', ARRAY['Layoff planning','Redundancy lists','Termination plans'], NULL, 2, ARRAY['hr','employee','executive']),
-- 9.3.5 Customer-Sensitive
('bulk-customer-datasets',      'Bulk Customer Datasets',      'highly_confidential', 'Customer-Sensitive Data', ARRAY['CRM exports','Customer database dumps','Account exports'], NULL, 2, ARRAY['customer','pii','gdpr']),
('customer-pii',                'Customer PII',                'highly_confidential', 'Customer-Sensitive Data', ARRAY['Customer name + email + phone + address + ID','Account data combined'], NULL, 2, ARRAY['pii','gdpr','customer']),
('customer-financial-info',     'Customer Financial Information','highly_confidential', 'Customer-Sensitive Data', ARRAY['Customer invoices','Billing records','Payment details','Credit status'], NULL, 2, ARRAY['customer','financial','pci']),
('customer-usage-data',         'Customer Usage Data',         'highly_confidential', 'Customer-Sensitive Data', ARRAY['Product usage logs','Telemetry linked to customers','Behavioral analytics'], NULL, 2, ARRAY['customer','privacy']),
('customer-auth-data',          'Customer Authentication Data','highly_confidential', 'Customer-Sensitive Data', ARRAY['Login identifiers','Password reset records','MFA status','Session data'], 'Elevate credential material to Secret', 2, ARRAY['customer','security','auth']),
('customer-environment-data',   'Customer Environment Data',   'highly_confidential', 'Customer-Sensitive Data', ARRAY['Network diagrams','Tenant details','Configuration exports'], NULL, 2, ARRAY['customer','security']),
('customer-security-info',      'Customer Security Information','highly_confidential', 'Customer-Sensitive Data', ARRAY['Customer vulnerabilities','Incident reports','Security exceptions','Audit evidence'], NULL, 2, ARRAY['customer','security']),
-- 9.3.6 Legal & Compliance
('litigation-data',             'Litigation Data',             'highly_confidential', 'Legal and Compliance Sensitive Data', ARRAY['Case files','Claims','Legal evidence','Legal strategies'], NULL, 2, ARRAY['legal','litigation']),
('legal-privileged-comms',      'Legal Privileged Communication','highly_confidential', 'Legal and Compliance Sensitive Data', ARRAY['Attorney-client communications','Legal opinions'], NULL, 2, ARRAY['legal','privilege']),
('investigation-records',       'Investigation Records',       'highly_confidential', 'Legal and Compliance Sensitive Data', ARRAY['Internal investigations','Misconduct investigations','Fraud investigations'], NULL, 2, ARRAY['legal','hr','compliance']),
('regulatory-submissions',      'Regulatory Submissions',      'highly_confidential', 'Legal and Compliance Sensitive Data', ARRAY['Non-public regulator responses','Examination reports'], NULL, 2, ARRAY['legal','regulatory','compliance']),
('whistleblower-reports',       'Whistleblower Reports',       'highly_confidential', 'Legal and Compliance Sensitive Data', ARRAY['Protected disclosures','Ethics complaints'], NULL, 2, ARRAY['legal','hr','compliance']),
('data-breach-records',         'Data Breach Records',         'highly_confidential', 'Legal and Compliance Sensitive Data', ARRAY['Breach assessments','Notification analysis','Impacted individual lists'], NULL, 2, ARRAY['legal','security','privacy']),
-- 9.3.7 Security-Sensitive
('security-architecture',       'Security Architecture',       'highly_confidential', 'Security-Sensitive Data', ARRAY['Network segmentation diagrams','Security zones','Trust boundaries','Control paths'], 'Elevate to Secret if includes admin paths or bypass instructions', 2, ARRAY['security','architecture']),
('vulnerability-reports',       'Vulnerability Reports',       'highly_confidential', 'Security-Sensitive Data', ARRAY['Scanner results','CVE mapping','Exploitability details'], 'Elevate to Secret if contains active exploit code', 2, ARRAY['security','vulnerability']),
('penetration-test-reports',    'Penetration Test Reports',    'highly_confidential', 'Security-Sensitive Data', ARRAY['Pen test findings','Exploit paths','Screenshots','Proof-of-concepts'], 'Elevate to Secret if crown-jewel findings', 2, ARRAY['security','pentest']),
('incident-response-data',      'Incident Response Data',      'highly_confidential', 'Security-Sensitive Data', ARRAY['Incident reports','Timelines','Attacker indicators','Forensic evidence'], 'Elevate to Secret if active breach under investigation', 2, ARRAY['security','incident']),
('siem-security-logs',          'SIEM and Security Logs',      'highly_confidential', 'Security-Sensitive Data', ARRAY['Logs with user activity','System events','IPs','Suspicious behavior'], NULL, 2, ARRAY['security','logs']),
('threat-intelligence',         'Threat Intelligence',         'highly_confidential', 'Security-Sensitive Data', ARRAY['Internal threat reports','Adversary observations','IOCs before public release'], NULL, 2, ARRAY['security','threat']),
('risk-assessments-security',   'Security Risk Assessments',   'highly_confidential', 'Security-Sensitive Data', ARRAY['Security risk ratings','Control gaps','Remediation plans'], NULL, 2, ARRAY['security','risk']),
('access-review-reports',       'Access Review Reports',       'highly_confidential', 'Security-Sensitive Data', ARRAY['Privileged access reports','Admin access lists'], 'Elevate to Secret if includes credentials or bypass paths', 2, ARRAY['security','iam']),
('dr-runbooks',                 'Disaster Recovery Runbooks',  'highly_confidential', 'Security-Sensitive Data', ARRAY['DR plans with system dependencies','Recovery procedures','Escalation contacts'], NULL, 2, ARRAY['security','operations']),
-- 9.3.8 Source Code & Engineering
('proprietary-source-code',     'Proprietary Source Code',     'highly_confidential', 'Source Code and Engineering Data', ARRAY['Application code','Backend services','Frontend code','Scripts'], 'Elevate to Secret if contains hardcoded credentials or exploit logic', 2, ARRAY['engineering','ip','source-code']),
('infrastructure-as-code',      'Infrastructure as Code',      'highly_confidential', 'Source Code and Engineering Data', ARRAY['Terraform files','CloudFormation templates','Kubernetes manifests','Bicep/ARM'], 'Elevate to Secret if includes secrets or credentials', 2, ARRAY['engineering','cloud','iac']),
('automation-scripts',          'Automation Scripts',          'highly_confidential', 'Source Code and Engineering Data', ARRAY['PowerShell','Bash','Python deployment scripts'], 'Elevate to Secret if includes credentials', 2, ARRAY['engineering','scripts']),
('cicd-pipeline-config',        'CI/CD Pipeline Configuration','highly_confidential', 'Source Code and Engineering Data', ARRAY['Pipeline definitions','Build workflows','Deployment config'], 'Elevate to Secret if includes pipeline secrets or tokens', 2, ARRAY['engineering','devops']),
('api-specifications',          'API Specifications',          'highly_confidential', 'Source Code and Engineering Data', ARRAY['Internal API schemas','Integration contracts','Swagger/OpenAPI specs'], NULL, 2, ARRAY['engineering','api']),
('product-algorithms',          'Product Algorithms',          'highly_confidential', 'Source Code and Engineering Data', ARRAY['Business logic','Scoring models','Recommendation algorithms'], 'Elevate to Secret if crown-jewel competitive advantage', 2, ARRAY['engineering','ip']),
('database-schema',             'Database Schema',             'highly_confidential', 'Source Code and Engineering Data', ARRAY['Sensitive table structures','Relationship maps','Stored procedures'], NULL, 2, ARRAY['engineering','data']),
('technical-design-documents',  'Technical Design Documents',  'highly_confidential', 'Source Code and Engineering Data', ARRAY['Architecture designs','Engineering implementation docs'], NULL, 2, ARRAY['engineering','architecture']),
-- 9.3.9 IP & Research
('research-data',               'Research and R&D Data',       'highly_confidential', 'Intellectual Property and Research Data', ARRAY['R&D results','Lab data','Experiments','Prototypes'], 'Elevate to Secret if breakthrough or crown-jewel', 2, ARRAY['ip','research']),
('product-formulas',            'Product Formulas',            'highly_confidential', 'Intellectual Property and Research Data', ARRAY['Chemical formulas','Manufacturing recipes','Production formulas'], 'Elevate to Secret if high-value trade secret', 2, ARRAY['ip','manufacturing']),
('patent-drafts',               'Patent Drafts',               'highly_confidential', 'Intellectual Property and Research Data', ARRAY['Patent applications','Invention disclosures before filing'], NULL, 2, ARRAY['ip','legal']),
('ai-ml-models',                'AI/ML Models',                'highly_confidential', 'Intellectual Property and Research Data', ARRAY['Model weights','Training data summaries','Proprietary prompts','Evaluation datasets'], 'Elevate to Secret if critical competitive model', 2, ARRAY['ip','ai','engineering']),
('trade-secrets',               'Trade Secrets',               'highly_confidential', 'Intellectual Property and Research Data', ARRAY['Non-public business methods','Technical formulas','Strategy models'], NULL, 2, ARRAY['ip','business']),
-- 9.3.10 Operationally Sensitive
('production-configuration',    'Production Configuration',    'highly_confidential', 'Operationally Sensitive Data', ARRAY['System exports','Firewall configs','Proxy configs','Tenant configs'], 'Elevate to Secret if includes credentials', 2, ARRAY['operations','security','engineering']),
('critical-system-inventory',   'Critical System Inventory',   'highly_confidential', 'Operationally Sensitive Data', ARRAY['Crown-jewel asset lists','Critical app inventory'], NULL, 2, ARRAY['operations','security']),
('privileged-access-reports',   'Privileged Access Reports',   'highly_confidential', 'Operationally Sensitive Data', ARRAY['Admin user lists','Privileged role assignments'], 'Elevate to Secret if contains credentials or bypass paths', 2, ARRAY['security','iam']),
('vendor-risk-assessments',     'Vendor Risk Assessments',     'highly_confidential', 'Operationally Sensitive Data', ARRAY['High-risk vendor findings','Control gaps','Third-party assessments'], NULL, 2, ARRAY['vendor','risk','security']),
('crisis-management-plans',     'Crisis Management Plans',     'highly_confidential', 'Operationally Sensitive Data', ARRAY['Emergency response procedures','Escalation contacts','Crisis runbooks'], NULL, 2, ARRAY['operations','executive'])
ON CONFLICT (slug) DO NOTHING;

-- ══ SECRET ════════════════════════════════════════════════════════════════════

INSERT INTO catalog_data_types (slug, name, system_level, subcategory, examples, notes, priority, tags) VALUES
-- 10.3.1 Credentials & Auth
('passwords',                   'Passwords and Passphrases',   'secret', 'Credentials and Authentication Data', ARRAY['User passwords','Admin passwords','Database passwords','Hardcoded passwords'], NULL, 1, ARRAY['credentials','security-critical']),
('password-vault-exports',      'Password Vault Exports',      'secret', 'Credentials and Authentication Data', ARRAY['Vault backups','CSV credential exports','Credential database exports'], NULL, 1, ARRAY['credentials','security-critical']),
('privileged-credentials',      'Privileged Credentials',      'secret', 'Credentials and Authentication Data', ARRAY['Domain admin credentials','Root credentials','Super admin','Break-glass accounts','Global admin'], NULL, 1, ARRAY['credentials','iam','security-critical']),
('service-account-credentials', 'Service Account Credentials', 'secret', 'Credentials and Authentication Data', ARRAY['Service account passwords','Robot accounts','Application credentials'], NULL, 1, ARRAY['credentials','devops','security-critical']),
('database-credentials',        'Database Credentials',        'secret', 'Credentials and Authentication Data', ARRAY['Database usernames/passwords','Connection strings with passwords'], NULL, 1, ARRAY['credentials','data','security-critical']),
('mfa-recovery-data',           'MFA Recovery Data',           'secret', 'Credentials and Authentication Data', ARRAY['Backup codes','Recovery seeds','Emergency MFA bypass details'], NULL, 1, ARRAY['credentials','auth','security-critical']),
('session-credentials',         'Session Credentials',         'secret', 'Credentials and Authentication Data', ARRAY['Session cookies','Session tokens','Bearer tokens'], NULL, 1, ARRAY['credentials','auth']),
-- 10.3.2 API Keys & Tokens
('api-keys',                    'API Keys',                    'secret', 'API Keys, Tokens, and Secrets', ARRAY['Cloud API keys','SaaS API keys','Payment gateway keys','Service API keys'], NULL, 1, ARRAY['api','credentials','security-critical']),
('access-tokens',               'Access Tokens',               'secret', 'API Keys, Tokens, and Secrets', ARRAY['OAuth access tokens','Bearer tokens','Personal access tokens'], NULL, 1, ARRAY['oauth','credentials','auth']),
('refresh-tokens',              'Refresh Tokens',              'secret', 'API Keys, Tokens, and Secrets', ARRAY['OAuth refresh tokens','Long-lived session refresh tokens'], NULL, 1, ARRAY['oauth','credentials','auth']),
('oauth-client-secrets',        'OAuth Client Secrets',        'secret', 'API Keys, Tokens, and Secrets', ARRAY['Client secret values','OAuth app secrets'], NULL, 1, ARRAY['oauth','credentials']),
('webhook-secrets',             'Webhook Secrets',             'secret', 'API Keys, Tokens, and Secrets', ARRAY['Webhook signing secrets','Endpoint secret keys'], NULL, 1, ARRAY['api','security']),
('cicd-pipeline-secrets',       'CI/CD Pipeline Secrets',      'secret', 'API Keys, Tokens, and Secrets', ARRAY['Pipeline variables','Deployment tokens','Runner tokens'], NULL, 1, ARRAY['devops','credentials','cicd']),
('saas-integration-tokens',     'SaaS Integration Tokens',     'secret', 'API Keys, Tokens, and Secrets', ARRAY['Slack tokens','GitHub tokens','Jira tokens','Salesforce tokens','Microsoft Graph tokens'], NULL, 1, ARRAY['saas','credentials','integration']),
('cloud-access-keys',           'Cloud Access Keys',           'secret', 'API Keys, Tokens, and Secrets', ARRAY['AWS access keys','Azure tokens','GCP service account keys'], NULL, 1, ARRAY['cloud','credentials','security-critical']),
-- 10.3.3 Cryptographic Material
('private-keys',                'Private Keys',                'secret', 'Cryptographic and Key Material', ARRAY['RSA private keys','EC private keys','SSH private keys','TLS private keys'], NULL, 1, ARRAY['cryptography','security-critical','keys']),
('encryption-keys',             'Encryption Keys',             'secret', 'Cryptographic and Key Material', ARRAY['Symmetric keys','Data encryption keys','Master keys'], NULL, 1, ARRAY['cryptography','security-critical','keys']),
('key-vault-exports',           'Key Vault Exports',           'secret', 'Cryptographic and Key Material', ARRAY['Exported secrets','Key bundles','Vault backups'], NULL, 1, ARRAY['cryptography','security-critical','keys']),
('signing-keys',                'Signing Keys',                'secret', 'Cryptographic and Key Material', ARRAY['Code-signing keys','Document-signing keys','JWT signing keys'], NULL, 1, ARRAY['cryptography','security-critical']),
('ssh-keys',                    'SSH Keys',                    'secret', 'Cryptographic and Key Material', ARRAY['SSH private keys','Deploy keys','Machine keys'], NULL, 1, ARRAY['cryptography','ssh','security-critical']),
('pgp-keys',                    'PGP / GPG Keys',              'secret', 'Cryptographic and Key Material', ARRAY['PGP private keys','GPG private keys'], NULL, 1, ARRAY['cryptography','email']),
-- 10.3.4 High-Risk Files
('private-key-files',           'Private Key Files',           'secret', 'High-Risk Certificate and Secret Files', ARRAY['.key files','.pem files','.rsa files','.ppk files','.id_rsa files'], NULL, 1, ARRAY['files','cryptography','security-critical']),
('keystore-files',              'Keystore Files',              'secret', 'High-Risk Certificate and Secret Files', ARRAY['.jks files','.p12 files','.pfx files','.keystore files'], NULL, 1, ARRAY['files','cryptography','certificates']),
('environment-files',           'Environment Files with Secrets','secret', 'High-Risk Certificate and Secret Files', ARRAY['.env files','.env.local','.env.production','.envrc'], NULL, 1, ARRAY['files','credentials','devops','security-critical']),
('cloud-credential-files',      'Cloud Credential Files',      'secret', 'High-Risk Certificate and Secret Files', ARRAY['AWS credentials file','GCP service account JSON','Azure publish settings'], NULL, 1, ARRAY['files','cloud','credentials','security-critical']),
('kubernetes-secrets',          'Kubernetes Secrets',          'secret', 'High-Risk Certificate and Secret Files', ARRAY['Secret YAML files','Kubeconfig with tokens','Service account tokens'], NULL, 1, ARRAY['kubernetes','credentials','devops']),
-- 10.3.5 Privileged Access
('break-glass-accounts',        'Break-Glass Accounts',        'secret', 'Privileged Access and Administrative Data', ARRAY['Emergency access credentials','Recovery admin accounts'], NULL, 1, ARRAY['iam','credentials','security-critical']),
('domain-admin-data',           'Domain Admin Data',           'secret', 'Privileged Access and Administrative Data', ARRAY['Domain admin credentials','Privileged access paths'], NULL, 1, ARRAY['iam','credentials','security-critical']),
('root-access-details',         'Root Access Details',         'secret', 'Privileged Access and Administrative Data', ARRAY['Root account credentials','Root SSH keys'], NULL, 1, ARRAY['iam','credentials','security-critical']),
('auth-bypass-details',         'Authentication Bypass Details','secret', 'Privileged Access and Administrative Data', ARRAY['Methods to bypass MFA','SSO bypass details','PAM bypass instructions'], NULL, 1, ARRAY['security','iam','vulnerability']),
-- 10.3.6 Critical Security Data
('zero-day-exploits',           'Zero-Day Exploit Details',    'secret', 'Critical Security Data', ARRAY['Exploit code','Unpublished vulnerability exploitation steps'], NULL, 1, ARRAY['security','exploit','security-critical']),
('weaponized-exploits',         'Weaponized Proof-of-Concept', 'secret', 'Critical Security Data', ARRAY['Exploit scripts','Attack chains','Payloads'], NULL, 1, ARRAY['security','exploit','security-critical']),
('security-bypass-methods',     'Security Bypass Methods',     'secret', 'Critical Security Data', ARRAY['DLP bypass methods','EDR bypass','IAM bypass','Network segmentation bypass'], NULL, 1, ARRAY['security','vulnerability','security-critical']),
('red-team-findings',           'Red-Team Crown-Jewel Findings','secret', 'Critical Security Data', ARRAY['Unpublished domain compromise paths','Critical system compromise findings'], NULL, 1, ARRAY['security','pentest','security-critical']),
-- 10.3.7 Executive / M&A / Market-Sensitive
('ma-documents',                'M&A Documents',               'secret', 'Executive, Board, M&A, and Market-Sensitive Data', ARRAY['Acquisition plans','Target analysis','Negotiation details','Due diligence material'], NULL, 1, ARRAY['executive','ma','legal','security-critical']),
('board-papers',                'Board Papers',                'secret', 'Executive, Board, M&A, and Market-Sensitive Data', ARRAY['Board packs','Board decisions','Strategic executive presentations'], NULL, 1, ARRAY['executive','board']),
('unreleased-financial-results','Unreleased Financial Results','secret', 'Executive, Board, M&A, and Market-Sensitive Data', ARRAY['Earnings results before public release','Material financial disclosures'], NULL, 1, ARRAY['executive','finance','market-sensitive']),
('strategic-restructuring',     'Strategic Restructuring Plans','secret', 'Executive, Board, M&A, and Market-Sensitive Data', ARRAY['Layoff planning','Business closure plans','Major reorganization plans'], NULL, 1, ARRAY['executive','hr']),
-- 10.3.8 Crown-Jewel IP
('crown-jewel-algorithms',      'Core Proprietary Algorithms', 'secret', 'Crown-Jewel Intellectual Property', ARRAY['Unique algorithms central to competitive advantage'], NULL, 1, ARRAY['ip','engineering','security-critical']),
('critical-ml-models',          'Critical ML Model Weights',   'secret', 'Crown-Jewel Intellectual Property', ARRAY['High-value AI/ML model weights','Proprietary foundation model assets'], NULL, 1, ARRAY['ip','ai','engineering']),
('crown-jewel-trade-secrets',   'Crown-Jewel Trade Secrets',   'secret', 'Crown-Jewel Intellectual Property', ARRAY['High-value formulas','Manufacturing secrets','Scientific breakthroughs'], NULL, 1, ARRAY['ip','manufacturing','security-critical']),
('unfiled-critical-patents',    'Unfiled Critical Patents',    'secret', 'Crown-Jewel Intellectual Property', ARRAY['Major invention disclosures before legal protection'], NULL, 1, ARRAY['ip','legal'])
ON CONFLICT (slug) DO NOTHING;
