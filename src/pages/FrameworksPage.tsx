import { Link } from '@tanstack/react-router'
import { Card, Badge, Reveal } from '../components/ui'
import { FRAMEWORKS } from '../lib/frameworks'
import {
  Network, Banknote, Cpu, ShieldCheck, TrendingUp, ArrowRight, Layers, Radar, Leaf, Mountain,
} from 'lucide-react'

// Icon resolver for the framework registry's `icon` field.
const ICONS: Record<string, typeof Network> = {
  Network, Radar, Banknote, Cpu, ShieldCheck, TrendingUp, Leaf, Mountain,
}

const THEME: Record<string, { ring: string; chip: string; icon: string }> = {
  emerald: { ring: 'hover:border-emerald-400', chip: 'bg-emerald-100 text-emerald-700', icon: 'bg-emerald-500/10 text-emerald-600' },
  indigo: { ring: 'hover:border-indigo-400', chip: 'bg-indigo-100 text-indigo-700', icon: 'bg-indigo-500/10 text-indigo-600' },
  amber: { ring: 'hover:border-amber-400', chip: 'bg-amber-100 text-amber-700', icon: 'bg-amber-500/10 text-amber-600' },
  slate: { ring: 'hover:border-slate-400', chip: 'bg-slate-100 text-slate-700', icon: 'bg-slate-500/10 text-slate-600' },
}

const SCALE_LABEL: Record<string, string> = {
  'omt-1-4': '4-level Statements of Excellence',
  'oca-1-4': '1–4 Maturity Scale',
  'fiduciary-0-5': '0–5 Fiduciary Scale',
}

// The Dynamic Assessment Engine entry point: pick a world-leading framework and
// the engine renders its exact methodology at /assessment/{frameworkId}.
export function FrameworksPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Layers className="h-5 w-5 text-emerald-600" />
          <Badge className="bg-emerald-100 text-emerald-700">Dynamic Assessment Engine · ICARF v4.0</Badge>
        </div>
        <h1 className="font-display text-3xl font-bold text-slate-900">Assessment Frameworks</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          CRAFT renders each framework using its exact, native methodology - from Pact's
          Statements of Excellence to the Global Fund's financial reporting tabs and the
          G7/OECD AI governance matrix. Select a framework to launch its engine.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {FRAMEWORKS.map((f, i) => {
          const Icon = ICONS[f.icon] ?? Network
          const t = THEME[f.theme] ?? THEME.emerald
          return (
            <Reveal key={f.id} delay={i * 60}>
              <Link to="/assessment/$frameworkId" params={{ frameworkId: f.id }} className="block h-full">
                <Card className={`group flex h-full flex-col border-2 border-transparent p-5 transition-all hover:shadow-md ${t.ring}`}>
                  <div className="flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${t.icon}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${t.chip}`}>
                      {SCALE_LABEL[f.scale]}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold leading-tight text-slate-900">{f.name}</h3>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{f.authority}</p>
                  <p className="mt-2 flex-1 text-sm text-slate-600">{f.blurb}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 group-hover:gap-2.5">
                    Launch engine <ArrowRight className="h-4 w-4 transition-all" />
                  </span>
                </Card>
              </Link>
            </Reveal>
          )
        })}
      </div>
    </div>
  )
}
