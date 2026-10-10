import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Menu, X, Shield } from 'lucide-react'
import { cn } from '../lib/utils'
import { BRAND } from '../lib/data'
import { Button } from './ui'
import { Footer } from './Footer'
import { Logo } from './Logo'
import { LanguageToggle } from './LanguageToggle'
import { useI18n } from '../lib/i18n'

const navLinks = [
  { to: '/', labelKey: 'nav.home', fallback: 'Home' },
  { to: '/pre-assessment', labelKey: 'nav.readiness', fallback: 'Readiness Check' },
  { to: '/methodology', labelKey: 'nav.methodology', fallback: 'Methodology' },
  { to: '/architecture', labelKey: 'nav.architecture', fallback: 'Architecture' },
  { to: '/institute', labelKey: 'nav.institute', fallback: 'The Institute' },
  { to: '/open-source', labelKey: 'nav.openSource', fallback: 'Open Source' },
  { to: '/contact', labelKey: 'nav.contact', fallback: 'Contact' },
]

// Public storefront chrome (Zone 1) - no auth required.
export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const router = useRouterState()
  const pathname = router.location.pathname
  const { t } = useI18n()

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:gap-6 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <div className="leading-tight">
              <p className="font-display text-lg font-bold text-emerald-900">{BRAND.product}</p>
              <p className="mt-0.5 text-[10px] font-medium tracking-wide text-slate-400">
                {BRAND.framework} · {BRAND.institute}
              </p>
            </div>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {navLinks.map(l => (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === l.to
                    ? 'text-emerald-700'
                    : 'text-slate-600 hover:text-emerald-700',
                )}
              >
                {t(l.labelKey, l.fallback)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <LanguageToggle tone="light" />
            <Link to="/auth">
              <Button size="sm">
                {t('nav.signIn', 'Sign in')}
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">
                <Shield className="h-4 w-4" /> {t('nav.register', 'Register Your Institution')}
              </Button>
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <LanguageToggle tone="light" />
            <button className="text-slate-600" onClick={() => setOpen(o => !o)} aria-label="Menu">
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-slate-200 px-6 py-3 lg:hidden">
            {navLinks.map(l => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="block py-2 text-sm font-medium text-slate-700"
              >
                {t(l.labelKey, l.fallback)}
              </Link>
            ))}
            <Link to="/auth" onClick={() => setOpen(false)} className="mt-1 block">
              <Button size="sm" className="w-full justify-center">
                {t('nav.signIn', 'Sign in')}
              </Button>
            </Link>
            <Link to="/auth" onClick={() => setOpen(false)} className="mt-2 block">
              <Button size="sm" className="w-full justify-center">
                {t('nav.register', 'Register Your Institution')}
              </Button>
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
