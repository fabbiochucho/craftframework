import { useMemo, useState } from 'react'
import { Building2, Check, ChevronLeft, ChevronRight, Landmark, Loader2, Mail, Send, Users, Briefcase } from 'lucide-react'
import { Button, Input, Select } from './ui'
import { ARCHETYPES, type Archetype } from '../lib/data'
import { SECTORS_BY_ARCHETYPE } from '../lib/dataroom'
import { COUNTRIES } from '../lib/countries'
import { buildWelcomeEmailHtml } from '../lib/inviteEmail'
import { describeOrgType } from '../lib/orgType'
import { cn } from '../lib/utils'

// A short wizard for inviting an organisation that is not on CRAFT yet. Used everywhere an
// organisation can be invited by email (portfolio, admin portal, engagements, networks):
//   1 Type        CRAFT archetype, then sector and country (prefills the new workspace's profile)
//   2 Contact     organisation name, contact email and name
//   3 Purpose     what accepting does (set by the page) + optional portfolio + personal note
//   4 Review      a live preview of the exact email, then send
export type InviteWizardValues = {
  email: string
  orgName: string
  inviteeName: string
  message: string
  orgArchetype: Archetype | ''
  orgSector: string
  orgCountry: string
  portfolioId: string
  /** false = save as a draft to send later. */
  send: boolean
}

export type InviteWizardProps = {
  /** What accepting does, in plain words (shown in step 3 and in the email). */
  purpose: string
  /** Optional: let the inviter choose one of their portfolios to link (portfolio context). */
  portfolios?: Array<{ id: string; name: string }>
  /** For the email preview. */
  inviterName: string
  inviterEmail: string
  /** Offer "save as draft, send later" on the review step. */
  allowDraft?: boolean
  /** Prefill the personal note (e.g. an onboarding message). */
  defaultMessage?: string
  /** Send the invitation. Resolve with an error message to stay on the review step. */
  onSend: (values: InviteWizardValues) => Promise<{ ok: true } | { ok: false; error: string }>
  onClose?: () => void
}

