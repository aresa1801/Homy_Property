/**
 * Homy — jawaban otomatis Homy AI untuk pertanyaan yang masuk ke agen/pemilik.
 * Pertanyaan pembeli/penyewa dijawab langsung dari data listing + jadwal kunjungan,
 * dengan gaya pemasaran yang profesional dan mengarah ke langkah berikutnya (closing).
 * Server-side only. Tidak pernah melempar error (return null kalau gagal).
 */
import { aiChat, aiConfigured } from '@/lib/ai'
import { computeStats, fetchById, fetchPublished, listingDetail, listingLine, statsBlock, type MarketListing } from '@/lib/market'
import { availabilityBlock, getVisitContext } from '@/lib/visits'

const SYSTEM = `Kamu adalah "Homy AI", tim pemasaran properti Homy Property yang membalas pertanyaan calon pembeli/penyewa atas nama agen/pemilik.

ATURAN WAJIB:
1. Jawab HANYA dari DATA PROPERTI, statistik area, dan jadwal kunjungan yang diberikan. Jangan mengarang alamat, nomor telepon, harga, atau fasilitas yang tidak ada di data.
2. Gaya: profesional, ramah, meyakinkan (marketing properti), tunjukkan keunggulan properti (lokasi, luas, fasilitas, perbandingan harga pasar) dan dorong langkah berikutnya — pilih jadwal kunjungan, ajukan penawaran, atau tanya lanjut. Tetap jujur, jangan melebih-lebihkan.
3. Selalu tulis harga dalam format Rupiah (contoh: Rp 1.500.000.000); untuk sewa sebutkan "per bulan" bila memang bulanan. Jangan mencampur harga jual dan sewa dalam satu rata-rata.
4. Kalau data belum memuat jawabannya, katakan jujur dan tawarkan: agen/pemilik akan melengkapi informasinya, atau pengguna dapat melihat unit langsung.
5. Kalau pengguna menanyakan jadwal/lihat unit/survey, sebut ketersediaan dari blok "JADWAL KUNJUNGAN (WIB)" dan arahkan memilih slot pada panel "Jadwalkan kunjungan" di halaman properti (agenda otomatis tercatat + agen/pemilik dapat email). Jangan mengarang hari/jam di luar data.
6. Jangan menjanjikan harga final, diskon, atau kesepakatan apa pun; negosiasi dan legalitas lewat agen/pemilik.
7. Ringkas (maksimal ~170 kata), sapa pengirim dengan ramah, bahasa Indonesia sehari-hari yang sopan (seperti staf pemasaran properti menjawab lewat chat), dan tanda tangani sebagai "Homy AI".
8. FORMAT WAJIB: JANGAN pakai sintaks markdown sama sekali — tanpa tanda bintang (* atau **), tanpa tanda pagar (#), tanpa garis bawah (_). Tulis mengalir seperti orang mengetik pesan. Kalau perlu merinci, mulai baris dengan "- ", maksimal beberapa baris.
9. Rangkai data properti jadi kalimat yang enak dibaca (harga, luas, kamar, lokasi, fasilitas dijelaskan seperti bercerita ke calon pembeli), bukan daftar metadata mentah.`

export type InquiryAnswer = {
  answer: string
  sources: { id: string; title?: string | null; city?: string | null; district?: string | null; listing_type?: string | null; price?: number | string | null }[]
}

/** Susun jawaban AI untuk satu pertanyaan prospek (grounded ke data properti + jadwal). */
export async function answerInquiry(input: { propertyId?: string | null; message: string; senderName?: string | null }): Promise<InquiryAnswer | null> {
  if (!aiConfigured()) return null
  const question = String(input.message ?? '').trim().slice(0, 1200)
  if (!question) return null

  let property: MarketListing | null = null
  const rows = await fetchPublished(400).catch(() => [] as MarketListing[])
  try {
    property = input.propertyId ? await fetchById(String(input.propertyId)) : null
  } catch {
    property = null
  }

  const siblings = property
    ? rows.filter((row) => row.id !== property?.id && row.listing_type === property?.listing_type && (row.district === property?.district || row.city === property?.city))
    : rows.slice(0, 8)
  const stats = computeStats(siblings, property ? `daerah ${property.district || property.city || '-'}` : 'listing terbaru')
  const visitContext = property ? await getVisitContext(property.id).catch(() => null) : null

  const dataBlock = [
    property ? '=== PROPERTI ===' : '=== PROPERTI TERBARU DI HOMY ===',
    property ? listingDetail(property) : siblings.slice(0, 8).map((row, index) => listingLine(row, index)).join('\n'),
    '',
    '=== PEMBANDING & STATISTIK AREA ===',
    statsBlock(stats),
    siblings.length ? 'Pembanding:\n' + siblings.slice(0, 5).map((row, index) => listingLine(row, index)).join('\n') : 'Belum ada pembanding di area yang sama.',
    visitContext ? availabilityBlock(visitContext) : '',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const { text } = await aiChat(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: dataBlock + '\n\n=== PERTANYAAN CALON PEMBELI/PENYEWA' + (input.senderName ? ' (' + input.senderName + ')' : '') + ' ===\n' + question },
      ],
      { temperature: 0.35, maxTokens: 750 },
    )
    const answer = String(text ?? '').trim()
    if (!answer) return null
    return {
      answer,
      sources: [property, ...siblings.slice(0, 4)]
        .filter((row): row is MarketListing => Boolean(row))
        .map((row) => ({ id: row.id, title: row.title, city: row.city, district: row.district, listing_type: row.listing_type, price: row.price }))
        .slice(0, 5),
    }
  } catch (error) {
    console.error('[homy-inquiry-ai] gagal menyusun jawaban:', error instanceof Error ? error.message : error)
    return null
  }
}

/** Cek feature flag "Balasan otomatis AI untuk prospek". Default: aktif kalau flag tidak ada. */
export async function aiAutoReplyEnabled(): Promise<boolean> {
  const { serviceClient } = await import('@/lib/visits')
  const admin = serviceClient()
  if (!admin) return false
  const { data } = await admin.from('feature_flags').select('enabled').eq('key', 'ai_auto_reply').maybeSingle()
  const row = data as { enabled?: boolean | null } | null
  if (!row) return true
  return row.enabled !== false
}
