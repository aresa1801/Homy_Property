import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { LanguageProvider } from '@/components/language-provider'
import { PwaRegister } from '@/components/pwa-register'
import './globals.css'

const SITE_URL = (process.env.HOMY_APP_URL || 'https://homyproperty.id').replace(/\/$/, '')

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Homy Property — Temukan hunian terbaik',
  description: 'Temukan properti pilihan di Indonesia yang sesuai dengan gaya hidup Anda.',
  applicationName: 'Homy Property',
  generator: 'v0.app',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Homy Property',
    locale: 'id_ID',
    url: SITE_URL,
    title: 'Homy Property — Temukan hunian terbaik',
    description: 'Temukan properti pilihan di Indonesia yang sesuai dengan gaya hidup Anda.',
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
  return (
    <html lang="id">
      <body className="antialiased">
        <PwaRegister />
        <LanguageProvider>{children}</LanguageProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
