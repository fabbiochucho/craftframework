import { Link } from '@tanstack/react-router'
import { BRAND } from '../lib/data'
import { useI18n } from '../lib/i18n'
import { openConsentSettings } from '../lib/consent'
import { analyticsConfigured } from '../lib/analytics'

const footerLinks = [
  { to: '/institute', labelKey: 'footer.about', fallback: 'About & Founders' },
  { to: '/code-of-conduct', labelKey: 'footer.codeOfConduct', fallback: 'Code of Conduct' },
  { to: '/open-source', labelKey: 'footer.openSource', fallback: 'Open Source' },
  { to: '/methodology', labelKey: 'footer.methodology', fallback: 'Methodology' },
  { to: '/terms', labelKey: 'footer.terms', fallback: 'Terms of Service' },
  { to: '/privacy', labelKey: 'footer.privacy', fallback: 'Privacy Policy' },
  { to: '/acceptable-use', labelKey: 'footer.acceptableUse', fallback: 'Acceptable Use' },
  { to: '/data-processing', labelKey: 'footer.dataProcessing', fallback: 'Data Processing' },
  { to: '/subprocessors', labelKey: 'footer.subprocessors', fallback: 'Sub-processors' },
  { to: '/security', labelKey: 'footer.security', fallback: 'Security' },
  { to: '/accessibility', labelKey: 'footer.accessibility', fallback: 'Accessibility' },
  { to: '/launch', labelKey: 'footer.pressKit', fallback: 'Press Kit' },
  { to: '/contact', labelKey: 'footer.contact', fallback: 'Contact' },
] as const

export function Footer() {
  const { t } = useI18n()
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
          {analyticsConfigured && (
            <button
              type="button"
              onClick={openConsentSettings}
              className="text-emerald-200 transition-colors hover:text-amber-400"
            >
              {t('footer.cookieSettings', 'Cookie & analytics settings')}
            </button>
          )}
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

        <div className="mt-6 border-t border-emerald-700 pt-6">
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <a
              href="https://becomechange.institute"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-80"
              aria-label="DiBadili Institute"
            >
              <img
                src="/dibadili-logo.png"
                alt="DiBadili Institute"
                className="h-8 w-auto"
              />
            </a>
          </div>

          <p className="mt-4 text-center text-xs text-emerald-300">
            Distributed under the{' '}
            <a
              href="https://www.gnu.org/licenses/gpl-3.0.en.html"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-amber-400 transition-colors hover:text-amber-300 hover:underline"
            >
              GNU General Public License v3
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
