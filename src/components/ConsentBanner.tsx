import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from '@tanstack/react-router'
import {
  acceptAll, closeConsentSettings, getConsentSnapshot, getServerConsentSnapshot, makeRecord, rejectAll, saveConsent, subscribeConsent,
} from '../lib/consent'
import { analyticsConfigured } from '../lib/analytics'

const button = 'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2'

function Toggle({ id, label, hint, checked, disabled, onChange }: { id: string; label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className={`flex items-start gap-3 rounded-lg border border-slate-200 p-3 ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-slate-50'}`}>
      <input id={id} type="checkbox" className="mt-1 h-5 w-5 accent-emerald-600" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="text-sm text-slate-700"><b className="block text-slate-900">{label}</b>{hint}</span>
    </label>
  )
}

/**
 * First-visit analytics consent, reopened from the footer ("Cookie & analytics settings").
 * Not modal: the page stays usable while it is open. "Accept" and "Reject" are equal in size and prominence.
 */
export function ConsentBanner() {
  const consent = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getServerConsentSnapshot)
  const [choosing, setChoosing] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [replay, setReplay] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const uid = useId()
  const open = analyticsConfigured && (consent.needsAnswer || consent.settingsOpen)
  const reopened = consent.settingsOpen

  // Opening from the footer starts from the saved choice and puts focus on the panel.
  useEffect(() => {
    if (!consent.settingsOpen) return
    setChoosing(true)
    setAnalytics(consent.analytics)
    setReplay(consent.replay)
    heading.current?.focus()
  }, [consent.settingsOpen])
  useEffect(() => { if (!open) setChoosing(false) }, [open])

  if (!open) return null
  const showChoices = choosing || reopened
  return (
    <section
      role="region"
      aria-label="Analytics consent"
      data-testid="consent-banner"
      onKeyDown={e => { if (e.key === 'Escape' && reopened) closeConsentSettings() }}
      className="fixed inset-x-0 bottom-0 z-[60] print:hidden max-h-[90vh] overflow-y-auto border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md sm:rounded-2xl"
    >
      <h2 ref={heading} tabIndex={-1} className="font-display text-base font-bold text-emerald-900 focus:outline-none">
        {reopened ? 'Cookie & analytics settings' : 'Help us improve CRAFT?'}
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        With your permission we use PostHog (hosted in the EU) to see which public pages are used and where visitors get stuck. We never record assessments, evidence, scores, workspaces or admin pages, and never what you type. No advertising, no cookies. See the{' '}
        <Link to="/privacy" className="text-emerald-700 underline" onClick={() => closeConsentSettings()}>privacy policy</Link>.
      </p>
      {consent.signal && (
        <p role="status" className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
          Your browser sends a Do Not Track or Global Privacy Control signal, so analytics stays off.
        </p>
      )}
      {showChoices ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={e => { e.preventDefault(); saveConsent(makeRecord(analytics, analytics && replay)) }}
        >
          <Toggle id={`${uid}-analytics`} label="Product analytics" disabled={consent.signal} checked={analytics && !consent.signal}
            hint="Page views, clicks and errors on public pages such as the home page, sign-up, directory, training and policies." onChange={v => { setAnalytics(v); if (!v) setReplay(false) }} />
          <Toggle id={`${uid}-replay`} label="Session replay" disabled={consent.signal || !analytics} checked={replay && analytics && !consent.signal}
            hint="Anonymous screen recordings of those pages. All typed text is masked and most page text is hidden." onChange={setReplay} />
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button type="submit" className={`${button} bg-emerald-700 text-white hover:bg-emerald-800`}>Save choices</button>
            {reopened && <button type="button" className={`${button} border border-slate-300 text-slate-800 hover:bg-slate-50`} onClick={() => closeConsentSettings()}>Close</button>}
            {!reopened && <button type="button" className={`${button} border border-slate-300 text-slate-800 hover:bg-slate-50`} onClick={() => setChoosing(false)}>Back</button>}
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button type="button" className={`${button} flex-1 bg-emerald-700 text-white hover:bg-emerald-800`} onClick={() => saveConsent(acceptAll())}>Accept analytics</button>
          <button type="button" className={`${button} flex-1 bg-slate-800 text-white hover:bg-slate-900`} onClick={() => saveConsent(rejectAll())}>Reject</button>
          <button type="button" className={`${button} flex-1 border border-slate-300 text-slate-800 hover:bg-slate-50`} onClick={() => { setAnalytics(false); setReplay(false); setChoosing(true) }}>Choose</button>
        </div>
      )}
    </section>
  )
}
