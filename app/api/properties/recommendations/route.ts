import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/properties/recommendations?limit=10&city=Sleman
 *
 * Menyusun hingga `limit` (maksimal 10) rekomendasi properti terbit untuk
 * carousel "Pilihan khusus untuk Anda" di beranda.
 *
 * Urutan rekomendasi:
 *  1. properti yang kotanya/kecamatannya cocok dengan lokasi pengguna
 *  2. sisanya, dari yang paling baru dipasang
 *
 * Lokasi pengguna ditentukan bertingkat:
 *  a. `?city=` (mis. dari preferensi yang sudah tersimpan di perangkat)
 *  b. header geolokasi Vercel (`x-vercel-ip-city`) — perkiraan kota dari IP
 */

const SELECT = 'id,title,listing_type,status,property_type,city,district,province,price,price_period,bedrooms,bathrooms,land_area,building_area,created_at,property_media(storage_path,media_type,sort_order)'

type PropertyRow = {
  id: string
  title: string
  listing_type: string | null
  city: string | null
  district: string | null
  province: string | null
  price: number | null
  price_period: string | null
  bedrooms: number | null
  bathrooms: number | null
  land_area: number | null
  building_area: number | null
  created_at: string
  property_media?: { storage_path: string; media_type?: string | null; sort_order?: number | null }[] | null
}

const normalize = (value?: string | null) => String(value ?? '').toLowerCase().replace(/^(kota|kabupaten|kab\.?|city of)\s+/i, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Kota cocok kalau salah satu nama mengandung nama yang lain (mis. "Sleman" vs "Depok, Sleman"). */
function matches(area: string | null, city: string) {
  const left = normalize(area)
  const right = normalize(city)
  if (!left || !right || right.length < 3) return false
  return left.includes(right) || right.includes(left)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const requested = Number(searchParams.get('limit') ?? 10)
  const limit = Math.min(Math.max(Number.isFinite(requested) ? Math.trunc(requested) : 10, 1), 10)
  const explicitCity = (searchParams.get('city') ?? '').trim()
  let geoCity = ''
  try {
    geoCity = decodeURIComponent(request.headers.get('x-vercel-ip-city') ?? '').trim()
  } catch {
    geoCity = (request.headers.get('x-vercel-ip-city') ?? '').trim()
  }
  const city = explicitCity || geoCity

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select(SELECT)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) {
    console.error('[homy] gagal memuat rekomendasi properti:', error.message)
    return NextResponse.json({ error: 'Gagal memuat rekomendasi properti.' }, { status: 502 })
  }

  const rows = (data ?? []) as PropertyRow[]
  const nearby: PropertyRow[] = []
  const others: PropertyRow[] = []
  for (const row of rows) {
    if (city && (matches(row.city, city) || matches(row.district, city))) nearby.push(row)
    else others.push(row)
  }
  const picked = [...nearby, ...others].slice(0, limit)

  return NextResponse.json({
    ok: true,
    city: city || null,
    citySource: explicitCity ? 'saved' : geoCity ? 'geo' : null,
    matched: nearby.length,
    count: picked.length,
    data: picked,
  })
}
