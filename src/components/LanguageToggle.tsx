import { useEffect, useRef, useState } from 'react'
import { Globe, Check, ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'
import { LANGUAGES, langMeta, useI18n } from '../lib/i18n'

// A compact, accessible language switcher. Renders a globe button that opens a
// menu of supported languages. The `tone` prop adapts it to light surfaces
// (public storefront header) or dark surfaces (secure workspace chrome).
export function LanguageToggle({
  tone = 'light',
  className,
}: {
  tone?: 'light' | 'dark'
  className?: string
}) {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = langMeta(lang)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const triggerTone =
    tone === 'dark'
      ? 'text-slate-300 hover:bg-emerald-800/50 hover:text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-emerald-700'

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('lang.label', 'Language')}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
          triggerTone,
        )}
      >
        <Globe className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{current.code.toUpperCase()}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('lang.label', 'Language')}
          className="absolute right-0 z-50 mt-1.5 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          {LANGUAGES.map(l => {
            const active = l.code === lang
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setLang(l.code)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                    active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <span className="text-base leading-none">{l.flag}</span>
                  <span className="flex-1">{l.label}</span>
                  {active && <Check className="h-4 w-4 text-emerald-600" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
