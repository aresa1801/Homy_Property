import type { Metadata } from 'next'

/**
 * Satu sumber kebenaran untuk host kanonik. Semua canonical / OG / sitemap / robots
 * memakai SITE_URL ini supaya konsisten (https://homyproperty.id tanpa trailing slash).
 */
export const SITE_URL = (process.env.HOMY_APP_URL || 'https://homyproperty.id').replace(/\/$/, '')

/** Gambar default untuk Open Graph / Twitter bila halaman tidak punya gambar sendiri. */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/screenshots/homy-desktop.png`

type PageMetaInput = {
  /** Judul tanpa suffix brand; suffix "| Homy Property" ditambahkan otomatis bila belum ada. */
  title: string
  description: string
  /** Path absolut-style relatif host, mis. "/buy". Dipakai untuk canonical + og:url. */
  path: string
  keywords?: string[]
  image?: string
  type?: 'website' | 'article'
  robots?: Metadata['robots']
}

const BRAND = 'Homy Property'
const TITLE_SUFFIX = `| ${BRAND}`
const TITLE_SEP = ' — '

function withBrand(title: string): string {
  if (title.includes(BRAND)) return title
  if (title.includes(TITLE_SUFFIX) || title.includes(TITLE_SEP)) {
    return `${title} ${TITLE_SUFFIX}`
  }
  return `${title}${TITLE_SEP}${BRAND}`
}

/** Metadata lengkap per halaman: title, description, keywords, canonical, OG, Twitter. */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
  image,
  type = 'website',
  robots,
}: PageMetaInput): Metadata {
  const url = `${SITE_URL}${path === '/' ? '' : path}`
  const ogImage = image || DEFAULT_OG_IMAGE
  const fullTitle = withBrand(title)
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    robots,
    openGraph: {
      type,
      url,
      siteName: BRAND,
      locale: 'id_ID',
      title: fullTitle,
      description,
      images: [{ url: ogImage, width: 1920, height: 1080, alt: `${BRAND} — ${title}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
    },
  }
}

export type Breadcrumb = { name: string; path: string }

/** BreadcrumbList JSON-LD. `path` relatif host, mis. "/property/abc". */
export function breadcrumbLd(items: Breadcrumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path === '/' ? '' : item.path}`,
    })),
  }
}

/** ItemList JSON-LD untuk halaman listing/search. */
export function itemListLd(opts: {
  name: string
  url: string
  items: { name: string; url: string; image?: string }[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: opts.name,
    url: opts.url.startsWith('http') ? opts.url : `${SITE_URL}${opts.url}`,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
      name: item.name,
      ...(item.image ? { image: item.image } : {}),
    })),
  }
}

export type SeoListing = {
  id: string
  title: string | null
  listing_type: string | null
  city: string | null
  district: string | null
  updated_at?: string | null
  created_at?: string | null
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Ambil listing published langsung dari Supabase untuk keperluan SEO (ItemList / breadcrumb).
 * Selalu aman: jika DB tidak bisa diakses, kembalikan array kosong.
 */
export async function fetchSeoListings(
  listingType?: 'sale' | 'rent',
  limit = 50,
): Promise<SeoListing[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return []
  const typeFilter = listingType ? `&listing_type=eq.${listingType}` : ''
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?select=id,title,listing_type,city,district,updated_at,created_at&status=eq.published${typeFilter}&order=updated_at.desc&limit=${limit}`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        next: { revalidate: 3600 },
      },
    )
    if (!res.ok) return []
    const rows = (await res.json()) as SeoListing[]
    return Array.isArray(rows) ? rows.filter((r) => Boolean(r?.id)) : []
  } catch {
    return []
  }
}

/** FAQPage JSON-LD dari daftar pertanyaan/jawaban nyata. */
export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
}
