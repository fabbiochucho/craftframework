import { useCallback, useEffect, useRef, useState } from 'react'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import { LegacySaveStatus, type SaveStatus } from '../lib/legacy-state'
import { useNavigate, Link } from '@tanstack/react-router'
import {
  Building2, Target, Users, UploadCloud, Wand2, ArrowRight, ArrowLeft,
  Check, Plus, X,
} from 'lucide-react'
import { Button, Input, Select, Stepper } from '../components/ui'
import { Footer } from '../components/Footer'
import { Logo } from '../components/Logo'
import { ExcelImport } from '../components/ExcelImport'
import { useAuthCtx, useTeamCtx, useEntityProfileCtx } from '../lib/context'
import { BRAND, DONOR_FRAMEWORKS, ARCHETYPES, Archetype } from '../lib/data'
import { ONBOARDING_STEPS } from '../lib/onboardingProgress'
import { saveOnboardingProgress } from '../lib/api'
import {
  EMPTY_ONBOARDING_DRAFT, ONBOARDING_DRAFT_DEBOUNCE_MS, ONBOARDING_DRAFT_KEY, furthestStep, mergeDraft, restoreDraft,
  step1Complete, stepFromSearch, type OnboardingDraft,
} from '../lib/onboardingDraft'
import { COUNTRIES, SECTORS_BY_ARCHETYPE, subsectorsForSector } from '../lib/dataroom'

const STEPS = [...ONBOARDING_STEPS]

// One small, polite live region for everything the wizard saves as the person goes.
function DraftSaveIndicator({ statuses }: { statuses: SaveStatus[] }) {
  const state = statuses.includes('error') ? 'error' : statuses.includes('saving') ? 'saving' : statuses.includes('saved') ? 'saved' : null
  const label = { error: 'Not saved yet — we’ll retry when you’re back online', saving: 'Saving…', saved: 'Saved' }[state ?? 'saved']
  return (
    <p role="status" aria-live="polite" className={`text-xs ${state === 'error' ? 'text-rose-700' : 'text-slate-500'}`}>
      {state ? label : ''}
    </p>
  )
}

