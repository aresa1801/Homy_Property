/**
 * Pengambilan data properti + statistik pasar dari Supabase.
 * Dipakai AI untuk: menjawab calon buyer, saran harga, kurasi & rekomendasi listing.
 */
import { createClient } from '@/lib/supabase/server'

export const MARKET_COLUMNS = [
  'id', 'title', 'listing_type', 'property_type', 'status',
  'province', 'city', 'district', 'address', 'postal_code',
  'price', 'price_period', 'negotiable',
  'bedrooms', 'bathrooms', 'land_area', 'building_area', 'furnished',
  'certificate', 'year_built', 'floors', 'carports', 'electricity_va',
  'water_source', 'property_condition',
  'min_lease_months', 'rent_payment_terms', 'occupancy_status', 'utilities_included', 'available_from',
  'amenities', 'nearby', 'extra_notes', 'ai_summary', 'ai_facts', 'created_at',
].join(',')

export type MarketListing = {
  id: string
  title?: string | null
  listing_type?: string | null
  property_type?: string | null
  status?: string | null
  province?: string | null
  city?: string | null
  district?: string | null
  address?: string | null
  postal_code?: string | null
  price?: number | string | null
  price_period?: string | null
  negotiable?: boolean | null
  bedrooms?: number | null
  bathrooms?: number | null
  land_area?: number | null
  building_area?: number | null
  furnished?: string | null
  certificate?: string | null
  year_built?: number | null
  floors?: number | null
  carports?: number | null
  electricity_va?: number | null
  water_source?: string | null
  property_condition?: string | null
  min_lease_months?: number | null
  rent_payment_terms?: string | null
  occupancy_status?: string | null
  utilities_included?: boolean | null
  available_from?: string | null
  amenities?: string[] | null
  nearby?: string[] | null
  extra_notes?: string | null
  ai_summary?: string | null
  ai_facts?: Record<string, unknown> | null
  created_at?: string | null
}

export type ListingFilters = {
  listing_type?: string | null
  city?: string | null
  district?: string | null
  province?: string | null
  property_type?: string | null
  bedrooms?: number | null
  maxPrice?: number | null
  minPrice?: number | null
  keyword?: string | null
  excludeId?: string | null
  excludeOwner?: string | null
}

export type MarketStats = {
  total: number
  avg: number | null
  median: number | null
  min: number | null
  max: number | null
  avgPerM2: number | null
  medianPerM2: number | null
  byDistrict: { district: string; count: number; avg: number; avgPerM2: number | null }[]
  byType: { type: string; count: number; avg: number }[]
  scope: string
}

const number = (value: unknown): number | null => {
  const parsed = typeof value === 'string' ? Number(value) : (value as number)
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

const norm = (value?: string | null) => (value ?? '').trim().toLowerCase()

export function listingArea(row: Pick<MarketListing, 'building_area' | 'land_area'>) {
  return number(row.building_area) ?? number(row.land_area) ?? null
}

export function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

/** Ambil listing terbit (published) dari database, terbaru dulu. */
export async function fetchPublished(limit = 400): Promise<MarketListing[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select(MARKET_COLUMNS)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []) as unknown as MarketListing[]
}

export async function fetchById(id: string): Promise<MarketListing | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('properties').select(MARKET_COLUMNS).eq('id', id).maybeSingle()
  if (error || !data) return null
  const row = data as unknown as MarketListing
  if (norm(row.status) !== 'published') return null
  return row
}

