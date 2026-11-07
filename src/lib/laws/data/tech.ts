// Tech policy areas (AI, cybersecurity and cybercrime, electronic transactions, telecoms and online platforms), batch 1:
// Nigeria, the African Union, the EU, the UK and the US. Official sources where they exist. All pending review.
import type { LawEntry } from '../types.ts'
import { finalize } from './helpers.ts'

const CHECKED = '2026-11-07'
const e = (jurisdiction: string, area: LawEntry['area'], title: string, citation: string, regulator: string | null, summary: string, url: string, kind: 'official' | 'secondary' = 'official', extra: Partial<LawEntry> = {}): LawEntry =>
  ({ id: '', jurisdiction, area, title, citation, regulator, summary, source: { url, kind, checked: CHECKED }, review: 'pending', ...extra })

export const TECH_LAWS: LawEntry[] = finalize([
  // ---- Nigeria
  e('NG', 'ai', 'No AI-specific law; National Artificial Intelligence Strategy (draft, 2024)', 'NITDA / NCAIR, draft strategy, August 2024', 'National Information Technology Development Agency (NITDA)',
    'Nigeria has no AI-specific statute. The draft National AI Strategy sets direction on governance, skills and ethics. Personal data used in AI systems falls under the Nigeria Data Protection Act 2023.',
    'https://ncair.nitda.gov.ng/', 'official', { noLaw: true, reformNote: 'AI bills have been introduced in the National Assembly; check their status before relying on this entry.' }),
  e('NG', 'cyber', 'Cybercrimes (Prohibition, Prevention, etc.) Act, 2015 (as amended 2024)', 'Act of 2015; Cybercrimes (Prohibition, Prevention, etc.) (Amendment) Act, 2024', 'Office of the National Security Adviser (National Cybersecurity Coordination Centre)',
    'Defines cybercrimes, protects critical national information infrastructure, requires reporting of cyber incidents and attacks, and sets duties for service providers including data retention and cooperation with law enforcement.',
    'https://cert.gov.ng/'),
  e('NG', 'etransactions', 'Evidence Act, 2011 (electronic records and signatures)', 'Act No. 18 of 2011, ss. 84 and 93', null,
    'Admits computer-generated evidence and recognises electronic signatures. Nigeria has no general electronic transactions statute; NITDA guidelines apply to public bodies.',
    'https://nitda.gov.ng/', 'secondary', { reformNote: 'An electronic transactions / digital economy bill has been before the National Assembly; check its status.' }),
  e('NG', 'online', 'Nigerian Communications Act, 2003; Code of Practice for Interactive Computer Service Platforms (2022)', 'Act No. 19 of 2003; NITDA Code of Practice, 2022', 'Nigerian Communications Commission (NCC); NITDA',
    'The Act licenses and regulates communications services through the NCC. The NITDA Code of Practice sets duties for online platforms and intermediaries: local representation, takedown of unlawful content and user safety measures.',
    'https://www.ncc.gov.ng/'),
  // ---- African Union (continental instruments; apply where ratified or adopted)
  e('AU', 'ai', 'Continental Artificial Intelligence Strategy (2024)', 'Endorsed by the AU Executive Council, July 2024', 'African Union Commission',
    'A non-binding strategy guiding member states on AI governance, capability and responsible use. It is not a law; national measures implement it.', 'https://au.int/en/documents/20240809/continental-artificial-intelligence-strategy'),
  e('AU', 'cyber', 'African Union Convention on Cyber Security and Personal Data Protection (Malabo Convention), 2014', 'Adopted 27 June 2014; in force 8 June 2023', 'African Union Commission',
    'Commits ratifying states to cybersecurity measures and cybercrime offences, alongside personal data protection and electronic transactions. Binding only where ratified.', 'https://au.int/en/treaties/african-union-convention-cyber-security-and-personal-data-protection'),
  e('AU', 'etransactions', 'Malabo Convention, Chapter I: Electronic Transactions', 'Adopted 27 June 2014; in force 8 June 2023', 'African Union Commission',
    'Sets rules for electronic commerce, electronic contracts and electronic signatures in ratifying states.', 'https://au.int/en/treaties/african-union-convention-cyber-security-and-personal-data-protection'),
  e('AU', 'online', 'Digital Transformation Strategy for Africa (2020–2030)', 'Adopted 2020', 'African Union Commission',
    'A non-binding strategy on digital infrastructure, digital trade, online services and cross-border data, guiding national policy.', 'https://au.int/en/documents/20200518/digital-transformation-strategy-africa-2020-2030'),
  // ---- European Union
  e('EU', 'ai', 'Artificial Intelligence Act', 'Regulation (EU) 2024/1689', 'European AI Office; national market surveillance authorities',
    'Risk-based rules for AI systems: prohibited practices, obligations for high-risk systems and general-purpose AI models, and transparency duties. Obligations apply in stages from 2025.', 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj'),
  e('EU', 'cyber', 'NIS2 Directive', 'Directive (EU) 2022/2555', 'National competent authorities and CSIRTs',
    'Cybersecurity risk management and incident reporting duties for essential and important entities, with management accountability. Applies through national transposition.', 'https://eur-lex.europa.eu/eli/dir/2022/2555/oj'),
  e('EU', 'etransactions', 'eIDAS Regulation (as amended by eIDAS 2)', 'Regulation (EU) No 910/2014, amended by Regulation (EU) 2024/1183', 'National supervisory bodies',
    'Recognises electronic signatures, seals and trust services across the EU and introduces European Digital Identity Wallets.', 'https://eur-lex.europa.eu/eli/reg/2014/910/oj'),
  e('EU', 'online', 'Digital Services Act', 'Regulation (EU) 2022/2065', 'European Commission; national Digital Services Coordinators',
    'Duties for online intermediaries and platforms: notice and action, transparency, protection of minors, and extra obligations for very large platforms.', 'https://eur-lex.europa.eu/eli/reg/2022/2065/oj'),
  // ---- United Kingdom
  e('UK', 'ai', 'No AI-specific statute; pro-innovation regulatory approach', 'AI regulation white paper (2023) and government response (2024)', 'Existing sector regulators',
    'The UK regulates AI through existing law and regulators applying cross-sector principles, rather than a single AI statute. UK GDPR applies to personal data in AI systems.',
    'https://www.gov.uk/government/publications/ai-regulation-a-pro-innovation-approach', 'official', { noLaw: true }),
  e('UK', 'cyber', 'Network and Information Systems Regulations 2018; Computer Misuse Act 1990', 'SI 2018/506; 1990 c. 18', 'Sector competent authorities; Information Commissioner’s Office',
    'Security and incident reporting duties for operators of essential services and relevant digital service providers; offences for unauthorised access to computers.', 'https://www.legislation.gov.uk/uksi/2018/506',
    'official', { reformNote: 'The Cyber Security and Resilience Bill would expand these duties; check its status.' }),
  e('UK', 'etransactions', 'Electronic Communications Act 2000; UK eIDAS Regulations 2016', '2000 c. 7; SI 2016/696', 'Information Commissioner’s Office (trust services)',
    'Admits electronic signatures in evidence and governs trust services for electronic transactions.', 'https://www.legislation.gov.uk/ukpga/2000/7'),
  e('UK', 'online', 'Online Safety Act 2023', '2023 c. 50', 'Ofcom',
    'Duties for user-to-user and search services to tackle illegal content and protect children, with codes of practice enforced by Ofcom.', 'https://www.legislation.gov.uk/ukpga/2023/50'),
  // ---- United States
  e('US', 'ai', 'No comprehensive federal AI statute; NIST AI Risk Management Framework', 'NIST AI RMF 1.0 (2023); federal executive policy; state laws', 'Federal agencies within their remits; state regulators',
    'Federal AI governance relies on executive policy, agency guidance and the voluntary NIST framework. Several states have AI-specific laws, for example on automated decisions and transparency.',
    'https://www.nist.gov/itl/ai-risk-management-framework', 'official', { noLaw: true, reformNote: 'Federal AI policy and state AI laws change often; check current executive orders and state law where you operate.' }),
  e('US', 'cyber', 'Computer Fraud and Abuse Act; Cyber Incident Reporting for Critical Infrastructure Act 2022', '18 U.S.C. § 1030; CIRCIA (6 U.S.C. § 681 et seq.)', 'Department of Justice; CISA',
    'Federal offences for unauthorised computer access. CIRCIA requires covered critical infrastructure entities to report cyber incidents and ransom payments once its rules take effect.', 'https://www.govinfo.gov/app/details/USCODE-2023-title18/USCODE-2023-title18-partI-chap47-sec1030'),
  e('US', 'etransactions', 'Electronic Signatures in Global and National Commerce Act (E-SIGN)', '15 U.S.C. § 7001 et seq.', null,
    'Gives electronic signatures and records the same legal effect as paper in interstate commerce; most states also follow the Uniform Electronic Transactions Act.', 'https://www.law.cornell.edu/uscode/text/15/7001', 'secondary'),
  e('US', 'online', 'Communications Act § 230; Children’s Online Privacy Protection Act', '47 U.S.C. § 230; 15 U.S.C. § 6501 et seq.', 'Federal Communications Commission; Federal Trade Commission',
    'Section 230 shields online services from liability for most user content. COPPA sets consent and data duties for services directed at children under 13.', 'https://www.law.cornell.edu/uscode/text/47/230', 'secondary'),
])
