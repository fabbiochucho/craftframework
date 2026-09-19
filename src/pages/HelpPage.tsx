import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { HelpCircle, Search, BookOpen, ArrowRight } from 'lucide-react'
import { FAQS, GLOSSARY } from '../lib/data'
import { Card, CardContent, CardHeader, CardTitle, Input, Accordion, Button } from '../components/ui'

export function HelpPage() {
  const [query, setQuery] = useState('')

  const faqs = useMemo(
    () => FAQS.filter(f => !query || (f.q + f.a).toLowerCase().includes(query.toLowerCase())),
    [query],
  )
  const glossary = useMemo(
    () => GLOSSARY.filter(g => !query || (g.term + g.def).toLowerCase().includes(query.toLowerCase())),
    [query],
  )

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
          <HelpCircle className="h-4 w-4 text-emerald-600" /> Support
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Help &amp; Glossary</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Answers for every organizational archetype - Public Sector, Civil Society and Private Sector -
          and every access level, from Organization Assessor to Portfolio Reviewer and Administrator.
        </p>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Search FAQs and platform terms…" value={query} onChange={e => setQuery(e.target.value)} className="pl-9" />
      </div>

      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-emerald-900">New here? Read the interactive User Guide</p>
              <p className="mt-0.5 text-sm text-slate-600">
                A step-by-step walkthrough of the whole platform - filter it to your role, track your progress, and download it to read offline.
              </p>
            </div>
          </div>
          <Link to="/guide" className="shrink-0">
            <Button size="sm" className="w-full justify-center sm:w-auto">
              Open User Guide <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Frequently Asked Questions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {faqs.length === 0 && <p className="text-sm text-slate-400">No matching questions.</p>}
            {faqs.map(f => (
              <Accordion key={f.q} title={f.q}>{f.a}</Accordion>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-emerald-600" /> Glossary of Platform &amp; Donor Terms</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {glossary.length === 0 && <p className="text-sm text-slate-400">No matching terms.</p>}
            {glossary.map(g => (
              <div key={g.term} className="rounded-lg border border-slate-100 p-3">
                <p className="text-sm font-bold text-slate-800">{g.term}</p>
                <p className="mt-0.5 text-sm text-slate-600">{g.def}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