export function OnboardingPage() {
  const { currentUser, completeOnboarding } = useAuthCtx()
  const { inviteTeamMember } = useTeamCtx()
  const { setEntityProfile, profileSaveStatus } = useEntityProfileCtx()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(0)

  // Which step the person has reached, for the Super Admin's onboarding analytics (step number and name only).
  const isDemoUser = currentUser?.isDemo ?? true
  const signedInEmail = currentUser?.email
  useEffect(() => {
    if (signedInEmail && !isDemoUser) saveOnboardingProgress(step + 1)
  }, [step, signedInEmail, isDemoUser])

  // Step 1 - workspace identity. Archetype/country/sector/subsector ARE the
  // entity profile that drives the Assessment Wizard's question filtering and the
  // dynamic Data Room, so they are captured here and committed on finish.
  const [orgName, setOrgName] = useState(currentUser?.orgName ?? '')
  const [archetype, setArchetype] = useState<Archetype | ''>('')
  const [country, setCountry] = useState('')
  const [sector, setSector] = useState('')
  const [subsector, setSubsector] = useState('')
  // Step 2
  const [frameworks, setFrameworks, alignmentStatus] = useLegacyAssessment<string[]>('donor-alignment', ['usaid'])
  // Step 3
  const [invites, setInvites] = useState<string[]>([''])
  const [path, setPath] = useState<'web' | 'excel' | null>(null)

  // Draft: everything entered so far (not donor alignment, which saves itself) is saved server-side as the
  // person moves on and, debounced, while they type; reopening restores it at the furthest step reached.
  const [savedDraft, setSavedDraft, draftStatus] = useLegacyAssessment<OnboardingDraft>(ONBOARDING_DRAFT_KEY, EMPTY_ONBOARDING_DRAFT)
  const [hydrated, setHydrated] = useState(false)
  const lastSaved = useRef('')
  useEffect(() => {
    if (hydrated || draftStatus === 'loading') return
    const restored = mergeDraft({ orgName: currentUser?.orgName ?? '' }, restoreDraft(savedDraft))
    const hint = typeof window === 'undefined' ? 0 : stepFromSearch(new URLSearchParams(window.location.search).get('step'))
    const reach = furthestStep(restored, restored.furthestStep, hint)
    setOrgName(restored.orgName); setArchetype(restored.archetype); setCountry(restored.country)
    setSector(restored.sector); setSubsector(restored.subsector); setInvites(restored.invites); setPath(restored.path)
    setFurthest(reach); setStep(reach)
    lastSaved.current = JSON.stringify({ ...restored, furthestStep: restored.furthestStep })
    setHydrated(true)
  }, [hydrated, draftStatus, savedDraft, currentUser?.orgName])

  const draftNow = useCallback((reached: number): OnboardingDraft => ({
    orgName, archetype, country, sector, subsector, invites, path,
    furthestStep: furthestStep({ orgName, archetype }, reached),
  }), [orgName, archetype, country, sector, subsector, invites, path])
  const latest = useRef(draftNow)
  latest.current = draftNow
  const furthestRef = useRef(furthest)
  furthestRef.current = furthest
  const persist = useCallback(() => {
    if (isDemoUser) return
    const next = latest.current(furthestRef.current)
    const json = JSON.stringify(next)
    if (json === lastSaved.current) return
    lastSaved.current = json
    setSavedDraft(next)
  }, [isDemoUser, setSavedDraft])
  useEffect(() => {
    if (!hydrated) return
    const timer = setTimeout(persist, ONBOARDING_DRAFT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [hydrated, persist, orgName, archetype, country, sector, subsector, invites, path, furthest])
  // Offline-tolerant: a failed or offline save is retried when the connection returns, and when the tab is hidden.
  useEffect(() => {
    const retry = () => { lastSaved.current = ''; persist() }
    const hide = () => { if (document.visibilityState === 'hidden') persist() }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', hide)
    return () => { window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', hide) }
  }, [persist])

  function goToStep(next: number) {
    const reached = Math.max(furthestRef.current, next)
    furthestRef.current = reached
    setFurthest(reached)
    setStep(next)
    // Save now rather than waiting for the debounce when moving on.
    if (!isDemoUser && hydrated) {
      const draft = latest.current(reached)
      lastSaved.current = JSON.stringify(draft)
      setSavedDraft(draft)
    }
  }

  const sectorOptions = archetype ? SECTORS_BY_ARCHETYPE[archetype] : []
  const subsectorOptions = subsectorsForSector(sector)
  const canContinueStep1 = step1Complete({ orgName, archetype })

  function chooseArchetype(value: Archetype) {
    setArchetype(value)
    setSector('')
    setSubsector('')
  }
  function chooseSector(value: string) {
    setSector(value)
    setSubsector('')
  }

  function toggleFramework(id: string) {
    setFrameworks(f => (f.includes(id) ? f.filter(x => x !== id) : [...f, id]))
  }

  function finish(destination: '/assessment' | '/dashboard') {
    if (profileSaveStatus === 'loading' || profileSaveStatus === 'error' || profileSaveStatus === 'read-only') return
    // Commit the entity profile so the wizard filters to this archetype and the
    // Data Room generates the right country/sector/subsector checklist.
    setEntityProfile({ archetype, country, sector, subsector, onboardingComplete: true })
    // Register any co-assessors entered during onboarding as invited team
    // members, scoped to this institution as Organization Assessors.
    const scopeLabel = orgName || currentUser?.orgName || 'Your institution'
    invites
      .map(e => e.trim())
      .filter(Boolean)
      .forEach(email => {
        const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        inviteTeamMember({ name, email, title: 'Co-Assessor', role: 'assessor', scopeLabel })
      })
    if (!isDemoUser) saveOnboardingProgress(STEPS.length, true)
    completeOnboarding()
    navigate({ to: destination })
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <div>
              <p className="font-display text-base font-bold text-emerald-900">{BRAND.product} Onboarding</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{BRAND.framework}</p>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 pt-4">
          {isDemoUser ? <LegacySaveStatus status="demo" /> : <DraftSaveIndicator statuses={[draftStatus, alignmentStatus]} />}
          <LegacySaveStatus status={profileSaveStatus} />
        </div>
        <div className="mx-auto max-w-3xl px-6 py-10">
          <Stepper steps={STEPS} current={step} />

          {!hydrated ? (
            <p role="status" className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">Loading your saved progress…</p>
          ) : (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            {/* STEP 1 */}
            {step === 0 && (
              <div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <Building2 className="h-5 w-5" />
                  <h2 className="font-display text-2xl font-bold text-emerald-900">Set up your workspace</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">This becomes your isolated tenant. Your archetype, country and sector tailor the assessment questions and your Data Room checklist.</p>
                <div className="mt-6 space-y-4">
                  <Input label="Organization Name" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="National Public Health Agency" />
                  <Select
                    label="Entity Archetype"
                    placeholder="Select archetype"
                    value={archetype}
                    onChange={v => chooseArchetype(v as Archetype)}
                    options={ARCHETYPES.map(a => ({ value: a.id, label: a.label }))}
                  />
                  {archetype && (
                    <p className="-mt-2 text-xs text-slate-400">
                      {ARCHETYPES.find(a => a.id === archetype)?.blurb}
                    </p>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                      label="Country of Operation"
                      placeholder="Select country"
                      value={country}
                      onChange={setCountry}
                      options={COUNTRIES.map(c => ({ value: c.code, label: `${c.flag} ${c.name}` }))}
                    />
                    <Select
                      label="Sector / Mandate"
                      placeholder={archetype ? 'Select sector' : 'Select archetype first'}
                      value={sector}
                      onChange={chooseSector}
                      options={sectorOptions.map(s => ({ value: s, label: s }))}
                    />
                  </div>
                  {subsectorOptions.length > 0 && (
                    <Select
                      label="Subsector (optional)"
                      placeholder="Select subsector"
                      value={subsector}
                      onChange={setSubsector}
                      options={subsectorOptions.map(s => ({ value: s, label: s }))}
                    />
                  )}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Organization Logo</label>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 hover:border-emerald-300">
                      <UploadCloud className="h-5 w-5" /> Upload logo (PNG/SVG)
                      <input type="file" accept="image/*" className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 1 && (
              <div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <Target className="h-5 w-5" />
                  <h2 className="font-display text-2xl font-bold text-emerald-900">Align to your donors</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">Select the frameworks your accreditation should map to.</p>
                <div className="mt-6 space-y-3">
                  {DONOR_FRAMEWORKS.map(f => {
                    const on = frameworks.includes(f.id)
                    return (
                      <button
                        key={f.id}
                        onClick={() => toggleFramework(f.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                          on ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded border ${on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                          {on && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{f.name}</p>
                          <p className="text-xs text-slate-500">{f.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 2 && (
              <div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <Users className="h-5 w-5" />
                  <h2 className="font-display text-2xl font-bold text-emerald-900">Invite your team & choose a path</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">Add co-assessors, then pick how you want to begin.</p>

                <div className="mt-6 space-y-2">
                  {invites.map((v, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder="colleague@institution.org"
                        value={v}
                        onChange={e => setInvites(arr => arr.map((x, idx) => (idx === i ? e.target.value : x)))}
                      />
                      {invites.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => setInvites(arr => arr.filter((_, idx) => idx !== i))}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setInvites(arr => [...arr, ''])}>
                    <Plus className="h-4 w-4" /> Add another co-assessor
                  </Button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <button
                    onClick={() => setPath('web')}
                    className={`rounded-xl border-2 p-5 text-left transition-all ${path === 'web' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <Wand2 className="h-6 w-6 text-emerald-600" />
                    <p className="mt-3 font-display text-lg font-bold text-emerald-900">Launch Web Wizard</p>
                    <p className="mt-1 text-xs text-slate-500">Answer questions tier-by-tier with live risk scoring.</p>
                  </button>
                  <button
                    onClick={() => setPath('excel')}
                    className={`rounded-xl border-2 p-5 text-left transition-all ${path === 'excel' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <UploadCloud className="h-6 w-6 text-amber-600" />
                    <p className="mt-3 font-display text-lg font-bold text-emerald-900">Download Secure Excel Template</p>
                    <p className="mt-1 text-xs text-slate-500">Fill offline, then bulk import to calculate scores.</p>
                  </button>
                </div>

                {path === 'excel' && (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <ExcelImport orgId={currentUser?.orgId ?? 'org-001'} />
                  </div>
                )}
              </div>
            )}

            {/* Nav */}
            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
              <Button variant="ghost" size="sm" onClick={() => goToStep(Math.max(0, step - 1))} disabled={step === 0}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {step < 2 ? (
                <Button onClick={() => goToStep(step + 1)} disabled={step === 0 && !canContinueStep1}>
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => finish(path === 'excel' ? '/dashboard' : '/assessment')}>
                  Enter Secure Vault <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
