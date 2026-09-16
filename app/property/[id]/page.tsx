import type { Metadata } from 'next'
import PropertyDetailClient from './property-detail-client'

const SITE_URL = (process.env.HOMY_APP_URL || 'https://homyproperty.id').replace(/\/$/, '')
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const LISTING_SELECT =
  'id,title,description,ai_summary,listing_type,property_type,status,city,district,address,province,price,price_period,bedrooms,bathrooms,land_area,building_area,latitude,longitude,created_at,updated_at,property_media(storage_path,sort_order)'

type ListingMedia = { storage_path: string | null; sort_order?: number | null }

type Listing = {
  id: string
  title: string | null
  description: string | null
  ai_summary: string | null
  listing_type: string | null
  property_type: string | null
  status: string | null
  city: string | null
  district: string | null
  address: string | null
  province: string | null
  price: number | string | null
  price_period: string | null
  bedrooms: number | null
  bathrooms: number | null
  land_area: number | null
  building_area: number | null
  latitude: number | null
  longitude: number | null
  created_at: string | null
  updated_at: string | null
  property_media?: ListingMedia[] | null
}

function mediaUrls(listing: Listing): string[] {
  const base = (SUPABASE_URL || '').replace(/\/$/, '')
  return (listing.property_media ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((m) => {
      const path = m?.storage_path ?? ''
      if (!path) return ''
      if (/^https?:\/\//i.test(path)) return path
      if (!base) return ''
      return `${base}/storage/v1/object/public/property-media/${path.replace(/^\//, '')}`
    })
    .filter(Boolean)
}

/** Ambil satu listing langsung dari Supabase (public read) untuk metadata & structured data. */
async function fetchListing(id: string): Promise<Listing | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?id=eq.${encodeURIComponent(id)}&select=${LISTING_SELECT}`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        next: { revalidate: 600 },
      },
    )
    if (!res.ok) return null
    const rows = (await res.json()) as Listing[]
    return Array.isArray(rows) && rows[0] ? rows[0] : null
  } catch {
    return null
  }
}

function cleanText(value: string | null | undefined, max = 300): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function locationLabel(listing: Listing): string {
  return [listing.district, listing.city].filter(Boolean).join(', ') || listing.city || 'Indonesia'
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const listing = await fetchListing(id)

  if (!listing) {
    return {
      title: 'Properti tidak ditemukan — Homy Property',
      robots: { index: false, follow: true },
    }
  }

  const title = `${listing.title || 'Properti'} — ${locationLabel(listing)} | Homy Property`
  const description =
    cleanText(listing.ai_summary) ||
    cleanText(listing.description) ||
    'Lihat detail properti di Homy Property.'
  const images = mediaUrls(listing).slice(0, 6)
  const url = `${SITE_URL}/property/${listing.id}`

  return {
    title,
    description,
    alternates: { canonical: `/property/${listing.id}` },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      images: images.length ? images : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.length ? images : undefined,
    },
  }
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await fetchListing(id)

  let jsonLd: Record<string, unknown> | null = null
  if (listing) {
    const url = `${SITE_URL}/property/${listing.id}`
    const images = mediaUrls(listing).slice(0, 6)
    const price = listing.price == null ? null : Number(listing.price)
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      name: listing.title || 'Properti',
      url,
      description:
        cleanText(listing.ai_summary) || cleanText(listing.description) || undefined,
      image: images.length ? images : undefined,
      datePosted: listing.created_at || undefined,
      dateModified: listing.updated_at || undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: listing.address || undefined,
        addressLocality: listing.city || undefined,
        addressRegion: listing.province || undefined,
        addressCountry: 'ID',
      },
      geo:
        listing.latitude != null && listing.longitude != null
          ? {
              '@type': 'GeoCoordinates',
              latitude: listing.latitude,
              longitude: listing.longitude,
            }
          : undefined,
      numberOfRooms: listing.bedrooms ?? undefined,
      numberOfBathroomsTotal: listing.bathrooms ?? undefined,
      floorSize:
        listing.building_area != null
          ? { '@type': 'QuantitativeValue', value: listing.building_area, unitCode: 'MTK' }
          : undefined,
      offers:
        price != null && Number.isFinite(price)
          ? {
              '@type': 'Offer',
              price,
              priceCurrency: 'IDR',
              url,
              availability: 'https://schema.org/InStock',
              businessFunction:
                listing.listing_type === 'rent'
                  ? 'http://purl.org/goodrelations/v1#LeaseOut'
                  : 'http://purl.org/goodrelations/v1#Sell',
            }
          : undefined,
    }
  }

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <PropertyDetailClient id={id} />
    </>
  )
}
