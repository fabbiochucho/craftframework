import { useMemo, useState, useEffect } from 'react'
import {
  BookOpen, Search, Download, Printer, ChevronDown, CheckCircle2, Circle,
  Rocket, Building2, ClipboardList, Gauge, Target, FolderCheck, FileBarChart,
  Network, Shield, Lock, LifeBuoy, type LucideIcon,
} from 'lucide-react'
import {
  BRAND, USER_GUIDE, USER_GUIDE_VERSION, USER_GUIDE_UPDATED, VIEW_LEVELS,
  type GuideSection, type ViewLevel,
} from '../lib/data'
import { Button, Input, Card, CardContent, ProgressBar } from '../components/ui'
import { cn } from '../lib/utils'

// Maps the data layer's icon keys to lucide glyphs (kept here so data.ts stays
// free of React/JSX imports).
const ICONS: Record<GuideSection['icon'], LucideIcon> = {
  rocket: Rocket,
  building: Building2,
  clipboard: ClipboardList,
  gauge: Gauge,
  target: Target,
  folder: FolderCheck,
  report: FileBarChart,
  network: Network,
  shield: Shield,
  lock: Lock,
  'life-buoy': LifeBuoy,
}

const READ_STORAGE_KEY = 'craft.guide.read'
type RoleFilter = 'all' | ViewLevel

// Builds a fully self-contained HTML document of the entire guide, styled to
// match the CRAFT brand and optimised for printing to PDF. Everything is inline
// so the downloaded file opens and prints anywhere with no network access.
function buildGuideHtml(): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const toc = USER_GUIDE.map(
    (s, i) => `<li><a href="#${s.id}">${i + 1}. ${esc(s.title)}</a></li>`,
  ).join('')

  const body = USER_GUIDE.map((s, i) => {
    const steps = s.steps
      .map(
        step => `
        <div class="step">
          <h3>${esc(step.heading)}</h3>
          <p>${esc(step.detail)}</p>
          ${step.tip ? `<p class="tip"><strong>Tip:</strong> ${esc(step.tip)}</p>` : ''}
        </div>`,
      )
      .join('')
    return `
      <section id="${s.id}">
        <h2>${i + 1}. ${esc(s.title)}</h2>
        <p class="summary">${esc(s.summary)}</p>
        ${steps}
      </section>`
  }).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(BRAND.product)} User Guide ${esc(USER_GUIDE_VERSION)}</title>
