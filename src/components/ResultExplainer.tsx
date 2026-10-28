import { EXPLAINERS, type ExplainerId } from '../lib/explainers'

// "What does this mean?": a short plain-language explainer beside a result, for non-technical readers.
// Closed by default so it never gets in the way; the wording lives in src/lib/explainers.ts.
export function ResultExplainer({ id, className = '' }: { id: ExplainerId; className?: string }) {
  const e = EXPLAINERS[id]
  return (
    <details className={`rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-sm text-slate-700 ${className}`}>
      <summary className="cursor-pointer font-medium text-emerald-800">What does this mean?</summary>
      <div className="mt-2 space-y-2">
        <p>{e.shows}</p>
        <div>
          <p className="font-medium text-slate-800">How to read it</p>
          <ul className="list-disc space-y-0.5 pl-5">{e.read.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div>
          <p className="font-medium text-slate-800">What to do next</p>
          <ul className="list-disc space-y-0.5 pl-5">{e.next.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
    </details>
  )
}
