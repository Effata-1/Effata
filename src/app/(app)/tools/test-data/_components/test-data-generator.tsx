'use client'

import { useState, useMemo, useTransition, useCallback } from 'react'
import { Loader2, Trash2, Check, Sparkles, Search, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateTestData, saveDataset, deleteDataset } from '../actions'
import type { GeneratedData, SavedDataset } from '../actions'

// ── Template Definitions ──────────────────────────────────────────────────────

interface Template {
  name: string
  description: string
  category: string
  fields: string[]
}

const TEMPLATES: Template[] = [
  // People
  { category: 'People', name: 'US Employee',         description: 'Name, SSN, email, phone, address, dept',          fields: ['full_name','email','ssn','dob','phone','address','department','job_title'] },
  { category: 'People', name: 'UK Employee',         description: 'Name, NI, NHS, postcode, dept',                   fields: ['full_name','email','ni_number','nhs_number','dob','uk_phone','uk_postcode','department'] },
  { category: 'People', name: 'Indian Employee',     description: 'Name, Aadhaar, PAN, phone',                       fields: ['full_name','email','aadhaar','pan_card','dob','in_phone'] },
  { category: 'People', name: 'EU Employee',         description: 'German/French — VAT, tax ID, IBAN',               fields: ['full_name','email','eu_tax_id','eu_vat_number','nationality','dob','iban','department','job_title'] },
  { category: 'People', name: 'Australian Employee', description: 'TFN, Medicare, phone, postcode',                  fields: ['full_name','email','aus_tfn','aus_medicare','dob','au_phone','au_postcode','department'] },
  { category: 'People', name: 'Canadian Employee',   description: 'SIN, province, postal code',                      fields: ['full_name','email','can_sin','dob','ca_phone','ca_postcode','department','job_title'] },
  { category: 'People', name: 'Generic PII',         description: 'Name, email, DOB, phone, passport, IP',           fields: ['full_name','email','dob','phone','passport','ip_address'] },
  { category: 'People', name: 'Customer Profile',    description: 'Loyalty ID, segment, lifetime value',             fields: ['full_name','email','phone','loyalty_id','customer_segment','lifetime_value','last_purchase'] },
  { category: 'People', name: 'Student Record',      description: 'Student ID, GPA, major, graduation',              fields: ['full_name','email','student_id','major','gpa','enrollment_date','graduation_date','dob'] },
  { category: 'People', name: 'Job Applicant',       description: 'Skills, experience, salary ask, LinkedIn',        fields: ['full_name','email','phone','job_title','years_experience','skills','salary_expectation','linkedin_url'] },
  // Financial
  { category: 'Financial', name: 'Credit Application', description: 'SSN, credit card, bank account',               fields: ['full_name','ssn','dob','credit_card','routing_number','bank_account','annual_income'] },
  { category: 'Financial', name: 'Banking Customer',   description: 'IBAN, SWIFT, sort code',                        fields: ['full_name','email','iban','swift','sort_code','bank_account'] },
  { category: 'Financial', name: 'Crypto Wallet',      description: 'Bitcoin and Ethereum addresses',                fields: ['full_name','email','bitcoin_address','ethereum_address'] },
  { category: 'Financial', name: 'Payroll Record',     description: 'Salary, pay period, bank, tax withholding',     fields: ['full_name','employee_id','ssn','salary','pay_period','bank_account','routing_number','tax_withholding'] },
  { category: 'Financial', name: 'Insurance Claim',    description: 'Policy, claim number, amount, status',          fields: ['full_name','ssn','policy_number','claim_number','claim_amount','claim_date','claim_status'] },
  { category: 'Financial', name: 'Tax Record',         description: 'SSN, tax year, income, filing status',          fields: ['full_name','ssn','tax_year','filing_status','gross_income','tax_owed','refund_amount'] },
  { category: 'Financial', name: 'Wire Transfer',      description: 'SWIFT, IBAN, amount, currency, reference',      fields: ['sender_name','recipient_name','amount','currency','swift','iban','reference_number','transfer_date'] },
  { category: 'Financial', name: 'Investment Account', description: 'Portfolio value, holdings, risk profile',       fields: ['full_name','email','account_number','portfolio_value','asset_type','annual_return','risk_profile'] },
  { category: 'Financial', name: 'Expense Report',     description: 'Employee expenses with merchant and category',  fields: ['full_name','employee_id','expense_date','merchant','expense_category','amount','currency','receipt_id'] },
  // Healthcare
  { category: 'Healthcare', name: 'US Patient Record',   description: 'SSN, NPI, insurance, ICD-10',                fields: ['full_name','dob','ssn','npi_number','insurance_id','icd10_code','phone'] },
  { category: 'Healthcare', name: 'Prescription Record', description: 'DEA, drug name, dosage, ICD-10',             fields: ['full_name','dob','dea_number','drug_name','dosage','icd10_code'] },
  { category: 'Healthcare', name: 'Lab Results',         description: 'Test name, result, reference range, NPI',    fields: ['full_name','dob','npi_number','lab_test','lab_result','reference_range','collected_date'] },
  { category: 'Healthcare', name: 'Medical Insurance',   description: 'Policy, group number, coverage type',        fields: ['full_name','dob','insurance_id','policy_number','group_number','coverage_type','effective_date'] },
  { category: 'Healthcare', name: 'Pharmacy Record',     description: 'Drug, quantity, refills, DEA number',        fields: ['full_name','dob','dea_number','drug_name','dosage','quantity','refills','icd10_code'] },
  { category: 'Healthcare', name: 'Emergency Contact',   description: 'Blood type, allergies, emergency contact',   fields: ['full_name','dob','blood_type','allergies','emergency_contact_name','emergency_contact_phone','relationship'] },
  { category: 'Healthcare', name: 'Mental Health',       description: 'Therapist NPI, diagnosis, treatment, session', fields: ['full_name','dob','ssn','npi_number','icd10_code','treatment','session_date','insurance_id'] },
  // Credentials
  { category: 'Credentials', name: 'API Config',        description: 'API key, AWS, DB URL, JWT',                   fields: ['service','api_key','aws_access_key','aws_secret_key','db_url','jwt_token'] },
  { category: 'Credentials', name: 'Developer Secrets', description: 'GitHub PAT, Google, Stripe, password',       fields: ['service','github_pat','google_api_key','stripe_key','password','api_key'] },
  { category: 'Credentials', name: 'User Account',      description: 'Username, password, API key, IP',            fields: ['username','email','password','api_key','ip_address','mac_address'] },
  { category: 'Credentials', name: 'AWS Config',        description: 'Access key, region, S3 bucket, secret',      fields: ['service','aws_access_key','aws_secret_key','aws_region','s3_bucket','db_url'] },
  { category: 'Credentials', name: 'Azure Config',      description: 'Subscription, client ID, secret, tenant',    fields: ['service','azure_subscription_id','azure_client_id','azure_client_secret','azure_tenant_id','db_url'] },
  { category: 'Credentials', name: 'OAuth Tokens',      description: 'Client ID, access and refresh tokens, scope',fields: ['service','client_id','access_token','refresh_token','token_expiry','scope'] },
  { category: 'Credentials', name: 'SSH & Certs',       description: 'Private key header, cert CN, fingerprint',   fields: ['hostname','ssh_private_key_header','certificate_cn','cert_expiry','fingerprint','ip_address'] },
  // Network
  { category: 'Network', name: 'Server Inventory', description: 'IP, MAC, OS, hostname, ports',                     fields: ['hostname','ip_address','mac_address','ipv6','os_version','open_ports'] },
  { category: 'Network', name: 'Network Scan',     description: 'IP, MAC, IPv6, hostname, last seen',               fields: ['ip_address','mac_address','ipv6','hostname','last_seen','status'] },
  { category: 'Network', name: 'Firewall Rules',   description: 'Rule ID, source, dest, port, protocol, action',   fields: ['rule_id','source_ip','dest_ip','port','protocol','action','fw_zone'] },
  { category: 'Network', name: 'VPN Config',       description: 'Endpoint, shared secret, tunnel IPs, encryption', fields: ['vpn_endpoint','shared_secret','tunnel_ip_local','tunnel_ip_remote','ike_version','encryption','hostname'] },
  { category: 'Network', name: 'DNS Records',      description: 'Record type, TTL, zone, record value',            fields: ['dns_zone','hostname','record_type','ttl','record_value','last_updated'] },
  // Corporate
  { category: 'Corporate', name: 'Customer Contract', description: 'Org, contract value, payment terms, expiry',   fields: ['org_name','contact_name','email','contract_value','currency','payment_terms','start_date','expiry_date'] },
  { category: 'Corporate', name: 'HR Record',         description: 'Employee ID, hire date, salary, manager',      fields: ['full_name','employee_id','email','ssn','hire_date','salary','department','job_title','manager_name'] },
  { category: 'Corporate', name: 'M&A Dataroom',      description: 'Company, valuation, deal type, stage',         fields: ['org_name','revenue','valuation','deal_type','deal_stage','lead_advisor','target_close_date'] },
  { category: 'Corporate', name: 'Background Check',  description: 'SSN, credit score, criminal record, history',  fields: ['full_name','ssn','dob','credit_score','criminal_record','employment_history','reference_name'] },
  { category: 'Corporate', name: 'Vendor Agreement',  description: 'Vendor, value, payment terms, termination',    fields: ['org_name','contact_name','email','contract_value','payment_terms','start_date','termination_date','termination_reason'] },
  { category: 'Corporate', name: 'Incident Report',   description: 'Incident ID, severity, affected system, notes',fields: ['incident_id','reported_by','email','severity','affected_system','description','reported_date','resolved_date'] },
]

