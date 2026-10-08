import { lazy, Suspense } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, Button, Badge } from '../components/ui'
import { getFramework } from '../lib/frameworks'
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react'

// Each framework's engine is its own chunk, loaded only when that framework is
// actually visited - otherwise every visitor to any single framework would
// download all nine panels (and every recharts variant they use) up front.
const OmtRubricRenderer = lazy(() => import('./OmtRubricRenderer').then(m => ({ default: m.OmtRubricRenderer })))
const GfFcrEngine = lazy(() => import('./GfFcrEngine').then(m => ({ default: m.GfFcrEngine })))
const G7AiEngine = lazy(() => import('./G7AiEngine').then(m => ({ default: m.G7AiEngine })))
const OecdAiWizard = lazy(() => import('./OecdAiWizard').then(m => ({ default: m.OecdAiWizard })))
const GfaDiagnosticPanel = lazy(() => import('./GfaDiagnosticPanel').then(m => ({ default: m.GfaDiagnosticPanel })))
const EsgAssessmentPanel = lazy(() => import('./EsgAssessmentPanel').then(m => ({ default: m.EsgAssessmentPanel })))
const CapitalReadinessPanel = lazy(() => import('./CapitalReadinessPanel').then(m => ({ default: m.CapitalReadinessPanel })))

function EngineLoading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-20 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading framework engine...
    </div>
  )
}

// The Dynamic Assessment Engine shell. The route supplies the frameworkId from
// the URL (/assessment/{frameworkId}); this component resolves the framework and
// renders its exact native methodology.
export function AssessmentFrameworkPage({ frameworkId }: { frameworkId: string }) {
  const meta = getFramework(frameworkId)

  if (!meta) {
    return (
      <div className="space-y-4">
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <h2 className="mt-3 font-display text-xl font-bold text-slate-900">Unknown framework</h2>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono">{frameworkId}</span> is not a registered assessment framework.
          </p>
          <Link to="/frameworks" className="mt-4 inline-block">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Back to frameworks</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/frameworks">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Frameworks</Button>
        </Link>
        <Badge className="bg-slate-100 text-slate-600 font-mono">{meta.id}</Badge>
        <Badge className="bg-emerald-100 text-emerald-700">{meta.authority}</Badge>
      </div>

      <Suspense fallback={<EngineLoading />}>
        {renderEngine(meta.id)}
      </Suspense>
    </div>
  )
}

function renderEngine(id: string) {
  switch (id) {
    case 'pact-omt-v6':
      return <OmtRubricRenderer frameworkId="pact-omt-v6" />
    case 'oca-opi':
      return <OmtRubricRenderer frameworkId="oca-opi" />
    case 'gf-pr-fcr':
      return <GfFcrEngine />
    case 'g7-ai-public-sector':
      return <G7AiEngine />
    case 'oecd-ai':
      return <OecdAiWizard />
    case 'gfa-diagnostic':
      return <GfaDiagnosticPanel />
    case 'esg-self-assessment':
      return <EsgAssessmentPanel />
    case 'capital-readiness-ladder':
      return <CapitalReadinessPanel />
    default:
      return null
  }
}
