// Consent for behaviour analytics. The state machine below is pure so it can be
// unit-tested; the store at the bottom adds first-party storage (no cookies).
//
// Nothing loads or sends before a recorded, current choice. Do Not Track and
// Global Privacy Control are treated as a rejection that no stored choice overrides.

/** Bump when the privacy policy's analytics description changes; visitors are asked again. */
export const CONSENT_POLICY_VERSION = '2026-10-17'
export const CONSENT_STORAGE_KEY = 'craft_consent'

export interface ConsentRecord { analytics: boolean; replay: boolean; timestamp: string; policyVersion: string }
export interface PrivacySignals { dnt: boolean; gpc: boolean }
export interface ConsentState {
  /** Ask the visitor (first visit, or the policy version changed). */
  needsAnswer: boolean
  analytics: boolean
  /** Session replay; only ever true together with analytics. */
  replay: boolean
  /** A browser privacy signal is on; it overrides any choice. */
  signal: boolean
  record: ConsentRecord | null
}

export function parseRecord(raw: string | null | undefined): ConsentRecord | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    if (v && typeof v.analytics === 'boolean' && typeof v.replay === 'boolean' && typeof v.policyVersion === 'string'
      && typeof v.timestamp === 'string' && !Number.isNaN(Date.parse(v.timestamp))) {
      return { analytics: v.analytics, replay: v.analytics && v.replay, timestamp: v.timestamp, policyVersion: v.policyVersion }
    }
  } catch { /* fall through */ }
  return null
}

export function evaluate(record: ConsentRecord | null, signals: PrivacySignals, version = CONSENT_POLICY_VERSION): ConsentState {
  const signal = signals.dnt || signals.gpc
  const current = record && record.policyVersion === version ? record : null
  if (signal) return { needsAnswer: false, analytics: false, replay: false, signal, record: current }
  if (!current) return { needsAnswer: true, analytics: false, replay: false, signal, record }
  return { needsAnswer: false, analytics: current.analytics, replay: current.analytics && current.replay, signal, record: current }
}

export function makeRecord(analytics: boolean, replay: boolean, now = new Date(), version = CONSENT_POLICY_VERSION): ConsentRecord {
  return { analytics, replay: analytics && replay, timestamp: now.toISOString(), policyVersion: version }
}
export const acceptAll = (now?: Date) => makeRecord(true, true, now)
export const rejectAll = (now?: Date) => makeRecord(false, false, now)

export function readSignals(nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean; msDoNotTrack?: string | null } | undefined,
  win?: { doNotTrack?: string | null }): PrivacySignals {
  const dnt = [nav?.doNotTrack, nav?.msDoNotTrack, win?.doNotTrack].some(v => v === '1' || v === 'yes')
  return { dnt, gpc: nav?.globalPrivacyControl === true }
}

// ---- Browser store --------------------------------------------------------------------------

interface View extends ConsentState { settingsOpen: boolean }
const listeners = new Set<() => void>()
let record: ConsentRecord | null = null
let loaded = false
let settingsOpen = false
let snapshot: View | null = null

function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try { record = parseRecord(window.localStorage.getItem(CONSENT_STORAGE_KEY)) } catch { /* storage blocked: ask again each visit */ }
}

function signals(): PrivacySignals {
  if (typeof navigator === 'undefined') return { dnt: false, gpc: false }
  return readSignals(navigator as never, window as never)
}

function recompute() {
  snapshot = { ...evaluate(record, signals()), settingsOpen }
  listeners.forEach(l => l())
}

export function getConsentSnapshot(): View {
  if (!snapshot) { load(); snapshot = { ...evaluate(record, signals()), settingsOpen } }
  return snapshot
}
// Server render and first client render never show the banner (it appears after mount).
const SERVER: View = { needsAnswer: false, analytics: false, replay: false, signal: false, record: null, settingsOpen: false }
export const getServerConsentSnapshot = () => SERVER

export function subscribeConsent(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function saveConsent(next: ConsentRecord) {
  record = next
  loaded = true
  settingsOpen = false
  try { window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next)) } catch { /* kept in memory for this visit */ }
  recompute()
}
export function openConsentSettings() { load(); settingsOpen = true; recompute() }
export function closeConsentSettings() { settingsOpen = false; recompute() }
