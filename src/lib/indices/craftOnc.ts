// CRAFT Organisational & Network Capacity (CRAFT-ONC) · v1 (102026)
// Original CRAFT indicators for civil society organisations and the members of networks, written to work in any
// African country: each question asks about a function, and the country's own laws come from the laws register
// (ONC_LAW_AREAS below). Informed by public organisational capacity tools (NHOCAT domains, South Sudan NNGO CAT,
// NEAR OCA, Pact OCA, MSH OCAT, ActionAid OCAT, CGIAR ICAT, Caritas Management Standards, Global Fund CRSS); the
// crosswalk names their domains only. No third-party questions, items or scoring are reproduced.
import type { LawArea } from '../laws/types.ts'
import type { FoundationModule } from '../foundationModules.ts'
import { id, indicator, V1, V1_BANDS } from './shared.ts'

const C = 'ONC'

export const CRAFT_ONC: FoundationModule = {
  id: 'craft-onc',
  no: '18',
  version: V1,
  title: 'CRAFT Organisational & Network Capacity Index',
  question: 'Can this organisation run itself well, deliver for its communities, and work with others?',
  intro:
    'Forty-four indicators across governance, legal standing, strategy, finance, people, operations, monitoring and learning, service delivery, resource mobilisation, partnerships and exchange, and accountability to communities. Written for civil society organisations anywhere in Africa and for the members of networks; results also read across to the NHOCAT domains.',
  lensTitle: 'Capacity lenses',
  lensBlurb: 'Three views that funders, networks and governments most often ask about.',
  dimensions: [
    { key: 'governance', name: 'Governance & Leadership', question: 'Is the organisation steered by an active, independent governing body with clear leadership?' },
    { key: 'legal', name: 'Legal Standing & Accountability', question: 'Is the organisation properly registered, up to date with the authorities and open about itself?' },
    { key: 'strategy', name: 'Strategy & Programme Management', question: 'Does the organisation plan its work against a strategy and manage programmes to plan?' },
    { key: 'finance', name: 'Financial Management', question: 'Is money recorded, controlled, reported and audited so it can be trusted?' },
    { key: 'people', name: 'People & Human Resources', question: 'Are staff and volunteers recruited, paid, developed and protected properly?' },
    { key: 'operations', name: 'Procurement, Assets & Administration', question: 'Are purchases, assets and records managed for value and safety?' },
    { key: 'meal', name: 'Monitoring, Evaluation & Learning', question: 'Does the organisation collect reliable data and use it to improve?' },
    { key: 'delivery', name: 'Service Delivery & Technical Capacity', question: 'Does the organisation deliver services to a recognised standard with the right skills?' },
    { key: 'resources', name: 'Resource Mobilisation & Sustainability', question: 'Can the organisation raise and diversify the resources it needs to last?' },
    { key: 'partnerships', name: 'Partnerships, Networking & Exchange', question: 'Does the organisation work with government, networks and peers, and learn from them?' },
    { key: 'community', name: 'Community Voice, Safeguarding & Advocacy', question: 'Are communities protected, heard and able to hold the organisation and services to account?' },
  ],
  indicators: [
    // ---- Governance & Leadership ----
    indicator(C, 1, 'governance', 'Governing Body', 'Is there a governing body (board of trustees or equivalent) that meets regularly and makes the decisions reserved to it?',
      ['No governing body exists, or it exists only on paper.', 'A governing body is named but rarely meets.', 'It meets, but decisions are made by management and only noted.', 'It meets at least quarterly, with minutes, and approves budgets, plans and audited accounts.', 'Its decisions are followed up at the next meeting and it reviews the chief executive yearly.', 'It reviews its own performance and skills yearly and renews its membership on schedule.'],
      'Governing document, list of members, minutes of the last four meetings.', 'Agree which decisions only the governing body takes, and record each one in signed minutes.', 'Funders and partners trust organisations whose leaders are overseen by people who can say no.', 'policy', 8,
      'nhocat:GL nngo-cat:GOV near-oca:GL ci-ms:GO'),
    indicator(C, 2, 'governance', 'Separation of Roles', 'Are the roles of the governing body and of management written down and kept apart in practice?',
      ['No difference between governing body and management; the same people do both.', 'Roles are understood informally but not written.', 'Roles are written, but board members still run day-to-day operations.', 'Written roles are followed; staff do not sit on the governing body as voting members.', 'Delegated authority limits are written and checked against actual decisions.', 'Roles and delegations are reviewed yearly and any overlap is resolved openly.'],
      'Governing document or charter, delegation of authority schedule, board and staff lists.', 'Write a one-page delegation schedule: what the board decides, what management decides, and the money limits.', 'When the people who spend the money also oversee it, mistakes and misuse go unchecked.', 'policy', 6,
      'nhocat:GL ci-ms:GO near-oca:GL'),
    indicator(C, 3, 'governance', 'Conflicts of Interest', 'Do board members and senior staff declare conflicts of interest every year, and are conflicts managed when they arise?',
      ['No conflict of interest policy.', 'A policy exists but nobody declares.', 'Declarations are made once, on joining, and not renewed.', 'Yearly signed declarations from every board member and senior manager are on file.', 'Declared conflicts are recorded in minutes, with the person stepping out of the decision.', 'Conflicts are checked against contracts, hires and grants, and the register is reviewed by the board.'],
      'Conflict of interest policy, signed declarations for this year, minutes showing recusals.', 'Collect signed declarations every year and record in the minutes when someone steps out of a decision.', 'Undeclared interests are one of the first things a due diligence review looks for.', 'process', 4,
      'nhocat:GL ci-ms:LEC near-oca:GL'),
    indicator(C, 4, 'governance', 'Leadership & Succession', 'Could the organisation keep running if its founder or chief executive left suddenly?',
      ['Everything depends on one person; no one else can sign, decide or represent the organisation.', 'A deputy exists in name only.', 'Others can act, but key passwords, contacts and decisions sit with one person.', 'A named deputy can sign and decide; key systems have at least two administrators.', 'A written succession plan has been tested by a real absence of the chief executive.', 'Leadership is shared and developed; the board reviews the succession plan yearly.'],
      'Organisation chart, bank mandate showing signatories, succession plan, list of system administrators.', 'Name a deputy, add a second bank signatory and system administrator, and write a short succession plan.', 'Founder-dependent organisations are a common reason funders hold back larger grants.', 'people', 12,
      'nhocat:GL near-oca:GL nngo-cat:GOV'),

    // ---- Legal Standing & Accountability ----
    indicator(C, 5, 'legal', 'Registration', 'Is the organisation registered with the authority that registers non-profit organisations in each country where it works, with its registration current?',
      ['Not registered.', 'Registration has been applied for or has lapsed.', 'Registered, but annual returns or renewals are overdue.', 'Registration is current and annual returns are filed on time.', 'Registration covers every country and activity the organisation runs.', 'Filings are tracked on a calendar with a named owner and checked by the board yearly.'],
      'Registration certificate, latest annual return and its receipt, registration for each country of operation.', 'Put every filing date on a calendar with a named owner; bring overdue returns up to date first.', 'An organisation that is not properly registered cannot sign grants or open accounts in its own name.', 'process', 6,
      'nhocat:CA ci-ms:LEC nngo-cat:GOV'),
    indicator(C, 6, 'legal', 'Tax & Statutory Duties', 'Does the organisation meet its tax and statutory duties (tax registration, payroll deductions, pensions and social insurance) on time?',
      ['Not registered for tax or statutory deductions.', 'Registered, but deductions are not remitted.', 'Remitted, but often late or incomplete.', 'Remittances are on time, with receipts kept for each month.', 'A tax clearance or good-standing certificate is current where the country issues one.', 'Statutory duties are reviewed by an adviser yearly and any change in law is acted on.'],
      'Tax registration, payroll deduction remittance receipts for the last 12 months, any tax clearance certificate.', 'Remit every deduction monthly and file the receipt with the payroll for that month.', 'Unpaid statutory deductions become debts and penalties that can freeze the organisation\'s accounts.', 'process', 6,
      'nhocat:CA ci-ms:LEC near-oca:HR'),
    indicator(C, 7, 'legal', 'Anti-Fraud & Anti-Corruption', 'Does the organisation have and use rules against fraud, bribery and money laundering, including a way to report concerns safely?',
      ['No rules on fraud, bribery or money laundering.', 'A policy exists but staff have not seen it.', 'Staff have signed the policy but there is no safe way to report.', 'A reporting channel exists outside the line of management, and reports are logged.', 'Reports are investigated by someone independent and outcomes are reported to the board.', 'Partners and suppliers are checked against sanctions lists and the policy is refreshed with staff yearly.'],
      'Anti-fraud and anti-corruption policy, whistleblowing channel details, incident log, board reports.', 'Set up a reporting channel that does not go through the person being reported, and log every report.', 'Fraud found late costs far more than fraud found early, and funders ask how it would be found.', 'policy', 6,
      'nhocat:CA ci-ms:LEC near-oca:FM'),
    indicator(C, 8, 'legal', 'Public Accountability', 'Does the organisation publish who it is, what it does and how it is funded?',
      ['Nothing is published.', 'Only contact details are public.', 'Activities are published, but not funding or results.', 'An annual report with activities, results and a summary of income and spending is published.', 'Audited accounts or a funding breakdown are public, along with the governing body\'s names.', 'Information is shared in the languages communities use, and questions from the public are answered.'],
      'Website or annual report, published accounts, list of governing body members.', 'Publish a short annual report with results and a one-page summary of income and spending.', 'Openness about money and results is what turns a good reputation into lasting trust.', 'practice', 8,
      'nhocat:CA ci-ms:ST near-oca:ERS'),

    // ---- Strategy & Programme Management ----
    indicator(C, 9, 'strategy', 'Strategic Plan', 'Is there a current strategic plan with clear goals that the governing body approved?',
      ['No strategy; the organisation follows whatever funding is available.', 'A strategy exists but is out of date.', 'A current strategy exists, but goals are not measurable.', 'A board-approved plan for three to five years with measurable goals.', 'Projects are chosen and turned down according to the plan.', 'Progress against the plan is reviewed yearly with staff, communities and partners.'],
      'Strategic plan, board minutes approving it, latest progress review.', 'Agree three to five measurable goals with the board and say no to work outside them.', 'Organisations that follow only the money lose focus and struggle to show lasting results.', 'policy', 12,
      'nhocat:PMPM near-oca:PDM nngo-cat:PMF'),
    indicator(C, 10, 'strategy', 'Workplans & Budgets', 'Does each programme have a workplan, budget and results framework that staff use?',
      ['Programmes run without written plans.', 'Plans exist for some donor projects only.', 'Plans exist but are not updated or used to manage.', 'Every programme has a workplan, budget and results framework, reviewed monthly.', 'Delays and overspends are spotted early and corrected.', 'Plans are adjusted with communities and partners as evidence comes in.'],
      'Current workplans, budgets and results frameworks, monthly review notes.', 'Use one simple workplan template for every programme and review it monthly.', 'Plans that are used are how an organisation knows it is on track before a donor tells it.', 'process', 6,
      'nhocat:PMPM near-oca:PDM nngo-cat:PMF'),
    indicator(C, 11, 'strategy', 'Partner & Sub-grantee Management', 'Where the organisation passes funds to other organisations, does it assess, agree terms with and monitor them?',
      ['Funds are passed on without assessment or agreement.', 'Agreements exist, but partners are not assessed first.', 'Partners are assessed, but not monitored after funding.', 'Every partner is assessed before funding, has a signed agreement and reports regularly.', 'Partner reports are checked against evidence, including site visits.', 'Partners are supported to strengthen their capacity, and the organisation learns from them too.'],
      'Partner assessment tool, signed sub-grant agreements, monitoring reports and visit notes.', 'Assess every partner before funding and visit at least once during the grant.', 'An organisation is accountable for the money it passes on, and funders hold it to that.', 'process', 8,
      'nhocat:PMPM nngo-cat:PMF ci-ms:FA'),
    indicator(C, 12, 'strategy', 'Inclusion in Programme Design', 'Are gender, disability and the needs of the most marginalised built into how programmes are designed?',
      ['Not considered.', 'Mentioned in proposals only.', 'Some data is broken down by sex or age, but it doesn\'t change the design.', 'Programmes analyse who might be left out and design for them.', 'Results are reported by sex, age and disability and gaps are acted on.', 'Marginalised groups help design and review the programmes themselves.'],
      'Programme design documents, disaggregated data, notes from consultations.', 'Break results down by sex, age and disability and ask who is not being reached.', 'Programmes that miss the most marginalised miss the people who most need them.', 'practice', 8,
      'nngo-cat:PMF gf-css:CELC near-oca:PDM'),

    // ---- Financial Management ----
    indicator(C, 13, 'finance', 'Accounting System', 'Are all transactions recorded in an accounting system that can show income and spending by project and funder?',
      ['No books are kept, or only a cash book.', 'Books are kept by hand and not reconciled.', 'An accounting system is used but projects are mixed together.', 'An accounting system codes every transaction to a project and funder.', 'Reports by project can be produced on request, matching the ledger.', 'The system is backed up, access-controlled and reviewed by the auditor.'],
      'Chart of accounts, sample ledger by project, backup and access settings.', 'Set up project and funder codes in the chart of accounts and use them for every transaction.', 'Funders need to see their money separately; mixing it is the most common finding in grant reviews.', 'system', 8,
      'nhocat:FMS nngo-cat:FM near-oca:FM ci-ms:FA'),
    indicator(C, 14, 'finance', 'Internal Controls', 'Are financial duties split so no one person can request, approve, pay and record the same payment?',
      ['One person handles everything.', 'Two people are involved, but checks are not recorded.', 'Duties are split on paper, but often bypassed.', 'Request, approval, payment and recording are done by different people, with signatures.', 'Bank accounts need two signatories and reconciliations are reviewed monthly by a second person.', 'Controls are tested by internal or external review and gaps are closed.'],
      'Finance manual, segregation of duties chart, signed payment vouchers, bank mandate.', 'Write down who requests, approves, pays and records, and require two signatures on the bank account.', 'Split duties are the simplest protection against both error and fraud.', 'process', 6,
      'nhocat:FMS ci-ms:FA near-oca:FM'),
    indicator(C, 15, 'finance', 'Budget Monitoring & Reporting', 'Is spending compared to budget regularly, and are financial reports accurate and on time?',
      ['No budget, or it isn\'t compared to spending.', 'Compared only when a donor asks.', 'Compared quarterly, but variances are not explained.', 'Monthly budget against actual reports with explained variances go to management.', 'The governing body reviews financial reports at every meeting.', 'Forecasts are updated and decisions are taken before money runs short.'],
      'Budget against actual reports for three recent months, board finance reports.', 'Produce a monthly budget against actual report and explain any line more than 10% out.', 'Overspends found at the end of a grant are much harder to fix than ones found in month two.', 'process', 4,
      'nhocat:FMS nngo-cat:FM near-oca:FM'),
    indicator(C, 16, 'finance', 'Audit', 'Are annual accounts audited by a qualified independent auditor, and are the auditor\'s recommendations acted on?',
      ['Never audited.', 'Audited occasionally, or only for a donor project.', 'Audited yearly, but late or with recommendations ignored.', 'Audited yearly by a qualified independent auditor within six months of year end.', 'Management letter points are tracked and closed before the next audit.', 'Two or more years of clean audits, with the board meeting the auditor directly.'],
      'Audited accounts for the last two years, management letters, action tracker.', 'Book the audit early, and track every management letter point to closure.', 'An audit is the first document most funders ask for.', 'assurance', 12,
      'nhocat:FMS ci-ms:FA nngo-cat:FM'),

    // ---- People & Human Resources ----
    indicator(C, 17, 'people', 'HR Policies & Contracts', 'Do staff and volunteers have written contracts or agreements and an HR manual that is followed?',
      ['No contracts or HR policies.', 'Some staff have contracts; no manual.', 'A manual exists, but contracts and practice don\'t match it.', 'Every staff member and regular volunteer has a signed contract or agreement and job description.', 'Recruitment follows the manual, with open adverts and reference checks.', 'The manual is reviewed against labour law and staff feedback every two years.'],
      'HR manual, sample of signed contracts and job descriptions, recruitment files.', 'Give every staff member a signed contract and job description, and follow the manual for the next hire.', 'Clear contracts protect both the organisation and its people, and are required by labour law.', 'policy', 8,
      'nhocat:HRM near-oca:HR nngo-cat:OM'),
    indicator(C, 18, 'people', 'Payroll & Time Records', 'Is payroll processed properly, and do staff record their time by project?',
      ['Staff are paid in cash without records.', 'Payroll records exist but don\'t match bank payments.', 'Payroll matches payments, but time isn\'t recorded by project.', 'Monthly timesheets by project, approved by supervisors, support payroll charged to grants.', 'Payroll is paid by bank transfer and reconciled to timesheets and budgets.', 'Payroll is reviewed by someone other than the preparer, and charged time is checked against activity.'],
      'Payroll registers, approved timesheets, bank payment records.', 'Introduce monthly timesheets by project, approved by each supervisor.', 'Staff costs are usually the largest budget line, and donors check that they are charged correctly.', 'process', 4,
      'nhocat:HRM near-oca:HR ci-ms:FA'),
    indicator(C, 19, 'people', 'Performance & Development', 'Are staff appraised and developed against what their roles need?',
      ['No appraisals or training.', 'Training happens when donors fund it.', 'Appraisals happen irregularly.', 'Yearly appraisals with agreed goals and a development plan for each person.', 'Training is based on a skills gap analysis linked to the strategy.', 'Staff grow into leadership roles and the organisation keeps key people.'],
      'Appraisal records, training plan, skills gap analysis, staff turnover figures.', 'Hold a yearly appraisal for everyone and agree one development goal each.', 'Organisations that develop their people keep their skills when projects end.', 'people', 8,
      'nhocat:HRM near-oca:HR nngo-cat:OM'),
    indicator(C, 20, 'people', 'Staff Wellbeing & Safety', 'Are staff and volunteers protected from harassment and unsafe working conditions?',
      ['Not considered.', 'Expected informally, with nothing written.', 'A policy exists, but staff don\'t know how to raise concerns.', 'A code of conduct and anti-harassment policy are signed by all, with a safe way to report.', 'Field safety and security plans exist for risky locations, and incidents are logged.', 'Staff wellbeing is surveyed yearly and results lead to changes.'],
      'Code of conduct, anti-harassment policy, safety and security plan, incident log.', 'Have every staff member sign the code of conduct and tell them how to report safely.', 'People who feel safe do better work and stay longer.', 'policy', 6,
      'nhocat:HRM ci-ms:LEC near-oca:HR'),

    // ---- Procurement, Assets & Administration ----
    indicator(C, 21, 'operations', 'Procurement', 'Are purchases made under written rules that require competition above set amounts?',
      ['Anyone buys from anyone.', 'Rules exist but are not followed.', 'Quotes are collected sometimes, without records.', 'Written thresholds require quotes or tenders, and the records are kept.', 'A committee decides on large purchases, with scoring and minutes.', 'Suppliers are pre-qualified and checked against sanctions lists, and procurement is reviewed yearly.'],
      'Procurement policy with thresholds, sample purchase files with quotes, committee minutes.', 'Set clear thresholds (for example, three quotes above an agreed amount) and keep the quotes on file.', 'Transparent buying is how an organisation shows value for money.', 'process', 6,
      'nngo-cat:OM near-oca:GMA ci-ms:FA'),
    indicator(C, 22, 'operations', 'Assets', 'Is there a register of assets that is checked against what physically exists?',
      ['No register.', 'A partial list exists.', 'A register exists but isn\'t checked.', 'A register with location, funder and value for every asset, checked yearly.', 'Assets are tagged, insured where needed, and disposals are approved.', 'The register is reconciled to the accounts and assets bought with grants are tracked to the funder\'s rules.'],
      'Asset register, last physical check, insurance, disposal approvals.', 'List every asset with its funder and location, tag it, and check the list once a year.', 'Funders often own the assets their grants buy until the grant ends.', 'process', 4,
      'nngo-cat:OM near-oca:GMA'),
    indicator(C, 23, 'operations', 'Records & Data Protection', 'Are records kept securely, and is personal data protected under the country\'s data protection law?',
      ['Records are scattered and unprotected.', 'Records are kept but anyone can access them.', 'Access is restricted, but there is no backup or data protection policy.', 'Records are backed up, access is controlled and a data protection policy is followed.', 'Personal data is collected with consent and only kept as long as needed.', 'Data protection is reviewed yearly, staff are trained and any breach is reported as the law requires.'],
      'Filing and backup arrangements, access list, data protection policy, consent forms.', 'Back up records, limit access to those who need it, and get consent before collecting personal data.', 'Losing community members\' personal data can harm them and break the law.', 'system', 6,
      'near-oca:GMA nngo-cat:OM ci-ms:LEC'),
    indicator(C, 24, 'operations', 'Administration & Logistics', 'Are vehicles, travel, stores and office running costs controlled and recorded?',
      ['Nothing is recorded.', 'Some logs are kept.', 'Logs are kept but not reviewed.', 'Vehicle logbooks, travel authorisations and stock records are kept and reviewed monthly.', 'Running costs are compared with budgets and unusual use is followed up.', 'Administration is reviewed for efficiency and savings are put back into programmes.'],
      'Vehicle logbooks, travel authorisations, stock cards, monthly reviews.', 'Keep logbooks and stock cards and review them monthly.', 'Small running costs add up, and they are where controls are most often skipped.', 'process', 4,
      'nngo-cat:OM near-oca:GMA'),

    // ---- Monitoring, Evaluation & Learning ----
    indicator(C, 25, 'meal', 'M&E Plan', 'Is there a monitoring and evaluation plan with indicators, targets and named responsibilities?',
      ['No monitoring.', 'Activities are counted, without indicators.', 'Indicators exist for some projects.', 'An M&E plan with indicators, targets, data sources and responsibilities covers every programme.', 'Indicators are aligned with national or sector indicators where these exist.', 'Outcomes are evaluated independently from time to time.'],
      'M&E plan, indicator tracking table, evaluation reports.', 'Write a simple M&E plan per programme: indicator, target, source, who collects it, how often.', 'Without measurement, an organisation cannot show what changed because of its work.', 'process', 8,
      'nhocat:PMPM near-oca:PPM nngo-cat:PMF'),
    indicator(C, 26, 'meal', 'Data Quality', 'Is the data the organisation reports checked against its sources?',
      ['Never checked.', 'Checked only when errors are noticed.', 'Some checks, not documented.', 'Routine data quality checks compare reported figures with source registers.', 'Errors found are corrected and their causes fixed.', 'External data quality reviews confirm the figures.'],
      'Data quality check reports, source registers, correction logs.', 'Each quarter, pick a sample of reported figures and trace them back to the source registers.', 'Reported numbers that cannot be traced to source undermine every other result.', 'assurance', 6,
      'nhocat:PMPM near-oca:PPM'),
    indicator(C, 27, 'meal', 'Using Data to Decide', 'Does the organisation use its data to change what it does?',
      ['Data is collected for donors only.', 'Data is looked at in reports, not discussed.', 'Discussed at times, with no decisions recorded.', 'Data is reviewed in regular meetings and decisions are recorded.', 'Programme changes can be traced to what the data showed.', 'Communities see and discuss the data with the organisation.'],
      'Review meeting notes, examples of decisions changed by data.', 'Hold a short data review each quarter and record one decision that came from it.', 'Data that changes decisions is worth collecting; data that doesn\'t is a cost.', 'practice', 4,
      'nhocat:PMPM near-oca:PPM gf-css:CLM'),
    indicator(C, 28, 'meal', 'Learning & Knowledge Management', 'Does the organisation capture and share what it learns, so knowledge stays when people leave?',
      ['Nothing is documented.', 'Lessons are mentioned in reports only.', 'Some lessons documented, not shared.', 'Lessons, case studies and good practice are documented and stored where staff can find them.', 'Learning is shared with partners and networks and used in new proposals.', 'The organisation contributes evidence to its sector and national discussions.'],
      'Lessons learned documents, case studies, shared folders, presentations to networks.', 'After each project, write down three lessons and store them in a shared place.', 'Organisations that learn systematically improve faster than those that depend on memory.', 'practice', 6,
      'nhocat:PMPM near-oca:PPM gf-css:CLRA'),

    // ---- Service Delivery & Technical Capacity ----
    indicator(C, 29, 'delivery', 'Service Standards', 'Are services delivered according to written standards or national guidelines where these exist?',
      ['No standards.', 'Standards known informally.', 'Standards exist but aren\'t checked.', 'Written standards or national guidelines are followed and checked by supervisors.', 'Quality is assessed regularly and gaps are fixed.', 'Service users rate quality, and standards are updated with their input.'],
      'Service standards or guidelines in use, supervision checklists, quality assessments.', 'Adopt the national guideline for each service where one exists, and check against it during supervision.', 'Consistent quality is what makes a service worth funding at scale.', 'process', 8,
      'nhocat:SDTC near-oca:PDM'),
    indicator(C, 30, 'delivery', 'Technical Skills', 'Do the staff delivering services have the qualifications and skills their work requires?',
      ['Skills are not considered.', 'Some staff qualified; gaps not known.', 'Qualifications checked on hiring only.', 'Required qualifications and licences are verified and kept current.', 'Skills gaps are assessed and closed through training and mentoring.', 'Staff are recognised as experts and help train others.'],
      'Staff qualifications and licences, skills assessments, training records.', 'List the skills each service needs and check every staff member against the list.', 'Technical skills are what funders are buying when they fund a service.', 'people', 8,
      'nhocat:SDTC near-oca:HR'),
    indicator(C, 31, 'delivery', 'Referrals & Linkages', 'Are people referred to other services they need, and are referrals followed up?',
      ['No referrals.', 'Informal referrals only.', 'Referrals made but not tracked.', 'A referral directory and forms are used, and referrals are recorded.', 'Referrals are followed up to confirm the person received the service.', 'Referral pathways are agreed with government services and reviewed together.'],
      'Referral directory, referral forms and register, follow-up records.', 'Keep a referral register and follow up each referral within an agreed time.', 'People rarely need just one service; linkages decide whether they get the rest.', 'process', 6,
      'nhocat:SDTC gf-css:CELC'),
    indicator(C, 32, 'delivery', 'Supplies & Commodities', 'Where the organisation handles supplies or commodities, are stocks controlled to prevent stock-outs, expiry and loss?',
      ['Not controlled.', 'Stocks counted occasionally.', 'Stock cards kept but not reconciled.', 'Stock cards are reconciled monthly and expiry dates tracked.', 'Stock levels trigger orders before stock-outs occur.', 'Supply data is shared with the government or partner supply chain and used for planning.'],
      'Stock cards, monthly reconciliations, expiry tracking, order records.', 'Reconcile stock cards monthly and check expiry dates at the same time.', 'Stock-outs and expired supplies hurt the people relying on the service.', 'process', 4,
      'nhocat:SDTC near-oca:GMA'),

    // ---- Resource Mobilisation & Sustainability ----
    indicator(C, 33, 'resources', 'Resource Mobilisation Plan', 'Is there a plan for raising the resources the strategy needs?',
      ['No plan for raising resources.', 'Funding sought only when a call opens.', 'A list of possible funders, no plan.', 'A written plan with targets, funders to approach and responsibilities.', 'Progress against the plan is reviewed quarterly.', 'The plan is linked to the strategy and the board takes part in fundraising.'],
      'Resource mobilisation plan, funder pipeline, quarterly reviews.', 'Write a one-page plan: how much, from whom, by when, and who leads each approach.', 'Organisations that plan their funding spend less time in crisis.', 'policy', 8,
      'nhocat:RM nngo-cat:RMS near-oca:ERS'),
    indicator(C, 34, 'resources', 'Funding Diversity', 'How dependent is the organisation on its largest funder?',
      ['One funder provides almost everything.', 'One funder provides most of the income.', 'Two or three funders, but one still dominates.', 'No single funder provides more than about half the income.', 'Several funders of different types, including some local or non-grant income.', 'Diverse, stable income with a reserve covering several months of core costs.'],
      'Income by source for the last two years, reserves policy and balance.', 'Set a target for the largest funder\'s share and approach at least one new type of funder each year.', 'Losing one funder should be a setback, not the end of the organisation.', 'practice', 24,
      'nhocat:RM nngo-cat:RMS near-oca:ERS'),
    indicator(C, 35, 'resources', 'Proposal Development', 'Can the organisation write competitive proposals and track their success?',
      ['Proposals are written by outsiders or not at all.', 'Proposals written occasionally by one person.', 'Proposals written, but success isn\'t tracked.', 'A team writes proposals using templates and past evidence, and tracks results.', 'Win rate is reviewed and lessons improve the next proposal.', 'The organisation leads or co-leads consortium proposals.'],
      'Proposals submitted and won in the last two years, templates, tracker.', 'Keep a tracker of proposals submitted and won, and review it every six months.', 'Proposal skills inside the organisation are what make funding repeatable.', 'people', 8,
      'nhocat:RM nngo-cat:RMS'),
    indicator(C, 36, 'resources', 'Local Resources & Co-financing', 'Does the organisation raise local resources (community, private sector, government) alongside external grants?',
      ['No local resources are raised.', 'Occasional in-kind support.', 'Some local contributions, not recorded.', 'Local contributions and co-financing are recorded and valued.', 'Local income covers part of core costs.', 'Government or local partners co-finance programmes on a regular basis.'],
      'Records of community, private sector and government contributions, co-financing agreements.', 'Record and value every local contribution, including in-kind support.', 'Local resources are a sign of local ownership and survive changes in donor priorities.', 'practice', 12,
      'nhocat:RM nngo-cat:RMS gf-css:CELC'),

    // ---- Partnerships, Networking & Exchange ----
    indicator(C, 37, 'partnerships', 'Government & Sector Coordination', 'Does the organisation take part in government and sector coordination (technical working groups, forums, planning)?',
      ['Not involved.', 'Attends occasionally when invited.', 'Attends regularly but doesn\'t contribute.', 'Takes part regularly and shares its data and plans.', 'Its evidence shapes sector plans or decisions.', 'Holds a recognised role (for example, co-chair or civil society representative).'],
      'Meeting attendance records, presentations made, letters of recognition, memoranda of understanding with government.', 'Join the relevant working group, attend regularly and share one piece of data each quarter.', 'Coordination prevents duplication and gives civil society a voice in public plans.', 'practice', 6,
      'nhocat:PN near-oca:ERS gf-css:CELC'),
    indicator(C, 38, 'partnerships', 'Networks & Alliances', 'Is the organisation an active member of networks or alliances relevant to its work?',
      ['Not a member of any network.', 'A member in name only.', 'Attends network meetings.', 'Contributes to network activities and shares information.', 'Leads joint initiatives or working groups in the network.', 'Helps govern the network and strengthens other members.'],
      'Membership records, network activity reports, roles held.', 'Pick the one or two networks most relevant to your mission and take on an active role.', 'Networks multiply what any single organisation can achieve.', 'practice', 6,
      'nhocat:PN near-oca:ERS gf-css:CELC'),
    indicator(C, 39, 'partnerships', 'Peer Learning & Exchange', 'Does the organisation learn from peers through exchange visits, study tours, mentoring, communities of practice or conferences, and apply what it learns?',
      ['No exchange with peers.', 'Attends events occasionally without follow-up.', 'Takes part in exchanges, but lessons aren\'t written down or applied.', 'Takes part in planned exchanges linked to its capacity gaps, and records what it learned.', 'Changes to its practice can be traced to exchanges, and it hosts or mentors others in turn.', 'Exchange is a planned part of its development, shared through networks across countries.'],
      'Exchange or study tour reports, mentoring agreements, conference presentations, action plans after exchanges.', 'Link each exchange to a capacity gap from this assessment, and agree one change to make afterwards.', 'Learning from peers who faced the same problems is often faster and cheaper than outside training.', 'practice', 8,
      'nhocat:PN near-oca:ERS gf-css:CBLD'),
    indicator(C, 40, 'partnerships', 'Partnership Agreements', 'Are partnerships set out in written agreements with clear roles, and reviewed?',
      ['No agreements.', 'Verbal agreements only.', 'Some agreements, often expired.', 'Current written agreements (for example, memoranda of understanding) set out roles and responsibilities.', 'Partnerships are reviewed jointly and agreements renewed or closed.', 'Partners assess each other and use the results to work better together.'],
      'Current partnership agreements, joint review notes.', 'Put every active partnership into a short written agreement with a review date.', 'Clear roles prevent disputes and make joint work accountable.', 'policy', 4,
      'nhocat:PN ci-ms:ST near-oca:ERS'),

    // ---- Community Voice, Safeguarding & Advocacy ----
    indicator(C, 41, 'community', 'Safeguarding', 'Does the organisation protect children, vulnerable adults and communities from sexual exploitation, abuse and harassment by its staff and partners?',
      ['No safeguarding measures.', 'A policy exists, not known to staff.', 'Staff signed the policy, but there is no reporting route for communities.', 'A safeguarding policy, focal person, safer recruitment and a reporting route for communities are in place.', 'Concerns are handled with a survivor-centred approach and reported to the board.', 'Partners are held to the same standard and communities help design the reporting routes.'],
      'Safeguarding policy, focal person, training records, reporting route, case log (anonymised).', 'Name a safeguarding focal person, train staff, and tell communities how to report.', 'Harm by an organisation\'s own people destroys trust and can end its funding overnight.', 'policy', 8,
      'nhocat:CA ci-ms:LEC gf-css:CELC'),
    indicator(C, 42, 'community', 'Feedback & Complaints', 'Can the people the organisation serves give feedback and complain, and do they get a response?',
      ['No way to give feedback.', 'Feedback is welcome informally.', 'A channel exists, but responses aren\'t tracked.', 'Feedback and complaints channels are known to communities, with responses logged.', 'Feedback leads to changes that are reported back to communities.', 'Communities help review the organisation\'s performance.'],
      'Feedback and complaints channels, log with responses, examples of changes made.', 'Set up a feedback channel communities can use, log every comment and report back what changed.', 'Accountability to the people served is the core of civil society\'s legitimacy.', 'process', 6,
      'ci-ms:ST gf-css:CLM near-oca:ERS'),
    indicator(C, 43, 'community', 'Community-led Monitoring', 'Do communities themselves monitor the services that affect them, and is that evidence used?',
      ['Communities are not involved in monitoring.', 'Communities are consulted occasionally.', 'Community monitoring happens but findings go nowhere.', 'Communities collect data on service access and quality with the organisation\'s support.', 'Findings are shared with service providers and government and lead to fixes.', 'Community-led monitoring is a regular, independent part of the local system.'],
      'Community monitoring tools and reports, meetings where findings were shared, follow-up actions.', 'Support a community group to monitor one service and present its findings to the provider.', 'Communities see service problems first; their evidence makes services answer to them.', 'practice', 12,
      'gf-css:CLM gf-css:CELC'),
    indicator(C, 44, 'community', 'Evidence-based Advocacy', 'Does the organisation advocate for policy or budget change using evidence, and track the results?',
      ['No advocacy.', 'Advocacy based on opinion only.', 'Some evidence used, results not tracked.', 'An advocacy plan uses evidence (including community data) with clear asks.', 'Changes in policy, budgets or practice can be linked to its advocacy.', 'It leads coalitions and builds communities\' own advocacy capacity.'],
      'Advocacy plan, policy briefs, evidence used, record of results.', 'Pick one policy or budget ask, back it with evidence, and record what happened.', 'Evidence turns a complaint into a case that decision-makers can act on.', 'practice', 12,
      'gf-css:CLRA nhocat:PN'),
  ],
  bands: V1_BANDS([
    'Basic systems are missing; the organisation depends on individuals and cannot yet manage outside funds safely.',
    'Some systems exist, but they are incomplete or not followed; strengthen the weakest areas first.',
    'Core systems work and are followed, though some areas still need attention.',
    'Systems are well established and evidenced; the organisation can manage substantial funding and partnerships.',
    'Systems are mature, reviewed and improved; the organisation strengthens others and shapes its sector.',
  ]),
  weakestLinkFloor: 1.75,
  lenses: [
    { key: 'funds', name: 'Ready to manage funds', description: 'Could this organisation receive and account for a grant directly?', indicatorIds: [id(C, 5), id(C, 13), id(C, 14), id(C, 15), id(C, 16), id(C, 21)] },
    { key: 'deliver', name: 'Ready to deliver', description: 'Can it plan, deliver and show results to a standard?', indicatorIds: [id(C, 10), id(C, 25), id(C, 26), id(C, 29), id(C, 30)] },
    { key: 'accountable', name: 'Accountable and connected', description: 'Is it answerable to communities and working with others?', indicatorIds: [id(C, 8), id(C, 37), id(C, 39), id(C, 41), id(C, 42), id(C, 43)] },
  ],
  related: [
    { frameworkId: 'craft-fiduciary', label: 'Fiduciary Controls & Risk Management' },
    { frameworkId: 'craft-safeguards', label: 'Environmental & Social Safeguards' },
  ],
}

