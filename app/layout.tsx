import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { LanguageProvider } from '@/components/language-provider'
import './globals.css'

const SITE_URL = (process.env.HOMY_APP_URL || 'https://homyproperty.id').replace(/\/$/, '')
const OG_IMAGE = `${SITE_URL}/screenshots/homy-desktop.png`
const SITE_DESCRIPTION =
  'Marketplace properti Indonesia: cari dan pasang rumah dijual, disewakan, apartemen, ruko, dan tanah. Dilengkapi asisten AI, kalkulator KPR, dan direktori notaris & PPAT.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Homy Property — Temukan hunian terbaik',
    template: '%s | Homy Property',
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'properti Indonesia',
    'jual rumah',
    'sewa rumah',
    'apartemen dijual',
    'tanah dijual',
    'ruko',
    'agen properti',
    'marketplace properti',
  ],
  applicationName: 'Homy Property',
  generator: 'v0.app',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Homy Property',
    locale: 'id_ID',
    url: SITE_URL,
    title: 'Homy Property — Temukan hunian terbaik',
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1920, height: 1080, alt: 'Homy Property' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Homy Property — Temukan hunian terbaik',
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: 'any',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        url: '/icon-light-32x32.png',
        sizes: '32x32',
        type: 'image/png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        sizes: '32x32',
        type: 'image/png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    shortcut: ['/favicon.ico'],
    apple: [
      {
        url: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0b3d2e',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Homy Property',
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/logo-homy.png`,
          width: 541,
          height: 160,
        },
        image: OG_IMAGE,
        description:
          'Marketplace properti Indonesia: cari rumah dijual, disewakan, dan kerja sama agen properti.',
        areaServed: { '@type': 'Country', name: 'Indonesia' },
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            email: 'support@homyproperty.id',
            availableLanguage: ['id', 'en'],
          },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Homy Property',
        url: SITE_URL,
        inLanguage: 'id-ID',
        publisher: { '@id': `${SITE_URL}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/buy?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }

  return (
    <html lang="id">
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        {/* Register the service worker during HTML parsing so crawlers (PWABuilder/Lighthouse)
            and first visits detect it without waiting for React hydration. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){})}",
          }}
        />
        <LanguageProvider>{children}</LanguageProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
