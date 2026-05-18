-- Migration 015: Add industry-specific regulations for technology, education,
-- government, automotive, telecom; expand regulation industry strings.

INSERT INTO compliance_regulations (code, short_name, name, regions, industries, jurisdiction, authority, type, summary, max_fine, effective_date, source_url) VALUES

-- ── Technology / SaaS ────────────────────────────────────────────────────────

('soc2',
 'SOC 2',
 'AICPA SOC 2 Type II (Trust Services Criteria)',
 ARRAY['US'],
 ARRAY['technology'],
 'United States',
 'American Institute of Certified Public Accountants (AICPA)',
 'security',
 'SOC 2 evaluates service organisations against the Trust Services Criteria — Security, Availability, Confidentiality, Processing Integrity, and Privacy. Type II covers a 6–12 month period and is effectively mandatory for B2B SaaS companies handling customer data.',
 NULL,
 NULL,
 'https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2'),

('fedramp',
 'FedRAMP',
 'Federal Risk and Authorization Management Program',
 ARRAY['US'],
 ARRAY['technology','government'],
 'United States',
 'FedRAMP Program Management Office (GSA)',
 'security',
 'US government programme that provides a standardised approach to security assessment, authorisation, and continuous monitoring for cloud services used by federal agencies. Based on NIST SP 800-53 controls.',
 'Revocation of Authority to Operate (ATO); loss of federal contracts',
 '2011-12-08',
 'https://www.fedramp.gov/'),

-- ── Education ────────────────────────────────────────────────────────────────

('ferpa',
 'FERPA',
 'Family Educational Rights and Privacy Act',
 ARRAY['US'],
 ARRAY['education'],
 'United States',
 'U.S. Department of Education',
 'privacy',
 'FERPA protects the privacy of student education records at institutions that receive federal funding. It restricts disclosure of personally identifiable information from education records without parental or student consent.',
 'Withdrawal of federal funding',
 '1974-08-21',
 'https://studentprivacy.ed.gov/ferpa'),

-- ── Children''s Data (cross-industry) ───────────────────────────────────────

('coppa',
 'COPPA',
 'Children''s Online Privacy Protection Act',
 ARRAY['US'],
 NULL,
 'United States',
 'Federal Trade Commission (FTC)',
 'privacy',
 'COPPA imposes requirements on operators of websites and online services directed at children under 13, or who knowingly collect personal information from children. Requires verifiable parental consent and strict data minimisation.',
 '$51,744 per violation per day',
 '2000-04-21',
 'https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa'),

-- ── Government / Defence ─────────────────────────────────────────────────────

('fisma',
 'FISMA',
 'Federal Information Security Modernization Act',
 ARRAY['US'],
 ARRAY['government'],
 'United States',
 'Office of Management and Budget (OMB) / CISA',
 'security',
 'FISMA requires US federal agencies and contractors to develop, document, and implement agency-wide information security programmes. Controls are based on NIST SP 800-53 and SP 800-171 for systems handling federal information.',
 'Inspector General findings; loss of federal authority to operate',
 '2014-12-18',
 'https://csrc.nist.gov/topics/laws-and-regulations/laws/fisma'),

('nist_800_171',
 'NIST 800-171',
 'NIST SP 800-171 — Protecting CUI in Non-Federal Systems',
 ARRAY['US'],
 ARRAY['government','defence'],
 'United States',
 'National Institute of Standards and Technology (NIST)',
 'security',
 'Defines 110 security requirements for protecting Controlled Unclassified Information (CUI) in non-federal information systems. Required for DoD contractors and widely adopted across the defence industrial base.',
 'Loss of government contracts; CMMC non-compliance',
 '2021-02-01',
 'https://csrc.nist.gov/publications/detail/sp/800/171/rev-3/final'),

-- ── Automotive ───────────────────────────────────────────────────────────────

