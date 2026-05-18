-- Migration 016: Frameworks expansion
-- Adds 15 high-value security/privacy/AI frameworks, cleans up existing entries.
--
-- New: ISO 27001, ISO 27701, NIST CSF 2.0, NIST 800-53, CIS Controls v8.1,
--      EU AI Act, NIST AI RMF, ISO 42001, FTC Safeguards Rule, NYDFS 500,
--      SWIFT CSCF, NERC CIP, CJIS, ITAR/EAR, CERT-In Directions
-- Cleanup: DPDP rename, COPPA industry expansion, delete COPPA Retail duplicate,
--          MPA/SOC2/PCI-DSS type corrections

-- ── Cleanup existing entries ─────────────────────────────────────────────────

-- Rename DPDP to include 2025 Rules
UPDATE compliance_regulations
SET
  name      = 'Digital Personal Data Protection Act 2023 + Rules 2025',
  short_name = 'DPDP 2023+Rules',
  summary   = 'India''s primary data protection law, with Rules notified in April 2025 clarifying consent frameworks, data fiduciary obligations, and penalties up to ₹250 crore for failure to maintain reasonable security safeguards.',
  max_fine  = '₹250 Crore (~€27M) per violation (Rules 2025)'
WHERE code = 'dpdp';

-- Expand COPPA to cover all applicable industries (merge COPPA Retail into it)
UPDATE compliance_regulations
SET
  industries = ARRAY['education','retail','media'],
  summary    = 'COPPA imposes requirements on operators of websites and online services directed at children under 13, or who knowingly collect personal information from children. Applies across education, retail, media, and any platform with child-directed content. Requires verifiable parental consent and strict data minimisation.'
WHERE code = 'coppa';

-- Delete the redundant COPPA Retail duplicate
DELETE FROM compliance_requirements
WHERE regulation_id = (SELECT id FROM compliance_regulations WHERE code = 'coppa_retail');
DELETE FROM compliance_regulations WHERE code = 'coppa_retail';

-- Fix SOC 2 type: it's an audit framework, not a security regulation
UPDATE compliance_regulations SET type = 'standard' WHERE code = 'soc2';

-- Fix PCI-DSS type: it's an industry payment standard
UPDATE compliance_regulations SET type = 'standard' WHERE code = 'pci_dss';

-- Fix MPA Content Security type and short_name
UPDATE compliance_regulations
SET type = 'standard', short_name = 'MPA Content Security'
WHERE code = 'content_sec_reqs';

-- ── New frameworks ────────────────────────────────────────────────────────────

INSERT INTO compliance_regulations
  (code, short_name, name, regions, industries, jurisdiction, authority, type, summary, max_fine, effective_date, source_url)
VALUES

-- ── ISO Standards ─────────────────────────────────────────────────────────────

('iso_27001',
 'ISO/IEC 27001',
 'ISO/IEC 27001:2022 — Information Security Management System',
 ARRAY['Global'],
 NULL,
 'Global',
 'International Organization for Standardization (ISO)',
 'standard',
 'The globally adopted standard for information security management systems (ISMS). Annex A includes controls for data classification (A.5.12), data leakage prevention (A.8.12), encryption (A.8.24), access control, and logging. Certification is widely required in enterprise procurement and regulated sectors.',
 NULL,
 '2022-10-25',
 'https://www.iso.org/standard/27001'),

('iso_27701',
 'ISO/IEC 27701',
 'ISO/IEC 27701:2019 — Privacy Information Management System',
 ARRAY['Global'],
 NULL,
 'Global',
 'International Organization for Standardization (ISO)',
 'standard',
 'Privacy extension to ISO 27001/27002. Establishes requirements for a Privacy Information Management System (PIMS) that maps directly to GDPR, CCPA, and other privacy regulations. Covers PII identification, lawful processing, data minimisation, retention, and cross-border transfer controls.',
 NULL,
 '2019-08-06',
 'https://www.iso.org/standard/71670.html'),