const TEMPLATE_CATEGORIES = ['All', 'People', 'Financial', 'Healthcare', 'Credentials', 'Network', 'Corporate']

const CATEGORY_COLORS: Record<string, string> = {
  People:      'bg-blue-500/15 text-blue-400',
  Financial:   'bg-green-500/15 text-green-400',
  Healthcare:  'bg-red-500/15 text-red-400',
  Credentials: 'bg-amber-500/15 text-amber-400',
  Network:     'bg-purple-500/15 text-purple-400',
  Corporate:   'bg-cyan-500/15 text-cyan-400',
}

// ── Client-Side Data Generator ────────────────────────────────────────────────

const FIRST_NAMES = ['James','Emma','Oliver','Sophia','William','Ava','Noah','Isabella','Liam','Mia','Charlotte','Ethan','Amelia','Lucas','Harper','Aiden','Evelyn','Mason','Abigail','Logan','Priya','Arjun','Fatima','Mohammed']
const LAST_NAMES  = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Taylor','Anderson','Thomas','Jackson','White','Harris']
const DOMAINS     = ['gmail.com','outlook.com','yahoo.com','company.com','enterprise.org','corp.net']
const DEPARTMENTS = ['Engineering','Marketing','Finance','Operations','HR','Sales','Legal','Product']
const JOB_TITLES  = ['Software Engineer','Product Manager','Data Analyst','Marketing Manager','Financial Analyst','HR Specialist','Sales Representative','Operations Lead','Legal Counsel','Designer']
const ICD10_CODES = ['J18.9','M54.5','I10','E11.9','F32.1','K21.0','R05','Z00.00','J06.9','N39.0']
const DRUG_NAMES  = ['Amoxicillin','Lisinopril','Metformin','Atorvastatin','Omeprazole']
const SERVICES         = ['payment-api','auth-service','data-pipeline','reporting-api','webhook-service','notification-svc','analytics-api','crm-service','billing-service','search-service']
const OS_VERSIONS      = ['Ubuntu 22.04 LTS','Windows Server 2022','CentOS 7.9','Debian 11','RHEL 8.6']
const NATIONALITIES    = ['German','French','Dutch','Spanish','Italian','Belgian','Austrian','Swiss','Swedish','Danish']
const MAJORS           = ['Computer Science','Business Administration','Finance','Marketing','Mechanical Engineering','Nursing','Psychology','Data Science','Information Systems','Accounting']
const SKILL_SETS       = ['Python, SQL, Machine Learning','React, Node.js, TypeScript','Java, Spring Boot, AWS','Salesforce, HubSpot, CRM','Data Analysis, Tableau, Excel','DevOps, Kubernetes, Terraform','Penetration Testing, SIEM, SOAR','Finance, FP&A, Excel, SAP','Project Management, Agile, JIRA','Compliance, GDPR, Risk Management']
const MERCHANTS        = ['Amazon Business','Marriott Hotels','Delta Airlines','Office Depot','Uber Business','Microsoft Azure','Salesforce Inc','Zoom Video','Gartner Research','Adobe Systems']
const EXPENSE_CATS     = ['Travel','Accommodation','Software Subscriptions','Office Supplies','Training & Conferences','Meals & Entertainment','Equipment','Marketing','Legal','Consulting']
const LAB_TESTS        = ['Complete Blood Count (CBC)','Comprehensive Metabolic Panel','Hemoglobin A1c','Lipid Panel','TSH Thyroid','Urinalysis','Vitamin D Level','Ferritin','PSA Prostate','INR/PT']
const LAB_RESULTS      = ['12.4 g/dL','7.1 mmol/L','5.8%','185 mg/dL','2.1 mIU/L','Normal','32 ng/mL','45 ng/mL','4.2 ng/mL','1.1']
const LAB_RANGES       = ['11.5-17.5 g/dL','3.5-5.5 mmol/L','< 5.7%','< 200 mg/dL','0.4-4.0 mIU/L','Normal','30-100 ng/mL','20-250 ng/mL','0-4.0 ng/mL','0.8-1.2']
const BLOOD_TYPES      = ['A+','A-','B+','B-','AB+','AB-','O+','O-']
const ALLERGY_LIST     = ['Penicillin','Sulfonamides','None known','Aspirin, NSAIDs','Latex','Ibuprofen','Codeine','Erythromycin']
const RELATIONSHIPS    = ['Spouse','Parent','Sibling','Child','Friend','Partner','Guardian','Emergency']
const TREATMENTS       = ['Cognitive Behavioural Therapy (CBT)','Dialectical Behaviour Therapy (DBT)','Exposure and Response Prevention','Psychodynamic Therapy','Group Therapy','Medication Management','EMDR Therapy','Mindfulness-Based Cognitive Therapy']
const AWS_REGIONS      = ['us-east-1','us-west-2','eu-west-1','ap-southeast-2','eu-central-1','us-east-2','ap-northeast-1','ca-central-1']
const OAUTH_SCOPES     = ['read:user,repo,write:packages','openid,profile,email,offline_access','https://graph.microsoft.com/.default','https://www.googleapis.com/auth/cloud-platform','read,write,channels:read']
const PROTOCOLS        = ['TCP','UDP','ICMP','TCP/UDP','ESP','GRE']
const DNS_RECORD_TYPES = ['A','AAAA','CNAME','MX','TXT','NS','SRV','PTR']
const IKE_VERSIONS     = ['IKEv2','IKEv1','IKEv2 (preferred)']
const ENCRYPTIONS      = ['AES-256-GCM','AES-128-CBC','AES-256-CBC','CHACHA20-POLY1305']
const FW_ZONES         = ['DMZ','Internal','External','Guest','Management','Production','Staging']
const ORG_NAMES        = ['Apex Technologies Ltd','Meridian Data Corp','Vertex Solutions Inc','Pinnacle Systems LLC','Summit Consulting Group','Horizon Analytics','Catalyst Digital','Nexus Global Services','Ember Software','Prism Ventures']
const DEAL_TYPES       = ['Merger','Acquisition','Strategic Partnership','Joint Venture','Asset Purchase','Share Purchase','Carve-out','Management Buyout']
const DEAL_STAGES      = ['Initial Outreach','NDA Signed','Letter of Intent','Due Diligence','Definitive Agreement','Regulatory Review','Closing']
const PAYMENT_TERMS    = ['Net 30','Net 60','Net 90','Net 15','2/10 Net 30','50% Upfront / 50% Delivery','Monthly Recurring','Quarterly']
const ADVISORS         = ['Goldman Sachs Advisory','Morgan Stanley M&A','McKinsey & Company','Deloitte Corporate Finance','KPMG Deal Advisory','PwC M&A','Lazard Ltd','Rothschild & Co']
const CRIMINAL_RECORDS = ['None','None','None','None','Minor traffic offence (2019)','None','None','Misdemeanor — dismissed (2018)']
const EMP_HISTORY      = ['Microsoft Corp','Google LLC','Amazon Web Services','Salesforce Inc','Oracle Corp','SAP SE','Cisco Systems','IBM Corporation','Accenture','Deloitte']
const TERM_REASONS     = ['Voluntary resignation','End of contract','Restructuring','Performance improvement plan','Mutual agreement','Acquisition integration','Role elimination','Personal reasons']
const AFFECTED_SYSTEMS = ['Customer DB (prod)','Auth Service','Payment Gateway','API Gateway','Data Warehouse','CI/CD Pipeline','Email Server','VPN Concentrator','SSO Provider','Load Balancer']
const SEVERITY_LEVELS  = ['Critical','High','Medium','Low']
const INC_DESCRIPTIONS = ['Unauthorized access attempt on customer database','Sensitive PII exposed via misconfigured S3 bucket','Credential stuffing attack on auth service','Ransomware variant detected on endpoint','Data exfiltration via unsanctioned cloud storage','Phishing campaign targeting finance team','Unencrypted backup containing SSNs discovered','API key leaked in public GitHub repository','Insider threat — large download of customer records','DLP policy bypass via encrypted email attachment']
const COVERAGE_TYPES   = ['Individual HMO','Family PPO','Employee + Spouse EPO','Individual HDHP','Group PPO','COBRA Coverage','Medicare Supplement','Individual Bronze ACA']
const ASSET_TYPES      = ['US Equities','Bonds & Fixed Income','International ETFs','REITs','Technology Stocks','ESG Portfolio','Diversified Index Funds','Commodities','Cash & Money Market','Cryptocurrency']
const RISK_PROFILES    = ['Conservative','Moderate','Aggressive','Very Aggressive','Moderate-Conservative','Income-focused']
const CUST_SEGMENTS    = ['Enterprise','SMB','Consumer','Premium','Startup','Non-profit','Government','Partner']
const FILING_STATUSES  = ['Single','Married Filing Jointly','Married Filing Separately','Head of Household','Qualifying Widow(er)']
const CLAIM_STATUSES   = ['Submitted','Under Review','Approved','Denied','Pending Documentation','In Appeal','Settled','Closed']
const CURRENCIES       = ['USD','EUR','GBP','AUD','CAD','JPY','CHF','SGD','HKD','INR']
const PAY_PERIODS      = ['Bi-Weekly','Monthly','Semi-Monthly','Weekly']

