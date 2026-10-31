import { useNavigate } from '@tanstack/react-router'
import { Building2, Handshake, Network, ShieldCheck } from 'lucide-react'
import { START_PATH, saveStartChoice, type StartChoice } from '../lib/startChoice'

// Right after sign-up: one question that sends people down the path that fits them. Nothing here changes what an
// account can do later; anyone can come back and take another path.

const OPTIONS: Array<{ key: StartChoice; title: string; text: string; icon: typeof Building2 }> = [
  { key: 'organisation', title: 'My organisation wants to assess itself', text: 'Set up your organisation, run the self-assessments and get a plan and reports.', icon: Building2 },
  { key: 'validator', title: "I'm a validator or consultant", text: 'Create your directory profile, take the validator training and work on engagements.', icon: ShieldCheck },
  { key: 'funder', title: "I'm a funder or investor", text: 'Set up a cohort of the organisations you support and follow their readiness together.', icon: Handshake },
  { key: 'network', title: 'I coordinate a network', text: 'Set up your network, its levels and coordinators, and assess members together.', icon: Network },
]

export function StartPage() {
  const navigate = useNavigate()
  const go = (k: StartChoice) => {
    saveStartChoice(k)
    const [to, query] = START_PATH[k].split('?')
    navigate({ to, search: query ? Object.fromEntries(new URLSearchParams(query)) : undefined } as never)
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">What brings you to CRAFT?</h1>
        <p className="mt-1 text-slate-600">Choose the path that fits you best. You can take another path later; one account can do all of them.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(({ key, title, text, icon: Icon }) => (
          <button key={key} type="button" onClick={() => go(key)}
            className="flex h-full flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">
            <Icon className="h-6 w-6 text-emerald-700" aria-hidden />
            <span className="font-semibold text-slate-900">{title}</span>
            <span className="text-sm text-slate-600">{text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
