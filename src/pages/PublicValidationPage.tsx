import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../components/ui'
import { CONCERN_CATEGORIES, CONCERN_LABEL, type ConcernCategory } from '../lib/validationStatement'

// Validator system PR 6: the PUBLIC verification page (no sign-in, no list). Everything shown
// comes from /api/public/validation/:id, which never returns scores, evidence, validator
// comments or contact details.

type View = {
  verificationId: string; status: string; statusLabel: string; lastChangedAt: string
  organization: { name: string; country: string; registrationNumber: string | null }
  framework: { name: string; version: string }; scope: string; label: string; statement: string
  outcome: string; outcomeLabel: string; validatedRung: number; rungName: string; confirmedLevels: Array<{ level: number; name: string; achieved: boolean }> | null
  indexResults?: Array<{ name: string; version: string; band: string | null }> | null
  validators: Array<{ name: string; role: string; accreditation: string; credentials: Array<{ body: string; number: string; status: string }> }>
  firm: string | null; validatorType: string; engagedBy: string
  independence: { statement: string; declarations: Array<{ name: string; version: string; signedAt: string }>; disclosure: string }
  method: string; fieldwork: { start: string | null; end: string | null }; issuedAt: string; expiresAt: string; validityMonths: number
  nextVerificationPoint: string | null; wording: { means: string; doesNot: string; changes: string }
  rungHistory?: Array<{ rung: number; issuedAt: string; status: string }>; qualifications?: string[]; devmapperUrl?: string
  pdf: null | { sha256: string; url: string }
}

const STATUS_STYLE: Record<string, string> = {
  current: 'bg-emerald-100 text-emerald-800', follow_up_overdue: 'bg-amber-100 text-amber-800', suspended: 'bg-rose-100 text-rose-800',
  expired: 'bg-slate-200 text-slate-700', withdrawn: 'bg-rose-100 text-rose-800', superseded: 'bg-slate-200 text-slate-700',
}
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—')

export function ValidationLookupPage() {
  const [id, setId] = useState('')
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-12">
      <h1 className="font-display text-3xl font-bold text-emerald-900">Verify a CRAFT validation</h1>
      <p className="text-sm text-slate-600">Enter the verification ID printed on the statement (it looks like CRAFT-V-XXXXXXXX), or scan the QR code on the statement. There is no public list of validations.</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (id.trim()) window.location.assign(`/validation/${encodeURIComponent(id.trim())}`) }}>
        <div className="min-w-[14rem] flex-1"><Input label="Verification ID" value={id} onChange={(e) => setId(e.target.value)} placeholder="CRAFT-V-XXXXXXXX" /></div>
        <Button type="submit">Check</Button>
      </form>
    </div>
  )
}

