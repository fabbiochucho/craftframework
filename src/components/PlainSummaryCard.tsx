import { Card, CardContent, CardHeader, CardTitle } from './ui'
import type { PlainSummary } from '../lib/plainSummary'

// "In plain words": where the organisation stands, its biggest gaps and where to start, for non-technical readers.
// Built from the organisation's own scores (src/lib/plainSummary.ts). Renders nothing until something is answered.
export function PlainSummaryCard({ summary, heading = 'In plain words' }: { summary: PlainSummary | null; heading?: string }) {
  if (!summary) return null
  return (
    <Card className="border-emerald-200 print:break-inside-avoid print:shadow-none">
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
        <p className="mt-1 text-sm text-slate-700">{summary.standing}</p>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-slate-700 md:grid-cols-2">
        {summary.gaps.length > 0 && (
          <div>
            <p className="font-medium text-slate-800">Your biggest gaps</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              {summary.gaps.map((g) => <li key={g.text}>{g.text} <span className="text-xs text-slate-500">({g.area})</span></li>)}
            </ol>
          </div>
        )}
        <div>
          <p className="font-medium text-slate-800">Where to start</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">{summary.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
      </CardContent>
    </Card>
  )
}
