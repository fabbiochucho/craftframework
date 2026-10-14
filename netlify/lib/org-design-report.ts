// Organisational Analysis report (Word-compatible HTML) rendered from a CRAFT-OD review and its diagnosis.
// Finalised reviews render from their frozen snapshot, so the report matches what was approved.
import {
  CONFIGURATIONS, COORDINATING_MECHANISMS, DEAL_KENNEDY, DESIGN_PARAMETERS, FUNCTIONAL_UNITS, HANDY, LEARNING_OUTCOMES, METAPHORS, NINE_TESTS,
  RUBRIC_PASS, SECTIONS, TEST_RESULTS, optionLabel, sectionById, type Diagnosis, type OrgData,
} from '../../src/lib/org-design.js'

export interface OrgReportInput {
  title: string
  organisation: string
  country: string
  status: string
  preparedBy: string
  approvedBy: string | null
  approvedAt: string | null
  methodologyVersion: string
  data: OrgData
  diagnosis: Diagnosis
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? `<p>${esc(v.trim()).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>` : '<p><i>Not yet completed.</i></p>')
const words = (v: unknown) => (typeof v === 'string' ? v.split(/\s+/).filter(Boolean).length : 0)
const fieldOpts = (section: string, key: string) => sectionById(section)?.fields.find((f) => f.key === key)?.options ?? []
const pick = (section: string, key: string, data: OrgData) => optionLabel(fieldOpts(section, key), data[section]?.[key]) ?? '—'
const cfg = (id: string | null) => CONFIGURATIONS.find((c) => c.id === id)?.label ?? '—'
const filled = (obj: Record<string, unknown> | undefined) => !!obj && Object.values(obj).some((v) => v !== null && v !== '' && !(Array.isArray(v) && !v.length))

export function orgSectionWords(data: OrgData): { id: string; title: string; words: number; suggested: [number, number] | null }[] {
  return SECTIONS.map((s) => ({ id: s.id, title: s.title, suggested: s.suggestedWords ?? null, words: s.fields.reduce((a, f) => a + words(data[s.id]?.[f.key]), 0) }))
}

