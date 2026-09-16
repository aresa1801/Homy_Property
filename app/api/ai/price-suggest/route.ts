import { NextResponse } from 'next/server'
import { AI_DISCLAIMER, AiError, aiConfigured, aiJson } from '@/lib/ai'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { computeStats, fetchPublished, listingArea, listingLine, statsBlock, type MarketListing } from '@/lib/market'

export const runtime = 'nodejs'
export const maxDuration = 60

type Body = {
  listing_type?: string
  property_type?: string
  city?: string
  district?: string
  province?: string
  land_area?: number
  building_area?: number
  bedrooms?: number
  bathrooms?: number
  furnished?: string
  property_condition?: string
  certificate?: string
  amenities?: string[]
  min_lease_months?: number
  extra_notes?: string
}

type Suggestion = {
  recommended: number | null
  range_low: number | null
  range_high: number | null
  price_per_m2: number | null
  confidence: 'rendah' | 'sedang' | 'tinggi'
  rationale: string
  factors: string[]
  tips: string[]
}

const SYSTEM = `Kamu analis harga properti Indonesia untuk platform Homy Property.
Tugasmu: memberi rekomendasi harga jual/sewa berdasarkan STATISTIK PASAR dan PEMBANDING yang diberikan.

ATURAN:
1. Angka rekomendasi HARUS berbasis data yang diberikan (median/rata-rata per m2 dan harga pembanding). Jangan mengarang angka pasar lain.
2. Kalau jumlah pembanding sedikit (<3), set confidence "rendah" dan sebutkan keterbatasannya.
3. Untuk listing sewa, angka = harga per bulan. Untuk jual, angka = harga total.
4. Ukuran area yang dipakai untuk per-m2: bangunan kalau ada, kalau tidak tanah.
5. Alasan (rationale) maksimal 3 kalimat, bahasa Indonesia, menyebut angka pembanding nyata.
6. "factors" = 3-5 poin singkat faktor yang menaikkan/menurunkan harga. "tips" = 2-4 saran praktis agar properti cepat terjual/tersewa.
7. GAYA BAHASA: Indonesia sehari-hari yang sopan dan profesional. JANGAN pakai sintaks markdown di dalam teks (tanpa tanda bintang * atau **, tanpa #, tanpa _).

Balas JSON dengan bentuk:
{"recommended": number, "range_low": number, "range_high": number, "price_per_m2": number, "confidence": "rendah|sedang|tinggi", "rationale": "...", "factors": ["..."], "tips": ["..."]}`

