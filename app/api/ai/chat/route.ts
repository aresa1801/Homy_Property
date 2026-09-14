import { NextResponse } from 'next/server'
import { aiChat, aiConfigured, aiModel, AiError, type AiMessage } from '@/lib/ai'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { computeStats, fetchById, fetchPublished, listingDetail, listingLine, statsBlock, type ListingFilters, type MarketListing } from '@/lib/market'

export const runtime = 'nodejs'
export const maxDuration = 60

type ChatBody = {
  message?: string
  history?: { role?: string; content?: string }[]
  propertyId?: string | null
  filters?: ListingFilters
}

const SYSTEM = `Kamu adalah "Homy AI", asisten properti berbahasa Indonesia untuk platform Homy Property.

TUGAS: membantu calon pembeli/penyewa properti dan mitra agen/pemilik.

ATURAN WAJIB:
1. Jawab HANYA berdasarkan DATA LISTING dan STATISTIK yang diberikan di pesan pengguna. Jangan mengarang properti, alamat, nomor telepon, atau harga yang tidak ada di data.
2. Kalau data tidak memuat jawabannya, katakan dengan jujur data itu belum tersedia dan sebutkan apa yang bisa dilakukan (misal: hubungi agen lewat tombol tanya di halaman properti, atau perluas area/budget).
3. Selalu tulis harga dalam format Rupiah dengan pemisah ribuan (contoh: Rp 1.500.000.000). Untuk sewa, sebutkan "per bulan" kalau memang harganya bulanan.
4. Kalau merekomendasikan listing, sebutkan judulnya dan alasan singkat kenapa cocok (harga, lokasi, luas, fasilitas) — maksimal 3-4 listing, jangan menyebut id panjang kecuali diminta.
5. Jangan memberi nasihat hukum/pajak yang mengikat. Untuk hal itu, sarankan konsultasi dengan notaris/agen.
6. Ringkas, ramah, profesional. Maksimal ~180 kata, pakai poin-poin pendek bila membantu. Bahasa Indonesia.
7. Jangan menyebut dirimu sebagai model tertentu; kamu "Homy AI".
8. JANGAN mencampur harga JUAL dan harga SEWA dalam satu rata-rata. Kalau menyebut rata-rata pasar, sebutkan terpisah ("rata-rata harga jual ...", "rata-rata harga sewa ... per bulan"). Pakai baris "Pisahkan jual vs sewa" di statistik.`

export async function GET() {
  return NextResponse.json({ configured: aiConfigured(), model: aiModel() })
}

export async function POST(request: Request) {
  if (!aiConfigured()) {
    return NextResponse.json({ error: 'Fitur AI belum diaktifkan (kunci AI belum diatur).' }, { status: 503 })
  }
  const limit = rateLimit(clientKey(request, 'ai-chat'), 20, 60_000)
  if (!limit.ok) return NextResponse.json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` }, { status: 429 })

  let body: ChatBody = {}
  try { body = (await request.json()) as ChatBody } catch { /* body kosong */ }

  const question = (body.message ?? body.history?.at(-1)?.content ?? '').toString().trim().slice(0, 1200)
  if (!question) return NextResponse.json({ error: 'Pertanyaan belum diisi.' }, { status: 400 })

  const history: AiMessage[] = (body.history ?? [])
    .slice(-8)
    .filter((item) => item?.content)
    .map((item) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content).slice(0, 1500) }))
  if (history.length && history.at(-1)?.content.trim() === question) history.pop()

  const filters: ListingFilters = { ...(body.filters ?? {}), listing_type: body.filters?.listing_type ?? undefined }

  try {
    const rows = await fetchPublished(400)
    let mode: 'property' | 'search' | 'market' = 'search'
    let dataBlock = ''
    let sourceRows: MarketListing[] = []

    const property = body.propertyId ? await fetchById(body.propertyId) : null

    if (property) {
      mode = 'property'
      const siblings = rows.filter((row) => row.id !== property.id && row.listing_type === property.listing_type && (row.district === property.district || row.city === property.city))
      const stats = computeStats(siblings, `daerah ${property.district || property.city || '-'} (${property.listing_type === 'rent' ? 'sewa' : 'jual'})`)
      sourceRows = siblings.slice(0, 6)
      dataBlock = [
        '=== PROPERTI YANG DITANYAKAN ===',
        listingDetail(property),
        '',
        '=== PEMBANDING & STATISTIK AREA ===',
        statsBlock(stats),
        siblings.length ? 'Pembanding:\n' + siblings.slice(0, 6).map((row, index) => listingLine(row, index)).join('\n') : 'Belum ada pembanding di area yang sama.',
      ].join('\n')
    } else {
      const candidates = rows.filter((row) => {
        if (filters.listing_type && row.listing_type !== filters.listing_type) return false
        if (filters.city && !(row.city ?? '').toLowerCase().includes(String(filters.city).toLowerCase())) return false
        if (filters.district && !(row.district ?? '').toLowerCase().includes(String(filters.district).toLowerCase())) return false
        if (filters.property_type && row.property_type !== filters.property_type) return false
        if (filters.maxPrice && Number(row.price) > filters.maxPrice) return false
        return true
      })
      const picked = candidates.slice(0, 12)
      sourceRows = picked.slice(0, 6)
      const stats = computeStats(candidates, filters.city || filters.district ? `filter ${[filters.district, filters.city].filter(Boolean).join(', ')}` : 'seluruh listing terbit')
      mode = candidates.length ? 'search' : 'market'
      dataBlock = [
        '=== RINGKASAN PASAR ===',
        statsBlock(stats),
        '',
        candidates.length ? `=== ${picked.length} LISTING PALING RELEVAN ===\n` + picked.map((row, index) => listingLine(row, index)).join('\n') : 'Tidak ada listing yang cocok dengan filter tersebut.',
      ].join('\n')
    }

    const { text, usage } = await aiChat(
      [
        { role: 'system', content: SYSTEM },
        ...history,
        { role: 'user', content: `${dataBlock}\n\n=== PERTANYAAN PENGGUNA ===\n${question}` },
      ],
      { temperature: 0.25, maxTokens: 900 },
    )

    const sources = [property, ...sourceRows].filter((row): row is MarketListing => Boolean(row))
    return NextResponse.json({
      answer: text,
      mode,
      configured: true,
      usage,
      sources: sources.map((row) => ({ id: row.id, title: row.title, city: row.city, district: row.district, listing_type: row.listing_type, price: row.price })).slice(0, 7),
    })
  } catch (error) {
    const aiError = error instanceof AiError ? error : null
    return NextResponse.json(
      { error: aiError?.message ?? 'AI sedang tidak bisa dihubungi. Coba lagi sebentar lagi.', detail: aiError?.detail },
      { status: aiError?.status ?? 502 },
    )
  }
}
