/**
 * Konfirmasi Ketertarikan — modul bersama (label, skor, prompt AI).
 *
 * Tujuan: sistem + Homy AI bisa menyimpulkan apakah calon pembeli/penyewa
 * benar-benar akan bertransaksi, atau masih memakai properti ini sebagai
 * pembanding sebelum mencari opsi lain.
 */
import { aiJson, aiModel, type AiMessage } from '@/lib/ai'

export const INTEREST_INTENTS = ['buy', 'rent', 'undecided'] as const
export type InterestIntent = (typeof INTEREST_INTENTS)[number]

export const INTEREST_READINESS = ['exploring', 'comparing', 'ready', 'committed'] as const
export type InterestReadiness = (typeof INTEREST_READINESS)[number]

/** Tahap pemantauan negosiasi (dipakai User, Agent, Owner, Admin). */
export const INTEREST_STAGES = ['interest', 'viewing', 'negotiation', 'offer', 'deal', 'lost'] as const
export type InterestStage = (typeof INTEREST_STAGES)[number]

export const INTEREST_FINANCING = ['cash', 'kpr', 'installment', 'unknown'] as const

export const INTENT_LABEL: Record<string, string> = {
  buy: 'Rencana membeli',
  rent: 'Rencana menyewa',
  undecided: 'Belum memutuskan',
}

export const READINESS_LABEL: Record<string, string> = {
  exploring: 'Masih melihat-lihat',
  comparing: 'Membandingkan beberapa properti',
  ready: 'Siap bertransaksi',
  committed: 'Sudah berkomitmen (DP/booking)',
}

export const STAGE_LABEL: Record<string, { label: string; className: string }> = {
  interest: { label: 'Tertarik', className: 'bg-[#eef2ff] text-[#3b4a8c]' },
  viewing: { label: 'Kunjungan', className: 'bg-[#e9f5ff] text-[#1d5b8a]' },
  negotiation: { label: 'Negosiasi', className: 'bg-[#fff6e5] text-[#8a641d]' },
  offer: { label: 'Penawaran', className: 'bg-[#fdeede] text-[#8a4b1d]' },
  deal: { label: 'Kesepakatan', className: 'bg-[#e8f6ec] text-[#1d6b3a]' },
  lost: { label: 'Batal', className: 'bg-[#f4eeea] text-[#7a6a60]' },
}

export const FINANCING_LABEL: Record<string, string> = {
  cash: 'Tunai / cash',
  kpr: 'KPR bank',
  installment: 'Cicilan / bertahap',
  unknown: 'Belum tahu',
}

export const VERDICT_LABEL: Record<string, { label: string; className: string; tone: string }> = {
  buy_likely: { label: 'Cenderung membeli', className: 'bg-[#e8f6ec] text-[#1d6b3a]', tone: 'ok' },
  comparing: { label: 'Masih membandingkan', className: 'bg-[#fff6e5] text-[#8a641d]', tone: 'warn' },
  exploring: { label: 'Belum siap / cari opsi lain', className: 'bg-[#f4eeea] text-[#7a6a60]', tone: 'muted' },
  unclear: { label: 'Belum bisa disimpulkan', className: 'bg-[#eef2ff] text-[#3b4a8c]', tone: 'info' },
}

export const TIMELINE_OPTIONS = [
  { value: 'segera', label: 'Secepatnya (< 1 bulan)' },
  { value: '1-3-bulan', label: '1–3 bulan' },
  { value: '3-6-bulan', label: '3–6 bulan' },
  { value: 'lebih-6-bulan', label: 'Lebih dari 6 bulan' },
  { value: 'belum-tahu', label: 'Belum tahu' },
]

export type InterestInput = {
  propertyId?: string | null
  intent?: string | null
  readiness?: string | null
  budget?: number | string | null
  budgetFlexible?: boolean | null
  timeline?: string | null
  financing?: string | null
  downPayment?: number | string | null
  hasOtherOptions?: boolean | null
  comparisonNotes?: string | null
  priorities?: string | null
  dealBreakers?: string | null
  contactPreference?: string | null
}