function hex(n: number, len = 8): string {
  return Math.abs(n).toString(16).padStart(len, '0').slice(0, len).toUpperCase()
}
function pad(n: number, len = 2): string { return String(n).padStart(len, '0') }

function generateField(field: string, i: number): string {
  const fn = FIRST_NAMES[i % FIRST_NAMES.length]
  const ln = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length]

  switch (field) {
    case 'full_name':      return `${fn} ${ln}`
    case 'email':          return `${fn.toLowerCase()}.${ln.toLowerCase()}${i + 1}@${DOMAINS[i % DOMAINS.length]}`
    case 'ssn':            return `${100 + (i * 37) % 799}-${10 + (i * 13) % 79}-${1000 + (i * 97) % 8999}`
    case 'dob': {
      const year  = 1960 + (i * 7) % 35
      const month = 1 + (i * 3) % 12
      const day   = 1 + (i * 11) % 28
      return `${pad(month)}/${pad(day)}/${year}`
    }
    case 'phone':
    case 'us_phone':       return `(${200 + (i * 17) % 799}) ${200 + (i * 13) % 799}-${1000 + (i * 97) % 8999}`
    case 'uk_phone':       return `+44 7${pad(700 + (i * 13) % 299, 3)} ${pad(100 + (i * 7) % 899, 3)} ${pad(100 + (i * 31) % 899, 3)}`
    case 'in_phone':       return `+91 ${9000000000 + (i * 1234567) % 999999999}`
    case 'address':        return `${100 + (i * 13) % 9899} ${['Oak','Maple','Pine','Cedar','Elm'][(i * 3) % 5]} ${['Street','Avenue','Boulevard','Drive','Lane'][i % 5]}, ${['Austin TX','Seattle WA','Chicago IL','Boston MA','Denver CO'][i % 5]}`
    case 'uk_postcode':    return `${['SW','EC','W','N','SE','E','NW','WC'][i % 8]}${1 + (i * 3) % 9}${String.fromCharCode(65 + (i * 7) % 26)} ${1 + (i * 11) % 9}${String.fromCharCode(65 + (i * 13) % 20)}${String.fromCharCode(65 + (i * 17) % 20)}`
    case 'department':     return DEPARTMENTS[i % DEPARTMENTS.length]
    case 'job_title':      return JOB_TITLES[i % JOB_TITLES.length]
    case 'ni_number':      return `${String.fromCharCode(65 + (i * 3) % 22)}${String.fromCharCode(65 + (i * 7) % 22)}${pad(100000 + (i * 13) % 899999, 6)}${String.fromCharCode(65 + (i % 4))}`
    case 'nhs_number':     return `${pad(100 + (i * 37) % 899, 3)} ${pad(100 + (i * 13) % 899, 3)} ${pad(1000 + (i * 97) % 8999, 4)}`
    case 'passport':       return `${String.fromCharCode(65 + (i * 3) % 26)}${String.fromCharCode(65 + (i * 7) % 26)}${pad(1000000 + (i * 97) % 8999999, 7)}`
    case 'aadhaar':        return `${2 + (i % 8)}${pad((i * 3737 + 100) % 999, 3)} ${pad((i * 7919 + 1000) % 9999, 4)} ${pad((i * 6271 + 1000) % 9999, 4)}`
    case 'pan_card':       return `${String.fromCharCode(65 + (i * 3) % 26)}${String.fromCharCode(65 + (i * 7) % 26)}${String.fromCharCode(65 + (i * 11) % 26)}${String.fromCharCode(65 + (i * 13) % 26)}${String.fromCharCode(65 + (i * 17) % 26)}${pad(1000 + (i * 97) % 8999, 4)}${String.fromCharCode(65 + (i * 19) % 26)}`
    case 'credit_card':    return `4111 1111 1111 ${pad(1000 + (i * 97) % 8999, 4)}`
    case 'routing_number': return `0${pad(21000000 + (i * 12347) % 99999999, 8)}`
    case 'bank_account':   return `${pad(10000000 + (i * 123457) % 89999999, 8)}`
    case 'annual_income':  return `$${(45000 + (i * 5500) % 155000).toLocaleString()}`
    case 'iban':           return `GB${pad(29 + (i * 7) % 60, 2)}NWBK${pad(60000000 + (i * 123457) % 39999999, 8)}${pad(10000000 + (i * 97531) % 89999999, 8)}`
    case 'swift':          return `${['DEUT','BARC','HSBC','CITI','BOFA'][i % 5]}GB${String.fromCharCode(50 + i % 25)}${String.fromCharCode(50 + (i * 3) % 25)}`
    case 'sort_code':      return `${pad(10 + (i * 7) % 89, 2)}-${pad(10 + (i * 13) % 89, 2)}-${pad(10 + (i * 17) % 89, 2)}`
    case 'bitcoin_address': return `1SYNTH${hex(i * 7777 + 1000000, 8)}${hex(i * 3333 + 500000, 8)}TEST`
    case 'ethereum_address': return `0xSYNTH${hex(i * 9999 + 100000, 8)}${hex(i * 4444 + 200000, 8)}${hex(i * 2222 + 300000, 8)}TEST`
    case 'npi_number':     return `NPI: ${pad(1000000000 + (i * 123457) % 999999999, 10)}`
    case 'insurance_id':   return `INS-${String.fromCharCode(65 + (i * 3) % 26)}${String.fromCharCode(65 + (i * 7) % 26)}-${pad(10000 + (i * 97) % 89999, 5)}`
    case 'icd10_code':     return ICD10_CODES[i % ICD10_CODES.length]
    case 'dea_number':     return `${String.fromCharCode(65 + (i * 3) % 26)}${String.fromCharCode(66 + (i * 7) % 8)}${pad(1000000 + (i * 97) % 8999999, 7)}`
    case 'drug_name':      return DRUG_NAMES[i % DRUG_NAMES.length]
    case 'dosage':         return `${[100,200,250,500,750,1000][i % 6]}mg ${['twice daily','once daily','three times daily','as needed'][i % 4]}`
    case 'api_key':        return `SYNTHETIC_API_${pad(i + 1, 3)}_${hex(i * 31337 + 100000, 16)}`
    case 'aws_access_key': return `AKIAIOSFODNN${hex(i * 97531 + 1000000, 7)}`
    case 'aws_secret_key': return `SYNTHETIC_AWS_SECRET_${hex(i * 12345 + 100000, 8)}/${hex(i * 67890 + 200000, 8)}KEY`
    case 'db_url':         return `postgresql://user_${i + 1}:SYNTH_PASS_${pad(i + 1, 3)}@db.example.com:5432/testdb_${['prod','staging','dev'][i % 3]}`
    case 'jwt_token':      return `eyJhbGciOiJIUzI1NiJ9.SYNTHETIC_PAYLOAD_${pad(i + 1, 3)}.SYNTHETIC_SIG_${hex(i * 54321 + 100000, 8)}`
    case 'github_pat':     return `ghp_SYNTHETIC${pad(i + 1, 3)}${hex(i * 11111 + 100000, 16)}${hex(i * 22222 + 200000, 16)}`
    case 'google_api_key': return `AIzaSYNTHETIC${hex(i * 33333 + 100000, 8)}${hex(i * 44444 + 200000, 8)}TEST`
    case 'stripe_key':     return `sk_test_SYNTHETIC_KEY_${pad(i + 1, 3)}_${hex(i * 55555 + 100000, 8)}`
    case 'password':       return `P@ssw0rd_TEST_${pad(i + 1, 3)}!`
    case 'username':       return `${fn.toLowerCase()}${ln.toLowerCase().slice(0, 3)}${pad(i + 1, 2)}`
    case 'ip_address':     return `10.${(i * 3) % 255}.${(i * 7) % 255}.${(i * 13 + 1) % 254}`
    case 'ipv6':           return `2001:0db8:85a3:${hex(i * 17, 4).toLowerCase()}:${hex(i * 31, 4).toLowerCase()}:8a2e:0370:${hex(i * 43 + 1000, 4).toLowerCase()}`
    case 'mac_address':    return `02:${hex(i * 17 + 10, 2).toLowerCase()}:${hex(i * 31 + 20, 2).toLowerCase()}:${hex(i * 43 + 30, 2).toLowerCase()}:${hex(i * 59 + 40, 2).toLowerCase()}:${hex(i * 67 + 50, 2).toLowerCase()}`
    case 'hostname':       return `server-${['web','app','db','cache','worker'][i % 5]}-${pad(i + 1, 3)}.internal.example.com`
    case 'os_version':     return OS_VERSIONS[i % OS_VERSIONS.length]
    case 'open_ports':     return [['80,443','22,80,443','3306,33060','6379','22,8080'][i % 5]][0]
    case 'last_seen':      return `${pad(1 + (i * 7) % 28)}/${pad(1 + (i * 3) % 12)}/2026 ${pad((i * 5) % 23)}:${pad((i * 13) % 59)}`
    case 'status':         return ['active','inactive','unknown','vulnerable','patched'][i % 5]
    case 'service':        return SERVICES[i % SERVICES.length]
    // People — EU / AU / CA
    case 'eu_tax_id':      return `DE${pad(10000000 + (i * 31337) % 89999999, 8)}`
    case 'eu_vat_number':  return `${['DE','FR','NL','ES','IT','BE','AT'][i % 7]}${pad(100000000 + (i * 97531) % 899999999, 9)}`
    case 'nationality':    return NATIONALITIES[i % NATIONALITIES.length]
    case 'au_phone':       return `+61 4${pad((i * 13 + 100) % 899, 2)} ${pad(100 + (i * 7) % 899, 3)} ${pad(100 + (i * 31) % 899, 3)}`
    case 'au_postcode':    return `${2000 + (i * 137) % 7999}`
    case 'aus_tfn':        return `${pad(100 + (i * 37) % 899, 3)} ${pad(100 + (i * 13) % 899, 3)} ${pad(100 + (i * 73) % 899, 3)}`
    case 'aus_medicare':   return `${2 + i % 8}${pad((i * 3737 + 1000) % 9999, 4)} ${pad((i * 7919 + 1000) % 9999, 4)} ${i % 9 + 1}`
    case 'can_sin':        return `${pad(100 + (i * 37) % 799, 3)}-${pad(100 + (i * 13) % 899, 3)}-${pad(100 + (i * 73) % 899, 3)}`
    case 'ca_phone':       return `(${200 + (i * 17) % 799}) ${200 + (i * 13) % 799}-${1000 + (i * 97) % 8999}`
    case 'ca_postcode':    return `${String.fromCharCode(75 + (i * 3) % 12)}${(i * 7) % 9}${String.fromCharCode(65 + (i * 11) % 22)} ${(i * 13) % 9}${String.fromCharCode(65 + (i * 17) % 22)}${(i * 19) % 9}`
    // People — Customer / Student / Applicant
    case 'loyalty_id':        return `LYL-${pad(1000000 + (i * 97531) % 8999999, 7)}`
    case 'customer_segment':  return CUST_SEGMENTS[i % CUST_SEGMENTS.length]
    case 'lifetime_value':    return `$${(500 + (i * 847) % 149500).toLocaleString()}`
    case 'last_purchase': {
      const d = new Date(2025, (i * 3) % 12, 1 + (i * 7) % 28)
      return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`
    }
    case 'student_id':        return `STU-${pad(100000 + (i * 97) % 899999, 6)}`
    case 'major':             return MAJORS[i % MAJORS.length]
    case 'gpa':               return `${(2.0 + ((i * 23) % 200) / 100).toFixed(2)}`
    case 'years_experience':  return `${2 + (i * 3) % 18} years`
    case 'skills':            return SKILL_SETS[i % SKILL_SETS.length]
    case 'salary_expectation': return `$${(60000 + (i * 7500) % 140000).toLocaleString()}`
    case 'linkedin_url': {
      const lfn = FIRST_NAMES[i % FIRST_NAMES.length].toLowerCase()
      const lln = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length].toLowerCase()
      return `linkedin.com/in/${lfn}-${lln}-${pad(i + 1, 3)}`
    }
    // Financial — Payroll / Claim / Tax / Transfer / Investment / Expense
    case 'employee_id':      return `EMP-${pad(10000 + (i * 97) % 89999, 5)}`
    case 'salary':           return `$${(45000 + (i * 5500) % 155000).toLocaleString()}`
    case 'pay_period':       return PAY_PERIODS[i % PAY_PERIODS.length]
    case 'tax_withholding':  return `$${(3000 + (i * 750) % 22000).toLocaleString()}`
    case 'policy_number':    return `POL-${String.fromCharCode(65 + (i * 3) % 26)}${pad(100000 + (i * 97) % 899999, 6)}`
    case 'claim_number':     return `CLM-2025${pad(10000 + (i * 97) % 89999, 5)}`
    case 'claim_amount':     return `$${(500 + (i * 1237) % 99500).toLocaleString()}`
    case 'claim_status':     return CLAIM_STATUSES[i % CLAIM_STATUSES.length]
    case 'tax_year':         return `${2020 + (i % 5)}`
    case 'filing_status':    return FILING_STATUSES[i % FILING_STATUSES.length]
    case 'gross_income':     return `$${(30000 + (i * 7500) % 270000).toLocaleString()}`
    case 'tax_owed':         return `$${(3000 + (i * 1500) % 57000).toLocaleString()}`
    case 'refund_amount':    return `$${((i * 750) % 8000).toLocaleString()}`
    case 'sender_name':      return `${FIRST_NAMES[(i * 3) % FIRST_NAMES.length]} ${LAST_NAMES[(i * 5) % LAST_NAMES.length]}`
    case 'recipient_name':   return `${FIRST_NAMES[(i * 7) % FIRST_NAMES.length]} ${LAST_NAMES[(i * 11) % LAST_NAMES.length]}`
    case 'amount':           return `${(100 + (i * 2731) % 99900).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'currency':         return CURRENCIES[i % CURRENCIES.length]
    case 'reference_number': return `REF-2025-${pad(10000 + (i * 97) % 89999, 5)}`
    case 'account_number':   return `ACCT-${pad(100000000 + (i * 97531) % 899999999, 9)}`
    case 'portfolio_value':  return `$${(10000 + (i * 47500) % 990000).toLocaleString()}`
    case 'asset_type':       return ASSET_TYPES[i % ASSET_TYPES.length]
    case 'annual_return':    return `${(-3 + ((i * 17) % 250) / 10).toFixed(1)}%`
    case 'risk_profile':     return RISK_PROFILES[i % RISK_PROFILES.length]
    case 'merchant':         return MERCHANTS[i % MERCHANTS.length]
    case 'expense_category': return EXPENSE_CATS[i % EXPENSE_CATS.length]
    case 'receipt_id':       return `RCP-${pad(100000 + (i * 97) % 899999, 6)}`
    // Healthcare — Lab / Insurance / Pharmacy / Emergency / Mental Health
    case 'lab_test':                return LAB_TESTS[i % LAB_TESTS.length]
    case 'lab_result':              return LAB_RESULTS[i % LAB_RESULTS.length]
    case 'reference_range':         return LAB_RANGES[i % LAB_RANGES.length]
    case 'group_number':            return `GRP-${pad(10000 + (i * 37) % 89999, 5)}`
    case 'coverage_type':           return COVERAGE_TYPES[i % COVERAGE_TYPES.length]
    case 'quantity':                return `${[30, 60, 90, 14, 7, 28][i % 6]} tablets`
    case 'refills':                 return `${i % 5}`
    case 'blood_type':              return BLOOD_TYPES[i % BLOOD_TYPES.length]
    case 'allergies':               return ALLERGY_LIST[i % ALLERGY_LIST.length]
    case 'emergency_contact_name':  return `${FIRST_NAMES[(i * 5) % FIRST_NAMES.length]} ${LAST_NAMES[(i * 7) % LAST_NAMES.length]}`
    case 'emergency_contact_phone': return `(${300 + (i * 23) % 699}) ${200 + (i * 11) % 799}-${1000 + (i * 113) % 8999}`
    case 'relationship':            return RELATIONSHIPS[i % RELATIONSHIPS.length]
    case 'treatment':               return TREATMENTS[i % TREATMENTS.length]
    // Credentials — AWS / Azure / OAuth / SSH
    case 'aws_region':           return AWS_REGIONS[i % AWS_REGIONS.length]
    case 's3_bucket':            return `synthetic-dlp-${['prod','staging','dev','backup','archive'][i % 5]}-${pad(i + 1, 3)}.example.com`
    case 'azure_subscription_id': return `SYNTH-${hex(i * 11111 + 100000, 8)}-${hex(i * 22222 + 200000, 4)}-${hex(i * 33333 + 300000, 4)}-${hex(i * 44444 + 400000, 4)}-${hex(i * 55555 + 500000, 12)}`
    case 'azure_client_id':      return `SYNTH-${hex(i * 66666 + 100000, 8)}-${hex(i * 77777 + 200000, 4)}-${hex(i * 88888 + 300000, 4)}-${hex(i * 99999 + 400000, 4)}-${hex(i * 12345 + 500000, 12)}`
    case 'azure_tenant_id':      return `SYNTH-${hex(i * 13579 + 100000, 8)}-${hex(i * 24680 + 200000, 4)}-${hex(i * 35791 + 300000, 4)}-${hex(i * 46802 + 400000, 4)}-${hex(i * 57913 + 500000, 12)}`
    case 'azure_client_secret':  return `SYNTHETIC_AZ_SECRET_${hex(i * 31337 + 100000, 16)}~SYNTH`
    case 'client_id':            return `SYNTH_CLIENT_${pad(i + 1, 3)}_${hex(i * 97531 + 100000, 8)}`
    case 'access_token':         return `SYNTH_ACCESS_${pad(i + 1, 3)}.${hex(i * 11111 + 100000, 16)}.${hex(i * 22222 + 200000, 8)}`
    case 'refresh_token':        return `SYNTH_REFRESH_${pad(i + 1, 3)}.${hex(i * 33333 + 100000, 16)}`
    case 'token_expiry': {
      const te = new Date(2026, (i * 3) % 12, 1 + (i * 7) % 28)
      return `${te.toISOString().slice(0, 10)} ${pad((i * 5) % 23)}:${pad((i * 13) % 59)} UTC`
    }
    case 'scope':                return OAUTH_SCOPES[i % OAUTH_SCOPES.length]
    case 'ssh_private_key_header': return `-----BEGIN SYNTHETIC RSA PRIVATE KEY ${pad(i + 1, 3)}-----`
    case 'certificate_cn':       return `CN=synthetic-cert-${pad(i + 1, 3)}.example.com, O=Synthetic Corp, C=US`
    case 'cert_expiry':          return `${pad(1 + (i * 3) % 12)}/${pad(1 + (i * 7) % 28)}/${2025 + (i % 5) + 1}`
    case 'fingerprint':          return `SHA256:SYNTH${hex(i * 97531 + 100000, 8)}${hex(i * 12345 + 200000, 8)}${hex(i * 67890 + 300000, 8)}=`
    // Network — Firewall / VPN / DNS
    case 'rule_id':          return `FW-RULE-${pad(1000 + i, 4)}`
    case 'source_ip':        return `10.${(i * 3) % 255}.${(i * 7) % 255}.0/24`
    case 'dest_ip':          return `${[192, 172, 10][(i * 3) % 3]}.${(i * 11) % 255}.${(i * 17) % 255}.0/24`
    case 'port':             return `${[80, 443, 22, 3389, 8080, 3306, 5432, 6379, 27017, 25][i % 10]}`
    case 'protocol':         return PROTOCOLS[i % PROTOCOLS.length]
    case 'action':           return ['Allow','Deny','Drop','Log','Alert'][i % 5]
    case 'fw_zone':          return FW_ZONES[i % FW_ZONES.length]
    case 'vpn_endpoint':     return `vpn-${['primary','secondary','backup','dr'][i % 4]}-${pad(i + 1, 2)}.example.com`
    case 'shared_secret':    return `SYNTHETIC_VPN_PSK_${hex(i * 97531 + 100000, 16)}!`
    case 'tunnel_ip_local':  return `172.16.${(i * 3) % 255}.1`
    case 'tunnel_ip_remote': return `172.16.${((i * 3) % 255) + 1}.1`
    case 'ike_version':      return IKE_VERSIONS[i % IKE_VERSIONS.length]
    case 'encryption':       return ENCRYPTIONS[i % ENCRYPTIONS.length]
    case 'dns_zone':         return `${['corp','internal','dmz','example','prod'][i % 5]}.example.com`
    case 'record_type':      return DNS_RECORD_TYPES[i % DNS_RECORD_TYPES.length]
    case 'ttl':              return `${[300, 600, 900, 3600, 86400, 60][i % 6]}`
    case 'record_value':     return `${10 + (i * 13) % 245}.${(i * 7) % 255}.${(i * 11) % 255}.${(i * 17 + 1) % 254}`
    // Corporate
    case 'org_name':           return ORG_NAMES[i % ORG_NAMES.length]
    case 'contact_name':       return `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length]}`
    case 'contract_value':     return `$${(10000 + (i * 47500) % 990000).toLocaleString()}`
    case 'payment_terms':      return PAYMENT_TERMS[i % PAYMENT_TERMS.length]
    case 'manager_name':       return `${FIRST_NAMES[(i * 7) % FIRST_NAMES.length]} ${LAST_NAMES[(i * 11) % LAST_NAMES.length]}`
    case 'revenue':            return `$${(500000 + (i * 2500000) % 99500000).toLocaleString()}`
    case 'valuation':          return `$${(1000000 + (i * 12500000) % 499000000).toLocaleString()}`
    case 'deal_type':          return DEAL_TYPES[i % DEAL_TYPES.length]
    case 'deal_stage':         return DEAL_STAGES[i % DEAL_STAGES.length]
    case 'lead_advisor':       return ADVISORS[i % ADVISORS.length]
    case 'credit_score':       return `${580 + (i * 37) % 270}`
    case 'criminal_record':    return CRIMINAL_RECORDS[i % CRIMINAL_RECORDS.length]
    case 'employment_history': return `${EMP_HISTORY[i % EMP_HISTORY.length]} (${2015 + (i * 2) % 8}–${2020 + (i % 5)})`
    case 'reference_name':     return `${FIRST_NAMES[(i * 9) % FIRST_NAMES.length]} ${LAST_NAMES[(i * 13) % LAST_NAMES.length]}`
    case 'termination_reason': return TERM_REASONS[i % TERM_REASONS.length]
    case 'incident_id':        return `INC-2025-${pad(1000 + i, 4)}`
    case 'reported_by':        return `${FIRST_NAMES[(i * 5) % FIRST_NAMES.length]} ${LAST_NAMES[(i * 7) % LAST_NAMES.length]}`
    case 'severity':           return SEVERITY_LEVELS[i % SEVERITY_LEVELS.length]
    case 'affected_system':    return AFFECTED_SYSTEMS[i % AFFECTED_SYSTEMS.length]
    case 'description':        return INC_DESCRIPTIONS[i % INC_DESCRIPTIONS.length]
    // Shared date fields
    case 'claim_date':
    case 'collected_date':
    case 'expense_date':
    case 'session_date':
    case 'effective_date':
    case 'start_date':
    case 'expiry_date':
    case 'hire_date':
    case 'target_close_date':
    case 'termination_date':
    case 'transfer_date':
    case 'enrollment_date':
    case 'graduation_date':
    case 'reported_date':
    case 'resolved_date':
    case 'last_updated': {
      const y = 2022 + (i * 3) % 4
      const m = 1 + (i * 5) % 12
      const d = 1 + (i * 7) % 28
      return `${pad(m)}/${pad(d)}/${y}`
    }
    default:               return `value_${i + 1}`
  }
}

function generateFromTemplate(template: Template, rowCount: number): GeneratedData {
  const records: Record<string, string>[] = []
  for (let i = 0; i < rowCount; i++) {
    const record: Record<string, string> = {}
    for (const field of template.fields) {
      record[field] = generateField(field, i)
    }
    records.push(record)
  }
  return {
    columns:     template.fields,
    records,
    description: `${template.name} — ${rowCount} synthetic records for DLP testing`,
  }
}

// ── Download Helpers ──────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function escapeXml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
}

