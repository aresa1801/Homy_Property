// Shared helpers for rendering property data coming from the API/DB.
// Kept dependency-free so it can be imported from client components.

export type PropertyRecord = {
  id: string
  title: string
  description?: string | null
  listing_type?: string | null
  status?: string | null
  property_type?: string | null
  city?: string | null
  district?: string | null
  price?: number | null
  price_period?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  land_area?: number | null
  building_area?: number | null
  furnished?: string | null
  utilities_included?: boolean | null
  available_from?: string | null
  min_lease_months?: number | null
  rent_payment_terms?: string | null
  property_condition?: string | null
  created_at?: string | null
  property_media?: { storage_path: string; media_type?: string | null; sort_order?: number | null }[] | null
  media?: { storage_path: string; sort_order?: number | null }[] | null
}

export const PROPERTY_TYPE_LABEL: Record<string, string> = {
  house: 'Rumah',
  apartment: 'Apartemen',
  land: 'Tanah',
  shopHouse: 'Ruko',
  shophouse: 'Ruko',
  villa: 'Vila',
  boardingHouse: 'Kost',
  boarding_house: 'Kost',
  office: 'Kantor',
  warehouse: 'Gudang',
}

export const FURNISHED_LABEL: Record<string, string> = {
  furnished: 'Fully furnished',
  semi_furnished: 'Semi furnished',
  unfurnished: 'Unfurnished',
}

export function formatRupiah(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Hubungi penjual'
  return 'Rp ' + Math.round(value).toLocaleString('id-ID')
}

export function formatPriceWithPeriod(price?: number | null, period?: string | null): string {
  const base = formatRupiah(price)
  if (!price) return base
  if (period === 'monthly') return `${base} / bulan`
  if (period === 'yearly') return `${base} / tahun`
  return base
}

export function propertyMeta(p: PropertyRecord): string {
  const parts: string[] = []
  if (p.bedrooms) parts.push(`${p.bedrooms} Kamar`)
  if (p.bathrooms) parts.push(`${p.bathrooms} Kamar Mandi`)
  const area = p.building_area ?? p.land_area
  if (area) parts.push(`${area} m²`)
  return parts.join('  •  ') || 'Detail menyusul'
}

export function propertyLocation(p: PropertyRecord): string {
  return [p.district, p.city].filter(Boolean).join(', ') || 'Lokasi menyusul'
}

// Resolve a public URL for the first media item of a property.
// storage_path may already be a full URL (legacy/demo) or a bucket-relative path.
export function firstMediaUrl(p: PropertyRecord, supabaseUrl?: string, bucket = 'property-media'): string | null {
  const media = (p.property_media ?? p.media ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const first = media[0]
  if (!first?.storage_path) return null
  const path = first.storage_path
  if (/^https?:\/\//i.test(path)) return path
  if (!supabaseUrl) return null
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${path.replace(/^\//, '')}`
}

export const DEMO_PROPERTY_IMAGES = [
  'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1100&q=85',
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1100&q=85',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1100&q=85',
]
