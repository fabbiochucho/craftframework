import { Link } from '@tanstack/react-router'
import { BRAND } from '../lib/data'
import { useI18n } from '../lib/i18n'

const footerLinks = [
  { to: '/code-of-conduct', labelKey: 'footer.codeOfConduct', fallback: 'Code of Conduct' },
  { to: '/open-source', labelKey: 'footer.openSource', fallback: 'Open Source' },
  { to: '/methodology', labelKey: 'footer.methodology', fallback: 'Methodology' },
  { to: '/terms', labelKey: 'footer.terms', fallback: 'Terms of Service' },
  { to: '/privacy', labelKey: 'footer.privacy', fallback: 'Privacy Policy' },
  { to: '/contact', labelKey: 'footer.contact', fallback: 'Contact' },
] as const

export function Footer() {
  const { t } = useI18n()
  // Split the footer text so the institute name can be accented in gold.
  const [before, after] = BRAND.footer.split(BRAND.institute)
  return (
    <footer className="border-t border-emerald-800 bg-emerald-900 text-emerald-100">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium">
          {footerLinks.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className="text-emerald-200 transition-colors hover:text-amber-400"
            >
              {t(l.labelKey, l.fallback)}
            </Link>
          ))}
        </nav>
        <p className="mt-5 text-center text-xs leading-relaxed">
          {before}
          <a
            href={BRAND.instituteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-amber-400 underline-offset-2 transition-colors hover:text-amber-300 hover:underline"
          >
            {BRAND.institute}
          </a>
          {after}
        </p>
      </div>
    </footer>
  )
}
