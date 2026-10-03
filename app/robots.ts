import type { MetadataRoute } from 'next'

const SITE_URL = (process.env.HOMY_APP_URL || 'https://homyproperty.id').replace(/\/$/, '')

/** Rute privat / aplikasi yang tidak boleh diindeks. Konsisten dengan sitemap. */
const PRIVATE = [
  '/api/',
  '/dashboard/',
  '/auth/',
  '/message',
  '/agreement',
  '/verify',
  '/onboarding',
  '/listing/',
  '/open',
  '/open-file',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      { userAgent: 'Googlebot', allow: '/', disallow: PRIVATE },
      { userAgent: 'Googlebot-Image', allow: '/' },
      { userAgent: 'Bingbot', allow: '/', disallow: PRIVATE },
      { userAgent: 'Twitterbot', allow: '/' },
      { userAgent: 'facebookexternalhit', allow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
