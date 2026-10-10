import { useEffect, useRef, useState } from 'react'
import { Languages } from 'lucide-react'
import { dictionaryValues, useI18n, type LangCode } from '../lib/i18n'
import { useAuthCtx } from '../lib/context'
import { useRouterState } from '@tanstack/react-router'

// ---------------------------------------------------------------------------
// Whole-page runtime translation.
//
// The hand-written dictionaries in lib/i18n.tsx cover the navigation chrome;
// everything else (page copy, workspace screens, question banks, tables,
// toasts, tooltips, placeholders) is translated here. When a non-English
// language is active, every visible text node and user-facing attribute is
// collected, sent in batches to /api/translate (AI Gateway + Blobs cache) and
// swapped in place. A MutationObserver keeps newly rendered content (route
// changes, dialogs, async data) translated, and switching back to English
// restores the original strings exactly.
//
// Opt out for any subtree with `translate="no"` or `data-no-translate`.
// ---------------------------------------------------------------------------

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'KBD', 'SAMP', 'TEXTAREA', 'SVG', 'TEMPLATE', 'IFRAME', 'CANVAS'])
const BATCH = 20
const MAX_LEN = 4000
const CACHE_PREFIX = 'craft_tx_v1_'
const CACHE_LIMIT = 6000
const PUBLIC_COPY_ROUTES = new Set(['/', '/architecture', '/methodology', '/institute', '/launch', '/privacy', '/terms', '/open-source', '/code-of-conduct', '/vaults'])

type Tracked = { source: string; applied: string }

// Strings with no letters, or that are only an email / URL / code-like token,
// have nothing to translate.
function translatable(text: string): boolean {
  const s = text.trim()
  if (s.length < 2 || s.length > MAX_LEN) return false
  if (!/\p{L}{2}/u.test(s)) return false
  if (/^(https?:\/\/|www\.)\S+$/i.test(s) || /^\S+@\S+\.\S+$/.test(s)) return false
  if (/^[A-Z0-9][A-Z0-9._:-]*\d[A-Z0-9._:-]*$/.test(s)) return false
  return true
}

function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName.toUpperCase())) return true
    if (e.getAttribute('translate') === 'no' || e.hasAttribute('data-no-translate')) return true
    if ((e as HTMLElement).isContentEditable) return true
    if (e.classList.contains('font-mono')) return true
  }
  return false
}

function loadCache(lang: LangCode): Map<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + lang)
    if (raw) return new Map(Object.entries(JSON.parse(raw) as Record<string, string>))
  } catch {
    /* corrupt or unavailable storage - start empty */
  }
  return new Map()
}

function saveCache(lang: LangCode, cache: Map<string, string>) {
  try {
    const entries = Array.from(cache.entries())
    const kept = entries.length > CACHE_LIMIT ? entries.slice(entries.length - CACHE_LIMIT) : entries
    localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(Object.fromEntries(kept)))
  } catch {
    /* quota exceeded or private mode - the server cache still applies */
  }
}