export function matches(row: MarketListing, filters: ListingFilters) {
  if (filters.excludeId && row.id === filters.excludeId) return false
  if (filters.listing_type && norm(row.listing_type) !== norm(filters.listing_type)) return false
  if (filters.property_type && norm(row.property_type) !== norm(filters.property_type)) return false
  if (filters.city && !norm(row.city).includes(norm(filters.city))) return false
  if (filters.district && !norm(row.district).includes(norm(filters.district))) return false
  if (filters.province && !norm(row.province).includes(norm(filters.province))) return false
  if (filters.bedrooms != null && number(row.bedrooms) != null && (number(row.bedrooms) as number) < filters.bedrooms) return false
  const price = number(row.price)
  if (filters.maxPrice != null && price != null && price > filters.maxPrice) return false
  if (filters.minPrice != null && price != null && price < filters.minPrice) return false
  if (filters.keyword) {
    const haystack = [row.title, row.city, row.district, row.province, row.property_type, row.ai_summary, (row.amenities ?? []).join(' '), (row.nearby ?? []).join(' ')]
      .map((part) => norm(part as string))
      .join(' ')
    const words = norm(filters.keyword).split(/\s+/).filter((word) => word.length > 2)
    if (words.length && !words.some((word) => haystack.includes(word))) return false
  }
  return true
}

export function searchListings(rows: MarketListing[], filters: ListingFilters, limit = 20) {
  return rows.filter((row) => matches(row, filters)).slice(0, limit)
}

