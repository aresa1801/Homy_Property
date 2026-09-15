import type { MetadataRoute } from 'next'

const SITE_URL = (process.env.HOMY_APP_URL || 'https://homyproperty.id').replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes: Array<{ path: string; priority: number; freq: 'daily' | 'weekly' | 'monthly' }> = [
    { path: '/', priority: 1, freq: 'daily' },
    { path: '/buy', priority: 0.9, freq: 'daily' },
    { path: '/rent', priority: 0.9, freq: 'daily' },
    { path: '/partnership', priority: 0.9, freq: 'weekly' },
    { path: '/list', priority: 0.8, freq: 'weekly' },
    { path: '/ai-assistant', priority: 0.8, freq: 'weekly' },
    { path: '/message', priority: 0.6, freq: 'weekly' },
    { path: '/contact', priority: 0.6, freq: 'monthly' },
    { path: '/privacy', priority: 0.4, freq: 'monthly' },
    { path: '/terms', priority: 0.4, freq: 'monthly' },
  ]
  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }))
}
