import { NextResponse } from 'next/server'
import { AiError, aiConfigured, aiJson } from '@/lib/ai'
import { clientKey, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

type Body = {
  title?: string
  listing_type?: string
  property_type?: string
  city?: string
  district?: string
  province?: string
  address?: string
  land_area?: number
  building_area?: number
  bedrooms?: number
  bathrooms?: number
  furnished?: string
  property_condition?: string
  certificate?: string
  year_built?: number
  floors?: number
  carports?: number
  electricity_va?: number
  water_source?: string
  amenities?: string[]
  nearby?: string[]
  price?: number
  price_period?: string
  negotiable?: boolean
  min_lease_months?: number
  rent_payment_terms?: string
  occupancy_status?: string
  utilities_included?: boolean
  available_from?: string
  extra_notes?: string
}

type Description = {
  title: string
  description: string
  ai_summary: string
  highlights: string[]
  faq: { q: string; a: string }[]
  keywords: string[]
}

const SYSTEM = `Kamu copywriter properti Indonesia untuk Homy Property.
Dari DATA SPESIFIKASI yang diberikan, tulis materi iklan listing yang jujur (jangan menambah fakta yang tidak ada).

ATURAN:
1. "title" maksimal 70 karakter, menarik tapi faktual (tipe + kamar/luas + lokasi).
2. "description" 90-160 kata, bahasa Indonesia, 3 paragraf pendek: gambaran properti, keunggulan lokasi/fasilitas, ajakan menghubungi agen lewat Homy.
3. "ai_summary" 1-2 kalimat padat untuk jawab cepat bot AI (sebut harga, luas, kamar, lokasi).
4. "highlights" 4-6 poin singkat (masing-masing maksimal 12 kata).
5. "faq" 3-5 tanya-jawab yang paling mungkin ditanya calon pembeli/penyewa, jawabannya HANYA dari data.
6. "keywords" 6-10 kata kunci pencarian (tanpa tanda baca).
7. Jangan mengarang nomor telepon, alamat spesifik yang tidak ada, atau sertifikat yang tidak disebut.

Balas JSON: {"title":"...","description":"...","ai_summary":"...","highlights":["..."],"faq":[{"q":"...","a":"..."}],"keywords":["..."]}`

export async function POST(request: Request) {
  if (!aiConfigured()) return NextResponse.json({ error: 'Fitur AI belum diaktifkan (kunci AI belum diatur).' }, { status: 503 })
  const limit = rateLimit(clientKey(request, 'ai-describe'), 20, 60_000)
  if (!limit.ok) return NextResponse.json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` }, { status: 429 })

  let body: Body = {}
  try { body = (await request.json()) as Body } catch { /* kosong */ }

  const filled = Object.entries(body).filter(([, value]) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length))
  if (filled.length < 3) {
    return NextResponse.json({ error: 'Isi minimal tipe properti, lokasi, dan luas/kamar agar AI bisa menulis deskripsi.' }, { status: 400 })
  }

  try {
    const result = await aiJson<Description>(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `DATA SPESIFIKASI:\n${JSON.stringify(Object.fromEntries(filled))}` },
      ],
      { temperature: 0.6, maxTokens: 1500 },
    )

    return NextResponse.json({
      title: String(result?.title ?? '').slice(0, 120),
      description: String(result?.description ?? ''),
      ai_summary: String(result?.ai_summary ?? ''),
      highlights: Array.isArray(result?.highlights) ? result.highlights.slice(0, 8).map(String) : [],
      faq: Array.isArray(result?.faq) ? result.faq.slice(0, 6).map((item) => ({ q: String(item?.q ?? ''), a: String(item?.a ?? '') })) : [],
      keywords: Array.isArray(result?.keywords) ? result.keywords.slice(0, 12).map(String) : [],
    })
  } catch (error) {
    const aiError = error instanceof AiError ? error : null
    return NextResponse.json({ error: aiError?.message ?? 'AI sedang tidak bisa dihubungi. Coba lagi sebentar lagi.', detail: aiError?.detail }, { status: aiError?.status ?? 502 })
  }
}