/** Statistik harga untuk sekumpulan listing (dipakai saran harga & insight pasar). */
export function computeStats(rows: MarketListing[], scope: string): MarketStats {
  const prices = rows.map((row) => number(row.price)).filter((value): value is number => value != null && value > 0)
  const perM2 = rows
    .map((row) => {
      const price = number(row.price)
      const area = listingArea(row)
      return price != null && area && area > 0 ? price / area : null
    })
    .filter((value): value is number => value != null && value > 0)

  const districtMap = new Map<string, number[]>()
  const typeMap = new Map<string, number[]>()
  rows.forEach((row) => {
    const price = number(row.price)
    if (price == null || price <= 0) return
    const district = (row.district || row.city || 'Tidak diketahui').trim()
    districtMap.set(district, [...(districtMap.get(district) ?? []), price])
    const type = (row.property_type || 'lainnya').trim()
    typeMap.set(type, [...(typeMap.get(type) ?? []), price])
  })

  const byDistrict = [...districtMap.entries()]
    .map(([district, values]) => {
      const avg = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      const areas = rows
        .filter((row) => (row.district || row.city || 'Tidak diketahui').trim() === district)
        .map((row) => {
          const price = number(row.price)
          const area = listingArea(row)
          return price != null && area && area > 0 ? price / area : null
        })
        .filter((value): value is number => value != null)
      return { district, count: values.length, avg, avgPerM2: areas.length ? Math.round(areas.reduce((sum, value) => sum + value, 0) / areas.length) : null }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const byType = [...typeMap.entries()]
    .map(([type, values]) => ({ type, count: values.length, avg: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return {
    total: rows.length,
    avg: prices.length ? Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length) : null,
    median: median(prices),
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
    avgPerM2: perM2.length ? Math.round(perM2.reduce((sum, value) => sum + value, 0) / perM2.length) : null,
    medianPerM2: median(perM2.map((value) => Math.round(value))),
    byDistrict,
    byType,
    scope,
  }
}

export const rupiahText = (value?: number | null) =>
  value == null ? 'tidak tersedia' : `Rp ${Math.round(value).toLocaleString('id-ID')}`

/** Ringkasan satu baris untuk konteks prompt AI. */
export function listingLine(row: MarketListing, index?: number) {
  const parts = [
    `[${index != null ? index + 1 : '-'}] id=${row.id}`,
    row.title ?? '(tanpa judul)',
    row.listing_type === 'rent' ? 'SEWA' : row.listing_type === 'sale' ? 'JUAL' : (row.listing_type ?? '-'),
    row.property_type ?? '-',
    `${row.district ? row.district + ', ' : ''}${row.city ?? '-'}`,
    `harga=${rupiahText(number(row.price))}${row.price_period ? '/' + row.price_period : ''}${row.negotiable ? ' (nego)' : ''}`,
    row.bedrooms != null ? `KT=${row.bedrooms}` : null,
    row.bathrooms != null ? `KM=${row.bathrooms}` : null,
    row.land_area != null ? `LT=${row.land_area}m2` : null,
    row.building_area != null ? `LB=${row.building_area}m2` : null,
    row.furnished ? `perabot=${row.furnished}` : null,
    row.certificate ? `sertifikat=${row.certificate}` : null,
    row.amenities?.length ? `fasilitas=${row.amenities.slice(0, 8).join('/')}` : null,
    row.nearby?.length ? `sekitar=${row.nearby.slice(0, 6).join('/')}` : null,
    row.min_lease_months ? `min-sewa=${row.min_lease_months}bln` : null,
    row.available_from ? `tersedia=${String(row.available_from).slice(0, 10)}` : null,
  ].filter(Boolean)
  return parts.join(' | ')
}

/** Detail multi-baris satu listing (untuk tanya-jawab properti tertentu). */
export function listingDetail(row: MarketListing) {
  const lines = [
    `Judul: ${row.title ?? '-'}`,
    `ID: ${row.id}`,
    `Jenis: ${row.listing_type === 'rent' ? 'Sewa' : row.listing_type === 'sale' ? 'Jual' : row.listing_type ?? '-'}`,
    `Tipe properti: ${row.property_type ?? '-'}`,
    `Lokasi: ${[row.address, row.district, row.city, row.province, row.postal_code].filter(Boolean).join(', ') || '-'}`,
    `Harga: ${rupiahText(number(row.price))}${row.price_period ? ` per ${row.price_period}` : ''}${row.negotiable ? ' (bisa nego)' : ''}`,
    `Kamar tidur: ${row.bedrooms ?? '-'} | Kamar mandi: ${row.bathrooms ?? '-'}`,
    `Luas tanah: ${row.land_area ?? '-'} m2 | Luas bangunan: ${row.building_area ?? '-'} m2`,
    `Perabot: ${row.furnished ?? '-'} | Kondisi: ${row.property_condition ?? '-'} | Sertifikat: ${row.certificate ?? '-'}`,
    `Listrik: ${row.electricity_va ?? '-'} VA | Air: ${row.water_source ?? '-'} | Carport: ${row.carports ?? '-'}`,
    row.listing_type === 'rent' ? `Min sewa: ${row.min_lease_months ?? '-'} bulan | Skema bayar: ${row.rent_payment_terms ?? '-'} | Status huni: ${row.occupancy_status ?? '-'} | Utilitas termasuk: ${row.utilities_included ? 'ya' : 'belum tentu'} | Tersedia: ${row.available_from ?? '-'}` : null,
    row.amenities?.length ? `Fasilitas: ${row.amenities.join(', ')}` : null,
    row.nearby?.length ? `Lingkungan sekitar: ${row.nearby.join(', ')}` : null,
    row.extra_notes ? `Catatan tambahan: ${row.extra_notes}` : null,
    row.ai_summary ? `Ringkasan: ${row.ai_summary}` : null,
  ].filter(Boolean)
  return lines.join('\n')
}

export function statsBlock(stats: MarketStats) {
  const lines = [
    `Cakupan data: ${stats.scope} | jumlah listing: ${stats.total}`,
    `Harga rata-rata: ${rupiahText(stats.avg)} | median: ${rupiahText(stats.median)} | terendah: ${rupiahText(stats.min)} | tertinggi: ${rupiahText(stats.max)}`,
    `Harga rata-rata per m2: ${rupiahText(stats.avgPerM2)} | median per m2: ${rupiahText(stats.medianPerM2)}`,
  ]
  if (stats.byDistrict.length) {
    lines.push('Per kecamatan/daerah: ' + stats.byDistrict.map((item) => `${item.district} (${item.count} listing, rata-rata ${rupiahText(item.avg)}${item.avgPerM2 ? `, ${rupiahText(item.avgPerM2)}/m2` : ''})`).join('; '))
  }
  if (stats.byType.length) {
    lines.push('Per tipe: ' + stats.byType.map((item) => `${item.type} (${item.count} listing, rata-rata ${rupiahText(item.avg)})`).join('; '))
  }
  return lines.join('\n')
}