function toCSV(columns: string[], records: Record<string, string>[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const header = columns.map(escape).join(',')
  const rows   = records.map(r => columns.map(c => escape(r[c] ?? '')).join(','))
  return [header, ...rows].join('\n')
}

function toTXT(columns: string[], records: Record<string, string>[]): string {
  return records.map((r, i) =>
    `--- Record ${i + 1} ---\n${columns.map(c => `${c}: ${r[c] ?? ''}`).join('\n')}`
  ).join('\n\n')
}

function toXML(columns: string[], records: Record<string, string>[]): string {
  const rows = records.map(r => {
    const fields = columns.map(c => `    <${c}>${escapeXml(r[c] ?? '')}</${c}>`).join('\n')
    return `  <record>\n${fields}\n  </record>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<records>\n${rows}\n</records>`
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

const FORMATS = [
  { id: 'csv',  label: 'CSV'  },
  { id: 'txt',  label: 'TXT'  },
  { id: 'xml',  label: 'XML'  },
] as const

type Format = typeof FORMATS[number]['id']

const ROW_COUNT_AI_OPTIONS  = [5, 10, 25, 50]
const ROW_COUNT_TPL_OPTIONS = [5, 10, 25, 50, 100, 250, 500]

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  initialDatasets: SavedDataset[]
}

export function TestDataGenerator({ initialDatasets }: Props) {
  const [generatedData,   setGeneratedData]   = useState<GeneratedData | null>(null)
  const [aiPrompt,        setAiPrompt]        = useState('')
  const [aiRowCount,      setAiRowCount]      = useState(25)
  const [tplRowCount,     setTplRowCount]     = useState(25)
  const [aiLoading,       startAiTransition]  = useTransition()
  const [aiError,         setAiError]         = useState<string | null>(null)
  const [downloadFormat,  setDownloadFormat]  = useState<Format>('csv')
  const [savedDatasets,   setSavedDatasets]   = useState<SavedDataset[]>(initialDatasets)
  const [saveName,        setSaveName]        = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [saveLoading,     startSaveTransition] = useTransition()
  const [saveSuccess,     setSaveSuccess]     = useState(false)
  const [saveError,       setSaveError]       = useState<string | null>(null)
  const [tplSearch,       setTplSearch]       = useState('')
  const [tplCategory,     setTplCategory]     = useState('All')

  // ── Template filter ────────────────────────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    const q = tplSearch.toLowerCase()
    return TEMPLATES.filter(t => {
      const catMatch  = tplCategory === 'All' || t.category === tplCategory
      const textMatch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      return catMatch && textMatch
    })
  }, [tplSearch, tplCategory])

  // ── AI generate ───────────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (!aiPrompt.trim()) return
    setAiError(null)
    startAiTransition(async () => {
      const { result, error } = await generateTestData(aiPrompt, aiRowCount)
      if (error) { setAiError(error); return }
      if (result) setGeneratedData(result)
    })
  }, [aiPrompt, aiRowCount])

  // ── Template generate (client-side, instant) ───────────────────────────────
  const handleTemplate = useCallback((template: Template) => {
    setGeneratedData(generateFromTemplate(template, tplRowCount))
    setAiError(null)
  }, [tplRowCount])

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!generatedData) return
    const { columns, records } = generatedData
    const ts = Date.now()
    switch (downloadFormat) {
      case 'csv':  downloadFile(toCSV(columns, records),  `dlp-test-data-${ts}.csv`,  'text/csv')    ; break
      case 'txt':  downloadFile(toTXT(columns, records),  `dlp-test-data-${ts}.txt`,  'text/plain')  ; break
      case 'xml':  downloadFile(toXML(columns, records),  `dlp-test-data-${ts}.xml`,  'application/xml') ; break
    }
  }, [generatedData, downloadFormat])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!generatedData || !saveName.trim()) return
    setSaveError(null)
    setSaveSuccess(false)
    startSaveTransition(async () => {
      const { id, error } = await saveDataset({
        name:        saveName,
        description: saveDescription,
        columns:     generatedData.columns,
        records:     generatedData.records,
        aiGenerated: !!aiPrompt,
        aiPrompt:    aiPrompt,
      })
      if (error) { setSaveError(error); return }
      const entry: SavedDataset = {
        id: id!,
        name:         saveName.trim(),
        description:  saveDescription.trim() || null,
        columns:      generatedData.columns,
        records:      generatedData.records,
        row_count:    generatedData.records.length,
        ai_generated: !!aiPrompt,
        ai_prompt:    aiPrompt || null,
        created_at:   new Date().toISOString(),
      }
      setSavedDatasets(prev => [entry, ...prev])
      setSaveSuccess(true)
      setSaveName('')
      setSaveDescription('')
      setTimeout(() => setSaveSuccess(false), 3000)
    })
  }, [generatedData, saveName, saveDescription, aiPrompt])

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    const { error } = await deleteDataset(id)
    if (!error) setSavedDatasets(prev => prev.filter(d => d.id !== id))
  }, [])

  // ── Load saved ────────────────────────────────────────────────────────────
  const handleLoad = useCallback((ds: SavedDataset) => {
    setGeneratedData({ columns: ds.columns, records: ds.records, description: ds.name })
    setAiError(null)
  }, [])

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="grid grid-cols-3 gap-5">

      {/* ══════════════════════════════════════════════════
          LEFT COLUMN (2/3)
          ══════════════════════════════════════════════════ */}
      <div className="col-span-2 space-y-5">

        {/* AI Assistant */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <SectionLabel>AI Assistant</SectionLabel>
            <Sparkles className="w-3 h-3 text-purple-400 mb-3" />
          </div>

          <div className="flex gap-2 items-start">
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
              placeholder='Describe the test data you need in plain English… e.g. "25 UK patient records with NHS numbers, ICD-10 codes and prescriptions" or "API configs with AWS keys and database URLs"'
              rows={2}
              className="flex-1 bg-zinc-800 text-white text-sm px-3 py-2.5 rounded-lg border border-zinc-700 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex flex-col gap-2 shrink-0">
              <select
                value={aiRowCount}
                onChange={e => setAiRowCount(Number(e.target.value))}
                className="bg-zinc-800 text-zinc-300 text-xs px-2 py-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
              >
                {ROW_COUNT_AI_OPTIONS.map(n => (
                  <option key={n} value={n}>{n} rows</option>
                ))}
              </select>
              <button
                onClick={handleGenerate}
                disabled={aiLoading || !aiPrompt.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {aiLoading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                  : 'Generate Data'}
              </button>
            </div>
          </div>

          {aiError && <p className="mt-2 text-xs text-red-400">{aiError}</p>}
          <p className="mt-1.5 text-[10px] text-zinc-600">Tip: ⌘ + Enter to generate</p>
        </div>

        {/* Data Preview */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Data Preview</SectionLabel>
            {generatedData && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {generatedData.columns.length} cols
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-bold">
                  {generatedData.records.length} rows
                </span>
              </div>
            )}
          </div>

          {!generatedData ? (
            <div className="py-16 text-center">
              <p className="text-sm text-zinc-600 italic">Generate data above or pick a template →</p>
              <p className="text-xs text-zinc-700 mt-1">AI-generated or instant templates, your choice</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] text-zinc-500 mb-3 italic">{generatedData.description}</p>
              <div className="overflow-x-auto rounded-lg border border-zinc-700" style={{ maxHeight: '360px' }}>
                <table className="text-xs w-full">
                  <thead>
                    <tr className="sticky top-0 bg-zinc-800 z-10">
                      <th className="text-[9px] font-bold text-zinc-600 uppercase px-3 py-2 text-right w-8 border-r border-zinc-700">#</th>
                      {generatedData.columns.map(col => (
                        <th key={col} className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide px-3 py-2 text-left whitespace-nowrap border-r border-zinc-700 last:border-r-0">
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {generatedData.records.map((row, i) => (
                      <tr key={i} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="px-3 py-2 text-zinc-700 text-right tabular-nums text-[9px] border-r border-zinc-800">{i + 1}</td>
                        {generatedData.columns.map(col => (
                          <td key={col} className="px-3 py-2 font-mono text-zinc-300 whitespace-nowrap border-r border-zinc-800 last:border-r-0" title={row[col] ?? ''}>
                            {(row[col] ?? '').length > 28
                              ? (row[col] ?? '').slice(0, 28) + '…'
                              : (row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Download Bar */}
        {generatedData && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <SectionLabel>Download</SectionLabel>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 p-1 bg-zinc-800 rounded-lg">
                {FORMATS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setDownloadFormat(f.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                      downloadFormat === f.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download {downloadFormat.toUpperCase()}
              </button>
              <span className="text-[10px] text-zinc-600">
                {generatedData.records.length} records · {generatedData.columns.length} columns
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          RIGHT COLUMN (1/3)
          ══════════════════════════════════════════════════ */}
      <div className="col-span-1 space-y-5">

        {/* Quick Templates */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Quick Templates</SectionLabel>
          </div>

          {/* Template row count */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-zinc-500 shrink-0">Rows:</span>
            <select
              value={tplRowCount}
              onChange={e => setTplRowCount(Number(e.target.value))}
              className="flex-1 bg-zinc-800 text-zinc-300 text-xs px-2 py-1.5 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
            >
              {ROW_COUNT_TPL_OPTIONS.map(n => (
                <option key={n} value={n}>{n} rows</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search templates..."
              value={tplSearch}
              onChange={e => setTplSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1 mb-3">
            {TEMPLATE_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setTplCategory(cat)}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                  tplCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template grid */}
          <div className="grid grid-cols-2 gap-1 max-h-80 overflow-y-auto pr-0.5">
            {filteredTemplates.length === 0 ? (
              <p className="col-span-2 text-xs text-zinc-600 italic">No templates match</p>
            ) : (
              filteredTemplates.map(t => (
                <button
                  key={t.name}
                  onClick={() => handleTemplate(t)}
                  className="text-left rounded-lg border border-zinc-700 bg-zinc-800/60 p-2.5 hover:border-blue-500/50 hover:bg-zinc-700/60 transition-all group"
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', CATEGORY_COLORS[t.category]?.split(' ')[0])} />
                    <p className="text-[10px] font-semibold text-white group-hover:text-blue-300 transition-colors leading-tight truncate">
                      {t.name}
                    </p>
                  </div>
                  <p className="text-[9px] text-zinc-500 leading-tight line-clamp-2 pl-2.5">
                    {t.description}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Save Dataset */}
        {generatedData && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <SectionLabel>Save Dataset</SectionLabel>
            <div className="space-y-2">
              <input
                type="text"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="Dataset name *"
                maxLength={80}
                className="w-full bg-zinc-800 text-white text-sm px-3 py-2 rounded-lg border border-zinc-700 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={saveDescription}
                onChange={e => setSaveDescription(e.target.value)}
                placeholder="Description (optional)"
                maxLength={200}
                className="w-full bg-zinc-800 text-white text-sm px-3 py-2 rounded-lg border border-zinc-700 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim() || saveLoading}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saveLoading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                  : 'Save to Library'}
              </button>
              {saveSuccess && (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Saved successfully
                </p>
              )}
              {saveError && <p className="text-xs text-red-400">{saveError}</p>}
            </div>
          </div>
        )}

        {/* Saved Datasets */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <SectionLabel>Saved Datasets</SectionLabel>
          {savedDatasets.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No saved datasets yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {savedDatasets.map(ds => (
                <div
                  key={ds.id}
                  className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-3 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{ds.name}</p>
                      {ds.description && (
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{ds.description}</p>
                      )}
                      <p className="text-[10px] text-zinc-600 mt-1">
                        {new Date(ds.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(ds.id)}
                      title="Delete dataset"
                      className="p-1 text-zinc-600 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 font-mono">
                      {ds.row_count} rows
                    </span>
                    {ds.ai_generated && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 uppercase">
                        AI
                      </span>
                    )}
                    <button
                      onClick={() => handleLoad(ds)}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      Load →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