('iso_42001',
 'ISO/IEC 42001',
 'ISO/IEC 42001:2023 — Artificial Intelligence Management System',
 ARRAY['Global'],
 ARRAY['technology'],
 'Global',
 'International Organization for Standardization (ISO)',
 'ai_governance',
 'First certifiable AI management system standard. Requires organisations to establish governance, risk management, and controls for AI systems — including data quality, fairness, transparency, and security. Directly addresses GenAI data leakage risks and AI system data governance.',
 NULL,
 '2023-12-18',
 'https://www.iso.org/standard/81230.html'),

-- ── NIST Frameworks ───────────────────────────────────────────────────────────

('nist_csf',
 'NIST CSF 2.0',
 'NIST Cybersecurity Framework 2.0',
 ARRAY['Global'],
 NULL,
 'United States / Global',
 'National Institute of Standards and Technology (NIST)',
 'framework',
 'The most widely adopted cybersecurity framework globally. The Protect function (PR.DS) directly addresses data security: data-at-rest protection (PR.DS-01), data-in-transit protection (PR.DS-02), and data-in-use protection (PR.DS-10). Used as the reference framework for DLP maturity assessment across industries.',
 NULL,
 '2024-02-26',
 'https://www.nist.gov/cyberframework'),

('nist_800_53',
 'NIST SP 800-53',
 'NIST SP 800-53 Rev. 5 — Security and Privacy Controls',
 ARRAY['Global'],
 ARRAY['government'],
 'United States / Global',
 'National Institute of Standards and Technology (NIST)',
 'framework',
 'Comprehensive catalogue of security and privacy controls for federal information systems, widely adopted in enterprise and cloud environments. Key DLP-relevant control families: AC (Access Control), AU (Audit), SC (System Communications), SI (System Integrity), and MP (Media Protection). Baseline for FedRAMP, FISMA, and CMMC.',
 NULL,
 '2020-09-23',
 'https://csrc.nist.gov/publications/detail/sp/800/53/rev-5/final'),

-- ── CIS Controls ──────────────────────────────────────────────────────────────

('cis_v8',
 'CIS Controls v8.1',
 'CIS Critical Security Controls Version 8.1',
 ARRAY['Global'],
 NULL,
 'Global',
 'Center for Internet Security (CIS)',
 'framework',
 'Prioritised set of 18 security controls and 153 safeguards. Control 3 (Data Protection) maps directly to DLP: data inventory (3.1), data classification (3.2), data retention (3.3), encryption at rest (3.6), and DLP solutions (3.7). Widely used as a practical implementation guide for ISO 27001 and NIST CSF.',
 NULL,
 '2024-06-01',
 'https://www.cisecurity.org/controls'),

-- ── AI Governance ──────────────────────────────────────────────────────────────

