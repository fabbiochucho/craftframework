import { useMemo, useState } from 'react'
import { FileText, Download, Printer, Scale, ShieldCheck } from 'lucide-react'
import { useWorkspace, useScoresCtx, useCIPCtx, useEntityProfileCtx } from '../lib/context'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import { esgMaturity, stageLabel } from '../lib/esgMaturity'
import {
  computeOrgScore, getAccreditation, getReadinessClassification,
} from '../lib/data'
import { planTimeline } from '../lib/moduleFindings'
import { PACE_LABEL } from '../lib/cipTimeline'
import { useModuleProfile } from '../lib/moduleProfile'
import {
  compositeVerifiedScore, evidenceCoveragePct, getEsgBadge, ratedAnswered, identifyGaps, ESG_QUESTIONS,
} from '../lib/esg'
import { REGULATORY_PILLARS, JurisdictionId } from '../lib/regulatory-context'
import { MaterialityLens, MATERIALITY_LABEL } from '../lib/issb'
import { assessContribution } from '../lib/ndc'
import { NDC_KEY, emptyNdcSettings, type NdcSettings } from '../components/NdcContributionCard'
import { jurisdictionName } from '../lib/laws/types'
import { buildNarrativeDocument, buildNarrativeHtml, NarrativeBlock, NarrativeOrgContext } from '../lib/narrative'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Table, Thead, Tbody, Th, Td } from '../components/ui'
import { cn } from '../lib/utils'

function Block({ block }: { block: NarrativeBlock }) {
  if (block.type === 'paragraph') return <p className="text-sm leading-relaxed text-slate-700">{block.text}</p>
  if (block.type === 'note') {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{block.text}</p>
    )
  }
  if (block.type === 'list') {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        {block.items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    )
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <Thead>
          <tr>{block.headers.map(h => <Th key={h}>{h}</Th>)}</tr>
        </Thead>
        <Tbody>
          {block.rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <Td key={j}>{cell}</Td>)}</tr>
          ))}
        </Tbody>
      </Table>
    </div>
  )
}

