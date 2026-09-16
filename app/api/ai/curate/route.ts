import { NextResponse } from 'next/server'
import { AI_DISCLAIMER, AiError, aiConfigured, aiJson } from '@/lib/ai'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { computeStats, fetchPublished, listingLine, statsBlock, type MarketListing } from '@/lib/market'

export const runtime = 'nodejs'
export const maxDuration = 60

type Body = {
  listing_type?: string
  budget?: number
  city?: string
  district?: string
  property_type?: string
  bedrooms?: number
  needs?: string
  limit?: number
}

type Curation = {
  summary: string
  recommendations: { id: string; match_score: number; why: string; watch_out: string }[]
  advice: string
}

const SYSTEM = `Kamu konsultan properti Homy Property yang membantu CALON PEMBELI/PENYEWA memilih listing terbaik.

ATURAN:
1. Pilih HANYA dari daftar listing yang diberikan (jangan mengarang listing baru). Gunakan id yang ada di data.
2. Nilai match_score 0-100 berdasarkan kecocokan budget, lokasi, tipe, jumlah kamar, dan kebutuhan yang disebut pembeli.
3. "why" = 1-2 kalimat alasan konkret (sebut angka harga/luas/fasilitas dari data). "watch_out" = 1 kalimat hal yang perlu dicek/diperhatikan (misal harga di atas budget, data fasilitas belum lengkap, min sewa panjang).
4. Kalau tidak ada listing yang benar-benar cocok, katakan jujur di "summary" dan beri saran (naikkan budget / perluas area / ubah tipe).
5. "advice" = 2-4 saran langkah berikutnya untuk pembeli (maksimal 4 poin singkat, bahasa Indonesia). Harga pakai format Rupiah.
6. GAYA BAHASA: Indonesia sehari-hari yang sopan dan profesional, seperti konsultan menjelaskan langsung ke calon pembeli. Hindari bahasa kaku. JANGAN pakai sintaks markdown di dalam teks (tanpa tanda bintang * atau **, tanpa #, tanpa _); kalau merinci, mulai dengan angka atau "- ".

Balas JSON: {"summary":"...","recommendations":[{"id":"...","match_score":0,"why":"...","watch_out":"..."}],"advice":"..."}`

export async function POST(request: Request) {
  if (!aiConfigured()) return NextResponse.json({ error: 'Fitur AI belum diaktifkan (kunci AI belum diatur).' }, { status: 503 })
  const limit = rateLimit(clientKey(request, 'ai-curate'), 15, 60_000)
  if (!limit.ok) return NextResponse.json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` }, { status: 429 })

  let body: Body = {}
  try { body = (await request.json()) as Body } catch { /* kosong */ }

  const listingType = body.listing_type === 'rent' ? 'rent' : body.listing_type === 'sale' ? 'sale' : ''
  const budget = Number(body.budget) > 0 ? Number(body.budget) : null
  const city = (body.city ?? '').trim().toLowerCase()
  const district = (body.district ?? '').trim().toLowerCase()
  const propertyType = (body.property_type ?? '').trim()
  const bedrooms = Number(body.bedrooms) > 0 ? Number(body.bedrooms) : null
  const needs = (body.needs ?? '').trim().slice(0, 600)
  const max = Math.min(Math.max(Number(body.limit) || 4, 1), 8)

  try {
    const all = await fetchPublished(400)
    const base = all.filter((row) => {
      if (listingType && row.listing_type !== listingType) return false
      return true
    })

    const applyStrict = (rows: MarketListing[]) => rows.filter((row) => {
      if (budget && Number(row.price) > budget * 1.05) return false
      if (city && !(row.city ?? '').toLowerCase().includes(city)) return false
      if (district && !(row.district ?? '').toLowerCase().includes(district)) return false
      if (propertyType && row.property_type !== propertyType) return false
      if (bedrooms && Number(row.bedrooms ?? 0) < bedrooms) return false
      return true
    })

    let relaxed: string[] = []
    let pool = applyStrict(base)
    if (pool.length < 3) {
      const relaxedRows = base.filter((row) => {
        if (budget && Number(row.price) > budget * 1.25) return false
        if (city && !(row.city ?? '').toLowerCase().includes(city)) return false
        return true
      })
      if (relaxedRows.length > pool.length) {
        if (propertyType) relaxed.push('tipe properti tidak dipatok')
        if (bedrooms) relaxed.push('jumlah kamar tidak dipatok')
        if (budget) relaxed.push('budget dilonggarkan sampai 25%')
        pool = relaxedRows
      }
    }
    if (!pool.length) pool = base.slice(0, 20)

    const candidates = pool.slice(0, 20)
    const stats = computeStats(candidates, `kandidat untuk permintaan pembeli`)

    const payload = {
      permintaan_pembeli: {
        tujuan: listingType === 'rent' ? 'sewa' : listingType === 'sale' ? 'beli' : 'belum dipastikan',
        budget_max: budget,
        kota: body.city ?? null,
        kecamatan: body.district ?? null,
        tipe: propertyType || null,
        kamar_tidur_min: bedrooms,
        kebutuhan: needs || null,
        jumlah_rekomendasi_diminta: max,
      },
      statistik_kandidat: statsBlock(stats),
      penyesuaian_filter: relaxed,
      kandidat: candidates.map((row, index) => listingLine(row, index)),
    }

    const result = await aiJson<Curation>(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      { temperature: 0.3, maxTokens: 1400 },
    )

    const byId = new Map(candidates.map((row) => [row.id, row]))
    const recommendations = (result?.recommendations ?? [])
      .map((item) => {
        const row = byId.get(String(item?.id ?? ''))
        if (!row) return null
        return {
          ...row,
          match_score: Math.min(Math.max(Number(item?.match_score) || 0, 0), 100),
          why: String(item?.why ?? ''),
          watch_out: String(item?.watch_out ?? ''),
        }
      })
      .filter(Boolean)
      .sort((a, b) => (b as { match_score: number }).match_score - (a as { match_score: number }).match_score)
      .slice(0, max)

    return NextResponse.json({
      summary: String(result?.summary ?? ''),
      advice: String(result?.advice ?? ''),
      recommendations,
      stats,
      candidates: candidates.length,
      relaxed,
      disclaimer: AI_DISCLAIMER,
    })
  } catch (error) {
    const aiError = error instanceof AiError ? error : null
    return NextResponse.json({ error: aiError?.message ?? 'AI sedang tidak bisa dihubungi. Coba lagi sebentar lagi.', detail: aiError?.detail }, { status: aiError?.status ?? 502 })
  }
}