('un_r155',
 'UN R155',
 'UN Regulation No. 155 — Automotive Cybersecurity Management',
 ARRAY['EU','EEA','UK','Japan','South Korea','China'],
 ARRAY['automotive'],
 'United Nations (UNECE WP.29)',
 'UNECE World Forum for Harmonization of Vehicle Regulations',
 'security',
 'UN Regulation 155 requires vehicle manufacturers to implement a Cybersecurity Management System (CSMS) covering vehicle design, production, and post-production. Mandatory for type approval of new vehicle types in signatory countries.',
 'Type approval denial; recall obligations',
 '2022-07-22',
 'https://unece.org/transport/vehicle-regulations/un-regulation-no155-cybersecurity-and-cybersecurity-management'),

-- ── Telecom ──────────────────────────────────────────────────────────────────

('cpni',
 'CPNI Rules',
 'FCC Customer Proprietary Network Information Rules',
 ARRAY['US'],
 ARRAY['telecom'],
 'United States',
 'Federal Communications Commission (FCC)',
 'privacy',
 'FCC rules requiring telecommunications carriers to protect Customer Proprietary Network Information (CPNI) — call records, calling patterns, service details — from unauthorised disclosure. Carriers must obtain opt-in approval for use of CPNI for marketing.',
 '$100,000 per day per violation (max $1M per single act)',
 '2007-04-02',
 'https://www.fcc.gov/consumers/guides/protecting-your-phone-records'),

-- ── Retail / E-commerce ──────────────────────────────────────────────────────

('coppa_retail',
 'COPPA (Retail)',
 'COPPA Applicability for Retail and E-commerce',
 ARRAY['US'],
 ARRAY['retail'],
 'United States',
 'Federal Trade Commission (FTC)',
 'privacy',
 'Retail and e-commerce platforms must comply with COPPA if they knowingly collect data from children under 13 or operate child-directed services. This includes loyalty programmes, gaming integrations, and educational content on retail platforms.',
 '$51,744 per violation per day',
 '2013-07-01',
 'https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa'),

-- ── Legal / Professional Services ────────────────────────────────────────────

('sra_standards',
 'SRA Standards',
 'Solicitors Regulation Authority Standards and Regulations',
 ARRAY['UK'],
 ARRAY['legal'],
 'United Kingdom',
 'Solicitors Regulation Authority (SRA)',
 'sector',
 'SRA Standards and Regulations require solicitors and law firms to protect confidential client information, maintain client data security, and comply with confidentiality obligations. Firms must have appropriate cybersecurity measures to protect privileged and confidential data.',
 'Fines, suspension, or disbarment; referral to SDT',
 '2019-11-25',
 'https://www.sra.org.uk/solicitors/standards-regulations/'),

('aba_model_rules',
 'ABA Model Rules',
 'ABA Model Rules of Professional Conduct — Data Security',
 ARRAY['US'],
 ARRAY['legal'],
 'United States',
 'American Bar Association (ABA) / State Bar Associations',
 'sector',
 'ABA Model Rule 1.6 requires lawyers to make reasonable efforts to prevent the inadvertent or unauthorised disclosure of client information. Formal Opinion 477R clarifies that lawyers must implement reasonable cybersecurity measures to protect client data.',
 'State bar disciplinary action; malpractice liability',
 '2017-05-11',
 'https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/'),

-- ── Media & Entertainment ─────────────────────────────────────────────────────

('content_sec_reqs',
 'Content Security Reqs',
 'MPA Content Security Program Requirements',
 ARRAY['US','EU','EEA','UK','Global'],
 ARRAY['media'],
 'Global',
 'Motion Picture Association (MPA)',
 'security',
 'The MPA Content Security Program defines best practices for protecting pre-release and confidential content for studios, vendors, and post-production facilities. Includes controls for digital asset management, access control, and DLP for unreleased content.',
 'Loss of studio contracts; content breach liability',
 NULL,
 'https://www.motionpictures.org/what-we-do/protecting-creativity/anti-piracy/mpa-content-security-program/')

ON CONFLICT (code) DO NOTHING;

-- ── Requirements ─────────────────────────────────────────────────────────────

