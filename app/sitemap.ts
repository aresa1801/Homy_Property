import type { MetadataRoute } from 'next'

const SITE_URL = (process.env.HOMY_APP_URL || 'https://homyproperty.id').replace(/\/$/, '')
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Sitemap di-regenerasi tiap jam supaya listing baru cepat terindeks. */
export const revalidate = 3600

type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

type StaticRoute = { path: string; priority: number; freq: ChangeFreq }

/**
 * Halaman publik yang memang layak diindeks.
 * Halaman privat (dashboard, auth, onboarding, agreement, message) sengaja TIDAK dimasukkan.
 */
const STATIC_ROUTES: StaticRoute[] = [
  { path: '/', priority: 1, freq: 'daily' },
  { path: '/buy', priority: 0.9, freq: 'daily' },
  { path: '/rent', priority: 0.9, freq: 'daily' },
  { path: '/list', priority: 0.9, freq: 'weekly' },
  { path: '/partnership', priority: 0.8, freq: 'weekly' },
  { path: '/ai-assistant', priority: 0.7, freq: 'weekly' },
  { path: '/contact', priority: 0.6, freq: 'monthly' },
  { path: '/privacy', priority: 0.3, freq: 'yearly' },
  { path: '/terms', priority: 0.3, freq: 'yearly' },
]

type ListingRow = {
  id: string
  updated_at?: string | null
  created_at?: string | null
}

/** Ambil semua listing berstatus published langsung dari Supabase (public read). */
async function fetchPublishedListings(): Promise<ListingRow[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return []
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?select=id,updated_at,created_at&status=eq.published&order=updated_at.desc&limit=5000`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        next: { revalidate },
      },
    )
    if (!res.ok) return []
    const rows = (await res.json()) as ListingRow[]
    return Array.isArray(rows) ? rows : []
  } catch {
    // Sitemap tetap valid walau DB sedang tidak bisa diakses.
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    changeFrequency: r.freq,
    priority: r.priority,
  }))

  const listings = await fetchPublishedListings()
  const listingEntries: MetadataRoute.Sitemap = listings
    .filter((row) => Boolean(row.id))
    .map((row) => ({
      url: `${SITE_URL}/property/${row.id}`,
      lastModified: row.updated_at || row.created_at || undefined,
      changeFrequency: 'weekly' as ChangeFreq,
      priority: 0.8,
    }))

  return [...staticEntries, ...listingEntries]
}
