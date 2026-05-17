-- Add source_url column to compliance_regulations (safe — uses IF NOT EXISTS)
ALTER TABLE compliance_regulations
  ADD COLUMN IF NOT EXISTS source_url text;

-- Update existing regulation rows with official source URLs
UPDATE compliance_regulations SET source_url = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679'                                                                               WHERE code = 'gdpr';
UPDATE compliance_regulations SET source_url = 'https://www.legislation.gov.uk/uksi/2019/419/contents/made'                                                                                          WHERE code = 'uk_gdpr';
UPDATE compliance_regulations SET source_url = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022L2555'                                                                              WHERE code = 'nis2';
UPDATE compliance_regulations SET source_url = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2554'                                                                              WHERE code = 'dora';
UPDATE compliance_regulations SET source_url = 'https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf'                                                WHERE code = 'dpdp';
UPDATE compliance_regulations SET source_url = 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=10435'                                                                                       WHERE code = 'rbi_csf';
UPDATE compliance_regulations SET source_url = 'https://www.sebi.gov.in/legal/circulars/aug-2023/cybersecurity-and-cyber-resilience-framework-cscrf-for-sebi-regulated-entities_75301.html'          WHERE code = 'sebi_cscrf';
UPDATE compliance_regulations SET source_url = 'https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html'                                                                    WHERE code = 'hipaa';
UPDATE compliance_regulations SET source_url = 'https://www.ftc.gov/business-guidance/privacy-security/gramm-leach-bliley-act'                                                                       WHERE code = 'glba';
UPDATE compliance_regulations SET source_url = 'https://cppa.ca.gov/regulations/'                                                                                                                    WHERE code = 'ccpa';
UPDATE compliance_regulations SET source_url = 'https://www.acq.osd.mil/cmmc/'                                                                                                                       WHERE code = 'cmmc';
UPDATE compliance_regulations SET source_url = 'https://www.sec.gov/spotlight/sarbanes-oxley.htm'                                                                                                    WHERE code = 'sox';
UPDATE compliance_regulations SET source_url = 'https://www.pcisecuritystandards.org/document_library/'                                                                                              WHERE code = 'pci_dss';
UPDATE compliance_regulations SET source_url = 'https://www.pdpc.gov.sg/Overview-of-PDPA/The-Legislation/Personal-Data-Protection-Act'                                                              WHERE code = 'pdpa_sg';
UPDATE compliance_regulations SET source_url = 'https://www.chinalawtranslate.com/en/personal-information-protection-law/'                                                                           WHERE code = 'pipl';
UPDATE compliance_regulations SET source_url = 'https://www.ppc.go.jp/en/legal/'                                                                                                                     WHERE code = 'appi';
UPDATE compliance_regulations SET source_url = 'https://www.legislation.gov.au/Details/C2023C00209'                                                                                                  WHERE code = 'privacy_act_au';
UPDATE compliance_regulations SET source_url = 'https://www.pipc.go.kr/eng/'                                                                                                                         WHERE code = 'pipa_kr';
UPDATE compliance_regulations SET source_url = 'https://sdaia.gov.sa/en/SDAIA/about/Pages/PersonalDataProtection.aspx'                                                                               WHERE code = 'pdpl_sa';
UPDATE compliance_regulations SET source_url = 'https://www.justice.gov.za/inforeg/'                                                                                                                 WHERE code = 'popia';
UPDATE compliance_regulations SET source_url = 'https://laws-lois.justice.gc.ca/ENG/ACTS/P-8.6/'                                                                                                    WHERE code = 'pipeda';
UPDATE compliance_regulations SET source_url = 'https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd'                                                                                         WHERE code = 'lgpd';
