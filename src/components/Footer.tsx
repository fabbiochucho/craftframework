import { Link } from '@tanstack/react-router'
import { BRAND } from '../lib/data'
import { useI18n } from '../lib/i18n'

const footerLinks = [
  { to: '/code-of-conduct', labelKey: 'footer.codeOfConduct', fallback: 'Code of Conduct' },
  { to: '/open-source', labelKey: 'footer.openSource', fallback: 'Open Source' },
  { to: '/methodology', labelKey: 'footer.methodology', fallback: 'Methodology' },
  { to: '/terms', labelKey: 'footer.terms', fallback: 'Terms of Service' },
  { to: '/privacy', labelKey: 'footer.privacy', fallback: 'Privacy Policy' },
  { to: '/launch', labelKey: 'footer.pressKit', fallback: 'Press Kit' },
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

        {/* Open Source & Attribution Section */}
        <div className="mt-6 border-t border-emerald-700 pt-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
            {/* DiBadili Logo */}
            <a
              href="https://becomechange.institute"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-80"
              aria-label="DiBadili Institute"
            >
              <img
                src="https://becomechange.institute/logo.png"
                alt="DiBadili Institute"
                className="h-8 w-auto"
              />
            </a>

            {/* Netlify Attribution */}
            <a
              href="https://www.netlify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-emerald-200 transition-colors hover:text-amber-400"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 40 40"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M10.7 29.4l5.9-8.1-1.4-1.8-5.9 8.1 1.4 1.8z" />
                <path d="M27.7 10.6L21.8 18.7l1.4 1.8 5.9-8.1-1.4-1.8z" />
                <path d="M27.7 29.4l1.4-1.8-5.9-8.1-1.4 1.8 5.9 8.1z" />
                <path d="M10.7 10.6l-1.4 1.8 5.9 8.1 1.4-1.8-5.9-8.1z" />
                <path d="M20 30.8c-5.9 0-10.8-4.9-10.8-10.8S14.1 9.2 20 9.2c5.9 0 10.8 4.9 10.8 10.8s-4.9 10.8-10.8 10.8zm0-19.2c-4.6 0-8.4 3.8-8.4 8.4s3.8 8.4 8.4 8.4 8.4-3.8 8.4-8.4-3.8-8.4-8.4-8.4z" />
              </svg>
              This site is powered by Netlify
            </a>
          </div>

          {/* License Info */}
          <p className="mt-4 text-center text-xs text-emerald-300">
            Distributed under the{' '}
            <a
              href="https://www.gnu.org/licenses/gpl-3.0.en.html"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-amber-400 hover:text-amber-300 hover:underline"
            >
              GNU General Public License v3
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
