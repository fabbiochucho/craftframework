import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Maximize2, Minus, MoveHorizontal, Plus, X } from 'lucide-react'

// View-only document viewer for evidence (a watermarked PDF from /api/evidence-requests/:id/items/:e/view).
// Pages are drawn onto canvases in the page itself, so there is no browser PDF toolbar (save / print).
// Zoom: buttons, slider, Ctrl/⌘ + wheel or trackpad pinch (around the pointer), touch pinch, + / - / 0 keys.
// Pan: drag, scrollbars both ways, arrow keys. Only pages near the screen are drawn.
// ponytail: deterrent, not DRM; the watermark makes any screenshot traceable.

type Pdf = { numPages: number; getPage: (n: number) => Promise<any> }
type Size = { w: number; h: number }

const MIN = 0.25, MAX = 4, GAP = 16
const clamp = (z: number) => Math.min(MAX, Math.max(MIN, z))
const MAX_CANVAS_PIXELS = 16_000_000 // browsers refuse larger canvases

export function EvidenceViewer({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const [pdf, setPdf] = useState<Pdf | null>(null)
  const [sizes, setSizes] = useState<Size[]>([])
  const [error, setError] = useState('')
  const [zoom, setZoomState] = useState(1)
  const [crisp, setCrisp] = useState(1) // the zoom the canvases are drawn at (settles after zooming stops)
  const scroller = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(1)
  const anchor = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)

  // Load the document.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
        if (!res.ok) throw new Error((await res.text().catch(() => '')).slice(0, 400) || `Could not open the document (${res.status})`)
        const { getDocumentProxy } = await import('unpdf')
        const doc: Pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()), { disableFontFace: true })
        const s: Size[] = []
        for (let n = 1; n <= doc.numPages; n++) {
          const v = (await doc.getPage(n)).getViewport({ scale: 1 })
          s.push({ w: v.width, h: v.height })
        }
        if (cancelled) return
        setPdf(doc); setSizes(s)
        const el = scroller.current
        const fit = el ? clamp((el.clientWidth - 2 * GAP) / Math.max(...s.map((p) => p.w))) : 1
        zoomRef.current = fit; setZoomState(fit); setCrisp(fit)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.message.startsWith('{') ? 'Could not open the document' : (e as Error).message)
      }
    })()
    return () => { cancelled = true }
  }, [url])

  // Zoom, keeping the point under (cx, cy) - in scroller coordinates - where it is.
  const setZoom = useCallback((next: number, cx?: number, cy?: number) => {
    const el = scroller.current
    const z = clamp(next)
    if (el) {
      const px = cx ?? el.clientWidth / 2, py = cy ?? el.clientHeight / 2
      anchor.current = { x: (el.scrollLeft + px) / zoomRef.current, y: (el.scrollTop + py) / zoomRef.current, cx: px, cy: py }
    }
    zoomRef.current = z
    setZoomState(z)
  }, [])
  useLayoutEffect(() => {
    const el = scroller.current, a = anchor.current
    if (el && a) { el.scrollLeft = a.x * zoom - a.cx; el.scrollTop = a.y * zoom - a.cy; anchor.current = null }
    const t = setTimeout(() => setCrisp(zoom), 180)
    return () => clearTimeout(t)
  }, [zoom])

  const fitWidth = () => sizes.length && scroller.current && setZoom((scroller.current.clientWidth - 2 * GAP) / Math.max(...sizes.map((p) => p.w)))
  const fitPage = () => {
    const el = scroller.current
    if (!sizes.length || !el) return
    setZoom(Math.min((el.clientWidth - 2 * GAP) / sizes[0].w, (el.clientHeight - 2 * GAP) / sizes[0].h))
  }

  // Ctrl/⌘ + wheel and trackpad pinch (sent as ctrl + wheel) zoom around the pointer; needs a non-passive listener.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      setZoom(zoomRef.current * Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setZoom])

  // Drag to pan (mouse / pen); two fingers pinch to zoom (touch). One finger scrolls natively.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null)
  const pinch = useRef<{ d: number; z: number } | null>(null)
  const dist = () => { const [a, b] = [...pointers.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y) }
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scroller.current!
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) { pinch.current = { d: dist(), z: zoomRef.current }; drag.current = null; return }
    if (e.pointerType !== 'touch' && e.button === 0) {
      drag.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop }
      el.setPointerCapture(e.pointerId)
    }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scroller.current!
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()], r = el.getBoundingClientRect()
      setZoom(pinch.current.z * (dist() / pinch.current.d), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top)
      return
    }
    if (drag.current) { el.scrollLeft = drag.current.l - (e.clientX - drag.current.x); el.scrollTop = drag.current.t - (e.clientY - drag.current.y) }
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    drag.current = null
  }

  // Keyboard: Escape closes; + / - / 0 zoom; arrows pan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = scroller.current
      if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(zoomRef.current * 1.2) }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(zoomRef.current / 1.2) }
      else if (e.key === '0') setZoom(1)
      else if (el && e.key === 'ArrowRight') el.scrollLeft += 60
      else if (el && e.key === 'ArrowLeft') el.scrollLeft -= 60
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose, setZoom])

  const contentWidth = sizes.length ? Math.max(...sizes.map((p) => p.w)) * zoom + 2 * GAP : 0
  return (
    <div role="dialog" aria-modal="true" aria-label={`View ${name}`} className="fixed inset-0 z-[100] flex flex-col bg-slate-800">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
        <p className="min-w-0 flex-1 truncate font-medium" title={name}>{name}{sizes.length ? <span className="ml-2 text-xs text-slate-400">{sizes.length} page{sizes.length === 1 ? '' : 's'} · view only</span> : null}</p>
        <button type="button" aria-label="Zoom out" onClick={() => setZoom(zoom / 1.2)} className="rounded p-1.5 hover:bg-slate-700"><Minus className="h-4 w-4" /></button>
        <input type="range" aria-label="Zoom" min={MIN * 100} max={MAX * 100} step={5} value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
          className="h-1.5 w-28 cursor-pointer appearance-none rounded-full bg-slate-500 sm:w-40 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400" />
        <button type="button" aria-label="Zoom in" onClick={() => setZoom(zoom * 1.2)} className="rounded p-1.5 hover:bg-slate-700"><Plus className="h-4 w-4" /></button>
        <span className="w-12 text-center tabular-nums" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={fitWidth} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-700"><MoveHorizontal className="h-4 w-4" /> Fit width</button>
        <button type="button" onClick={fitPage} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-700"><Maximize2 className="h-4 w-4" /> Fit page</button>
        <button type="button" aria-label="Close viewer" onClick={onClose} className="rounded p-1.5 hover:bg-slate-700"><X className="h-5 w-5" /></button>
      </div>
      <div ref={scroller} tabIndex={0} aria-label="Document pages: drag or use the scrollbars to move, Ctrl and scroll to zoom"
        className="relative flex-1 overflow-auto outline-none [touch-action:pan-x_pan-y]"
        // Always-visible scrollbars, both ways, in colours that stand out on the dark background.
        style={{ cursor: drag.current ? 'grabbing' : 'grab', scrollbarColor: '#cbd5e1 #334155', scrollbarWidth: 'auto' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}>
        {error && <p role="alert" className="m-6 max-w-xl rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
        {!error && !pdf && <p className="m-6 text-sm text-slate-300">Opening the document…</p>}
        {pdf && (
          <div className="flex flex-col items-center" style={{ width: Math.max(contentWidth, 0), minWidth: '100%', padding: GAP, gap: GAP }}>
            {sizes.map((s, i) => <PageCanvas key={i} pdf={pdf} n={i + 1} size={s} zoom={zoom} crisp={crisp} root={scroller} />)}
          </div>
        )}
      </div>
    </div>
  )
}

/** One page: sized to the zoom at once (stretching the last drawing), redrawn sharply when it is near the screen. */
function PageCanvas({ pdf, n, size, zoom, crisp, root }: { pdf: Pdf; n: number; size: Size; zoom: number; crisp: number; root: React.RefObject<HTMLDivElement | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(n <= 2)
  useEffect(() => {
    const el = canvas.current
    if (!el || !root.current) return
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { root: root.current, rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [root])
  useEffect(() => {
    if (!near) return
    let task: { cancel: () => void } | null = null
    let stop = false
    void (async () => {
      const page = await pdf.getPage(n)
      if (stop || !canvas.current) return
      const dpr = window.devicePixelRatio || 1
      const scale = Math.min(crisp * dpr, Math.sqrt(MAX_CANVAS_PIXELS / (size.w * size.h)))
      const viewport = page.getViewport({ scale })
      const c = canvas.current
      c.width = Math.floor(viewport.width); c.height = Math.floor(viewport.height)
      task = page.render({ canvasContext: c.getContext('2d')!, viewport })
      await (task as any).promise.catch(() => {})
    })()
    return () => { stop = true; task?.cancel() }
  }, [pdf, n, size, crisp, near])
  return (
    <canvas ref={canvas} aria-label={`Page ${n}`} draggable={false}
      className="block shrink-0 bg-white shadow-lg select-none"
      style={{ width: size.w * zoom, height: size.h * zoom }} />
  )
}