const ICONS: Record<Archetype, typeof Landmark> = { Public: Landmark, 'Civil Society': Users, Private: Briefcase }
const STEPS = ['Type', 'Organisation', 'Purpose', 'Review'] as const
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function InviteOrganizationWizard({ purpose, portfolios, inviterName, inviterEmail, allowDraft, defaultMessage, onSend, onClose }: InviteWizardProps) {
  const [step, setStep] = useState(0)
  const [v, setV] = useState<InviteWizardValues>({
    email: '', orgName: '', inviteeName: '', message: defaultMessage ?? '', orgArchetype: '', orgSector: '', orgCountry: '',
    portfolioId: portfolios?.length === 1 ? portfolios[0].id : '', send: true,
  })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const set = (patch: Partial<InviteWizardValues>) => setV((x) => ({ ...x, ...patch }))

  const portfolioName = portfolios?.find((p) => p.id === v.portfolioId)?.name
  const fullPurpose = portfolioName ? `Adds you to the portfolio "${portfolioName}". ${purpose}` : purpose
  const typeLabel = describeOrgType({ archetype: v.orgArchetype, sector: v.orgSector, country: v.orgCountry })

  const canNext = [
    !!v.orgArchetype,
    v.orgName.trim().length >= 2 && EMAIL.test(v.email.trim()),
    !portfolios?.length || !!v.portfolioId,
    true,
  ][step]

  const preview = useMemo(() => buildWelcomeEmailHtml({
    name: v.inviteeName.trim(), email: v.email.trim() || 'contact@example.org', role: 'admin', scopeLabel: v.orgName,
    inviterName, inviterEmail, message: v.message.trim() || undefined, kind: 'organization', orgName: v.orgName.trim(),
    orgType: typeLabel || undefined, purpose: fullPurpose, expiresInDays: 14,
    siteUrl: typeof window === 'undefined' ? undefined : window.location.origin,
  }).html, [v, inviterName, inviterEmail, typeLabel, fullPurpose])

  async function send() {
    setSending(true)
    setError(null)
    const out = await onSend({ ...v, email: v.email.trim().toLowerCase(), orgName: v.orgName.trim(), inviteeName: v.inviteeName.trim(), message: v.message.trim() })
    setSending(false)
    if (out.ok) setSent(true)
    else setError(out.error)
  }

  if (sent) {
    return (
      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 text-center">
        <Check className="mx-auto h-8 w-8 text-emerald-600" />
        <p className="font-semibold text-emerald-900">{v.send ? `Invitation sent to ${v.email.trim()}` : `Draft saved for ${v.email.trim()}`}</p>
        <p className="text-sm text-slate-600">{v.send
          ? `${v.orgName.trim()} gets its own workspace when it accepts. The link is valid for 14 days.`
          : 'Nothing has been sent yet. Send it from "Invitations waiting to be sent" when you are ready; the 14 days start then.'}</p>
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { setV({ ...v, email: '', orgName: '', inviteeName: '', message: defaultMessage ?? '' }); setStep(0); setSent(false) }}>Invite another</Button>
          {onClose && <Button size="sm" onClick={onClose}>Done</Button>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-emerald-200 bg-white p-4">
      <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Invitation steps">
        {STEPS.map((label, i) => (
          <li key={label} className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 font-medium',
            i === step ? 'bg-emerald-600 text-white' : i < step ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500')}
            aria-current={i === step ? 'step' : undefined}>
            {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>} {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800">What type of organisation are you inviting?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {ARCHETYPES.map((a) => {
              const Icon = ICONS[a.id]
              const on = v.orgArchetype === a.id
              return (
                <button key={a.id} type="button" onClick={() => set({ orgArchetype: a.id, orgSector: on ? v.orgSector : '' })}
                  aria-pressed={on}
                  className={cn('rounded-xl border p-3 text-left transition-colors', on ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-300')}>
                  <Icon className="h-5 w-5 text-emerald-700" />
                  <p className="mt-1 text-sm font-semibold text-slate-900">{a.label}</p>
                  <p className="text-xs text-slate-500">{a.blurb}</p>
                </button>
              )
            })}
          </div>
          {v.orgArchetype && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Type (optional)" placeholder="Choose…" value={v.orgSector} onChange={(x) => set({ orgSector: x })}
                options={SECTORS_BY_ARCHETYPE[v.orgArchetype].map((s) => ({ value: s, label: s }))} />
              <Select label="Country (optional)" placeholder="Choose…" value={v.orgCountry} onChange={(x) => set({ orgCountry: x })}
                options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} />
            </div>
          )}
          <p className="text-xs text-slate-500">This tailors the invitation and prefills their profile. They can change it when they set up.</p>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Organisation name" placeholder="Riverbend Cooperative" value={v.orgName} onChange={(e) => set({ orgName: e.target.value })} />
          <Input label="Contact email" type="email" placeholder="director@riverbend.org" value={v.email} onChange={(e) => set({ email: e.target.value })} />
          <Input label="Contact name (optional)" placeholder="Amina Bello" value={v.inviteeName} onChange={(e) => set({ inviteeName: e.target.value })} />
          <p className="self-end text-xs text-slate-500">The contact creates the account and becomes the organisation's administrator.</p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {!!portfolios?.length && (
            <Select label="Add to portfolio" placeholder="Choose a portfolio" value={v.portfolioId} onChange={(x) => set({ portfolioId: x })}
              options={portfolios.map((p) => ({ value: p.id, label: p.name }))} />
          )}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What accepting does</p>
            <p className="mt-1">{fullPurpose}</p>
          </div>
          <div>
            <label htmlFor="invite-note" className="mb-1 block text-sm font-medium text-slate-700">Personal note (optional)</label>
            <textarea id="invite-note" rows={allowDraft ? 10 : 3} maxLength={4000} value={v.message} onChange={(e) => set({ message: e.target.value })}
              placeholder="Why you are inviting them, in a sentence or two."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            <p><span className="text-slate-500">To:</span> {v.inviteeName.trim() ? `${v.inviteeName.trim()} · ` : ''}{v.email.trim()}</p>
            <p><span className="text-slate-500">Organisation:</span> {v.orgName.trim()}</p>
            <p className="sm:col-span-2"><span className="text-slate-500">Type:</span> {typeLabel}</p>
          </div>
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"><Mail className="h-3.5 w-3.5" /> Email preview</p>
          <iframe title="Invitation email preview" srcDoc={preview} sandbox="" className="h-96 w-full rounded-lg border border-slate-200 bg-slate-900" />
          {allowDraft && (
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="sr-only">When to send</legend>
              <label className="flex items-center gap-2"><input type="radio" name="when" checked={v.send} onChange={() => set({ send: true })} className="accent-emerald-600" /> Send now</label>
              <label className="flex items-center gap-2"><input type="radio" name="when" checked={!v.send} onChange={() => set({ send: false })} className="accent-emerald-600" /> Save as draft, send later</label>
            </fieldset>
          )}
          {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div>
          {step > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setStep(step - 1)}><ChevronLeft className="h-4 w-4" /> Back</Button>
          ) : onClose ? (
            <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          ) : null}
        </div>
        {step < 3 ? (
          <Button size="sm" disabled={!canNext} onClick={() => setStep(step + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
        ) : (
          <Button size="sm" disabled={sending} onClick={send}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {v.send ? 'Send invitation' : 'Save draft'}
          </Button>
        )}
      </div>
    </div>
  )
}

/** A compact "Invite an organisation by email" toggle + wizard, for pages that already have a lot on them. */
export function InviteOrganizationCard(props: InviteWizardProps & { title?: string; blurb?: string }) {
  const [open, setOpen] = useState(false)
  return open ? (
    <InviteOrganizationWizard {...props} onClose={() => setOpen(false)} />
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-4">
      <div className="flex items-start gap-3">
        <Building2 className="mt-0.5 h-5 w-5 text-emerald-700" />
        <div>
          <p className="text-sm font-semibold text-slate-900">{props.title ?? 'Invite an organisation by email'}</p>
          <p className="text-xs text-slate-600">{props.blurb ?? 'For an organisation not on CRAFT yet. It gets its own secure workspace when it accepts.'}</p>
        </div>
      </div>
      <Button size="sm" onClick={() => setOpen(true)}><Mail className="h-4 w-4" /> Start invitation</Button>
    </div>
  )
}