INSERT INTO compliance_requirements (regulation_id, article, title, description, dlp_relevance, fine, severity, dlp_controls)
SELECT r.id, req.article, req.title, req.description, req.dlp_relevance, req.fine, req.severity, req.dlp_controls
FROM compliance_regulations r
JOIN (VALUES

  -- SOC 2
  ('soc2','CC6.1','Logical and Physical Access Controls','The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events.','DLP access controls enforce least-privilege access to sensitive data — preventing unauthorised users from accessing, copying, or transmitting protected information.', NULL,'critical',ARRAY['access_controls','data_classification','audit_logging']),
  ('soc2','CC6.7','Transmission of Sensitive Data','The entity restricts the transmission of data to authorised internal and external users and systems.','DLP enforces this criterion by blocking or monitoring transmission of sensitive data via email, web, endpoint, SaaS, and GenAI channels.', NULL,'critical',ARRAY['dlp_web','dlp_email','dlp_endpoint','dlp_saas','genai_controls','encryption_transit']),
  ('soc2','CC7.2','System Monitoring','The entity monitors system components for anomalies that are indicative of malicious acts, natural disasters, and errors affecting the entity''s ability to meet its objectives.','DLP monitoring and breach detection feed directly into this criterion — detecting data exfiltration and anomalous data movement patterns.', NULL,'high',ARRAY['breach_detection','audit_logging']),
  ('soc2','C1.1','Confidentiality Policy','The entity identifies and maintains confidential information to meet the entity''s objectives related to confidentiality.','Data classification is the foundation of the Confidentiality criterion — data must be labelled before it can be protected.', NULL,'high',ARRAY['data_classification','dlp_saas','dlp_email']),

  -- FedRAMP
  ('fedramp','AC-1','Access Control Policy','The organisation develops, documents, and disseminates an access control policy covering purpose, scope, roles, and responsibilities.','DLP access controls enforce policy-based data access restrictions aligned with FedRAMP''s access control requirements for federal cloud systems.', NULL,'critical',ARRAY['access_controls','data_classification']),
  ('fedramp','AU-2','Audit Events','The information system generates audit records for defined events including access control events, data modifications, and data transmissions.','DLP audit logging captures all data movement events, providing the audit trail required by NIST 800-53 AU controls at the FedRAMP Moderate/High baseline.', NULL,'critical',ARRAY['audit_logging','breach_detection']),
  ('fedramp','SC-28','Protection of Information at Rest and in Transit','The information system protects the confidentiality and integrity of information in storage and during transmission.','DLP encryption controls enforce protection of CUI and federal data in transit across web, email, and cloud channels.', NULL,'high',ARRAY['encryption_transit','dlp_web','dlp_email','dlp_saas']),
  ('fedramp','MP-7','Media Sanitization and Disposal','The organisation controls and restricts the use of types of digital media on information system components.','DLP endpoint controls restrict removable media, USB drives, and local data exports from systems processing federal data.', NULL,'high',ARRAY['dlp_endpoint','access_controls']),

  -- FERPA
  ('ferpa','§99.31','Legitimate Educational Interest — Access Control','Access to education records must be limited to school officials with a legitimate educational interest. Unauthorised disclosure is prohibited.','DLP access controls restrict who can view, copy, and transmit student education records, enforcing the legitimate educational interest requirement.', NULL,'critical',ARRAY['access_controls','data_classification','audit_logging']),
  ('ferpa','§99.32','Recordkeeping Requirements','Institutions must maintain a record of all disclosures of education records, including the parties who requested access and their legitimate interest.','DLP audit logging provides the disclosure records required under FERPA — tracking who accessed, exported, or shared student data and to whom.', NULL,'high',ARRAY['audit_logging','dlp_email','dlp_saas']),
  ('ferpa','§99.36','Health or Safety Emergencies','Records may be disclosed in emergencies but institutions must document the basis. Post-event review requires audit logs.','DLP breach detection and audit logging support post-incident documentation of emergency disclosures and ensure breaches are detected quickly.', NULL,'high',ARRAY['breach_detection','audit_logging']),
  ('ferpa','§99.67','Enforcement — Data Breach Response','Institutions subject to enforcement investigations must demonstrate they had appropriate safeguards in place to prevent unauthorised disclosure.','DLP controls across all channels (email, SaaS, web, endpoint) provide the documented technical safeguards regulators expect during enforcement investigations.', NULL,'critical',ARRAY['data_classification','dlp_web','dlp_email','dlp_saas','dlp_endpoint']),

  -- COPPA
  ('coppa','§312.3','Operator Notice and Data Collection','Operators must provide clear notice about what personal information is collected from children and how it is used.','Data classification identifies where children''s personal information sits within systems, enabling accurate notice and restricting its use to stated purposes.', NULL,'critical',ARRAY['data_classification','access_controls']),
  ('coppa','§312.7','Prohibition on Conditioning on Collection','Operators cannot condition a child''s participation on disclosure of more personal information than is reasonably necessary.','DLP controls enforce data minimisation by limiting which systems can collect or store children''s data, reducing unnecessary collection footprint.', NULL,'high',ARRAY['data_classification','dlp_saas','access_controls']),
  ('coppa','§312.10','Data Retention and Deletion','Operators must retain children''s personal information only as long as reasonably necessary and must delete it using reasonable measures.','DLP audit logging tracks the lifecycle of children''s data, supporting retention enforcement and documenting deletion activities.', '$51,744 per violation per day','high',ARRAY['audit_logging','data_classification']),
  ('coppa','§312.8','Confidentiality and Security','Operators must establish and maintain reasonable procedures to protect the confidentiality, security, and integrity of children''s personal information.','DLP across all channels — web, email, SaaS, endpoint — provides the technical security measures required to protect children''s personal information from unauthorised access or disclosure.', '$51,744 per violation per day','critical',ARRAY['dlp_web','dlp_email','dlp_saas','dlp_endpoint','encryption_transit','access_controls']),

  -- FISMA
  ('fisma','§3554(a)','Agency Information Security Programme','Each agency must develop, document, and implement an agency-wide information security programme to protect the information and information systems used or operated by or on behalf of the agency.','DLP is a core component of the required information security programme — providing technical controls across all data egress channels for systems holding federal information.', NULL,'critical',ARRAY['data_classification','dlp_web','dlp_email','dlp_saas','dlp_endpoint']),
  ('fisma','NIST 800-53 AC','Access Control Family','Agencies must implement access control policies covering account management, access enforcement, least privilege, and separation of duties.','DLP access controls enforce least-privilege principles by restricting which users can move, copy, or transmit sensitive federal data.', NULL,'critical',ARRAY['access_controls','audit_logging']),
  ('fisma','NIST 800-53 AU','Audit and Accountability Family','Agencies must create, protect, and retain system audit logs to monitor, analyse, investigate, and report unlawful or unauthorised activity.','DLP audit logging generates the required audit records for all data access and transmission events, feeding into the agency''s audit and accountability programme.', NULL,'high',ARRAY['audit_logging','breach_detection']),
  ('fisma','NIST 800-53 SC','System and Communications Protection','Agencies must protect information systems and communications at external boundaries and key internal boundaries.','DLP email, web, and encryption controls protect federal data at communication boundaries, preventing exfiltration of CUI and sensitive information.', NULL,'high',ARRAY['encryption_transit','dlp_web','dlp_email','dlp_saas']),

  -- NIST 800-171
  ('nist_800_171','3.1 AC','Access Control — CUI','Limit information system access to authorised users, processes acting on behalf of authorised users, and devices. Limit access to types of transactions and functions authorised users are permitted to execute.','DLP access controls enforce CUI access restrictions — preventing unauthorised users from accessing, copying, or transmitting Controlled Unclassified Information.', NULL,'critical',ARRAY['access_controls','data_classification']),
  ('nist_800_171','3.3 AU','Audit and Accountability — CUI Systems','Create and retain system audit logs and records to the extent needed to enable the monitoring, analysis, investigation, and reporting of unlawful or unauthorised system activity.','DLP audit logging provides the required audit trail for CUI-handling systems, capturing all data access, movement, and transmission events.', NULL,'high',ARRAY['audit_logging','breach_detection']),
  ('nist_800_171','3.13 SC','System and Communications Protection — CUI','Implement architectural designs, software development techniques, and systems engineering principles promoting security in information systems.','DLP email, web, and endpoint controls protect CUI at all communication egress points — web uploads, email attachments, removable media, and cloud storage.', NULL,'critical',ARRAY['dlp_web','dlp_email','dlp_endpoint','encryption_transit']),
  ('nist_800_171','3.14 SI','System and Information Integrity — CUI','Identify, report, and correct information and information system flaws; protect from malicious code; monitor information systems to detect attacks.','DLP breach detection identifies anomalous data movement indicative of exfiltration attacks or insider threats affecting CUI integrity.', NULL,'high',ARRAY['breach_detection','audit_logging','dlp_endpoint']),

  -- UN R155
  ('un_r155','§7.3.3','CSMS — Vehicle Cybersecurity Risk Management','Manufacturers must implement a Cybersecurity Management System (CSMS) covering identification and management of cyber risks across the vehicle lifecycle.','DLP data classification identifies sensitive vehicle design data, telematics, and engineering files — enabling risk-based controls over who can access and export this data.', NULL,'critical',ARRAY['data_classification','access_controls','audit_logging']),
  ('un_r155','§7.3.5','Detection and Response to Cyber Attacks','Manufacturers must implement measures to detect and respond to cyber attacks, threats, and vulnerabilities within a reasonable time.','DLP breach detection identifies exfiltration of vehicle design data, source code, or engineering documents — enabling rapid incident response before data reaches adversaries.', NULL,'critical',ARRAY['breach_detection','audit_logging']),
  ('un_r155','§7.3.2','Protect Vehicle Data and Data Transmissions','Manufacturers must protect vehicle and production system data, including telematics, diagnostic data, and over-the-air update systems.','DLP encryption controls and access controls protect sensitive vehicle data in transit, including telematics, OTA update packages, and design documentation.', NULL,'high',ARRAY['encryption_transit','access_controls','dlp_saas']),
  ('un_r155','§7.3.6','Forensic Data Capability','Manufacturers must be able to provide forensic data to support investigations of cyber attacks or security incidents.','DLP audit logging provides the forensic data trail required under R155 — capturing who accessed, moved, or transmitted sensitive vehicle data and when.', NULL,'high',ARRAY['audit_logging','breach_detection']),

  -- CPNI
  ('cpni','47 CFR §64.2010','Protection of CPNI — Opt-In Requirement','Carriers must obtain prior express approval before using CPNI for marketing services from third parties or joint venture partners.','Data classification identifies CPNI within carrier data stores, and DLP SaaS/web controls prevent unauthorised sharing of CPNI with third-party marketing platforms.', NULL,'critical',ARRAY['data_classification','dlp_saas','access_controls']),
  ('cpni','47 CFR §64.2011','CPNI Breach Notification','Carriers must notify the FBI and FCC within 7 business days of reasonably determining that CPNI has been accessed without customer approval. Notification to customers follows after 30 days.','DLP breach detection triggers CPNI breach investigations, providing the detection and evidence needed to meet the 7-business-day FBI/FCC notification window.', '$100,000 per day per violation','critical',ARRAY['breach_detection','audit_logging']),
  ('cpni','47 CFR §64.2001','CPNI Definition — Data Classification','Customer Proprietary Network Information includes call records, calling patterns, service usage, and billing details generated through use of the carrier''s network.','Data classification must identify and tag CPNI across carrier data systems — the prerequisite for applying DLP controls that protect this regulated data category.', NULL,'high',ARRAY['data_classification','audit_logging']),
  ('cpni','47 CFR §64.2009','Safeguarding CPNI — Access Controls','Carriers must train personnel on when they are and are not authorised to use CPNI and must implement policies and procedures to protect CPNI.','DLP access controls enforce the carrier''s CPNI usage policies by restricting which employees can access, export, or transmit CPNI data, with audit logging for enforcement.', '$100,000 per day per violation','high',ARRAY['access_controls','audit_logging','dlp_saas']),

  -- SRA Standards
  ('sra_standards','Principle 6 / Rule 6.3','Confidentiality Obligation — Client Data','Solicitors must keep the affairs of current and former clients confidential unless disclosure is required or permitted by law or the client consents.','DLP email and SaaS controls enforce client data confidentiality obligations — preventing inadvertent disclosure of privileged communications, case files, or client PII.', NULL,'critical',ARRAY['dlp_email','dlp_web','dlp_saas','data_classification']),
  ('sra_standards','Rule 6.4','Cybersecurity and Data Protection','Law firms must make reasonable efforts to prevent inadvertent disclosure or unauthorised access to client information.','DLP across all channels is a primary mechanism for meeting this obligation — the SRA expects firms to have technical controls preventing data leakage from email, web, and cloud.', NULL,'critical',ARRAY['dlp_email','dlp_web','dlp_saas','dlp_endpoint','access_controls']),
  ('sra_standards','SRA Cybersecurity Guide','Incident Response and Breach Management','The SRA expects firms to have documented incident response procedures and to report significant cybersecurity incidents.','DLP breach detection enables rapid identification of client data breaches, and audit logging provides the evidence trail needed for SRA incident reports.', NULL,'high',ARRAY['breach_detection','audit_logging']),

  -- ABA Model Rules
  ('aba_model_rules','Rule 1.6(c)','Reasonable Cybersecurity Measures','Lawyers must make reasonable efforts to prevent the inadvertent or unauthorised disclosure of, or unauthorised access to, information relating to the representation of a client.','DLP across email, web, and cloud is a core reasonable security measure for client data protection. ABA Formal Opinion 477R specifically cites email encryption and access controls.', NULL,'critical',ARRAY['dlp_email','dlp_web','dlp_saas','encryption_transit','access_controls']),
  ('aba_model_rules','Rule 1.1 (Competence)','Technology Competence — Data Security','Lawyers must maintain competence including understanding of the benefits and risks of relevant technology, including cybersecurity tools protecting client information.','Data classification and DLP are among the security technologies lawyers are expected to understand and implement to competently protect client data from inadvertent disclosure.', NULL,'high',ARRAY['data_classification','dlp_email','access_controls']),

  -- COPPA Retail
  ('coppa_retail','§312.4','Verifiable Parental Consent','Before collecting personal information from children, retail platforms must obtain verifiable parental consent.','Access controls and data classification are required to identify where children''s data enters retail platforms (loyalty programmes, competitions, gaming) and restrict processing without consent.', '$51,744 per violation per day','critical',ARRAY['data_classification','access_controls','dlp_saas']),
  ('coppa_retail','§312.8','Security Obligation for Retail Platforms','Retail operators must establish and maintain reasonable procedures to protect the confidentiality, security, and integrity of children''s personal information collected through their platforms.','DLP SaaS, web, and endpoint controls provide the security measures protecting children''s data from unauthorised access, disclosure, or sharing with third parties.', '$51,744 per violation per day','critical',ARRAY['dlp_web','dlp_saas','dlp_endpoint','encryption_transit','access_controls']),

  -- MPA Content Security
  ('content_sec_reqs','Section 3 — Access Control','Access Control for Pre-Release Content','Access to pre-release, confidential, and unreleased content must be restricted to authorised personnel. Multi-factor authentication and role-based access must be enforced.','DLP access controls enforce content security policies — preventing unauthorised staff from accessing, copying, or exfiltrating unreleased films, scripts, or digital assets.', NULL,'critical',ARRAY['access_controls','data_classification','audit_logging']),
  ('content_sec_reqs','Section 4 — Network and Data Security','Network Controls for Content Protection','Organisations must implement network security controls including DLP, egress filtering, and monitoring to prevent unauthorised transfer of content.','DLP web, email, and endpoint controls are explicitly referenced in MPA requirements — blocking upload of unreleased content to unauthorised destinations.', NULL,'critical',ARRAY['dlp_web','dlp_email','dlp_endpoint','dlp_saas','breach_detection']),
  ('content_sec_reqs','Section 7 — Incident Response','Content Breach Detection and Response','Organisations must have incident response procedures for detecting and responding to content security incidents, including digital content theft.','DLP breach detection identifies when pre-release content is exfiltrated, enabling rapid response before content reaches piracy networks.', NULL,'high',ARRAY['breach_detection','audit_logging'])

) AS req(code, article, title, description, dlp_relevance, fine, severity, dlp_controls)
  ON r.code = req.code
ON CONFLICT DO NOTHING;