export function AutoTranslate() {
  const { lang, t } = useI18n()
  const { currentUser, authReady } = useAuthCtx()
  const pathname = useRouterState({ select: state => state.location.pathname })
  const allowed = authReady && !currentUser && PUBLIC_COPY_ROUTES.has(pathname)
  const [pending, setPending] = useState(0)
  const textNodes = useRef(new Map<Text, Tracked>())
  const attrNodes = useRef(new Map<Element, Partial<Record<(typeof ATTRS)[number], Tracked>>>())
  const titleRef = useRef<Tracked | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!allowed) return
    const texts = textNodes.current
    const attrs = attrNodes.current

    // English is the source text; the previous language's cleanup already restored it.
    if (lang === 'en') return

    const cache = loadCache(lang)
    const native = dictionaryValues(lang)
    const queue = new Set<string>()
    const inflight = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | undefined
    let saveTimer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const controller = new AbortController()
    const stillPublic = () => !cancelled && PUBLIC_COPY_ROUTES.has(window.location.pathname) && !document.querySelector('[data-sensitive-workspace]')
    const clearSensitive = () => { cancelled = true; controller.abort(); cache.clear() }
    window.addEventListener('craft:clear-sensitive', clearSensitive)

    const needs = (s: string) => translatable(s) && !native.has(s.trim())

    // Apply a cached translation to every tracked string whose source is known.
    const translated = (source: string): string | undefined => {
      const core = source.trim()
      const hit = cache.get(core)
      if (hit === undefined) return undefined
      const lead = source.slice(0, source.indexOf(core))
      const trail = source.slice(source.indexOf(core) + core.length)
      return lead + hit + trail
    }

    const request = (source: string) => {
      const core = source.trim()
      if (cache.has(core) || inflight.has(core)) return
      queue.add(core)
      if (!timer) timer = setTimeout(flush, 120)
    }

    const applyAll = () => {
      texts.forEach((t, node) => {
        if (!node.isConnected) {
          texts.delete(node)
          return
        }
        const out = translated(t.source)
        if (out !== undefined && node.data !== out) {
          node.data = out
          t.applied = out
        }
      })
      attrs.forEach((map, el) => {
        if (!el.isConnected) {
          attrs.delete(el)
          return
        }
        for (const [name, t] of Object.entries(map)) {
          if (!t) continue
          const out = translated(t.source)
          if (out !== undefined && el.getAttribute(name) !== out) {
            el.setAttribute(name, out)
            t.applied = out
          }
        }
      })
      if (titleRef.current) {
        const out = translated(titleRef.current.source)
        if (out !== undefined && document.title !== out) {
          document.title = out
          titleRef.current.applied = out
        }
      }
    }

    const flush = async () => {
      timer = undefined
      const batch = Array.from(queue)
      queue.clear()
      if (batch.length === 0 || !stillPublic()) return
      batch.forEach(s => inflight.add(s))
      const chunks: string[][] = []
      for (let i = 0; i < batch.length; i += BATCH) chunks.push(batch.slice(i, i + BATCH))
      setPending(p => p + chunks.length)

      // Four chunks at a time keeps the first screen fast without flooding the API.
      let next = 0
      const worker = async () => {
        while (next < chunks.length && stillPublic()) {
          const chunk = chunks[next++]
          try {
            const res = await fetch('/api/translate', {
              signal: controller.signal,
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ lang, texts: chunk }),
            })
            if (res.ok && stillPublic()) {
              const { translations } = (await res.json()) as { translations: string[] }
              chunk.forEach((s, i) => {
                if (typeof translations[i] === 'string') cache.set(s, translations[i])
              })
            }
          } catch {
            /* offline or transient failure - the English text stays visible */
          } finally {
            chunk.forEach(s => inflight.delete(s))
            setPending(p => Math.max(0, p - 1))
          }
          if (stillPublic()) {
            applyAll()
            clearTimeout(saveTimer)
            saveTimer = setTimeout(() => { if (stillPublic()) saveCache(lang, cache) }, 800)
          }
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()])
    }

    const trackText = (node: Text) => {
      const prev = texts.get(node)
      // A value we wrote ourselves needs no work; anything else is new English source.
      if (prev && node.data === prev.applied) return
      if (!node.parentElement || skipped(node.parentElement) || !needs(node.data)) {
        texts.delete(node)
        return
      }
      texts.set(node, { source: node.data, applied: node.data })
      request(node.data)
    }

    const trackAttrs = (el: Element) => {
      if (skipped(el)) return
      for (const name of ATTRS) {
        const value = el.getAttribute(name)
        if (value == null) continue
        const map = attrs.get(el) ?? {}
        const prev = map[name]
        if (prev && value === prev.applied) continue
        if (!needs(value)) continue
        map[name] = { source: value, applied: value }
        attrs.set(el, map)
        request(value)
      }
    }

    const scan = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        trackText(root as Text)
        return
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return
      const el = root as Element
      if (skipped(el)) return
      trackAttrs(el)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: n =>
          n.nodeType === Node.ELEMENT_NODE && skipped(n as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
      })
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) trackText(n as Text)
        else trackAttrs(n as Element)
      }
    }

    const trackTitle = () => {
      const current = document.title
      if (titleRef.current && current === titleRef.current.applied) return
      if (!needs(current)) return
      titleRef.current = { source: current, applied: current }
      request(current)
    }

    scan(document.body)
    trackTitle()
    applyAll()

    // Our own writes also show up here; trackText/trackAttrs recognise them by
    // their `applied` value and ignore them.
    const observer = new MutationObserver(records => {
      if (!stillPublic()) return
      for (const r of records) {
        if (r.type === 'characterData') trackText(r.target as Text)
        else if (r.type === 'attributes') trackAttrs(r.target as Element)
        else r.addedNodes.forEach(scan)
      }
      trackTitle()
      applyAll()
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS],
    })
    const head = document.querySelector('head > title')
    const titleObserver = new MutationObserver(() => {
      trackTitle()
      applyAll()
    })
    if (head) titleObserver.observe(head, { childList: true, characterData: true, subtree: true })

    return () => {
      const persist = stillPublic()
      cancelled = true
      controller.abort()
      window.removeEventListener('craft:clear-sensitive', clearSensitive)
      observer.disconnect()
      titleObserver.disconnect()
      clearTimeout(timer)
      clearTimeout(saveTimer)
      if (persist) saveCache(lang, cache)
      // Hand the original English back before the next language takes over,
      // so translations are always produced from the English source.
      texts.forEach((t, node) => {
        if (node.isConnected && node.data === t.applied) node.data = t.source
      })
      attrs.forEach((map, el) => {
        for (const [name, t] of Object.entries(map)) {
          if (t && el.getAttribute(name) === t.applied) el.setAttribute(name, t.source)
        }
      })
      if (titleRef.current && document.title === titleRef.current.applied) document.title = titleRef.current.source
      texts.clear()
      attrs.clear()
      titleRef.current = null
      setPending(0)
    }
  }, [lang, allowed, pathname])

  if (!allowed || lang === 'en' || pending === 0) return null
  return (
    <div
      role="status"
      aria-live="polite"
      translate="no"
      className="pointer-events-none fixed bottom-4 left-4 z-[100] flex items-center gap-2 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
    >
      <Languages className="h-3.5 w-3.5 animate-pulse" />
      <span>{t('tx.translating', 'Translating…')}</span>
    </div>
  )
}
