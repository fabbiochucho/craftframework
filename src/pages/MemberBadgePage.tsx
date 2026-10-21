import { useEffect, useState } from 'react'
import { Download, Loader2, MailWarning } from 'lucide-react'
import { Button, Card, CardContent } from '../components/ui'
import { fetchBadgeInfo, type BadgeInfo } from '../lib/lifecycleApi'
import { BADGE_HEIGHT, BADGE_WIDTH } from '../lib/memberBadge'

// Renders the badge SVG onto a canvas at 2x for a crisp PNG (LinkedIn, slides). No server-side image tooling needed.
async function svgToPngBlob(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error('The badge could not be drawn.')); img.src = url })
    const canvas = document.createElement('canvas')
    canvas.width = BADGE_WIDTH * 2; canvas.height = BADGE_HEIGHT * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Your browser cannot create the PNG.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('The PNG could not be created.'))), 'image/png'))
  } finally { URL.revokeObjectURL(url) }
}
function save(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// /badge: 'CRAFT member since {year}' for websites and LinkedIn. Signed in, or via the signed link in the milestone email.
export function MemberBadgePage({ token }: { token?: string | null }) {
  const [info, setInfo] = useState<BadgeInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    fetchBadgeInfo(token).then((b) => live && setInfo(b)).catch((e: Error) => live && setError(e.message))
    return () => { live = false }
  }, [token])

  const shareUrl = info?.shareToken ? `${window.location.origin}/api/lifecycle/badge?t=${info.shareToken}` : null
  const snippet = shareUrl ? `<img src="${shareUrl}" alt="CRAFT member since ${info!.year}: ${info!.orgName}" width="360">` : ''
  async function png() {
    if (!info) return
    setBusy(true)
    try { save(await svgToPngBlob(info.svg), `${info.fileName}.png`) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-2xl font-bold text-emerald-900 sm:text-3xl">Your CRAFT member badge</h1>
      <p className="mt-2 text-sm text-slate-600">Show that your organisation is part of the CRAFT community. Use it on your website, in your email signature or on LinkedIn.</p>
      {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><MailWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}</p>}
      {!info && !error && <p className="mt-5 flex items-center gap-2 text-sm text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Preparing your badge…</p>}
      {info && (
        <Card className="mt-6"><CardContent className="p-4 sm:p-6">
          <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(info.svg)}`} width={BADGE_WIDTH} height={BADGE_HEIGHT} alt={`CRAFT member since ${info.year}: ${info.orgName}`} className="mx-auto h-auto w-full max-w-[720px]" />
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(info.svg)}`} download={`${info.fileName}.svg`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Download className="h-4 w-4" aria-hidden="true" /> Download SVG</a>
            <Button variant="outline" onClick={png} disabled={busy} className="min-h-11"><Download className="h-4 w-4" /> {busy ? 'Preparing…' : 'Download PNG'}</Button>
          </div>
          {snippet && (
            <div className="mt-6">
              <label htmlFor="embed" className="text-sm font-semibold text-slate-900">Embed on a website</label>
              <textarea id="embed" readOnly rows={3} value={snippet} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs" />
              <p className="mt-1 text-xs text-slate-500">The link in this snippet is public: anyone who has it can see the badge, and nothing else about your workspace.</p>
            </div>
          )}
        </CardContent></Card>
      )}
    </main>
  )
}