/** Laws-register areas behind each indicator: the country's own laws are shown next to the question. */
export const ONC_LAW_AREAS: Record<string, LawArea[]> = {
  [id(C, 5)]: ['company', 'licensing'],
  [id(C, 6)]: ['tax', 'labour'],
  [id(C, 7)]: ['integrity', 'sanctions'],
  [id(C, 13)]: ['financial'],
  [id(C, 16)]: ['financial'],
  [id(C, 17)]: ['labour'],
  [id(C, 18)]: ['labour', 'tax'],
  [id(C, 20)]: ['labour'],
  [id(C, 21)]: ['procurement', 'sanctions'],
  [id(C, 23)]: ['data'],
  [id(C, 1)]: ['governance', 'company'],
}

/** Four-level reading used by NHOCAT-family and ICAT tools, from a 0-5 CRAFT score. */
export const MATURITY_LEVELS = ['Latent', 'Emerging', 'Established', 'Advanced'] as const
export type MaturityLevel = (typeof MATURITY_LEVELS)[number]
export function maturityLevel(score: number): MaturityLevel {
  if (score < 1.75) return 'Latent'
  if (score < 2.75) return 'Emerging'
  if (score < 3.75) return 'Established'
  return 'Advanced'
}

/** CRAFT-ONC dimensions grouped under the eight NHOCAT domains (via each indicator's crosswalk). */
export function byNhocatDomain(scores: Record<string, number>): Array<{ domain: string; label: string; score: number | null; answered: number }> {
  const labels: Record<string, string> = {
    GL: 'Governance and leadership', HRM: 'Human resources management', FMS: 'Financial management and sustainability',
    PMPM: 'Programme management and performance monitoring', PN: 'Partnerships and networking', SDTC: 'Service delivery and technical capacity',
    RM: 'Resource mobilisation', CA: 'Compliance and accountability',
  }
  return Object.entries(labels).map(([domain, label]) => {
    const ids = CRAFT_ONC.indicators.filter((i) => (i.crosswalk ?? []).some((r) => r.framework === 'nhocat' && r.ref === domain)).map((i) => i.id)
    const vals = ids.map((x) => scores[x]).filter((v): v is number => v != null)
    return { domain, label, answered: vals.length, score: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null }
  })
}
