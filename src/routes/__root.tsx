import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppProvider } from '../lib/context'
import { I18nProvider } from '../lib/i18n'
import { IdentityBridge } from '../components/IdentityBridge'
import { OfflineBanner } from '../components/OfflineBanner'
import '../styles.css'

const queryClient = new QueryClient()

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#022c22' },
      { title: 'CRAFT: Capacity Readiness & Fiduciary Assurance Toolkit | DiBadili Institute' },
      {
        name: 'description',
        content: 'The Global Standard for Institutional Readiness - secure capacity, fiduciary assurance and Trust Delta verification from the DiBadili Institute.',
      },
      // Open Graph (LinkedIn / Facebook)
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'CRAFT · DiBadili Institute' },
      { property: 'og:title', content: 'CRAFT - The Global Standard for Institutional Readiness' },
      {
        property: 'og:description',
        content: 'Capacity Readiness & Fiduciary Assurance Toolkit. Secure, multi-tenant institutional readiness and Trust Delta verification.',
      },
      { property: 'og:url', content: 'https://craftframework.netlify.app/' },
      { property: 'og:image', content: 'https://craftframework.netlify.app/og-image.png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      // Twitter / X
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'CRAFT - The Global Standard for Institutional Readiness' },
      {
        name: 'twitter:description',
        content: 'Capacity Readiness & Fiduciary Assurance Toolkit from the DiBadili Institute.',
      },
      { name: 'twitter:image', content: 'https://craftframework.netlify.app/og-image.png' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.json' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <I18nProvider>
              <IdentityBridge>
                {children}
              </IdentityBridge>
              <OfflineBanner />
            </I18nProvider>
          </AppProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