export async function POST(request: Request) {
  if (!aiConfigured()) return NextResponse.json({ error: 'Fitur AI belum diaktifkan (kunci AI belum diatur).' }, { status: 503 })
  const limit = rateLimit(clientKey(request, 'ai-price'), 15, 60_000)
  if (!limit.ok) return NextResponse.json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` }, { status: 429 })

  let body: Body = {}
  try { body = (await request.json()) as Body } catch { /* kosong */ }

  const listingType = body.listing_type === 'rent' ? 'rent' : 'sale'
  const propertyType = (body.property_type ?? '').trim()
  const city = (body.city ?? '').trim()
  const district = (body.district ?? '').trim()

  if (!propertyType && !city) {
    return NextResponse.json({ error: 'Isi minimal tipe properti atau kota/kecamatan agar saran harga berbasis data.' }, { status: 400 })
  }

  try {
    const all = await fetchPublished(400)
    const sameKind = all.filter((row) => row.listing_type === listingType)

    const levels: { rows: MarketListing[]; scope: string }[] = []
    if (district) levels.push({ rows: sameKind.filter((row) => (row.district ?? '').toLowerCase() === district.toLowerCase() && (!propertyType || row.property_type === propertyType)), scope: `${propertyType || 'semua tipe'} di kecamatan ${district}` })
    if (city) levels.push({ rows: sameKind.filter((row) => (row.city ?? '').toLowerCase().includes(city.toLowerCase()) && (!propertyType || row.property_type === propertyType)), scope: `${propertyType || 'semua tipe'} di ${city}` })
    if (propertyType) levels.push({ rows: sameKind.filter((row) => row.property_type === propertyType), scope: `semua ${propertyType} (nasional)` })
    levels.push({ rows: sameKind, scope: 'semua listing terbit sejenis' })

    const chosen = levels.find((level) => level.rows.length >= 3) ?? levels[levels.length - 1]
    const stats = computeStats(chosen.rows, chosen.scope)
    const comparables = chosen.rows
      .slice()
      .sort((a, b) => Number(b.created_at ? Date.parse(String(b.created_at)) : 0) - Number(a.created_at ? Date.parse(String(a.created_at)) : 0))
      .slice(0, 8)

    const profiled = chosen.rows.map((row) => ({ row, perM2: (() => { const price = Number(row.price); const area = listingArea(row); return price > 0 && area && area > 0 ? price / area : null })() }))
    const perM2Values = profiled.map((item) => item.perM2).filter((value): value is number => value != null)
    const draftPerM2 = (() => {
      const area = body.building_area ?? body.land_area
      return null as number | null
    })()

    const payload = {
      listing_type: listingType === 'rent' ? 'sewa (per bulan)' : 'jual',
      spesifikasi_draft: {
        tipe: propertyType || 'tidak disebut',
        kota: city || 'tidak disebut',
        kecamatan: district || 'tidak disebut',
        provinsi: body.province || 'tidak disebut',
        luas_tanah: body.land_area ?? null,
        luas_bangunan: body.building_area ?? null,
        kamar_tidur: body.bedrooms ?? null,
        kamar_mandi: body.bathrooms ?? null,
        perabot: body.furnished || null,
        kondisi: body.property_condition || null,
        sertifikat: body.certificate || null,
        fasilitas: body.amenities ?? [],
        min_sewa_bulan: body.min_lease_months ?? null,
        catatan: body.extra_notes || null,
      },
      statistik_pasar: statsBlock(stats),
      harga_per_m2_data: perM2Values.length,
      pembanding: comparables.map((row, index) => listingLine(row, index)),
      catatan_draft_per_m2: draftPerM2,
    }

    const suggestion = await aiJson<Suggestion>(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      { temperature: 0.2, maxTokens: 800 },
    )

    const sane: Suggestion = {
      recommended: Number.isFinite(Number(suggestion?.recommended)) ? Number(suggestion.recommended) : stats.median,
      range_low: Number.isFinite(Number(suggestion?.range_low)) ? Number(suggestion.range_low) : stats.min,
      range_high: Number.isFinite(Number(suggestion?.range_high)) ? Number(suggestion.range_high) : stats.max,
      price_per_m2: Number.isFinite(Number(suggestion?.price_per_m2)) ? Number(suggestion.price_per_m2) : stats.medianPerM2,
      confidence: (['rendah', 'sedang', 'tinggi'] as const).includes(suggestion?.confidence as never) ? suggestion.confidence : (stats.total >= 8 ? 'tinggi' : stats.total >= 3 ? 'sedang' : 'rendah'),
      rationale: String(suggestion?.rationale ?? '').slice(0, 1200),
      factors: Array.isArray(suggestion?.factors) ? suggestion.factors.slice(0, 6).map(String) : [],
      tips: Array.isArray(suggestion?.tips) ? suggestion.tips.slice(0, 5).map(String) : [],
    }

    return NextResponse.json({
      stats,
      sampleSize: stats.total,
      scope: chosen.scope,
      comparables: comparables.map((row) => ({ id: row.id, title: row.title, city: row.city, district: row.district, listing_type: row.listing_type, price: row.price, land_area: row.land_area, building_area: row.building_area, bedrooms: row.bedrooms })),
      suggestion: sane,
      disclaimer: AI_DISCLAIMER,
    })
  } catch (error) {
    const aiError = error instanceof AiError ? error : null
    return NextResponse.json({ error: aiError?.message ?? 'AI sedang tidak bisa dihubungi. Coba lagi sebentar lagi.', detail: aiError?.detail }, { status: aiError?.status ?? 502 })
  }
}