('eu_ai_act',
 'EU AI Act',
 'EU Artificial Intelligence Act',
 ARRAY['EU', 'EEA'],
 ARRAY['technology'],
 'European Union',
 'European AI Office / National Market Surveillance Authorities',
 'ai_governance',
 'World''s first comprehensive AI regulation. Requires providers of high-risk AI systems to implement data governance (Art. 10), maintain logs (Art. 12), and ensure transparency. Prohibited practices include AI systems that process sensitive data without safeguards. DLP controls are required to prevent training data leakage and unauthorised data access in AI pipelines.',
 '€30M or 6% of global annual turnover (prohibited practices); €15M or 3% (high-risk)',
 '2024-08-01',
 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'),

('nist_ai_rmf',
 'NIST AI RMF',
 'NIST Artificial Intelligence Risk Management Framework 1.0',
 ARRAY['Global'],
 ARRAY['technology'],
 'United States / Global',
 'National Institute of Standards and Technology (NIST)',
 'ai_governance',
 'Voluntary framework for managing risks across the AI lifecycle. The GOVERN, MAP, MEASURE, and MANAGE functions address data provenance, model training data security, and monitoring of AI outputs. Directly applicable to GenAI deployments — DLP controls for preventing sensitive data entry into LLMs map to the Measure and Manage functions.',
 NULL,
 '2023-01-26',
 'https://www.nist.gov/system/files/documents/2023/01/26/AI RMF 1.0.pdf'),

-- ── US Financial Sector ────────────────────────────────────────────────────────

('ftc_safeguards',
 'FTC Safeguards Rule',
 'FTC Safeguards Rule — Standards for Safeguarding Customer Information',
 ARRAY['US'],
 ARRAY['financial'],
 'United States',
 'Federal Trade Commission (FTC)',
 'sector',
 'Updated 2023 rule under GLBA requiring non-bank financial institutions (mortgage brokers, auto dealers, fintechs, payday lenders) to implement a written information security program with encryption, access controls, MFA, audit logging, and incident response. Complements GLBA which covers banks.',
 'FTC enforcement action; civil penalties under FTC Act',
 '2023-06-09',
 'https://www.ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know'),

('nydfs_500',
 'NYDFS 500',
 'NYDFS 23 NYCRR 500 — Cybersecurity Regulation',
 ARRAY['US'],
 ARRAY['financial'],
 'New York, United States',
 'New York Department of Financial Services (NYDFS)',
 'security',
 'Cybersecurity regulation for NYDFS-licensed financial institutions requiring a documented cybersecurity programme, asset inventory, data classification, encryption, access controls, audit trails, MFA, and breach notification within 72 hours. 2023 amendments added enhanced requirements for large covered entities.',
 'Up to $1,000 per violation per day',
 '2017-03-01',
 'https://www.dfs.ny.gov/industry_guidance/cybersecurity'),

-- ── Banking / Payments ────────────────────────────────────────────────────────

('swift_cscf',
 'SWIFT CSCF',
 'SWIFT Customer Security Controls Framework',
 ARRAY['Global'],
 ARRAY['financial'],
 'Global',
 'SWIFT (Society for Worldwide Interbank Financial Telecommunication)',
 'sector',
 'Mandatory security controls framework for all SWIFT network participants. Mandatory controls include: securing the SWIFT environment, controlling privileged accounts, detecting anomalous activity, and protecting confidential data. Annual attestation required. DLP controls map directly to data access protection and activity monitoring requirements.',
 'Suspension from SWIFT network; reputational and regulatory consequences',
 '2021-01-01',
 'https://www.swift.com/myswift/customer-security-programme-csp/security-controls'),

-- ── Energy / Critical Infrastructure ──────────────────────────────────────────

('nerc_cip',
 'NERC CIP',
 'NERC Critical Infrastructure Protection Standards',
 ARRAY['US', 'Canada'],
 ARRAY['energy', 'critical_infrastructure'],
 'North America',
 'North American Electric Reliability Corporation (NERC)',
 'sector',
 'Mandatory cybersecurity standards for bulk electric system operators in North America. CIP-011 (Information Protection) requires classification and protection of BES Cyber System Information. CIP-007 requires system security management including access controls and security monitoring. Non-compliance incurs per-violation-per-day penalties.',
 'Up to USD 1,482,707 per violation per day',
 '2016-04-01',
 'https://www.nerc.com/pa/Stand/Pages/CIPStandards.aspx'),

-- ── Government / Law Enforcement ─────────────────────────────────────────────

('cjis',
 'CJIS Security Policy',
 'FBI CJIS Security Policy',
 ARRAY['US'],
 ARRAY['government'],
 'United States',
 'FBI Criminal Justice Information Services (CJIS) Division',
 'sector',
 'Binding security policy for any agency or vendor accessing FBI Criminal Justice Information (CJI). Requires data encryption in transit and at rest, strict access controls with MFA, audit logging, media protection, and incident response. Applies to all state, local, and tribal agencies and their cloud/SaaS vendors.',
 'Termination of CJIS access; criminal liability under 28 CFR Part 20',
 '2023-10-01',
 'https://le.fbi.gov/file-repository/cjis-security-policy-version-5-9-1.pdf'),

-- ── Export Control ────────────────────────────────────────────────────────────

('itar_ear',
 'ITAR / EAR',
 'International Traffic in Arms Regulations / Export Administration Regulations',
 ARRAY['US', 'Global'],
 ARRAY['defence', 'government'],
 'United States',
 'U.S. State Department (ITAR) / U.S. Commerce Department BIS (EAR)',
 'sector',
 'US export control regulations governing defence articles (ITAR) and dual-use items (EAR). Organisations must prevent unauthorised access by foreign nationals to controlled technical data — making data classification, access controls, and DLP enforcement essential. Cloud storage, SaaS, and email are common leakage vectors for ITAR-controlled data.',
 'Up to USD 1.35M per violation (ITAR civil); up to USD 350K per violation (EAR)',
 NULL,
 'https://www.pmddtc.state.gov/ddtc_public/ddtc_public?id=ddtc_public_portal_itar_landing'),

-- ── India ─────────────────────────────────────────────────────────────────────

('cert_in',
 'CERT-In Directions',
 'CERT-In Cybersecurity Directions 2022 (India)',
 ARRAY['India'],
 NULL,
 'India',
 'Indian Computer Emergency Response Team (CERT-In)',
 'security',
 'Mandatory directions issued under the IT Act 2000 requiring organisations in India to report cybersecurity incidents to CERT-In within 6 hours, maintain logs for 180 days, and implement technical and procedural safeguards. Applies to all service providers, intermediaries, data centres, and body corporates in India.',
 'Imprisonment up to 1 year and/or fine under IT Act Section 70B',
 '2022-04-28',
 'https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf')

ON CONFLICT (code) DO NOTHING;

-- ── Requirements for new frameworks ──────────────────────────────────────────

INSERT INTO compliance_requirements
  (regulation_id, article, title, description, dlp_relevance, fine, severity, dlp_controls)
SELECT r.id, req.article, req.title, req.description, req.dlp_relevance, req.fine, req.severity, req.dlp_controls
FROM compliance_regulations r
JOIN (VALUES

  -- ISO/IEC 27001
  ('iso_27001','A.5.12','Information Classification','Organisations must classify information according to legal requirements, value, criticality, and sensitivity to unauthorised disclosure.','Data classification is the foundation of ISO 27001 — without it, DLP controls cannot determine what data to protect or how to apply policies.',NULL,'critical',ARRAY['data_classification']),
  ('iso_27001','A.8.12','Data Leakage Prevention','Measures must be applied to systems, networks, and devices that process, store, or transmit sensitive information to detect and prevent the unauthorised disclosure of information.','This control explicitly requires DLP solutions. All eight DLP channels map to this requirement — web, email, endpoint, SaaS, GenAI, developer tools, data transfer, and network egress.',NULL,'critical',ARRAY['dlp_web','dlp_email','dlp_endpoint','dlp_saas','genai_controls','audit_logging']),
  ('iso_27001','A.8.24','Use of Cryptography','Rules for the effective use of cryptography must be defined and implemented, including key management.','DLP encryption-in-transit controls enforce this requirement by ensuring sensitive data is encrypted before traversing external networks and cloud channels.',NULL,'high',ARRAY['encryption_transit']),
  ('iso_27001','A.8.15','Logging','Event logs that record user activities, exceptions, faults, and information security events must be produced, stored, protected, and analysed.','DLP audit logging captures data movement events — who accessed what data, when, and via which channel — feeding directly into this control requirement.',NULL,'high',ARRAY['audit_logging','breach_detection']),
  ('iso_27001','A.5.15','Access Control','Rules to control physical and logical access to information and other associated assets must be established and implemented.','DLP access controls enforce least-privilege access to sensitive data repositories and restrict which users or systems can transfer data to external destinations.',NULL,'critical',ARRAY['access_controls']),

  -- ISO/IEC 27701
  ('iso_27701','Cl. 6.15.1','Identify and Document Purpose','The organisation must identify, document, and communicate the purposes for which PII is processed.','Data classification labels PII by sensitivity and purpose, enabling DLP policies to restrict processing to documented lawful purposes.',NULL,'high',ARRAY['data_classification']),
  ('iso_27701','Cl. 7.4.5','PII De-identification and Deletion','The organisation must evaluate the need for PII de-identification or deletion at all stages of processing.','DLP endpoint controls can enforce data retention and prevent unnecessary copies of PII on endpoint devices or removable media.',NULL,'high',ARRAY['dlp_endpoint','access_controls']),
  ('iso_27701','Cl. 8.4.2','Countries and International Organisations to Which PII Can Be Transferred','The PIMS must identify and document the countries and international organisations to which PII may be transferred.','DLP web and SaaS controls enforce geographic restrictions on data transfers — blocking uploads to services in unauthorised jurisdictions.',NULL,'critical',ARRAY['dlp_web','dlp_saas','encryption_transit']),
  ('iso_27701','Cl. 6.6.1','Breach and Incident Management','The organisation must have procedures for managing PII-related security breaches and incidents.','Breach detection identifies anomalous data movement patterns that indicate a PII breach in progress, enabling rapid incident response.',NULL,'critical',ARRAY['breach_detection','audit_logging']),

  -- ISO/IEC 42001
  ('iso_42001','Cl. 8.4','AI System Data Governance','The organisation must establish data governance processes for AI systems, including data quality, data provenance, and controls to prevent data leakage during model training and inference.','DLP GenAI controls prevent sensitive organisational data from being submitted to AI models — protecting against accidental inclusion of PII, IP, or confidential data in training or inference requests.',NULL,'critical',ARRAY['genai_controls','data_classification']),
  ('iso_42001','Cl. 6.1.2','AI Risk Assessment','The organisation must identify and assess risks associated with AI systems, including risks of unintended disclosure of sensitive data.','Data classification informs the AI risk assessment by identifying which data types carry the highest risk if leaked via AI channels.',NULL,'high',ARRAY['data_classification','audit_logging']),
  ('iso_42001','Cl. 9.1','Monitoring and Measurement','The organisation must monitor and measure AI system performance and compliance with policies, including data handling policies.','Audit logging of AI interactions (prompts, outputs, model versions) provides the monitoring trail required by this clause.',NULL,'high',ARRAY['audit_logging','breach_detection']),

  -- NIST CSF 2.0
  ('nist_csf','PR.DS-01','Data-at-Rest Protection','The confidentiality, integrity, and availability of data at rest are protected.','DLP endpoint controls prevent unauthorised copying of sensitive data to removable media or local storage, supporting this safeguard.',NULL,'critical',ARRAY['dlp_endpoint','encryption_transit','data_classification']),
  ('nist_csf','PR.DS-02','Data-in-Transit Protection','The confidentiality, integrity, and availability of data in transit are protected.','DLP web, email, and SaaS controls enforce encryption and block unauthorised transmission of sensitive data across all external channels.',NULL,'critical',ARRAY['dlp_web','dlp_email','dlp_saas','encryption_transit']),
  ('nist_csf','PR.DS-10','Data-in-Use Protection','The confidentiality, integrity, and availability of data in use are protected.','DLP GenAI controls and endpoint controls prevent sensitive data being processed in unauthorised applications or submitted to external AI services.',NULL,'high',ARRAY['genai_controls','dlp_endpoint','access_controls']),
  ('nist_csf','DE.AE-02','Anomalous Activity Detection','Potentially adverse events are analysed to better characterise the activity.','DLP breach detection identifies anomalous data movement patterns — mass exfiltration, unusual destinations, access outside business hours.',NULL,'high',ARRAY['breach_detection','audit_logging']),

  -- NIST SP 800-53
  ('nist_800_53','AC-4','Information Flow Enforcement','The information system enforces approved authorisations for controlling the flow of information within the system and between interconnected systems.','DLP enforces information flow controls across all channels — preventing sensitive data from flowing to unauthorised external systems or users.',NULL,'critical',ARRAY['dlp_web','dlp_email','dlp_saas','dlp_endpoint','access_controls']),
  ('nist_800_53','MP-3','Media Marking','The organisation marks information system media indicating the distribution limitations and handling caveats.','Data classification labels provide the media marking required — enabling DLP policies to enforce the correct handling based on sensitivity label.',NULL,'high',ARRAY['data_classification','dlp_endpoint']),
  ('nist_800_53','AU-2','Audit Events','The organisation determines that the information system is capable of auditing defined events and coordinates the event logging with other organisations.','DLP audit logging captures all data access and movement events, providing the audit record required across the AU control family.',NULL,'critical',ARRAY['audit_logging','breach_detection']),
  ('nist_800_53','SC-28','Protection of Information at Rest','The information system protects the confidentiality and integrity of information at rest.','DLP encryption controls enforce protection of sensitive data stored in cloud services, SaaS platforms, and endpoint devices.',NULL,'high',ARRAY['encryption_transit','dlp_saas','dlp_endpoint']),

  -- CIS Controls v8.1
  ('cis_v8','CIS 3.2','Establish and Maintain a Data Classification Scheme','Establish and maintain an overall data classification scheme for the enterprise. Enterprises may use labels such as Sensitive, Confidential, Public. This scheme should apply uniformly across the enterprise.','Data classification is the prerequisite for all other DLP controls. Without a consistent scheme, DLP policies cannot determine what data requires protection.',NULL,'critical',ARRAY['data_classification']),
  ('cis_v8','CIS 3.6','Encrypt Data on End-User Devices','Encrypt data on end-user devices containing sensitive data. Example implementations include: BitLocker, FileVault, or similar.','DLP endpoint controls enforce encryption on end-user devices and prevent unencrypted sensitive data from being copied to removable media or personal cloud storage.',NULL,'high',ARRAY['encryption_transit','dlp_endpoint']),
  ('cis_v8','CIS 3.7','Establish and Maintain a Data Loss Prevention Solution','Establish and maintain a data loss prevention solution to identify sensitive data and prevent unauthorised access. Example implementations include: Netskope, Microsoft Purview DLP.','This control directly mandates a DLP solution. All DLP channels — web, email, endpoint, SaaS, GenAI — are safeguards under this control.',NULL,'critical',ARRAY['dlp_web','dlp_email','dlp_endpoint','dlp_saas','genai_controls']),
  ('cis_v8','CIS 8.2','Collect Audit Logs','Collect audit logs. Ensure that logging, per the enterprise''s audit log management process, has been enabled across enterprise assets.','DLP audit logging feeds directly into this control — capturing data movement events that must be collected and retained.',NULL,'high',ARRAY['audit_logging']),

  -- EU AI Act
  ('eu_ai_act','Art. 10','Data and Data Governance for High-Risk AI','High-risk AI systems must be developed using training, validation, and testing datasets that meet quality criteria — including data governance practices that cover examination for biases and protection of personal data.','DLP controls for GenAI channels prevent sensitive or personal data from being included in AI training pipelines without proper classification and governance.',NULL,'critical',ARRAY['data_classification','genai_controls','access_controls']),
  ('eu_ai_act','Art. 12','Record-Keeping and Logging','High-risk AI systems must be designed to automatically record logs throughout their lifetime to enable traceability and facilitate post-market monitoring.','DLP audit logging of all AI interactions — what data was submitted, by whom, when — satisfies the logging requirements for regulated AI deployments.',NULL,'high',ARRAY['audit_logging','genai_controls']),
  ('eu_ai_act','Art. 65','Market Surveillance and Control','Member state authorities may require providers to take corrective actions including restricting, prohibiting, or recalling AI systems that present unacceptable risks involving personal data.','DLP breach detection and audit logging provide the monitoring evidence required for market surveillance compliance — demonstrating active controls over sensitive data in AI systems.',NULL,'critical',ARRAY['breach_detection','audit_logging']),

  -- NIST AI RMF
  ('nist_ai_rmf','GOVERN 1.1','AI Risk Classification','The organisation classifies AI risks, including data-related risks such as sensitive data leakage via AI model inputs and outputs.','Data classification informs AI risk classification — identifying which data categories pose the highest risk if submitted to an AI model.',NULL,'high',ARRAY['data_classification','genai_controls']),
  ('nist_ai_rmf','MANAGE 2.2','Data Leakage via AI','The organisation implements controls to prevent sensitive data from being exposed through AI system inputs, outputs, or model weights.','DLP GenAI controls are the primary mechanism for this safeguard — monitoring and blocking sensitive data in prompts and AI application usage.',NULL,'critical',ARRAY['genai_controls','dlp_web','audit_logging']),
  ('nist_ai_rmf','MEASURE 2.5','AI Monitoring and Anomaly Detection','The organisation monitors AI system behaviour for anomalous data access or exfiltration patterns.','Breach detection and audit logging provide the monitoring capability required — flagging unusual data volumes or sensitive data patterns in AI interactions.',NULL,'high',ARRAY['breach_detection','audit_logging']),

  -- FTC Safeguards Rule
  ('ftc_safeguards','§ 314.4(c)','Access Controls','Implement access controls, including technical controls to authorise users and authenticate user access to customer information.','DLP access controls enforce least-privilege access to customer financial data, preventing unauthorised access and transfer of protected information.',NULL,'critical',ARRAY['access_controls','data_classification']),
  ('ftc_safeguards','§ 314.4(e)','Encryption','Encrypt customer information, in transit over external networks and at rest.','DLP encryption controls enforce this requirement across email, web, SaaS, and cloud storage channels handling customer financial data.',NULL,'critical',ARRAY['encryption_transit','dlp_email','dlp_saas']),
  ('ftc_safeguards','§ 314.4(f)','Monitoring and Testing','Monitor and test the effectiveness of your safeguards. Include monitoring activity to prevent, detect, and respond to attacks.','DLP audit logging and breach detection provide the continuous monitoring required, capturing data access events and anomalous exfiltration attempts.',NULL,'high',ARRAY['audit_logging','breach_detection']),

  -- NYDFS 23 NYCRR 500
  ('nydfs_500','§ 500.14','Training and Monitoring','Implement risk-based controls to monitor the activity of authorised users and detect unauthorised access or use of nonpublic information.','DLP monitoring across all channels detects misuse of nonpublic information by internal users — accidental or intentional data exfiltration via email, web, or SaaS.',NULL,'critical',ARRAY['audit_logging','breach_detection','dlp_email','dlp_web']),
  ('nydfs_500','§ 500.7','Access Privileges and Management','Limit user access privileges to information systems that provide access to nonpublic information and periodically review access rights.','DLP access controls enforce least-privilege policies and can detect when users access data outside their normal scope.',NULL,'critical',ARRAY['access_controls','data_classification']),
  ('nydfs_500','§ 500.15','Encryption of Nonpublic Information','Implement controls to protect nonpublic information held or transmitted by the covered entity by encryption in transit and at rest.','DLP encryption-in-transit controls enforce this requirement across all channels carrying nonpublic financial information.',NULL,'high',ARRAY['encryption_transit','dlp_email','dlp_saas']),

  -- SWIFT CSCF
  ('swift_cscf','5.1','Logical Access Controls','Enforce the security principles of need-to-know access, least privilege, and separation of duties for operator accounts on local SWIFT infrastructure and business applications.','DLP access controls enforce least-privilege access to SWIFT-connected systems and prevent unauthorised data extraction from payment messaging environments.',NULL,'critical',ARRAY['access_controls','data_classification']),
  ('swift_cscf','6.1','Operator Session Confidentiality and Integrity','Protect the confidentiality of operator sessions and the integrity of transmitted data.','DLP encryption controls ensure all data transmitted to/from SWIFT infrastructure is encrypted and protected from interception.',NULL,'critical',ARRAY['encryption_transit','audit_logging']),
  ('swift_cscf','6.5A','Intrusion Detection','Detect and respond to anomalous network activity or systems behaviour within the SWIFT environment.','DLP breach detection identifies anomalous data access or exfiltration patterns in SWIFT-connected environments.',NULL,'high',ARRAY['breach_detection','audit_logging']),

  -- NERC CIP
  ('nerc_cip','CIP-011-3 R1','Information Protection Program','Each responsible entity shall implement one or more documented information protection programs that include procedures to identify, classify, and protect BES Cyber System Information.','Data classification and DLP controls are the primary implementation mechanism for CIP-011 — classifying operational technology data and preventing unauthorised disclosure.',NULL,'critical',ARRAY['data_classification','access_controls','dlp_endpoint']),
  ('nerc_cip','CIP-007-6 R4','Security Event Monitoring','Generate, store, and review logs of security events from applicable systems within the Electronic Security Perimeter.','DLP audit logging provides the security event trail required for CIP-007 monitoring — capturing data access and movement events from operational systems.','Up to USD 1,482,707 per violation per day','critical',ARRAY['audit_logging','breach_detection']),
  ('nerc_cip','CIP-004-7 R4','Personnel Risk Assessment — Data Access','Verify that individuals with authorised electronic access to BES Cyber Systems have undergone personnel risk assessments before access is granted.','DLP access controls enforce access restrictions to sensitive operational data and provide evidence of access control implementation for audit.',NULL,'high',ARRAY['access_controls','data_classification']),

  -- CJIS
  ('cjis','Policy 5.4','Auditing and Accountability','All criminal justice agencies and noncriminal justice agencies must audit access to CJI to ensure accountability.','DLP audit logging provides the complete access and movement trail for CJI data — who accessed what, when, and via which application or channel.',NULL,'critical',ARRAY['audit_logging','breach_detection']),
  ('cjis','Policy 5.5','Access Control','Criminal justice agencies must implement access controls to ensure only authorised individuals and processes can access CJI.','DLP access controls enforce least-privilege access to CJI data and prevent transfer to unauthorised applications or cloud services.',NULL,'critical',ARRAY['access_controls','data_classification','dlp_saas']),
  ('cjis','Policy 5.10','Mobile Devices','Agencies must ensure that CJI accessed via mobile devices is protected by encryption and DLP controls.','DLP endpoint controls restrict what data can be copied to mobile devices or removable media, ensuring CJI cannot leave the authorised environment.',NULL,'high',ARRAY['dlp_endpoint','encryption_transit']),

  -- ITAR / EAR
  ('itar_ear','22 CFR § 120.6','ITAR — Classification of Defence Articles','All organisations handling ITAR-controlled technical data must identify and classify controlled items to prevent unauthorised export.','Data classification is the first and most critical ITAR/EAR control — without knowing which data is export-controlled, DLP cannot prevent its leakage to foreign nationals or overseas destinations.',NULL,'critical',ARRAY['data_classification','access_controls']),
  ('itar_ear','22 CFR § 123.1','ITAR — Prohibition on Unlicensed Export','No defence article, including technical data, may be exported without authorisation. Email, cloud uploads, and SaaS sharing are common leakage vectors.','DLP email, web, and SaaS controls are the primary enforcement mechanism — blocking transfer of ITAR-marked documents to personal email, foreign IPs, or unauthorised cloud services.','Up to USD 1.35M per violation','critical',ARRAY['dlp_email','dlp_web','dlp_saas','dlp_endpoint']),
  ('itar_ear','15 CFR § 730','EAR — Export of Dual-Use Items and Technology','Organisations handling EAR-controlled technology must prevent unauthorised export to embargoed countries or restricted parties.','DLP access controls and data classification enforce EAR compliance by restricting access to export-controlled technical data and monitoring outbound transfers.',NULL,'high',ARRAY['data_classification','dlp_web','dlp_email','access_controls']),

  -- CERT-In
  ('cert_in','Direction 1','Mandatory Incident Reporting within 6 Hours','All service providers, intermediaries, data centres, and corporate bodies must report cybersecurity incidents to CERT-In within 6 hours of detection.','DLP breach detection enables rapid identification of incidents — detecting anomalous data exfiltration that must be reported within the 6-hour window.',NULL,'critical',ARRAY['breach_detection','audit_logging']),
  ('cert_in','Direction 3','Maintenance of Logs for 180 Days','Organisations must maintain IT and network logs for a rolling 180-day period and provide them to CERT-In on demand.','DLP audit logging captures all data movement events and must be retained for 180 days to satisfy this direction. Logs must include timestamps, user IDs, and system identifiers.',NULL,'critical',ARRAY['audit_logging']),
  ('cert_in','Direction 5','Data and ICT Infrastructure in India','Virtual asset service providers, virtual asset exchanges, and custodian wallets must maintain all data within India.','DLP web and SaaS controls enforce data residency requirements — blocking uploads to cloud services hosted outside India for in-scope organisations.',NULL,'high',ARRAY['dlp_web','dlp_saas','data_classification'])

) AS req(code, article, title, description, dlp_relevance, fine, severity, dlp_controls)
ON (r.code = req.code)
ON CONFLICT DO NOTHING;
