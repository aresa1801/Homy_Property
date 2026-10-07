/**
 * Homy — programmatic SEO per lokasi.
 * Membangun halaman "Rumah Dijual/Disewa di <Kota>" dari dataset 514 kabupaten/kota
 * (lib/regions-data.ts) + listing published di Supabase. Murni server-side & aman-gagal.
 */
import { REGIONS, type Region } from './regions-data'

export type { Region } from './regions-data'
import { hideDetailAddress } from './property-format'

export type ListingType = 'sale' | 'rent'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/* ------------------------------ slug / region ----------------------------- */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Inti nama wilayah tanpa prefix jenis ("kota"/"kabupaten"). */
export function coreName(city: string): string {
  return city
    .toLowerCase()
    .replace(/\bkabupaten\b|\bkab\.?\b|\bkota\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Slug kanonik sebuah wilayah, mis. "kota-yogyakarta", "kabupaten-bantul". */
export function regionSlug(region: Region): string {
  return slugify(region.city)
}

export function regionName(region: Region): string {
  return region.city
}

/** Label singkat untuk judul: "Yogyakarta", "Bantul", "Kulon Progo". */
export function regionShortName(region: Region): string {
  return region.city.replace(/^(Kabupaten|Kota)\s+/i, '')
}

export const REGION_BY_SLUG: Map<string, Region> = new Map(
  REGIONS.map((r) => [regionSlug(r), r] as const),
)

export function slugToRegion(slug: string): Region | null {
  return REGION_BY_SLUG.get(slug) ?? null
}

/** Wilayah dikelompokkan per provinsi (untuk hub internal linking). */
export const REGIONS_BY_PROVINCE: Array<{ province: string; regions: Region[] }> = (() => {
  const map = new Map<string, Region[]>()
  for (const r of REGIONS) {
    const arr = map.get(r.province) ?? []
    arr.push(r)
    map.set(r.province, arr)
  }
  return [...map.entries()]
    .map(([province, regions]) => ({ province, regions }))
    .sort((a, b) => a.province.localeCompare(b.province))
})()

const CORE_TO_SLUGS: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>()
  for (const r of REGIONS) {
    const c = coreName(r.city)
    const arr = m.get(c) ?? []
    arr.push(regionSlug(r))
    m.set(c, arr)
  }
  return m
})()

/** Terjemahkan nilai `city` di DB menjadi slug wilayah kanonik (best-effort). */
export function cityToRegionSlug(city?: string | null): string | null {
  if (!city) return null
  const raw = city.toLowerCase()
  const core = coreName(city)
  if (!core) return null
  const candidates = CORE_TO_SLUGS.get(core)
  if (!candidates || candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]
  if (/^\s*kota\b/.test(raw)) return candidates.find((s) => s.startsWith('kota-')) ?? candidates[0]
  if (/^\s*(kabupaten|kab)\b/.test(raw)) {
    return candidates.find((s) => s.startsWith('kabupaten-')) ?? candidates[0]
  }
  return candidates.find((s) => s.startsWith('kota-')) ?? candidates[0]
}

/* ------------------------------- data listing ------------------------------ */

export type LocationListing = {
  id: string
  title: string | null
  listing_type: string | null
  property_type: string | null
  city: string | null
  district: string | null
  price: number | null
  price_period: string | null
  bedrooms: number | null
  bathrooms: number | null
  land_area: number | null
  building_area: number | null
  updated_at: string | null
  created_at: string | null
  image: string | null
  region_slug: string | null
}

type RawListing = {
  id: string
  title: string | null
  listing_type: string | null
  property_type: string | null
  city: string | null
  district: string | null
  price: number | string | null
  price_period: string | null
  bedrooms: number | null
  bathrooms: number | null
  land_area: number | null
  building_area: number | null
  updated_at: string | null
  created_at: string | null
  property_media?: Array<{ storage_path: string | null; sort_order: number | null }> | null
}

function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  if (!SUPABASE_URL) return null
  const base = SUPABASE_URL.replace(/\/$/, '')
  return `${base}/storage/v1/render/image/public/property-media/${path.replace(/^\//, '')}?width=640&quality=72&resize=cover`
}

