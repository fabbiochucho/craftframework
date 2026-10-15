import { useEffect, useRef } from 'react'

// Cloudflare Turnstile widget for the Register form. The site key is public. On localhost the
// Cloudflare test key (always passes) is used. Remount (change `key`) to get a fresh token,
// since each token can be verified only once.
const SITE_KEY = '0x4AAAAAAFXQvo_5Fm_lXFRn'
const TEST_KEY = '1x00000000000000000000AA'
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void }
let loading: Promise<TurnstileApi> | null = null
function load(): Promise<TurnstileApi> {
  const w = window as unknown as { turnstile?: TurnstileApi }
  if (w.turnstile) return Promise.resolve(w.turnstile)
  return (loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SRC
    s.async = true
    s.onload = () => (w.turnstile ? resolve(w.turnstile) : reject(new Error('Turnstile failed to load')))
    s.onerror = () => { loading = null; reject(new Error('Turnstile failed to load')) }
    document.head.appendChild(s)
  }))
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let id: string | null = null
    let api: TurnstileApi | null = null
    let cancelled = false
    const local = ['localhost', '127.0.0.1'].includes(location.hostname)
    load().then(t => {
      if (cancelled || !ref.current) return
      api = t
      id = t.render(ref.current, {
        sitekey: local ? TEST_KEY : SITE_KEY,
        action: 'signup',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      })
    }).catch(() => onToken(''))
    return () => { cancelled = true; if (api && id) api.remove(id) }
  }, [])
  return <div ref={ref} className="min-h-[65px]" />
}