export type InterestRow = {
  id: string
  property_id: string
  user_id: string
  agent_id?: string | null
  owner_id?: string | null
  intent?: string | null
  readiness?: string | null
  stage?: string | null
  budget?: number | string | null
  budget_flexible?: boolean | null
  timeline?: string | null
  financing?: string | null
  down_payment?: number | string | null
  has_other_options?: boolean | null
  comparison_notes?: string | null
  priorities?: string | null
  deal_breakers?: string | null
  contact_preference?: string | null
  score?: number | null
  ai_verdict?: string | null
  ai_confidence?: number | null
  ai_summary?: string | null
  ai_signals?: unknown
  ai_model?: string | null
  ai_analyzed_at?: string | null
  agent_notes?: string | null
  created_at?: string | null
  updated_at?: string | null
  property?: Record<string, unknown> | null
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Skor ketertarikan 0–100 (rule-based, dipakai sebelum/selain analisis AI).
 * Semakin tinggi = semakin besar peluang transaksi.
 */
export function scoreInterest(input: InterestInput, propertyPrice?: number | null): number {
  let score = 25
  if (input.intent === 'buy' || input.intent === 'rent') score += 12
  const readinessScore: Record<string, number> = { exploring: 0, comparing: 8, ready: 24, committed: 32 }
  score += readinessScore[String(input.readiness ?? 'exploring')] ?? 0
  const timelineScore: Record<string, number> = { segera: 20, '1-3-bulan': 14, '3-6-bulan': 7, 'lebih-6-bulan': 2, 'belum-tahu': 0 }
  score += timelineScore[String(input.timeline ?? '')] ?? 0
  const financingScore: Record<string, number> = { cash: 12, kpr: 6, installment: 4, unknown: 0 }
  score += financingScore[String(input.financing ?? '')] ?? 0
  if (input.budgetFlexible) score += 3
  if (num(input.downPayment) > 0) score += 6
  if (input.hasOtherOptions) score -= 10
  const budget = num(input.budget)
  if (budget > 0 && num(propertyPrice) > 0) {
    const ratio = budget / num(propertyPrice)
    if (ratio >= 1.15) score += 10
    else if (ratio >= 1) score += 6
    else if (ratio >= 0.9) score += 1
    else score -= 12
  }
  if (String(input.comparisonNotes ?? '').trim().length > 20) score -= 4
  if (String(input.priorities ?? '').trim().length > 20) score += 3
  if (String(input.dealBreakers ?? '').trim().length > 20) score -= 2
  return Math.max(0, Math.min(100, Math.round(score)))
}

export type InterestAnalysis = {
  verdict: 'buy_likely' | 'comparing' | 'exploring' | 'unclear'
  confidence: number
  summary: string
  signals: string[]
  advice: string
  suggestedStage?: string
}

type AnalyzeArgs = {
  input: InterestInput
  property?: { title?: string | null; city?: string | null; district?: string | null; price?: number | string | null; listing_type?: string | null; price_period?: string | null } | null
  buyerName?: string | null
  conversations?: Array<{ question?: string | null; answer?: string | null }>
  visits?: Array<{ status?: string | null; scheduled_at?: string | null }>
  favorites?: Array<{ title?: string | null; price?: number | string | null }>
}

function rupiah(value: unknown): string {
  const n = num(value)
  return n > 0 ? 'Rp ' + n.toLocaleString('id-ID') : 'belum diisi'
}

/**
 * Minta Homy AI menyimpulkan niat calon pembeli: akan membeli, masih
 * membandingkan, atau cenderung mencari properti lain.
 */
export async function analyzeInterest(args: AnalyzeArgs): Promise<InterestAnalysis> {
  const { input, property, buyerName, conversations = [], visits = [], favorites = [] } = args
  const rules = scoreInterest(input, num(property?.price))
  const convoText = conversations.slice(-8).map((row, index) =>
    `T${index + 1}. Pembeli: ${String(row.question ?? '').slice(0, 300)}\n   Homy AI: ${String(row.answer ?? '').slice(0, 300)}`,
  ).join('\n') || 'Belum ada percakapan Homy AI.'

  const messages: AiMessage[] = [
    {
      role: 'system',
      content: [
        'Kamu analis prospek properti untuk platform Homy (Indonesia).',
        'Tugasmu menilai satu calon pembeli/penyewa: apakah dia cenderung MEMBELI properti ini, masih MEMBANDINGKAN dengan properti lain, atau BELUM SIAP / cenderung mencari opsi lain.',
        'Gunakan data konfirmasi ketertarikan, riwayat pertanyaan ke Homy AI, riwayat kunjungan, dan daftar properti favoritnya.',
        'Jujur dan konservatif: jangan asal menyimpulkan akan membeli kalau buktinya lemah. Sebutkan sinyal bukti dari data.',
        'Balas dalam bahasa Indonesia yang ringkas, tanpa membocorkan data pribadi (email/nomor telepon).',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        '=== KONFIRMASI KETERTARIKAN YANG DIISI PEMBELI ===',
        `Nama calon pembeli: ${buyerName || 'Pengguna Homy'}`,
        `Niat: ${INTENT_LABEL[String(input.intent ?? 'undecided')] ?? 'Belum memutuskan'}`,
        `Kesiapan: ${READINESS_LABEL[String(input.readiness ?? 'exploring')] ?? 'Masih melihat-lihat'}`,
        `Anggaran: ${rupiah(input.budget)}${input.budgetFlexible ? ' (masih fleksibel)' : ''}`,
        `Rencana waktu: ${input.timeline ?? 'belum diisi'}`,
        `Pembiayaan: ${FINANCING_LABEL[String(input.financing ?? 'unknown')] ?? 'Belum tahu'}`,
        `Dana muka/DP: ${rupiah(input.downPayment)}`,
        `Sedang membandingkan properti lain: ${input.hasOtherOptions ? 'ya' : 'tidak'}`,
        `Properti pembanding: ${input.comparisonNotes || '-'}`,
        `Hal terpenting baginya: ${input.priorities || '-'}`,
        `Yang bisa membatalkan: ${input.dealBreakers || '-'}`,
        `Skor rule-based sistem: ${rules}/100`,
        '',
        '=== PROPERTI YANG DITANYAKAN ===',
        `${property?.title ?? 'Properti Homy'} — ${[property?.district, property?.city].filter(Boolean).join(', ') || 'lokasi belum diisi'}`,
        `Harga: ${rupiah(property?.price)} ${property?.listing_type === 'rent' ? '/bulan' : ''}`,
        '',
        '=== RIWAYAT PERTANYAAN KE HOMY AI ===',
        convoText,
        '',
        '=== RIWAYAT KUNJUNGAN ===',
        visits.length ? visits.map((row) => `- ${row.status ?? 'dijadwalkan'} pada ${row.scheduled_at ?? '-'}`).join('\n') : 'Belum ada kunjungan.',
        '',
        '=== PROPERTI FAVORIT PEMBELI (pembanding) ===',
        favorites.length ? favorites.map((row) => `- ${row.title ?? 'Properti'} (${rupiah(row.price)})`).join('\n') : 'Belum ada favorit.',
        '',
        '=== FORMAT JAWABAN (JSON) ===',
        '{"verdict":"buy_likely|comparing|exploring|unclear","confidence":0-100,"summary":"2-3 kalimat kesimpulan","signals":["sinyal 1","sinyal 2"],"advice":"saran tindak lanjut untuk agen (1-2 kalimat)","suggested_stage":"interest|viewing|negotiation|offer|deal|lost"}',
      ].join('\n'),
    },
  ]

  const result = await aiJson<Partial<InterestAnalysis> & { suggested_stage?: string }>(messages, { temperature: 0.2, maxTokens: 700, timeoutMs: 45000 })
  const verdict = (['buy_likely', 'comparing', 'exploring', 'unclear'] as const).includes(result.verdict as never) ? result.verdict as InterestAnalysis['verdict'] : 'unclear'
  const confidence = Math.max(0, Math.min(100, Math.round(num(result.confidence))))
  const signals = Array.isArray(result.signals) ? result.signals.map((item) => String(item).slice(0, 160)).slice(0, 6) : []
  return {
    verdict,
    confidence,
    summary: String(result.summary ?? '').slice(0, 600) || 'Belum ada kesimpulan dari AI.',
    signals,
    advice: String(result.advice ?? '').slice(0, 400),
    suggestedStage: String(result.suggested_stage ?? result.suggestedStage ?? '').slice(0, 20) || undefined,
  }
}

export function interestModel() {
  return aiModel()
}