const LISTING_SELECT =
  'id,title,listing_type,property_type,city,district,price,price_period,bedrooms,bathrooms,land_area,building_area,updated_at,created_at,property_media(storage_path,sort_order)'

/** Semua listing published (maks 5000) — dipakai untuk membangun halaman lokasi. */
export async function fetchPublishedLocationListings(): Promise<LocationListing[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return []
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?select=${LISTING_SELECT}&status=eq.published&order=updated_at.desc&limit=5000`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        next: { revalidate: 1800 },
      },
    )
    if (!res.ok) return []
    const rows = (await res.json()) as RawListing[]
    if (!Array.isArray(rows)) return []
    return rows.map((r) => {
      const media = (r.property_media ?? [])
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      return {
        id: r.id,
        title: r.title ? hideDetailAddress(r.title) : null,
        listing_type: r.listing_type,
        property_type: r.property_type,
        city: r.city,
        district: r.district,
        price: r.price === null || r.price === undefined ? null : Number(r.price),
        price_period: r.price_period,
        bedrooms: r.bedrooms,
        bathrooms: r.bathrooms,
        land_area: r.land_area,
        building_area: r.building_area,
        updated_at: r.updated_at,
        created_at: r.created_at,
        image: mediaUrl(media[0]?.storage_path),
        region_slug: cityToRegionSlug(r.city),
      }
    })
  } catch {
    return []
  }
}

export function listingsForRegion(
  all: LocationListing[],
  region: Region,
  type: ListingType,
): LocationListing[] {
  const slug = regionSlug(region)
  const core = coreName(region.city)
  return all.filter((l) => {
    if (l.listing_type !== type) return false
    if (l.region_slug === slug) return true
    // fallback: cocokkan inti nama kota (mis. DB "Kulon Progo" vs "Kabupaten Kulon Progo")
    return !l.region_slug && coreName(l.city ?? '') === core
  })
}

/* --------------------------------- konten --------------------------------- */

export const TYPE_LABEL: Record<ListingType, string> = {
  sale: 'Dijual',
  rent: 'Disewa',
}

export const TYPE_KEYWORD: Record<ListingType, string> = {
  sale: 'dijual',
  rent: 'disewa',
}

function districtsOf(listings: LocationListing[]): string[] {
  return [...new Set(listings.map((l) => l.district).filter((d): d is string => Boolean(d)))].slice(0, 6)
}

export type PriceStats = { min: number; max: number; median: number; count: number }

export function priceStats(listings: LocationListing[]): PriceStats | null {
  const prices = listings.map((l) => l.price).filter((p): p is number => Boolean(p && p > 0))
  if (prices.length === 0) return null
  const sorted = [...prices].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
  return { min, max, median, count: prices.length }
}

export function formatIDR(v: number): string {
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(v % 1_000_000_000 === 0 ? 0 : 1)} M`
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)} jt`
  return `Rp ${Math.round(v).toLocaleString('id-ID')}`
}

/** Paragraf pengantar unik per lokasi + tipe. */
export function buildIntro(region: Region, type: ListingType, listings: LocationListing[]): string[] {
  const city = regionShortName(region)
  const province = region.province
  const keyword = TYPE_KEYWORD[type] === 'dijual' ? 'dijual' : 'disewakan'
  const verb = type === 'sale' ? 'membeli' : 'menyewa'
  const noun = type === 'sale' ? 'rumah' : 'hunian'

  const paras: string[] = []
  paras.push(
    `Homy Property menghimpun listing properti ${keyword} di ${region.city}, ${province}. ` +
      `Semua iklan ditayangkan langsung oleh pemilik maupun agen terverifikasi, lengkap dengan foto, ` +
      `spesifikasi (kamar, kamar mandi, luas tanah & bangunan), serta informasi harga terbaru.`,
  )

  const stats = priceStats(listings)
  if (listings.length > 0 && stats) {
    paras.push(
      `Saat ini terdapat ${listings.length} properti ${keyword} yang tayang di ${city}, ` +
        `dengan rentang harga ${formatIDR(stats.min)} hingga ${formatIDR(stats.max)}` +
        (type === 'rent' ? ' (menyesuaikan periode sewa).' : '.') +
        ` Harga median berada di kisaran ${formatIDR(stats.median)}, membantu Anda menakar nilai pasar ` +
        `sebelum menghubungi penjual.`,
    )
    const ds = districtsOf(listings)
    if (ds.length > 0) {
      paras.push(
        `Pilihan lokasi ${keyword} tersedia antara lain di kawasan ${ds.join(', ')}. ` +
          `Perbandingan tiap area bisa Anda lihat pada kartu listing di bawah.`,
      )
    }
  } else {
    paras.push(
      `Belum ada listing ${keyword} yang tayang di ${city} saat ini. ` +
        `Halaman ini menampilkan peluang bagi Anda yang ingin memulai: pasang iklan properti di ${city} ` +
        `dan jangkau calon ${type === 'sale' ? 'pembeli' : 'penyewa'} dari seluruh Indonesia secara gratis.`,
    )
  }

  paras.push(
    `Tips ${verb} ${noun} di ${city}: periksa dokumen (SHM/HGB), cek akses jalan dan fasilitas sekitar, ` +
      `bandingkan harga per meter persegi, dan gunakan fitur pesan Homy untuk berkomunikasi langsung ` +
      `dengan pemilik tanpa perantara. Untuk kebutuhan legalitas, Homy juga menyediakan rekomendasi ` +
      `Notaris & PPAT.`,
  )
  return paras
}

export function buildFaq(region: Region, type: ListingType, listings: LocationListing[]): { q: string; a: string }[] {
  const city = regionShortName(region)
  const kw = type === 'sale' ? 'dijual' : 'disewa'
  const stats = priceStats(listings)
  const faqs: { q: string; a: string }[] = []

  faqs.push({
    q: `Berapa harga properti ${kw} di ${city}?`,
    a: stats
      ? `Dari ${stats.count} listing yang tayang, harga properti ${kw} di ${city} berkisar ${formatIDR(stats.min)} sampai ${formatIDR(stats.max)}, dengan harga median ${formatIDR(stats.median)}. Harga akhir bergantung pada lokasi, luas, dan kondisi bangunan.`
      : `Belum ada listing aktif di ${city}. Harga di wilayah ini sangat bergantung pada lokasi, luas tanah/bangunan, dan akses. Pasang iklan atau hubungi kami untuk informasi terbaru.`,
  })
  faqs.push({
    q: `Apakah pasang iklan properti di ${city} gratis?`,
    a: `Ya. Pemilik dan agen dapat memasang iklan properti di Homy Property tanpa biaya, lalu dihubungi langsung oleh calon pembeli atau penyewa.`,
  })
  faqs.push({
    q: `Bagaimana cara menghubungi pemilik properti ${kw} di ${city}?`,
    a: `Buka detail listing yang Anda minati, lalu gunakan tombol pesan/WhatsApp untuk menghubungi pemilik atau agen. Anda juga dapat menyimpan listing ke favorit dan mengajukan jadwal survei.`,
  })
  if (type === 'sale') {
    faqs.push({
      q: `Dokumen apa yang perlu dicek saat membeli rumah di ${city}?`,
      a: `Pastikan sertifikat (SHM, HGB, atau lainnya), IMB/PBG, kesesuaian luas tanah, serta tidak ada sengketa atau tunggakan. Homy merekomendasikan Notaris & PPAT untuk proses transaksi yang aman.`,
    })
  } else {
    faqs.push({
      q: `Apa yang perlu diperhatikan saat menyewa properti di ${city}?`,
      a: `Perhatikan jangka waktu sewa, periode pembayaran, isi perabot (furnished/tidak), biaya listrik & air, serta ketentuan perpanjangan. Semua disepakati langsung dengan pemilik sebelum transaksi.`,
    })
  }
  return faqs
}

/** Wilayah lain di provinsi yang sama (internal linking). */
export function relatedRegions(region: Region, limit = 12): Region[] {
  const same = REGIONS.filter(
    (r) => r.province === region.province && regionSlug(r) !== regionSlug(region),
  )
  return same.slice(0, limit)
}
