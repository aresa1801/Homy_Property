import type { MetadataRoute } from 'next'

const SITE_URL = (process.env.HOMY_APP_URL || 'https://homyproperty.id').replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/', '/agreement', '/onboarding', '/auth/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