<style>
  :root { --emerald:#047857; --slate:#334155; --muted:#64748b; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; color: var(--slate); line-height: 1.6; margin: 0; padding: 0; background:#fff; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 48px 32px 64px; }
  header.cover { border-bottom: 4px solid var(--emerald); padding-bottom: 24px; margin-bottom: 32px; }
  header.cover .kicker { color: var(--emerald); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; margin: 0; }
  header.cover h1 { font-size: 34px; margin: 6px 0 4px; color:#064e3b; }
  header.cover p.sub { font-size: 15px; color: var(--muted); margin: 0; }
  header.cover p.meta { font-size: 13px; color: var(--muted); margin-top: 12px; }
  nav.toc { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding: 18px 22px; margin-bottom: 36px; }
  nav.toc h2 { font-size: 13px; text-transform: uppercase; letter-spacing:.06em; color: var(--emerald); margin: 0 0 10px; }
  nav.toc ul { margin: 0; padding-left: 18px; }
  nav.toc li { margin: 4px 0; }
  nav.toc a { color: var(--slate); text-decoration: none; }
  section { margin-bottom: 34px; page-break-inside: avoid; }
  section h2 { font-size: 22px; color:#064e3b; border-bottom:1px solid #e2e8f0; padding-bottom: 8px; }
  p.summary { color: var(--muted); font-style: italic; margin-top: -4px; }
  .step { margin: 14px 0; padding-left: 16px; border-left: 3px solid #d1fae5; }
  .step h3 { font-size: 15px; margin: 0 0 4px; color:#065f46; }
  .step p { margin: 0; font-size: 14px; }
  .step p.tip { margin-top: 6px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:8px 10px; font-size:13px; color:#92400e; }
  footer { margin-top: 48px; border-top:1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: var(--muted); }
  a { color: var(--emerald); }
  @media print { .wrap { padding: 0; } a { color: var(--slate); text-decoration: none; } }
</style>
</head>
<body>
  <div class="wrap">
    <header class="cover">
      <p class="kicker">${esc(BRAND.framework)} · ${esc(BRAND.institute)}</p>
      <h1>${esc(BRAND.product)} User Guide</h1>
      <p class="sub">${esc(BRAND.expansion)}</p>
      <p class="meta">Guide ${esc(USER_GUIDE_VERSION)} · Updated ${esc(USER_GUIDE_UPDATED)}</p>
    </header>
    <nav class="toc"><h2>Contents</h2><ul>${toc}</ul></nav>
    ${body}
    <footer>${esc(BRAND.footer)}</footer>
  </div>
</body>
</html>`
}

export function UserGuidePage() {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [read, setRead] = useState<Record<string, boolean>>({})

  // Restore read-progress from the browser (per-device, no server needed).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(READ_STORAGE_KEY)
      if (raw) setRead(JSON.parse(raw))
    } catch {
      /* ignore malformed storage */
    }
  }, [])

  function persistRead(next: Record<string, boolean>) {
    setRead(next)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* storage may be unavailable (private mode) - progress is best-effort */
    }
  }

  const q = query.trim().toLowerCase()
  const sections = useMemo(
    () =>
      USER_GUIDE.filter(s => {
        const roleOk = roleFilter === 'all' || s.roles.includes(roleFilter)
        if (!roleOk) return false
        if (!q) return true
        const hay = (
          s.title +
          s.summary +
          s.steps.map(st => st.heading + st.detail + (st.tip ?? '')).join(' ')
        ).toLowerCase()
        return hay.includes(q)
      }),
    [q, roleFilter],
  )

  const readCount = USER_GUIDE.filter(s => read[s.id]).length
  const allOpen = sections.length > 0 && sections.every(s => open[s.id])

  function toggleAll() {
    const next = { ...open }
    for (const s of sections) next[s.id] = !allOpen
    setOpen(next)
  }

  function download() {
    if (typeof window === 'undefined') return
    const blob = new Blob([buildGuideHtml()], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CRAFT-User-Guide-${USER_GUIDE_VERSION}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function printGuide() {
    if (typeof window === 'undefined') return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(buildGuideHtml())
    w.document.close()
    // Give the new document a tick to lay out before invoking the print dialog.
    w.onload = () => w.print()
  }

  const roleChips: { id: RoleFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    // The Super Admin tier is a reserved platform-operator role and is kept out
    // of the public guide's role filter so it stays invisible to everyone else.
    ...VIEW_LEVELS.filter(v => v.id !== 'super_admin').map(v => ({ id: v.id as RoleFilter, label: v.short })),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
            <BookOpen className="h-4 w-4 text-emerald-600" /> Support
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">User Guide</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            An interactive, step-by-step walkthrough of {BRAND.product} - from signing in and
            onboarding to the assessment wizard, findings, capacity plan and reports. Filter it to
            your access level, track what you have read, and download the whole guide to read
            offline or share.
          </p>
          <p className="mt-2 text-xs font-medium text-slate-400">
            Guide {USER_GUIDE_VERSION} · Updated {USER_GUIDE_UPDATED}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={printGuide}>
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
          <Button size="sm" onClick={download}>
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">Your progress</span>
              <span className="text-slate-500">
                {readCount} of {USER_GUIDE.length} sections read
              </span>
            </div>
            <ProgressBar value={readCount} max={USER_GUIDE.length} className="mt-2" />
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search the guide…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {roleChips.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setRoleFilter(c.id)}
                aria-pressed={roleFilter === c.id}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  roleFilter === c.id
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={toggleAll}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </Button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
            No sections match your search and filter.
          </p>
        )}
        {sections.map((s, i) => {
          const Icon = ICONS[s.icon]
          const isOpen = open[s.id] ?? false
          const isRead = read[s.id] ?? false
          return (
            <Card key={s.id} className={cn(isRead && 'ring-1 ring-emerald-200')}>
              <button
                type="button"
                onClick={() => setOpen(o => ({ ...o, [s.id]: !isOpen }))}
                className="flex w-full items-center gap-4 p-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate font-display text-base font-bold text-slate-800">
                      {s.title}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-slate-500">{s.summary}</span>
                </span>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 shrink-0 text-slate-400 transition-transform',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-2">
                  <div className="space-y-4 pl-14">
                    {s.steps.map(step => (
                      <div key={step.heading} className="border-l-2 border-emerald-100 pl-4">
                        <h3 className="text-sm font-bold text-emerald-800">{step.heading}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.detail}</p>
                        {step.tip && (
                          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                            <strong>Tip:</strong> {step.tip}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end pl-14">
                    <button
                      type="button"
                      onClick={() => persistRead({ ...read, [s.id]: !isRead })}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                        isRead
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                      )}
                    >
                      {isRead ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                      {isRead ? 'Read' : 'Mark as read'}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