export function NarrativeReportPage() {
  const { currentOrg } = useWorkspace()
  const { scores, implementationEvidence } = useScoresCtx()
  const { timeline } = useCIPCtx()
  const { entityProfile } = useEntityProfileCtx()
  const [ndcSettings] = useLegacyAssessment<NdcSettings>(NDC_KEY, () => emptyNdcSettings(entityProfile.country))
  // The NDC section appears once the organisation has said how it contributes.
  const ndcContribution = useMemo(() => ndcSettings.types.length ? assessContribution(ndcSettings.country, ndcSettings) : null, [ndcSettings])
  const [esgScores] = useLegacyAssessment<Record<string, number>>('esg:scores', {})
  const [esgEvidence] = useLegacyAssessment<Record<string, number>>('esg:evidence', {})

  const [selectedJurisdictions, setSelectedJurisdictions] = useState<JurisdictionId[]>(
    entityProfile.jurisdictions.length ? entityProfile.jurisdictions : ['NG'],
  )
  const [lens, setLens] = useState<MaterialityLens>(selectedJurisdictions.includes('EU') ? 'double' : 'single')

  const toggleJurisdiction = (id: JurisdictionId) => {
    setSelectedJurisdictions(prev => prev.includes(id) ? prev.filter(j => j !== id) : [...prev, id])
  }

  const orgScores = currentOrg ? scores[currentOrg.id] || {} : {}
  const composite = computeOrgScore(orgScores)
  const accreditation = getAccreditation(composite, implementationEvidence)
  const readiness = getReadinessClassification(composite)

  const esgAnswered = Object.keys(esgScores).length
  const esgEvidenceCoverage = evidenceCoveragePct(esgEvidence)
  const esgVerified = compositeVerifiedScore(esgScores, esgEvidence)
  const esgBadge = getEsgBadge(esgVerified, ratedAnswered(esgScores), esgEvidenceCoverage)
  const esgGaps = useMemo(() => identifyGaps(esgScores), [esgScores])

  const [moduleProfile] = useModuleProfile()
  const cipPlan = useMemo(() => planTimeline(orgScores, moduleProfile, timeline, 2, esgScores), [orgScores, timeline, moduleProfile, esgScores])
  const cipFindings = cipPlan.actions
  const planMonths = Math.max(1, cipPlan.planMonths)

  const ctx: NarrativeOrgContext = {
    orgName: currentOrg?.name || '[Insert Organization Name]',
    archetype: entityProfile.archetype,
    country: entityProfile.country,
    businessSector: entityProfile.sector,
    jurisdictions: selectedJurisdictions,
    regSector: entityProfile.regSector,
    compositeScore: composite,
    accreditationLevel: accreditation.level,
    accreditationLabel: `${accreditation.label} (${readiness.label})`,
    implementationEvidence,
    planMonths,
    planPace: PACE_LABEL[timeline.pace],
    lens,
    esgBadge,
    esgVerifiedScore: esgVerified,
    esgAnswered,
    esgTotal: ESG_QUESTIONS.length,
    esgStage: stageLabel(esgMaturity(esgScores, esgEvidence)),
    esgGaps,
    cipFindings,
    scopeEmissions: { scope3State: 'not_tracked' },
    ndc: ndcContribution ? { contribution: ndcContribution, countryName: jurisdictionName(ndcSettings.country) } : undefined,
  }

  const doc = useMemo(() => buildNarrativeDocument(ctx), [
    ctx.orgName, ctx.archetype, ctx.country, ctx.businessSector, selectedJurisdictions.join(','),
    ctx.regSector, ctx.compositeScore, ctx.accreditationLevel, ctx.implementationEvidence, ctx.planMonths, ctx.planPace,
    // Depend on the lists themselves, not their lengths, so a changed gap or action is never shown stale.
    lens, ctx.esgVerifiedScore, ctx.esgAnswered, ctx.esgStage, esgGaps, cipFindings, ndcContribution,
  ])

  function download() {
    if (typeof window === 'undefined') return
    const html = buildNarrativeHtml(doc)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(currentOrg?.name || 'CRAFT-Narrative-Report').replace(/\s+/g, '-')}-${doc.sections[0] ? 'Implementation-Plan' : 'Report'}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function print() {
    if (typeof window === 'undefined') return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(buildNarrativeHtml(doc))
    w.document.close()
    w.focus()
    w.print()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
          <FileText className="h-4 w-4" /> Narrative Report Generator
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">
          Sustainability &amp; Regulatory Implementation Plan
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Assembles a submission-ready implementation-plan document from this entity's own CRAFT assessment data —
          ESG gaps, CIP findings and the statutory citations for the jurisdictions below — rather than a blank template.
        </p>
      </header>

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-5 py-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Regulator(s) / jurisdiction(s) to submit to
            </p>
            <div className="flex flex-wrap gap-2">
              {REGULATORY_PILLARS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleJurisdiction(p.id)}
                  aria-pressed={selectedJurisdictions.includes(p.id)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                    selectedJurisdictions.includes(p.id)
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                  )}
                >
                  {p.flag} {p.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Disclosure standard / lens</p>
            <div className="flex gap-2">
              {(['single', 'double'] as MaterialityLens[]).map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLens(l)}
                  aria-pressed={lens === l}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                    lens === l
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                  )}
                >
                  {MATERIALITY_LABEL[l]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Button onClick={download}><Download className="h-4 w-4" /> Download Document (.html)</Button>
            <Button variant="outline" onClick={print}><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Composite Score</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{composite}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accreditation</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{accreditation.level}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ESG Rating</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{esgBadge.letter}</p>
          <p className="mt-1 text-xs text-slate-600">{stageLabel(esgMaturity(esgScores, esgEvidence))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open Gaps</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{esgGaps.length + cipFindings.length}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-slate-900">{doc.docTitle}</h2>
            <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Scale className="mr-1 inline h-3 w-3" /> {doc.submittedTo}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Submitted to: {doc.submittedTo} · Date: {doc.dateOfSubmission} · Reporting entity: {doc.reportingEntity}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {doc.sections.map(section => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                {section.number}. {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.blocks.map((block, i) => <Block key={i} block={block} />)}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