export function renderOrgDoc(r: OrgReportInput, generatedOn: string, meta: { reportId: string; author: string }): string {
  const d = r.diagnosis, data = r.data
  const intro = data.intro ?? {}, plan = data.planning ?? {}, env = data.environment ?? {}, st = data.structure ?? {}, cu = data.culture ?? {}, fn = data.functions ?? {}, sk = data.skills, lg = data.legal ?? {}, te = data.tests ?? {}
  const draft = r.status !== 'final'
  const timeline = Array.isArray(plan.timeline) ? (plan.timeline as Record<string, string>[]) : []
  const cfgRows = d.configuration.scores.map((s) => `<tr><td>${esc(s.label)}</td><td>${s.score ?? '—'}</td><td>${esc(CONFIGURATIONS.find((c) => c.id === s.id)?.coordination)}</td></tr>`).join('')
  const dpRows = DESIGN_PARAMETERS.map((p) => `<tr><td>${esc(p.label)}</td><td>${st[`dp_${p.id}`] ?? '—'}/5</td><td>${esc(st[`dp_${p.id}_note`] ?? '')}</td></tr>`).join('')
  const handyRows = d.culture.handy.scores.map((h) => `<tr><td>${esc(h.label)}</td><td>${h.score ?? '—'}</td></tr>`).join('')
  const units = FUNCTIONAL_UNITS.map((u, i) => `<h3>4.${i + 1} ${esc(u.label)}</h3>
<h4>Analysis of the function</h4>${txt(fn[`${u.id}_analysis`])}
<h4>Interface relations</h4>${txt(fn[`${u.id}_interface`])}
<p><b>Effectiveness:</b> ${fn[`${u.id}_effectiveness`] ?? '—'}/5 · <b>Efficiency:</b> ${fn[`${u.id}_efficiency`] ?? '—'}/5</p>
<h4>Problem areas</h4>${txt(fn[`${u.id}_problems`])}
<h4>Recommendations</h4>${txt(fn[`${u.id}_recommendations`])}`).join('')
  const testRows = NINE_TESTS.map((t) => `<tr><td>${esc(t.name)}</td><td>${t.group === 'fit' ? 'Fit' : 'Good design'}</td><td>${esc(optionLabel(TEST_RESULTS, te[`t_${t.id}`]) ?? 'Not assessed')}</td><td>${esc(te[`t_${t.id}_rationale`] ?? '')}</td><td>${esc(te[`t_${t.id}_action`] ?? '')}</td></tr>`).join('')
  const recs = [
    ...FUNCTIONAL_UNITS.filter((u) => typeof fn[`${u.id}_recommendations`] === 'string' && (fn[`${u.id}_recommendations`] as string).trim()).map((u) => `<li><b>${esc(u.label)}:</b> ${esc(fn[`${u.id}_recommendations`])}</li>`),
    ...NINE_TESTS.filter((t) => typeof te[`t_${t.id}_action`] === 'string' && (te[`t_${t.id}_action`] as string).trim()).map((t) => `<li><b>${esc(t.name)}:</b> ${esc(te[`t_${t.id}_action`])}</li>`),
  ].join('')
  const lengths = orgSectionWords(data).map((w) => `<tr><td>${esc(w.title)}</td><td>${w.words}</td><td>${w.suggested ? `${w.suggested[0]}–${w.suggested[1]}` : '—'}</td></tr>`).join('')
  const rubric = d.rubric.overall === null ? '<p>The report review rubric has not been completed.</p>'
    : `<table><tr><th>Learning outcome</th><th>Mark /100</th></tr>${d.rubric.byOutcome.map((o) => `<tr><td>${esc(o.outcome)} ${esc(LEARNING_OUTCOMES[o.outcome])}</td><td>${o.mark}</td></tr>`).join('')}</table>
<p><b>Overall ${d.rubric.overall}/100 — ${d.rubric.pass ? 'meets' : 'below'} the ${RUBRIC_PASS} pass mark</b> (self-review, not an examiner’s mark).</p>`

  return `<!doctype html><html><head><meta charset="utf-8"><title>Organisational Analysis — ${esc(r.organisation)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.4}table{border-collapse:collapse;width:100%;margin:6px 0}td,th{border:1px solid #999;padding:4px;vertical-align:top;text-align:left}th{background:#e8f5ee}h1{color:#064e3b}h2{color:#065f46;border-bottom:1px solid #ccc}.box{background:#f1f5f9;padding:8px;border-left:4px solid #059669}</style></head><body>
<h1>Organisational Analysis — ${esc(r.organisation)}${draft ? ' (DRAFT)' : ''}</h1>
<p><b>Review:</b> ${esc(r.title)}<br><b>Prepared by:</b> ${esc(r.preparedBy)}<br><b>Country:</b> ${esc(r.country || '—')}<br><b>Report ID:</b> ${esc(meta.reportId)}<br><b>Methodology:</b> ${esc(r.methodologyVersion)}<br>
<b>Generated:</b> ${esc(generatedOn)} by ${esc(meta.author)}${r.approvedBy ? `<br><b>Approved by:</b> ${esc(r.approvedBy)} on ${esc(r.approvedAt)}` : ''}</p>

<h2>Contents</h2><ol><li>Introduction</li><li>Planning</li><li>Organisational structure and culture</li><li>Functional units and interface relations</li><li>Development of critical skills</li><li>Business legal environment</li><li>Design evaluation: the nine tests</li><li>Diagnosis and recommendations</li></ol>

<h2>Summary diagnosis</h2>
<div class="box"><p><b>Structure:</b> ${esc(cfg(d.configuration.dominant))}${d.configuration.hybridWith ? ` (hybrid with ${esc(cfg(d.configuration.hybridWith))})` : ''}. Environment favours: ${esc(cfg(d.configuration.expected))} — <b>${d.configuration.fit === 'fits' ? 'fits' : d.configuration.fit === 'mismatch' ? 'mismatch' : 'not yet assessed'}</b>.<br>
<b>Culture:</b> ${esc(optionLabel(HANDY, d.culture.handy.dominant) ?? '—')}; ${esc(optionLabel(DEAL_KENNEDY, d.culture.dealKennedy.type) ?? '—')}; strength ${d.culture.strength ?? '—'}/5; metaphor: ${esc(optionLabel(METAPHORS, d.culture.metaphor) ?? '—')}.<br>
<b>Design evaluation:</b> ${esc(d.tests.verdict)}</p></div>

<h2>1. Introduction</h2>
<p><b>Role:</b> ${esc(intro.role ?? '—')} · <b>Sector:</b> ${esc(pick('intro', 'sector', data))} · <b>Size:</b> ${esc(pick('intro', 'size', data))} staff</p>
<h4>Nature and history</h4>${txt(intro.nature)}<h4>Products, services or mandate</h4>${txt(intro.offerings)}<h4>Definition of a functional unit</h4>${txt(intro.unitDefinition)}

<h2>2. Planning</h2>
<h4>Sources and people consulted</h4>${txt(plan.sources)}
<h4>Timeline</h4>${timeline.length ? `<table><tr><th>Activity</th><th>Start</th><th>End</th><th>Status</th></tr>${timeline.map((t) => `<tr><td>${esc(t.activity)}</td><td>${esc(t.start)}</td><td>${esc(t.end)}</td><td>${esc(t.status)}</td></tr>`).join('')}</table>` : '<p><i>No timeline recorded.</i></p>'}
<h4>Expected difficulties</h4>${txt(plan.difficulties)}<h4>Mitigation</h4>${txt(plan.mitigation)}<h4>Execution and adjustments</h4>${txt(plan.execution)}

<h2>3. Organisational structure and culture</h2>
<h3>3.1 Organisational structure</h3>
<h4>On Mintzberg’s definition of structure</h4>${txt(st.definitionView)}
<h4>Configuration</h4>
<table><tr><th>Configuration</th><th>Score (1–5)</th><th>Prime coordinating mechanism</th></tr>${cfgRows}</table>
<p>Dominant configuration: <b>${esc(cfg(d.configuration.dominant))}</b>. Reported prime coordinating mechanism: ${esc(optionLabel(COORDINATING_MECHANISMS, st.coordination) ?? '—')}.</p>
<p><b>Environment:</b> dynamism ${env.stability ?? '—'}/5, complexity ${env.complexity ?? '—'}/5, market diversity ${env.diversity ?? '—'}/5, hostility ${env.hostility ?? '—'}/5. ${esc(d.configuration.expectedReason)}</p>
<h4>Design parameters</h4><table><tr><th>Parameter</th><th>Use</th><th>Why used, and efficiency</th></tr>${dpRows}</table>
<h4>Efficiency and effectiveness of the structure</h4>${txt(st.effectiveness)}
<h3>3.2 Organisational culture</h3>
<p><b>Culture strength:</b> ${d.culture.strength ?? '—'}/5 (${d.culture.strong === null ? 'not rated' : d.culture.strong ? 'strong' : 'not strong'}).</p>
<h4>Should the culture be strong?</h4>${txt(cu.shouldBeStrong)}
<h4>Handy’s cultures</h4><table><tr><th>Culture</th><th>Score (1–5)</th></tr>${handyRows}</table>
<p>Current: <b>${esc(optionLabel(HANDY, d.culture.handy.dominant) ?? '—')}</b>; preferred: ${esc(optionLabel(HANDY, d.culture.handy.preferred) ?? '—')}.</p>
<h4>Deal and Kennedy</h4><p>Risk ${cu.dkRisk ?? '—'}/5, speed of feedback ${cu.dkFeedback ?? '—'}/5 → <b>${esc(optionLabel(DEAL_KENNEDY, d.culture.dealKennedy.type) ?? '—')}</b>; preferred: ${esc(optionLabel(DEAL_KENNEDY, d.culture.dealKennedy.preferred) ?? '—')}.</p>
<h4>Metaphor: ${esc(optionLabel(METAPHORS, cu.metaphor) ?? '—')}</h4>${txt(cu.metaphorNotes)}
<h4>Environmental factors affecting the culture</h4>${txt(env.factors)}<h4>Can management come to grips with them?</h4>${txt(cu.managementGrip)}

<h2>4. Functional units and interface relations</h2>${units}

<h2>5. Development of critical skills</h2>
${filled(sk) ? `<p><b>Motivation view:</b> ${sk!.theoryXY ?? '—'}/5 (1 = Theory X, 5 = Theory Y) · <b>Preferred style:</b> ${esc(pick('skills', 'leadershipStyle', data))} · <b>Style flexibility:</b> ${sk!.styleFlexibility ?? '—'}/5 · <b>Decision style:</b> ${esc(pick('skills', 'decisionStyle', data))}</p>
<h3>5.1 Management and leadership</h3>${txt(sk!.leadershipEvaluation)}${txt(sk!.leadershipPlan)}
<h3>5.2 Decision-making</h3>${txt(sk!.decisionPlan)}
<h3>5.3 Team building</h3>${txt(sk!.teamPlan)}<h4>Participation in decisions</h4>${txt(sk!.participation)}<h4>Acceptance of decisions</h4>${txt(sk!.acceptance)}` : '<p><i>Not included in this review (optional individual section).</i></p>'}

<h2>6. Business legal environment</h2>
<p><b>General terms of agreement:</b> ${esc(pick('legal', 'gta', data))} · <b>Legal identity:</b> ${esc(pick('legal', 'legalIdentity', data))}</p>
<h4>Strengths of the terms of agreement</h4>${txt(lg.gtaPositives)}<h4>Improvements or risks</h4>${txt(lg.gtaImprovements)}
<h4>Consumer protection</h4>${txt(lg.consumerProtection)}<h4>Legal identity and alternatives</h4>${txt(lg.legalAlternatives)}
<h4>Employment and discrimination</h4>${txt(lg.employmentLaw)}<h4>Proposed policies</h4>${txt(lg.employmentPolicies)}

<h2>7. Design evaluation: the nine tests</h2>
<p>Goold and Campbell’s four fit tests check that the design fits the strategy, the corporate centre, the people and the constraints; the five good-design tests check specialist cultures, difficult links, redundant hierarchy, accountability and flexibility.</p>
<table><tr><th>Test</th><th>Type</th><th>Result</th><th>Reasoning</th><th>Action</th></tr>${testRows}</table>
<p><b>Verdict:</b> ${esc(d.tests.verdict)}</p>

<h2>8. Diagnosis and recommendations</h2>
<h4>Findings</h4>${d.findings.length ? `<ul>${d.findings.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p>No findings yet.</p>'}
<h4>Recommended actions</h4>${recs ? `<ul>${recs}</ul>` : '<p><i>No recommendations recorded yet.</i></p>'}

<h2>Appendix A — Length check</h2><table><tr><th>Section</th><th>Words</th><th>Suggested</th></tr>${lengths}</table>
<h2>Appendix B — Report review rubric</h2>${rubric}
<h2>Appendix C — Method and limitations</h2>
<p>Configuration, culture and the structure–environment fit are derived from the analyst’s ratings using Mintzberg’s configurations and contingency factors, Handy’s cultures, Deal and Kennedy’s risk and feedback model and Morgan’s metaphors. The design evaluation uses Goold and Campbell’s nine tests. Results reflect the views of those who completed the review and the evidence they considered; they are an aid to judgement, not an audit, legal opinion or certification.</p>
</body></html>`
}