export function PublicValidationPage({ verificationId }: { verificationId: string }) {
  const [v, setV] = useState<View | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    void fetch(`/api/public/validation/${encodeURIComponent(verificationId)}`, { cache: 'no-store' }).then(async (r) => {
      const body = await r.json().catch(() => null)
      if (!r.ok) throw new Error(r.status === 404 ? 'No validation was found with that ID. Check the ID on the statement.' : body?.error || 'Verification is temporarily unavailable.')
      setV(body)
    }).catch((e) => setError(e.message))
  }, [verificationId])
  if (error) return <div className="mx-auto max-w-2xl px-4 py-12"><p role="alert" className="text-rose-700">{error}</p></div>
  if (!v) return <div className="mx-auto max-w-2xl px-4 py-12"><p className="text-sm text-slate-500">Checking…</p></div>
  const tone = v.status === 'current' ? 'border-emerald-300' : 'border-amber-300'
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Card className={tone}>
        <CardHeader>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> CRAFT validation verification</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-emerald-900">{v.verificationId}</h1>
            <Badge className={`text-sm ${STATUS_STYLE[v.status] ?? ''}`}>{v.statusLabel}</Badge>
          </div>
          <p className="text-sm text-slate-500">Status last changed {fmt(v.lastChangedAt)}. This page is the source of truth: a copy of the statement is only reliable while this shows Current.</p>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-700">
          <p className="text-base font-semibold text-slate-900">{v.organization.name}{v.organization.country ? `, ${v.organization.country}` : ''}</p>
          <p>Registration number: {v.organization.registrationNumber ?? 'not provided'}</p>
          <p>{v.label}: <strong>{v.outcomeLabel}</strong>, {v.confirmedLevels ? `levels confirmed: ${v.confirmedLevels.filter((l) => l.achieved).map((l) => `${l.level} (${l.name})`).join(', ') || 'none'}; no rung (partial scope)` : `rung ${v.validatedRung} (${v.rungName})`}</p>
          <p>{v.statement}</p>
        </CardContent>
      </Card>

      <Section title="The review">
        <Row k="Framework" v={`${v.framework.name} (${v.framework.version})`} />
        <Row k="Scope" v={v.scope} />
        <Row k="Method" v={v.method} />
        <Row k="Fieldwork" v={`${fmt(v.fieldwork.start)} to ${fmt(v.fieldwork.end)}`} />
        <Row k="Issued" v={fmt(v.issuedAt)} />
        <Row k={v.status === 'expired' ? 'Expired' : 'Expires'} v={`${fmt(v.expiresAt)} (${v.validityMonths}-month validity)`} />
        <Row k="Next verification point" v={v.nextVerificationPoint ? fmt(v.nextVerificationPoint) : 'None scheduled'} />
        {v.indexResults && v.indexResults.length > 0 && (
          <Row k={`CRAFT index results (${[...new Set(v.indexResults.map((r) => r.version))].join(', ')})`} v={v.indexResults.map((r) => `${r.name}: ${r.band ?? 'no band'}`).join('; ')} />
        )}
        {v.qualifications && <Row k="Qualifications" v={v.qualifications.length ? v.qualifications.join('; ') : 'None'} />}
        {v.rungHistory && <Row k="Rung history" v={v.rungHistory.map((r) => `rung ${r.rung} (${fmt(r.issuedAt)}, ${r.status})`).join(' → ')} />}
        {v.devmapperUrl && <Row k="DevMapper" v={<a className="text-emerald-700 underline" href={v.devmapperUrl} rel="noopener noreferrer nofollow">{v.devmapperUrl}</a>} />}
      </Section>

      <Section title="Who did it">
        {v.validators.map((p) => (
          <Row key={p.name} k={p.role} v={<span>{p.name} <Badge variant="outline" className="ml-1 text-slate-600">{p.accreditation}</Badge>{p.credentials.length > 0 && <span className="block text-xs text-slate-500">{p.credentials.map((c) => `${c.body} ${c.number} (${c.status})`).join('; ')}</span>}</span>} />
        ))}
        <Row k="Firm" v={v.firm ?? 'None (works independently)'} />
        <Row k="Validator type" v={v.validatorType} />
        <Row k="Engaged by" v={v.engagedBy} />
        <Row k="Independence" v={v.independence.statement} />
        <Row k="Disclosure" v={v.independence.disclosure} />
        {v.independence.declarations.length > 0 && <Row k="Declarations" v={v.independence.declarations.map((d) => `${d.name} (${d.version}, ${fmt(d.signedAt)})`).join('; ')} />}
      </Section>

      <Section title="What this validation means">
        <p className="text-sm text-slate-700">{v.wording.means}</p>
        <h3 className="pt-2 text-sm font-semibold text-slate-800">What it does not mean</h3>
        <p className="text-sm text-slate-700">{v.wording.doesNot}</p>
        <h3 className="pt-2 text-sm font-semibold text-slate-800">Its status can change</h3>
        <p className="text-sm text-slate-700">{v.wording.changes}</p>
      </Section>

      {v.pdf && (
        <Section title="Statement PDF">
          <a className="text-sm font-semibold text-emerald-700 underline" href={v.pdf.url}>Download the statement (PDF)</a>
          <p className="break-all pt-1 font-mono text-xs text-slate-500">SHA-256: {v.pdf.sha256}</p>
          <p className="text-xs text-slate-500">Compute the SHA-256 of your copy and compare it with this value to check the document is the one issued.</p>
        </Section>
      )}
      <Concern verificationId={v.verificationId} />
    </div>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-2">{children}</CardContent></Card>
)
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="grid gap-1 text-sm sm:grid-cols-[11rem_1fr]"><span className="font-medium text-slate-500">{k}</span><span className="text-slate-800">{v}</span></div>
)

function Concern({ verificationId }: { verificationId: string }) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ConcernCategory>('inaccurate')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <Card>
      <CardHeader><CardTitle>Report a concern</CardTitle><p className="text-sm text-slate-500">If something about this validation looks wrong, tell the CRAFT programme team. Your details are optional and are never shown publicly.</p></CardHeader>
      <CardContent className="space-y-3">
        {!open ? <Button variant="outline" onClick={() => setOpen(true)}>Report a concern</Button> : (
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault()
            const r = await fetch(`/api/public/validation/${encodeURIComponent(verificationId)}/concern`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category, message, name, email, website }) })
            const body = await r.json().catch(() => null)
            setMsg(r.ok ? { ok: true, text: 'Thank you. Your concern has been sent to the CRAFT programme team.' } : { ok: false, text: body?.error || 'Could not send your concern.' })
            if (r.ok) setMessage('')
          }}>
            <Select label="What is it about?" options={CONCERN_CATEGORIES.map((c) => ({ value: c, label: CONCERN_LABEL[c] }))} value={category} onChange={(v) => setCategory(v as ConcernCategory)} />
            <label className="block text-sm font-medium text-slate-700">Describe your concern
              <textarea required minLength={10} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2"><Input label="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} /><Input label="Your email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div aria-hidden="true" className="absolute -left-[9999px]"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label></div>
            <Button type="submit" disabled={message.trim().length < 10}>Send</Button>
          </form>
        )}
        {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
      </CardContent>
    </Card>
  )
}
