/**
 * Homy AI Workforce — Fase 1.
 *
 * Konsep: Homy dijalankan seperti perusahaan kecil dengan sedikit karyawan AI
 * berkualitas tinggi + 1 mesin koordinasi.
 *
 *   - COO Orchestrator  : merencanakan kerja harian, membagi tugas, memeriksa hasil,
 *                         hanya mengangkat hal yang butuh keputusan manusia (Boss).
 *   - Analyst & Compliance (LIVE)  : laporan operasional harian + deteksi anomali/kepatuhan.
 *   - Sales & Customer Success (LIVE, approve-first) : draf balasan prospek + tindak lanjut kunjungan.
 *   - Growth / Content / Listing Ops : job card siap, diaktifkan bertahap (Fase berikut).
 *
 * Prinsip: rilis aman. Semua aksi keluar (balas prospek, kirim notifikasi) butuh
 * persetujuan manusia kecuali yang benar-benar internal (laporan/alerts). Semua
 * tindakan dicatat ke audit_logs.
 *
 * Hanya dipakai admin/super_admin (dijaga di route API).
 */
import { aiConfigured, aiJson, aiModel, aiToolChat, AiError, type AiMessage, type AiToolDef } from '@/lib/ai'
import { serviceClient } from '@/lib/visits'

type Json = Record<string, unknown>
const nowIso = () => new Date().toISOString()
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

function sb() {
  const admin = serviceClient()
  if (!admin) throw new AiError('Klien database (service role) tidak tersedia', 503)
  return admin
}

/* ------------------------------------------------------------------ */
/* Job card registry                                                   */
/* ------------------------------------------------------------------ */

export type Autonomy = 'draft' | 'approve' | 'auto'
export type EmployeeStatus = 'active' | 'planned' | 'paused'
export type WorkItemKind = 'briefing' | 'report' | 'alert' | 'reply_draft' | 'task' | 'follow_up' | 'content_draft' | 'growth_plan' | 'listing_task'
export type WorkItemStatus = 'open' | 'awaiting_approval' | 'approved' | 'rejected' | 'done' | 'escalated'

export type EmployeeSeed = {
  slug: string
  name: string
  roleTitle: string
  department: string
  emoji: string
  mission: string
  autonomy: Autonomy
  status: EmployeeStatus
  sortOrder: number
  jobCard: {
    responsibilities: string[]
    standards: string[]
    guardrails: string[]
    escalates: string[]
  }
  kpis: string[]
}

export const WORKFORCE_ROSTER: EmployeeSeed[] = [
  {
    slug: 'coo',
    name: 'Ayana',
    roleTitle: 'Chief Operating Officer',
    department: 'Kantor Pusat',
    emoji: '🧠',
    mission: 'Merencanakan kerja harian seluruh karyawan AI, membagi tugas, memeriksa hasil, dan hanya mengangkat hal yang benar-benar butuh keputusan Boss.',
    autonomy: 'auto',
    status: 'active',
    sortOrder: 1,
    jobCard: {
      responsibilities: [
        'Menyusun rencana kerja harian untuk setiap karyawan AI.',
        'Menjalankan siklus koordinasi: instruksi → hasil → pemeriksaan mutu.',
        'Merangkum kondisi platform menjadi briefing pagi yang ringkas.',
        'Mengangkat hal yang perlu keputusan manusia (uang, kebijakan, konflik).',
      ],
      standards: [
        'Briefing maksimal 150 kata, angka konkret, tanpa basa-basi.',
        'Tidak pernah mengirim pesan ke pihak luar tanpa persetujuan.',
        'Setiap tugas punya pemilik, batas waktu, dan definisi selesai.',
      ],
      guardrails: [
        'Tidak mengubah harga, komisi, atau kebijakan tanpa approval.',
        'Tidak menghubungi pengguna atas nama brand tanpa approval.',
      ],
      escalates: ['Usulan promo/harga', 'Risiko fraud berat', 'Konflik data lintas tim'],
    },
    kpis: ['Rencana harian siap sebelum 08.00 WIB', 'Nol tugas menggantung > 24 jam', 'Eskalasi relevan ≤ 5/hari'],
  },
  {
    slug: 'analyst',
    name: 'Rani',
    roleTitle: 'Analyst & Compliance',
    department: 'Kontrol & Kepatuhan',
    emoji: '📊',
    mission: 'Menjaga kesehatan data dan kepatuhan platform: laporan operasional harian + deteksi dini anomali (listing duplikat, listing tanpa foto, prospek mangkrak, mitra tertunda).',
    autonomy: 'auto',
    status: 'active',
    sortOrder: 2,
    jobCard: {
      responsibilities: [
        'Menyusun laporan operasional harian dari data nyata platform.',
        'Memindai anomali & risiko kepatuhan setiap siklus.',
        'Menandai listing bermasalah dan prospek yang terlambat ditindak.',
      ],
      standards: [
        'Semua angka diambil langsung dari database, tidak dikira-kira.',
        'Temuan selalu disertai bukti (jumlah, contoh id/nama).',
        'Jujur: tidak melebih-lebihkan bila data belum cukup.',
      ],
      guardrails: [
        'Tidak mengubah data listing/pengguna secara langsung.',
        'Hanya menyampaikan; keputusan tindakan ada pada admin/Boss.',
      ],
      escalates: ['Indikasi fraud/penipuan', 'Listing ilegal/tidak layak tayang', 'Lonjakan anomali mendadak'],
    },
    kpis: ['Laporan harian terbit tiap hari', 'Anomali terdeteksi < 24 jam', 'Akurasi angka 100% (dari DB)'],
  },
  {
    slug: 'sales',
    name: 'Dita',
    roleTitle: 'Sales & Customer Success',
    department: 'Penjualan',
    emoji: '💬',
    mission: 'Memastikan setiap calon pembeli/penyewa dibalas cepat, ramah, dan jual: menyiapkan draf balasan prospek, menjadwalkan viewing, dan menindaklanjuti kunjungan.',
    autonomy: 'approve',
    status: 'active',
    sortOrder: 3,
    jobCard: {
      responsibilities: [
        'Menyiapkan draf balasan untuk setiap prospek (inquiry) yang masih terbuka.',
        'Mengusulkan jadwal viewing dan tindak lanjut kunjungan.',
        'Menandai prospek panas (hot lead) untuk diprioritaskan agen.',
      ],
      standards: [
        'Nada ramah, profesional, jelas, tanpa janji yang tidak bisa ditepati.',
        'Sertakan langkah berikutnya yang konkret di setiap balasan.',
        'Semua balasan menunggu persetujuan sebelum terkirim.',
      ],
      guardrails: [
        'Tidak menjanjikan diskon/harga khusus tanpa approval.',
        'Tidak membocorkan data pribadi pihak lain.',
      ],
      escalates: ['Permintaan negosiasi harga besar', 'Prospek komplain keras', 'Permintaan di luar kebijakan'],
    },
    kpis: ['Waktu draf balasan < 5 menit sejak prospek masuk', 'Tingkat persetujuan draf ≥ 80%', 'Nol balasan terlambat > 24 jam'],
  },
  {
    slug: 'growth',
    name: 'Bima',
    roleTitle: 'Growth & Lead Generation',
    department: 'Pertumbuhan',
    emoji: '📈',
    mission: 'Mengisi pipeline calon penjual & pembeli dari prospek masuk dan data CRM, serta menjaga mesin pertumbuhan tetap hidup.',
    autonomy: 'approve',
    status: 'active',
    sortOrder: 4,
    jobCard: {
      responsibilities: [
        'Mengubah prospek pasif menjadi pipeline aktif.',
        'Mengusulkan target & kampanye akuisisi seller/buyer.',
        'Menjaga data CRM Prospek tetap bersih dan terkualifikasi.',
      ],
      standards: ['Setiap prospek punya tahap & tindak lanjut berikutnya.', 'Aktivitas patuh aturan platform & kanal resmi.'],
      guardrails: ['Tidak menghubungi pihak eksternal tanpa approval.', 'Tidak memakai kanal pribadi untuk brand.', 'Semua yang menyangkut uang (promo, harga, anggaran kampanye) wajib persetujuan Boss.'],
      escalates: ['Kanal akuisisi baru', 'Anggaran kampanye'],
    },
    kpis: ['Pipeline aktif naik', 'Kualitas lead'],
  },
  {
    slug: 'content',
    name: 'Sari',
    roleTitle: 'Content & Marketing',
    department: 'Pemasaran',
    emoji: '✍️',
    mission: 'Memproduksi konten berkualitas (highlight listing, edukasi properti) untuk dua kanal resmi: Instagram & Threads, dan menyiapkan draf siap unggah.',
    autonomy: 'approve',
    status: 'active',
    sortOrder: 5,
    jobCard: {
      responsibilities: ['Menulis caption Instagram & post Threads untuk highlight listing / edukasi properti.', 'Menyiapkan hashtag, CTA, dan ide visual.', 'Menjaga konsistensi nada & jadwal tayang (Senin–Jumat).'],
      standards: ['Konten akurat, menarik, sesuai brand Homy, tanpa klaim harga/diskon.', 'Setiap draf punya kanal, hook, isi, hashtag, dan CTA.', 'Bahasa Indonesia yang hangat dan jelas.'],
      guardrails: ['Tidak menayangkan konten atas nama brand tanpa approval Boss.', 'Semua yang menyangkut uang (promo, harga, anggaran iklan) wajib persetujuan Boss.'],
      escalates: ['Kanal publikasi & identitas brand', 'Konten berbayar/promo'],
    },
    kpis: ['Konten siap tayang harian', 'Konsistensi jadwal'],
  },
  {
    slug: 'listing',
    name: 'Tono',
    roleTitle: 'Listing Operations',
    department: 'Operasional Listing',
    emoji: '🏠',
    mission: 'Membantu onboarding penjual, melengkapi data listing, dan QC sebelum tayang agar setiap listing siap jual.',
    autonomy: 'approve',
    status: 'active',
    sortOrder: 6,
    jobCard: {
      responsibilities: ['Membantu seller melengkapi data listing.', 'QC listing sebelum publikasi.'],
      standards: ['Setiap listing punya foto, harga, lokasi, dan deskripsi layak tayang.'],
      guardrails: ['Tidak mempublikasikan listing tanpa moderasi.'],
      escalates: ['Listing bermasalah/berisiko'],
    },
    kpis: ['Kelengkapan data listing', 'Waktu onboarding seller'],
  },
]

export function rosterBySlug(slug: string): EmployeeSeed | undefined {
  return WORKFORCE_ROSTER.find((e) => e.slug === slug)
}

/* ------------------------------------------------------------------ */
/* Seed / registry                                                     */
/* ------------------------------------------------------------------ */

export type EmployeeRow = {
  id: string
  slug: string
  name: string
  role_title: string
  department: string
  emoji: string
  mission: string
  job_card: Json
  kpis: string[]
  autonomy: Autonomy
  status: EmployeeStatus
  sort_order: number
}

/** Pastikan seluruh job card ada di database. Sifat idempoten; status/autonomy yang
 *  sudah diubah manusia tidak ditimpa. */
export async function ensureWorkforce(): Promise<{ employees: EmployeeRow[]; seeded: number }> {
  const admin = sb()
  const { data: existing } = await admin.from('ai_employees').select('slug')
  const have = new Set((existing ?? []).map((r) => String(r.slug)))
  let seeded = 0
  for (const seed of WORKFORCE_ROSTER) {
    const desc: Json = {
      name: seed.name,
      role_title: seed.roleTitle,
      department: seed.department,
      emoji: seed.emoji,
      mission: seed.mission,
      job_card: seed.jobCard as unknown as Json,
      kpis: seed.kpis,
      sort_order: seed.sortOrder,
    }
    if (have.has(seed.slug)) {
      // Sinkronkan deskripsi job card terbaru tanpa menimpa status/autonomy yang diatur manusia.
      await admin.from('ai_employees').update({ ...desc, updated_at: nowIso() }).eq('slug', seed.slug)
      continue
    }
    const { error } = await admin.from('ai_employees').insert({ slug: seed.slug, ...desc, autonomy: seed.autonomy, status: seed.status })
    if (!error) seeded += 1
  }
  const { data } = await admin.from('ai_employees').select('*').order('sort_order', { ascending: true })
  return { employees: (data ?? []) as unknown as EmployeeRow[], seeded }
}

export async function setEmployeeStatus(slug: string, status: EmployeeStatus): Promise<boolean> {
  const admin = sb()
  const { error } = await admin.from('ai_employees').update({ status, updated_at: nowIso() }).eq('slug', slug)
  return !error
}

/* ------------------------------------------------------------------ */
/* Snapshot data operasional                                           */
/* ------------------------------------------------------------------ */

type Anomaly = {
  kind: string
  severity: 'low' | 'normal' | 'high' | 'urgent'
  title: string
  detail: string
  target_type?: string
  target_id?: string
}

type Snapshot = {
  generatedAt: string
  totals: Record<string, number>
  commissionVerified: number
  anomalies: Anomaly[]
  openInquiries: { id: string; property_title: string; message: string; ageHours: number; source: string }[]
  staleVisits: { id: string; property_title: string; ageHours: number }[]
  cityBreakdown: { city: string; count: number }[]
  publishedListings: { id: string; title: string; city: string; price: number }[]
  recentAiQuestions: string[]
}

const hoursSince = (iso: unknown): number => {
  const t = new Date(String(iso ?? '')).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.round((Date.now() - t) / 36e5))
}

/** Panggilan AI dalam mode JSON dengan percobaan ulang tahan gangguan.
 *  Model kadang mengembalikan isi kosong secara transien — coba lagi sebelum menyerah. */
async function aiJsonRetry<T>(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
  tries = 3,
): Promise<T> {
  let last: unknown = null
  for (let i = 0; i < tries; i += 1) {
    try {
      return await aiJson<T>(messages, { timeoutMs: 25000, ...options })
    } catch (error) {
      last = error
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)))
    }
  }
  throw last instanceof Error ? last : new AiError('AI gagal setelah beberapa percobaan', 502)
}

export async function gatherSnapshot(): Promise<Snapshot> {
  const admin = sb()
  const [profilesRes, rolesRes, propsRes, mediaRes, inqRes, visitsRes, trxRes, sanRes, convRes] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('user_roles').select('role'),
    admin.from('properties').select('id,title,status,listing_type,price,city,district,created_at'),
    admin.from('property_media').select('property_id'),
    admin.from('inquiries').select('id,property_id,user_id,status,source,message,created_at'),
    admin.from('visits').select('id,property_id,status,scheduled_at,created_at,interest'),
    admin.from('transaction_reports').select('id,status,commission_amount'),
    admin.from('partner_sanctions').select('id').eq('status', 'active'),
    admin.from('ai_conversations').select('id,question,created_at'),
  ])

  const props = propsRes.data ?? []
  const mediaIds = new Set((mediaRes.data ?? []).map((m) => String(m.property_id)))
  const inq = inqRes.data ?? []
  const visits = visitsRes.data ?? []
  const trx = trxRes.data ?? []

  const titleMap: Record<string, string> = {}
  for (const p of props) titleMap[String(p.id)] = String(p.title ?? 'Listing')

  const statusCount = (s: string) => props.filter((p) => p.status === s).length
  const roleBreak: Record<string, number> = {}
  for (const r of rolesRes.data ?? []) roleBreak[String(r.role)] = (roleBreak[String(r.role)] ?? 0) + 1

  const published = props.filter((p) => p.status === 'published')
  const noPhoto = published.filter((p) => !mediaIds.has(String(p.id)))

  // Duplikat judul (case-insensitive) pada listing tayang.
  const byTitle: Record<string, string[]> = {}
  for (const p of published) {
    const key = String(p.title ?? '').trim().toLowerCase()
    if (!key) continue
    byTitle[key] = [...(byTitle[key] ?? []), String(p.id)]
  }
  const dupTitles = Object.entries(byTitle).filter(([, ids]) => ids.length > 1)

  const cityCount: Record<string, number> = {}
  for (const p of props) { const c = String(p.city ?? '').trim() || '—'; cityCount[c] = (cityCount[c] ?? 0) + 1 }
  const cityBreakdown = Object.entries(cityCount).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 8)

  const commissionVerified = trx.filter((t) => t.status === 'verified').reduce((sum, t) => sum + (Number(t.commission_amount) || 0), 0)

  const openInquiries = inq
    .filter((i) => i.status === 'open')
    .sort((a, b) => new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime())
  const staleInquiries = openInquiries.filter((i) => hoursSince(i.created_at) >= 48)

  const staleVisits = visits
    .filter((v) => (v.status === 'requested' || v.status === 'pending') && hoursSince(v.created_at ?? v.scheduled_at) >= 48)
    .map((v) => ({ id: String(v.id), property_title: titleMap[String(v.property_id)] ?? 'Listing', ageHours: hoursSince(v.created_at ?? v.scheduled_at) }))

  const recentAiQuestions = (convRes.data ?? [])
    .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
    .slice(0, 10)
    .map((c) => String(c.question ?? '').slice(0, 200))

  const anomalies: Anomaly[] = []
  if (noPhoto.length) {
    anomalies.push({
      kind: 'listing_no_photo', severity: 'high',
      title: `${noPhoto.length} listing tayang tanpa foto`,
      detail: noPhoto.slice(0, 5).map((p) => String(p.title ?? p.id)).join('; '),
      target_type: 'property', target_id: String(noPhoto[0].id),
    })
  }
  if (dupTitles.length) {
    anomalies.push({
      kind: 'duplicate_title', severity: 'normal',
      title: `${dupTitles.length} judul listing duplikat`,
      detail: dupTitles.slice(0, 5).map(([t]) => t).join('; '),
    })
  }
  if (staleInquiries.length) {
    anomalies.push({
      kind: 'stale_inquiry', severity: 'urgent',
      title: `${staleInquiries.length} prospek menunggu balasan > 48 jam`,
      detail: staleInquiries.slice(0, 5).map((i) => titleMap[String(i.property_id)] ?? String(i.id)).join('; '),
      target_type: 'inquiry', target_id: String(staleInquiries[0].id),
    })
  }
  if (staleVisits.length) {
    anomalies.push({
      kind: 'stale_visit', severity: 'high',
      title: `${staleVisits.length} permintaan kunjungan belum diproses > 48 jam`,
      detail: staleVisits.slice(0, 5).map((v) => v.property_title).join('; '),
    })
  }

  return {
    generatedAt: nowIso(),
    totals: {
      pengguna: profilesRes.count ?? 0,
      agen: roleBreak.agent ?? 0,
      listing: props.length,
      listing_tayang: statusCount('published'),
      menunggu_moderasi: props.filter((p) => p.status === 'pending' || p.status === 'draft').length,
      prospek: inq.length,
      prospek_terbuka: openInquiries.length,
      kunjungan: visits.length,
      kunjungan_terjadwal: visits.filter((v) => v.status === 'confirmed' || v.status === 'requested').length,
      transaksi_verified: trx.filter((t) => t.status === 'verified').length,
      sanksi_aktif: (sanRes.data ?? []).length,
      percakapan_ai: (convRes.data ?? []).length,
    },
    commissionVerified,
    anomalies,
    openInquiries: openInquiries.slice(0, 8).map((i) => ({
      id: String(i.id),
      property_title: titleMap[String(i.property_id)] ?? 'Listing',
      message: String(i.message ?? '').slice(0, 400),
      ageHours: hoursSince(i.created_at),
      source: String(i.source ?? 'form'),
    })),
    staleVisits,
    cityBreakdown,
    publishedListings: published.slice(0, 6).map((p) => ({ id: String(p.id), title: String(p.title ?? 'Listing'), city: String(p.city ?? ''), price: Number(p.price) || 0 })),
    recentAiQuestions,
  }
}

/* ------------------------------------------------------------------ */
/* Helper tulis                                                        */
/* ------------------------------------------------------------------ */

type NewItem = {
  employee_slug: string
  kind: WorkItemKind
  title: string
  summary?: string | null
  status?: WorkItemStatus
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  requires_approval?: boolean
  target_type?: string | null
  target_id?: string | null
  payload?: Json
  run_id?: string | null
}

async function insertItem(item: NewItem): Promise<string | null> {
  const admin = sb()
  const { data } = await admin.from('ai_work_items').insert({
    employee_slug: item.employee_slug,
    kind: item.kind,
    title: item.title.slice(0, 200),
    summary: item.summary ? String(item.summary).slice(0, 2000) : null,
    status: item.status ?? 'open',
    priority: item.priority ?? 'normal',
    requires_approval: item.requires_approval ?? false,
    target_type: item.target_type ?? null,
    target_id: item.target_id ?? null,
    payload: (item.payload ?? {}) as unknown as Json,
    run_id: item.run_id ?? null,
  }).select('id').maybeSingle()
  return data?.id ? String(data.id) : null
}

/** Kirim notifikasi ringkas ke seluruh admin/super_admin (lonceng + push). */
async function notifyAdmins(title: string, body: string, href = '/dashboard/admin/workforce'): Promise<number> {
  const admin = sb()
  const { data: roles } = await admin.from('user_roles').select('user_id,role').in('role', ['admin', 'super_admin'])
  const ids = Array.from(new Set((roles ?? []).map((r) => String(r.user_id))))
  if (!ids.length) return 0
  const rows = ids.map((user_id) => ({ user_id, kind: 'ai.work', title: title.slice(0, 180), body: body.slice(0, 600), href, data: { source: 'ai_workforce' } }))
  const { error } = await admin.from('notifications').insert(rows)
  return error ? 0 : rows.length
}

async function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, metadata: Json) {
  try { await sb().from('audit_logs').insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, metadata }) } catch { /* best effort */ }
}

/* ------------------------------------------------------------------ */
/* Karyawan: Analyst & Compliance                                      */
/* ------------------------------------------------------------------ */

type AnalystReport = {
  report_title: string
  summary: string
  metrics: Json
  insights: string[]
  risks: string[]
  recommendations: string[]
}

async function runAnalyst(snapshot: Snapshot, runId: string | null): Promise<{ analysis: AnalystReport; alertCount: number }> {
  const result = await aiJsonRetry<AnalystReport>(
    [
      { role: 'system', content: 'Kamu "Rani", Analyst & Compliance sebuah platform properti (Homy). Tugasmu menyusun laporan operasional harian yang jujur, padat, dan actionable. Gunakan HANYA data yang diberikan. Bahasa Indonesia.' },
      { role: 'user', content: `DATA OPERASIONAL (JSON): ${JSON.stringify(snapshot).slice(0, 12000)}\n\nHasilkan JSON dengan kunci: report_title (judul singkat), summary (2-3 kalimat), metrics (objek angka penting, maks 6, kunci memakai istilah manusia), insights (array maks 4 temuan), risks (array maks 3 risiko/anomali, utamakan yang dari daftar anomalies), recommendations (array maks 4 saran konkret). Padat, jangan bertele-tele.` },
    ],
    { temperature: 0.3, maxTokens: 2200 },
  )

  const report: AnalystReport = {
    report_title: String(result.report_title ?? 'Laporan Harian Homy').slice(0, 180),
    summary: String(result.summary ?? '').slice(0, 2000),
    metrics: (result.metrics && typeof result.metrics === 'object' ? result.metrics : {}) as Json,
    insights: Array.isArray(result.insights) ? result.insights.map(String) : [],
    risks: Array.isArray(result.risks) ? result.risks.map(String) : [],
    recommendations: Array.isArray(result.recommendations) ? result.recommendations.map(String) : [],
  }

  await insertItem({
    employee_slug: 'analyst',
    kind: 'report',
    title: report.report_title,
    summary: report.summary,
    status: 'done',
    priority: 'normal',
    payload: report as unknown as Json,
    run_id: runId,
  })

  // Anomali rule-based → item 'alert'.
  let alertCount = 0
  for (const a of snapshot.anomalies) {
    const id = await insertItem({
      employee_slug: 'analyst',
      kind: 'alert',
      title: a.title,
      summary: a.detail,
      status: a.severity === 'urgent' ? 'escalated' : 'open',
      priority: a.severity,
      target_type: a.target_type ?? null,
      target_id: a.target_id ?? null,
      payload: { kind: a.kind, detail: a.detail } as Json,
      run_id: runId,
    })
    if (id) alertCount += 1
  }

  return { analysis: report, alertCount }
}

/* ------------------------------------------------------------------ */
/* Karyawan: Sales & Customer Success                                  */
/* ------------------------------------------------------------------ */

type Draft = { inquiry_id: string; reply: string; intent?: string; urgency?: string }

function errMsg(e: unknown): string { return e instanceof Error ? e.message : 'kesalahan' }

/** Normalisasi keluaran AI yang bisa berupa array, {drafts:[...]}, {replies:[...]}, atau map {id: teks}. */
function normalizeDrafts(raw: unknown): Draft[] {
  const out: Draft[] = []
  const push = (x: unknown, fallbackId?: string) => {
    if (typeof x === 'string') { if (fallbackId && x.trim()) out.push({ inquiry_id: fallbackId, reply: x.trim() }); return }
    if (!x || typeof x !== 'object') return
    const o = x as Record<string, unknown>
    const reply = String(o.reply ?? o.message ?? o.text ?? '').trim()
    const id = String(o.inquiry_id ?? o.id ?? fallbackId ?? '')
    if (!id || !reply) return
    out.push({ inquiry_id: id, reply, intent: o.intent ? String(o.intent) : undefined, urgency: o.urgency ? String(o.urgency) : undefined })
  }
  if (Array.isArray(raw)) raw.forEach((x) => push(x))
  else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const listKey = ['drafts', 'replies', 'items', 'data'].find((k) => Array.isArray(o[k]))
    if (listKey) (o[listKey] as unknown[]).forEach((x) => push(x))
    else for (const [k, v] of Object.entries(o)) push(v, k)
  }
  return out
}

async function runSales(snapshot: Snapshot, runId: string | null): Promise<{ draftCount: number; hotCount: number }> {
  const admin = sb()
  // Lewati prospek yang sudah punya draf menunggu keputusan.
  const { data: pending } = await admin.from('ai_work_items').select('target_id').eq('kind', 'reply_draft').in('status', ['open', 'awaiting_approval'])
  const pendingIds = new Set((pending ?? []).map((p) => String(p.target_id)))
  const targets = snapshot.openInquiries.filter((i) => !pendingIds.has(i.id)).slice(0, 5)
  if (!targets.length) return { draftCount: 0, hotCount: 0 }

  const result = await aiJsonRetry<unknown>(
    [
      { role: 'system', content: 'Kamu "Dita", Sales & Customer Success platform properti Homy. Tulis draf balasan yang ramah, profesional, jelas, dan mendorong langkah berikutnya (mis. tawarkan jadwal viewing). Jangan menjanjikan diskon/harga khusus. Bahasa Indonesia santun. Maks 3 kalimat per balasan.' },
      { role: 'user', content: `PROSPEK TERBUKA (JSON): ${JSON.stringify(targets).slice(0, 6000)}\n\nBalas HANYA dengan JSON valid berbentuk objek: { "drafts": [ { "inquiry_id": "<id dari data>", "reply": "<teks balasan>", "intent": "tanya_harga|jadwal_viewing|umum|nego", "urgency": "low|normal|high" } ] }. Sertakan SEMUA inquiry_id yang diberikan, tanpa teks lain di luar JSON.` },
    ],
    { temperature: 0.5, maxTokens: 2000 },
  )
  const drafts = normalizeDrafts(result)

  const valid = new Map(targets.map((t) => [t.id, t]))
  let draftCount = 0
  let hotCount = 0
  for (const d of drafts) {
    const target = valid.get(String(d.inquiry_id))
    if (!target) continue
    const reply = String(d.reply ?? '').trim()
    if (!reply) continue // model kadang mengembalikan draf kosong — lewati, jangan buat item mati.
    const urgency = ['low', 'normal', 'high', 'urgent'].includes(String(d.urgency)) ? String(d.urgency) : 'normal'
    await insertItem({
      employee_slug: 'sales',
      kind: 'reply_draft',
      title: `Draf balasan: ${target.property_title}`,
      summary: String(d.reply ?? '').slice(0, 1200),
      status: 'awaiting_approval',
      priority: urgency as 'low' | 'normal' | 'high' | 'urgent',
      requires_approval: true,
      target_type: 'inquiry',
      target_id: target.id,
      payload: { reply, intent: d.intent ?? null, buyer_message: target.message, ageHours: target.ageHours } as Json,
      run_id: runId,
    })
    draftCount += 1
    if (urgency === 'high' || urgency === 'urgent') hotCount += 1
  }

  // Kunjungan mangkrak → item tugas tindak lanjut (butuh approval sebelum menghubungi).
  for (const v of snapshot.staleVisits.slice(0, 3)) {
    await insertItem({
      employee_slug: 'sales',
      kind: 'follow_up',
      title: `Tindak lanjut kunjungan: ${v.property_title}`,
      summary: `Permintaan kunjungan belum diproses ±${v.ageHours} jam. Segera konfirmasi/jadwalkan ulang.`,
      status: 'awaiting_approval',
      priority: 'high',
      requires_approval: true,
      target_type: 'visit',
      target_id: v.id,
      payload: { ageHours: v.ageHours } as Json,
      run_id: runId,
    })
    draftCount += 1
  }

  return { draftCount, hotCount }
}

/* ------------------------------------------------------------------ */
/* Orchestrator: COO                                                   */
/* ------------------------------------------------------------------ */

type Briefing = { briefing: string; priorities: string[]; escalate: { title: string; why: string }[] }

function cooFallback(snapshot: Snapshot, analyst: AnalystReport | null, sales: { draftCount: number; hotCount: number }): Briefing {
  const a = analyst?.report_title ? `Laporan "${analyst.report_title}" siap.` : 'Laporan operasional siap.'
  const b = sales.draftCount ? `${sales.draftCount} draf balasan prospek menunggu persetujuan Anda.` : 'Tidak ada draf balasan baru.'
  const c = snapshot.anomalies.length ? `${snapshot.anomalies.length} anomali terdeteksi.` : 'Tidak ada anomali baru.'
  return { briefing: `Siklus harian selesai. ${a} ${b} ${c}`, priorities: [], escalate: [] }
}

async function runCOO(snapshot: Snapshot, analyst: AnalystReport | null, sales: { draftCount: number; hotCount: number }, runId: string | null, useAi = true): Promise<Briefing> {
  let briefing: Briefing
  if (useAi) {
    try {
      const result = await aiJsonRetry<Briefing>(
        [
          { role: 'system', content: 'Kamu "Ayana", Chief Operating Officer platform properti Homy. Kamu memimpin tim kecil karyawan AI kelas dunia. Susun briefing pagi untuk pemilik (Boss) yang ringkas, tajam, dan berorientasi keputusan. Bahasa Indonesia, tanpa basa-basi, tanpa markdown.' },
          { role: 'user', content: `KONDISI PLATFORM (JSON): ${JSON.stringify(snapshot.totals).slice(0, 3000)}\nANOMALI: ${JSON.stringify(snapshot.anomalies).slice(0, 2000)}\nLAPORAN ANALIS: ${JSON.stringify(analyst ?? {}).slice(0, 2500)}\nDRAF PENJUALAN menunggu persetujuan: ${sales.draftCount} (prioritas tinggi: ${sales.hotCount})\n\nHasilkan JSON: { "briefing": "maks 150 kata", "priorities": ["maks 4 prioritas hari ini"], "escalate": [ { "title": "...", "why": "..." } ] } untuk hal yang benar-benar butuh keputusan Boss (uang/kebijakan/risiko). Bila tidak ada, escalate = [].` },
        ],
        { temperature: 0.4, maxTokens: 1500 },
      )
      briefing = {
        briefing: String(result.briefing ?? '').slice(0, 2000),
        priorities: Array.isArray(result.priorities) ? result.priorities.map(String).slice(0, 6) : [],
        escalate: Array.isArray(result.escalate) ? result.escalate.slice(0, 5).map((e) => ({ title: String(e?.title ?? ''), why: String(e?.why ?? '') })) : [],
      }
    } catch {
      // AI COO tidak tersedia → tetap terbitkan briefing ringkas dari data, jangan gagalkan siklus.
      briefing = cooFallback(snapshot, analyst, sales)
    }
  } else {
    briefing = cooFallback(snapshot, analyst, sales)
  }

  await insertItem({
    employee_slug: 'coo',
    kind: 'briefing',
    title: 'Briefing pagi dari COO',
    summary: briefing.briefing,
    status: 'done',
    priority: 'normal',
    payload: briefing as unknown as Json,
    run_id: runId,
  })

  for (const e of briefing.escalate) {
    if (!e.title) continue
    await insertItem({
      employee_slug: 'coo',
      kind: 'task',
      title: `Perlu keputusan Boss: ${e.title}`,
      summary: e.why,
      status: 'awaiting_approval',
      priority: 'high',
      requires_approval: true,
      payload: { type: 'escalation', why: e.why } as Json,
      run_id: runId,
    })
  }

  return briefing
}

/* ------------------------------------------------------------------ */
/* Karyawan: Growth, Content, Listing (Fase 2)                         */
/* ------------------------------------------------------------------ */

type GrowthPlan = {
  summary: string
  bets: { title: string; rationale: string; channel?: string; expected_impact?: string; needs_budget?: boolean }[]
  crm_actions: string[]
}

async function runGrowth(snapshot: Snapshot, runId: string | null): Promise<{ planCount: number }> {
  const result = await aiJsonRetry<GrowthPlan>(
    [
      { role: 'system', content: 'Kamu "Bima", Growth & Lead Generation platform properti Homy. Fokus: mengisi pipeline penjual & pembeli dari prospek yang ada dan data CRM. Bahasa Indonesia, praktis, tanpa basa-basi. Jangan mengarang angka.' },
      { role: 'user', content: `KONDISI PLATFORM (JSON): ${JSON.stringify({ totals: snapshot.totals, cityBreakdown: snapshot.cityBreakdown, prospek: snapshot.openInquiries.map((i) => ({ judul: i.property_title, umur_jam: i.ageHours })), kunjungan_mangkrak: snapshot.staleVisits }).slice(0, 8000)}\n\nHasilkan JSON: { "summary": "2-3 kalimat kondisi pipeline & peluang", "bets": [ { "title": "...", "rationale": "...", "channel": "instagram|threads|whatsapp|web|agen", "expected_impact": "...", "needs_budget": true|false } ], "crm_actions": ["langkah taktis menjaga pipeline"] }. Maks 3 bets dan maks 4 crm_actions. Tandai needs_budget=true untuk apa pun yang butuh biaya/anggaran.` },
    ],
    { temperature: 0.4, maxTokens: 1600 },
  )
  const bets = Array.isArray(result.bets) ? result.bets.slice(0, 3) : []
  await insertItem({
    employee_slug: 'growth', kind: 'growth_plan',
    title: 'Rencana pertumbuhan',
    summary: String(result.summary ?? 'Rencana pertumbuhan disiapkan.').slice(0, 1000),
    status: 'awaiting_approval', priority: 'normal', requires_approval: true,
    payload: { bets, crm_actions: Array.isArray(result.crm_actions) ? result.crm_actions.slice(0, 4) : [] } as Json,
    run_id: runId,
  })
  if (bets.some((b) => b?.needs_budget)) {
    await insertItem({
      employee_slug: 'growth', kind: 'task',
      title: 'Perlu keputusan Boss: usulan anggaran kampanye',
      summary: bets.filter((b) => b?.needs_budget).map((b) => String(b.title ?? '')).join('; ').slice(0, 500),
      status: 'awaiting_approval', priority: 'high', requires_approval: true,
      payload: { type: 'budget' } as Json, run_id: runId,
    })
    return { planCount: 2 }
  }
  return { planCount: 1 }
}

type ContentPost = { channel?: string; hook?: string; body?: string; hashtags?: string[]; cta?: string; image_idea?: string }

async function runContent(snapshot: Snapshot, runId: string | null): Promise<{ draftCount: number }> {
  const result = await aiJsonRetry<{ posts: ContentPost[] }>(
    [
      { role: 'system', content: 'Kamu "Sari", Content & Marketing Homy (platform properti Indonesia). Kamu menulis konten untuk dua kanal resmi: Instagram dan Threads. Nada hangat, jelas, membantu, tidak lebay, tanpa klaim harga/diskon. Bahasa Indonesia.' },
      { role: 'user', content: `DATA (JSON): ${JSON.stringify({ listing: snapshot.publishedListings, kota: snapshot.cityBreakdown, total_tayang: snapshot.totals.listing_tayang }).slice(0, 5000)}\n\nBuat 2 konten: 1 untuk "instagram" (caption + 8-12 hashtag + CTA) dan 1 untuk "threads" (post singkat < 400 karakter + 2-3 hashtag). Angkat satu listing tayang atau tips properti. Hasilkan JSON: { "posts": [ { "channel": "instagram|threads", "hook": "...", "body": "...", "hashtags": ["#..."], "cta": "...", "image_idea": "..." } ] }.` },
    ],
    { temperature: 0.7, maxTokens: 1600 },
  )
  const posts = Array.isArray(result.posts) ? result.posts.slice(0, 2) : []
  let draftCount = 0
  for (const p of posts) {
    const body = String(p?.body ?? '').trim()
    if (!body) continue
    const channel = String(p?.channel ?? 'instagram').toLowerCase() === 'threads' ? 'threads' : 'instagram'
    const hashtags = Array.isArray(p?.hashtags) ? p.hashtags.map((h) => String(h)).slice(0, 12) : []
    await insertItem({
      employee_slug: 'content', kind: 'content_draft',
      title: `${channel === 'threads' ? 'Threads' : 'Instagram'}: ${String(p?.hook ?? body).slice(0, 60)}`,
      summary: body.slice(0, 800),
      status: 'awaiting_approval', priority: 'normal', requires_approval: true,
      payload: { channel, hook: p?.hook ?? null, body, hashtags, cta: p?.cta ?? null, image_idea: p?.image_idea ?? null } as Json,
      run_id: runId,
    })
    draftCount += 1
  }
  return { draftCount }
}

/** Listing Operations bersifat deterministik: QC dari anomali data (tanpa panggilan AI). */
async function runListing(snapshot: Snapshot, runId: string | null): Promise<{ taskCount: number }> {
  const admin = sb()
  const { data: open } = await admin.from('ai_work_items').select('payload').eq('kind', 'listing_task').in('status', ['open'])
  const openTypes = new Set((open ?? []).map((o) => String(((o.payload ?? {}) as Json).type ?? '')))
  let taskCount = 0
  const noPhoto = snapshot.anomalies.find((a) => a.kind === 'listing_no_photo')
  if (noPhoto && !openTypes.has('no_photo')) {
    await insertItem({
      employee_slug: 'listing', kind: 'listing_task',
      title: noPhoto.title,
      summary: `${noPhoto.detail}. Lengkapi foto agar listing layak tampil & siap jual.`,
      status: 'open', priority: 'high', payload: { type: 'no_photo' } as Json, run_id: runId,
    })
    taskCount += 1
  }
  const dup = snapshot.anomalies.find((a) => a.kind === 'duplicate_title')
  if (dup && !openTypes.has('duplicate_title')) {
    await insertItem({
      employee_slug: 'listing', kind: 'listing_task',
      title: dup.title,
      summary: `${dup.detail}. Bedakan judul/deskripsi agar tidak membingungkan pencari.`,
      status: 'open', priority: 'normal', payload: { type: 'duplicate_title' } as Json, run_id: runId,
    })
    taskCount += 1
  }
  return { taskCount }
}

/* ------------------------------------------------------------------ */
/* Target & kinerja                                                   */
/* ------------------------------------------------------------------ */

export type TargetPeriod = 'daily' | 'weekly' | 'monthly'
export type TargetRow = {
  id: string; period: TargetPeriod; title: string; metric: string | null
  target_value: number; current_value: number; unit: string | null
  owner_slug: string | null; status: string; source: string; notes: string | null
  start_date: string | null; end_date: string | null; created_at: string; updated_at: string
}

export async function listTargets(): Promise<TargetRow[]> {
  const admin = sb()
  const { data } = await admin.from('ai_targets').select('*').order('created_at', { ascending: false }).limit(100)
  return (data ?? []) as unknown as TargetRow[]
}

export async function createTarget(input: {
  period?: string; title: string; metric?: string; target_value?: number; unit?: string
  owner_slug?: string; notes?: string; source?: string; created_by?: string | null
  start_date?: string | null; end_date?: string | null
}): Promise<TargetRow | null> {
  const admin = sb()
  const period = ['daily', 'weekly', 'monthly'].includes(String(input.period)) ? String(input.period) : 'weekly'
  const { data, error } = await admin.from('ai_targets').insert({
    period,
    title: String(input.title).slice(0, 180),
    metric: input.metric ? String(input.metric).slice(0, 120) : null,
    target_value: Number(input.target_value) || 0,
    unit: input.unit ? String(input.unit).slice(0, 40) : null,
    owner_slug: input.owner_slug ? String(input.owner_slug) : null,
    notes: input.notes ? String(input.notes).slice(0, 1000) : null,
    source: input.source === 'coo' ? 'coo' : 'boss',
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    created_by: input.created_by ?? null,
  }).select('*').maybeSingle()
  if (error) return null
  return (data ?? null) as unknown as TargetRow | null
}

export async function updateTarget(id: string, patch: { current_value?: number; target_value?: number; status?: string; notes?: string; title?: string }): Promise<boolean> {
  const admin = sb()
  const p: Record<string, unknown> = { updated_at: nowIso() }
  if (patch.current_value !== undefined) p.current_value = Number(patch.current_value) || 0
  if (patch.target_value !== undefined) p.target_value = Number(patch.target_value) || 0
  if (patch.status && ['active', 'achieved', 'missed', 'archived'].includes(patch.status)) p.status = patch.status
  if (patch.notes !== undefined) p.notes = String(patch.notes).slice(0, 1000)
  if (patch.title !== undefined) p.title = String(patch.title).slice(0, 180)
  const { error } = await admin.from('ai_targets').update(p).eq('id', id)
  return !error
}

/* ------------------------------------------------------------------ */
/* Chat dengan COO                                                    */
/* ------------------------------------------------------------------ */

export type ChatMessageRow = { id: string; role: 'user' | 'assistant'; content: string; created_at: string }

export async function listChat(limit = 40): Promise<ChatMessageRow[]> {
  const admin = sb()
  const { data } = await admin.from('ai_chat_messages').select('id,role,content,created_at').order('created_at', { ascending: false }).limit(limit)
  return ((data ?? []) as unknown as ChatMessageRow[]).reverse()
}

const COO_SYSTEM = `Kamu "Ayana", Chief Operating Officer Homy (platform properti Indonesia). Kamu berbicara langsung dengan Boss (pemilik) lewat chat.
Gaya: ringkas, tegas, praktis, tanpa basa-basi, tanpa markdown tebal. Bahasa Indonesia.
Tugas: (1) menjawab pertanyaan Boss tentang kondisi operasional & tim, (2) membantu Boss menetapkan target harian/mingguan/bulanan, (3) me-review pekerjaan tim AI, (4) mengangkat hal yang butuh keputusan Boss.
Aturan: semua yang menyangkut UANG (promo, harga, komisi, anggaran) wajib persetujuan Boss — usulkan, jangan putuskan sendiri. Jangan pernah mengirim pesan ke pihak luar tanpa persetujuan. Bila Boss meminta target, pakai tool create_target. Bila Boss menugaskan kerja, pakai create_task. Setelah aksi, konfirmasi singkat apa yang kamu lakukan.`

const COO_TOOLS: AiToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'create_target',
      description: 'Buat target baru (harian/mingguan/bulanan) untuk tim.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
          title: { type: 'string' },
          metric: { type: 'string' },
          target_value: { type: 'number' },
          unit: { type: 'string' },
          owner_slug: { type: 'string', description: 'slug karyawan penanggung jawab' },
        },
        required: ['period', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_target',
      description: 'Perbarui nilai capaian atau status sebuah target.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          current_value: { type: 'number' },
          status: { type: 'string', enum: ['active', 'achieved', 'missed', 'archived'] },
          notes: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Tugaskan pekerjaan ke karyawan AI tertentu (masuk antrean kerja).',
      parameters: {
        type: 'object',
        properties: {
          employee_slug: { type: 'string', enum: ['analyst', 'sales', 'growth', 'content', 'listing', 'coo'] },
          title: { type: 'string' },
          detail: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
        },
        required: ['employee_slug', 'title'],
      },
    },
  },
]

function safeJson(s: string): Json {
  try { const v = JSON.parse(s || '{}'); return v && typeof v === 'object' ? (v as Json) : {} } catch { return {} }
}

async function cooTool(name: string, args: Json, actorId: string): Promise<Json> {
  try {
    if (name === 'create_target') {
      const t = await createTarget({
        period: String(args.period ?? 'weekly'),
        title: String(args.title ?? 'Target').slice(0, 180),
        metric: args.metric ? String(args.metric) : undefined,
        target_value: Number(args.target_value) || 0,
        unit: args.unit ? String(args.unit) : undefined,
        owner_slug: args.owner_slug ? String(args.owner_slug) : undefined,
        source: 'coo', created_by: actorId,
      })
      return t ? { ok: true, id: t.id, title: t.title, period: t.period } : { ok: false, error: 'gagal menyimpan target' }
    }
    if (name === 'update_target') {
      const ok = await updateTarget(String(args.id ?? ''), {
        current_value: args.current_value as number | undefined,
        status: args.status as string | undefined,
        notes: args.notes as string | undefined,
      })
      return { ok }
    }
    if (name === 'create_task') {
      const slug = ['analyst', 'sales', 'growth', 'content', 'listing', 'coo'].includes(String(args.employee_slug)) ? String(args.employee_slug) : 'coo'
      const pr = ['low', 'normal', 'high', 'urgent'].includes(String(args.priority)) ? String(args.priority) : 'normal'
      const id = await insertItem({
        employee_slug: slug, kind: 'task',
        title: String(args.title ?? 'Tugas dari COO').slice(0, 180),
        summary: args.detail ? String(args.detail).slice(0, 800) : null,
        status: 'open', priority: pr as 'low' | 'normal' | 'high' | 'urgent',
        requires_approval: false, payload: { from: 'coo_chat', requested_by: actorId } as Json,
      })
      return { ok: !!id, item_id: id, assigned_to: slug }
    }
    return { ok: false, error: 'tool tidak dikenal' }
  } catch (e) {
    return { ok: false, error: errMsg(e) }
  }
}

function describeAction(name: string, result: Json): string {
  if (name === 'create_target') return result.ok ? `Target dibuat: ${String(result.title ?? '')} (${String(result.period ?? '')})` : 'Gagal membuat target'
  if (name === 'update_target') return result.ok ? 'Target diperbarui' : 'Gagal memperbarui target'
  if (name === 'create_task') return result.ok ? `Tugas dibuat untuk ${String(result.assigned_to ?? 'tim')}` : 'Gagal membuat tugas'
  return name
}

export async function cooChat(actorId: string, message: string): Promise<{ reply: string; actions: string[]; targets: TargetRow[] }> {
  if (!aiConfigured()) throw new AiError('Fitur AI belum diaktifkan (kunci AI belum diatur).', 503)
  const admin = sb()
  const text = message.trim().slice(0, 2000)
  if (!text) throw new AiError('Pesan kosong.', 400)

  await admin.from('ai_chat_messages').insert({ role: 'user', content: text, actor_id: actorId })

  const [snapshot, targets, emps, itemsRes, runsRes] = await Promise.all([
    gatherSnapshot(),
    listTargets(),
    ensureWorkforce(),
    admin.from('ai_work_items').select('employee_slug,kind,title,status,priority,created_at').order('created_at', { ascending: false }).limit(20),
    admin.from('ai_runs').select('summary,status,started_at,items_created').order('started_at', { ascending: false }).limit(3),
  ])
  const history = (await listChat(12)).slice(-10)

  const context = {
    waktu: nowIso(),
    platform: snapshot.totals,
    anomali: snapshot.anomalies.map((a) => a.title),
    prospek_terbuka: snapshot.openInquiries.length,
    karyawan: emps.employees.map((e) => ({ slug: e.slug, nama: e.name, peran: e.role_title, status: e.status })),
    target_aktif: targets.filter((t) => t.status === 'active').map((t) => ({ id: t.id, period: t.period, title: t.title, metric: t.metric, progress: `${t.current_value}/${t.target_value}${t.unit ? ' ' + t.unit : ''}`, owner: t.owner_slug })),
    kerja_terbaru: (itemsRes.data ?? []).map((i) => `${i.employee_slug}: ${i.title} [${i.status}]`),
    siklus_terakhir: (runsRes.data ?? []).map((r) => `${r.status}: ${String(r.summary ?? '').slice(0, 120)}`),
  }

  const messages: AiMessage[] = [
    { role: 'system', content: `${COO_SYSTEM}\n\nKONTEKS SAAT INI (JSON): ${JSON.stringify(context).slice(0, 7000)}` },
    ...history.map((m) => ({ role: m.role, content: m.content }) as AiMessage),
  ]
  if (!messages.length || messages[messages.length - 1].content !== text) messages.push({ role: 'user', content: text })

  const actions: string[] = []
  let reply = ''
  for (let round = 0; round < 4; round += 1) {
    const { message: msg } = await aiToolChat(messages, COO_TOOLS, { temperature: 0.3, maxTokens: 1200, timeoutMs: 40000 })
    const calls = msg.tool_calls ?? []
    if (!calls.length) { reply = String(msg.content ?? '').trim(); break }
    messages.push({ role: 'assistant', content: msg.content ?? '' })
    for (const call of calls) {
      const result = await cooTool(call.function.name, safeJson(call.function.arguments), actorId)
      actions.push(describeAction(call.function.name, result))
      messages.push({ role: 'user', content: `HASIL TOOL ${call.function.name}: ${JSON.stringify(result).slice(0, 4000)}` })
    }
  }
  if (!reply) reply = 'Baik, saya catat. Ada lagi yang ingin Anda putuskan?'

  await admin.from('ai_chat_messages').insert({ role: 'assistant', content: reply.slice(0, 6000), actor_id: actorId, meta: { actions } })
  await audit(actorId, 'workforce.coo.chat', 'ai_chat', null, { actions })
  return { reply, actions, targets: await listTargets() }
}

/* ------------------------------------------------------------------ */
/* Siklus orkestrasi                                                   */
/* ------------------------------------------------------------------ */

export type CycleResult = {
  runId: string | null
  ok: boolean
  employees: { slug: string; work: number; note?: string }[]
  itemsCreated: number
  briefing?: Briefing
  error?: string
}

export type CycleScope = 'core' | 'content' | 'extended' | 'all'
const SCOPE_PLAN: Record<CycleScope, string[]> = {
  core: ['analyst', 'sales', 'coo'],
  content: ['content'],
  extended: ['growth', 'listing'],
  all: ['analyst', 'sales', 'growth', 'content', 'listing', 'coo'],
}

export async function runCycle(actorId: string | null, trigger: 'manual' | 'cron' | 'event' = 'manual', scope: CycleScope = 'core'): Promise<CycleResult> {
  if (!aiConfigured()) throw new AiError('Fitur AI belum diaktifkan (kunci AI belum diatur).', 503)
  const admin = sb()
  await ensureWorkforce()

  const { data: run } = await admin.from('ai_runs').insert({ trigger, status: 'running', actor_id: actorId }).select('id').maybeSingle()
  const runId = run?.id ? String(run.id) : null
  const employees: CycleResult['employees'] = []
  let itemsCreated = 0

  try {
    const t0 = Date.now()
    const snapshot = await gatherSnapshot()
    let analysis: AnalystReport | null = null
    let sales = { draftCount: 0, hotCount: 0 }
    let briefing: Briefing | null = null

    // Rencana kerja sesuai cakupan (Fase 1 inti; Fase 2 konten/pertumbuhan/listing).
    const plan = SCOPE_PLAN[scope] ?? SCOPE_PLAN.core
    for (const slug of plan) {
      const elapsed = Date.now() - t0
      const skip = elapsed > 45000
      try {
        if (slug === 'analyst') {
          if (skip) { employees.push({ slug, work: 0, note: 'dilewati (batas waktu)' }); continue }
          const a = await runAnalyst(snapshot, runId)
          analysis = a.analysis
          employees.push({ slug, work: 1 + a.alertCount, note: `${a.alertCount} anomali` })
          itemsCreated += 1 + a.alertCount
        } else if (slug === 'sales') {
          if (skip) { employees.push({ slug, work: 0, note: 'dilewati (batas waktu)' }); continue }
          sales = await runSales(snapshot, runId)
          employees.push({ slug, work: sales.draftCount, note: `${sales.draftCount} draf menunggu persetujuan` })
          itemsCreated += sales.draftCount
        } else if (slug === 'growth') {
          if (skip) { employees.push({ slug, work: 0, note: 'dilewati (batas waktu)' }); continue }
          const g = await runGrowth(snapshot, runId)
          employees.push({ slug, work: g.planCount })
          itemsCreated += g.planCount
        } else if (slug === 'content') {
          if (skip) { employees.push({ slug, work: 0, note: 'dilewati (batas waktu)' }); continue }
          const c = await runContent(snapshot, runId)
          employees.push({ slug, work: c.draftCount, note: `${c.draftCount} konten siap unggah` })
          itemsCreated += c.draftCount
        } else if (slug === 'listing') {
          const l = await runListing(snapshot, runId)
          employees.push({ slug, work: l.taskCount })
          itemsCreated += l.taskCount
        } else if (slug === 'coo') {
          briefing = await runCOO(snapshot, analysis, sales, runId, Date.now() - t0 < 50000)
          employees.push({ slug, work: 1 + briefing.escalate.length })
          itemsCreated += 1 + briefing.escalate.length
        }
      } catch (e) {
        employees.push({ slug, work: 0, note: `gagal: ${errMsg(e)}` })
      }
    }

    const failed = employees.filter((e) => /^(gagal|dilewati)/.test(String(e.note ?? ''))).length
    const summary = (failed ? `[${failed} langkah terganggu] ` : '') + (briefing?.briefing || `Siklus ${scope} selesai: ${itemsCreated} item kerja dibuat.`)
    await admin.from('ai_runs').update({
      status: itemsCreated > 0 ? 'ok' : 'error', summary: summary.slice(0, 800), items_created: itemsCreated, employees, finished_at: nowIso(),
    }).eq('id', runId ?? '00000000-0000-0000-0000-000000000000')

    // Beri tahu admin bila ada yang menunggu keputusan.
    const awaiting = sales.draftCount + (briefing?.escalate.length ?? 0)
    if (awaiting > 0) {
      await notifyAdmins('AI Workforce: item menunggu keputusan', `${awaiting} item menunggu persetujuan Anda (${sales.draftCount} balasan prospek, ${briefing?.escalate.length ?? 0} eskalasi). Buka AI Workforce untuk meninjau.`)
    }

    await audit(actorId, 'workforce.cycle', 'ai_run', runId, { trigger, scope, itemsCreated, employees, failed })
    return { runId, ok: itemsCreated > 0, employees, itemsCreated, briefing: briefing ?? undefined }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Siklus gagal'
    await admin.from('ai_runs').update({ status: 'error', summary: message.slice(0, 800), finished_at: nowIso(), employees, items_created: itemsCreated }).eq('id', runId ?? '00000000-0000-0000-0000-000000000000')
    await audit(actorId, 'workforce.cycle.error', 'ai_run', runId, { trigger, error: message })
    throw error
  }
}

/* ------------------------------------------------------------------ */
/* Keputusan manusia atas item kerja                                   */
/* ------------------------------------------------------------------ */

export type Decision = 'approve' | 'reject'

export async function decideWorkItem(actorId: string, id: string, decision: Decision, note?: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  const admin = sb()
  const { data: item } = await admin.from('ai_work_items').select('*').eq('id', id).maybeSingle()
  if (!item) return { ok: false, error: 'Item kerja tidak ditemukan' }
  if (['done', 'approved', 'rejected'].includes(String(item.status)) && !item.requires_approval) {
    return { ok: false, error: 'Item ini sudah final' }
  }
  const patch: Record<string, unknown> = { decided_by: actorId, decided_at: nowIso(), decision_note: note?.slice(0, 500) ?? null, updated_at: nowIso() }

  if (decision === 'reject') {
    await admin.from('ai_work_items').update({ ...patch, status: 'rejected' }).eq('id', id)
    await audit(actorId, 'workforce.reject', 'ai_work_item', id, { kind: item.kind, note })
    return { ok: true, status: 'rejected' }
  }

  // approve
  try {
    if (item.kind === 'reply_draft' && item.target_type === 'inquiry' && item.target_id) {
      const payload = (item.payload ?? {}) as { reply?: string }
      const reply = String(payload.reply ?? '').trim()
      if (!reply) return { ok: false, error: 'Draf balasan kosong' }
      const { data: inquiry } = await admin.from('inquiries').select('id,property_id,user_id,agent_id,status').eq('id', String(item.target_id)).maybeSingle()
      if (!inquiry) return { ok: false, error: 'Prospek tidak ditemukan' }
      const { error } = await admin.from('inquiries').update({ reply_message: reply.slice(0, 2000), replied_at: nowIso(), status: 'contacted', updated_at: nowIso() }).eq('id', String(item.target_id))
      if (error) return { ok: false, error: error.message }
      if (inquiry.user_id) {
        await admin.from('notifications').insert({
          user_id: inquiry.user_id, kind: 'inquiry.reply', title: 'Balasan dari tim Homy',
          body: reply.slice(0, 200), href: inquiry.property_id ? `/property/${inquiry.property_id}` : '/dashboard/user/inquiries',
          data: { source: 'ai_workforce', inquiry_id: String(item.target_id) },
        }).then(() => {}, () => {})
      }
      await admin.from('ai_work_items').update({ ...patch, status: 'approved' }).eq('id', id)
      await audit(actorId, 'workforce.approve.reply', 'inquiry', String(item.target_id), { item_id: id, length: reply.length })
      return { ok: true, status: 'approved' }
    }

    // default: tanda disetujui (mis. eskalasi, follow_up tanpa aksi otomatis).
    await admin.from('ai_work_items').update({ ...patch, status: 'approved' }).eq('id', id)
    await audit(actorId, 'workforce.approve', 'ai_work_item', id, { kind: item.kind, note })
    return { ok: true, status: 'approved' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Gagal memproses' }
  }
}

/* ------------------------------------------------------------------ */
/* Baca untuk dasbor                                                   */
/* ------------------------------------------------------------------ */

export async function listWorkforce() {
  const admin = sb()
  const { employees } = await ensureWorkforce()
  const [itemsRes, runsRes, targets] = await Promise.all([
    admin.from('ai_work_items').select('*').order('created_at', { ascending: false }).limit(80),
    admin.from('ai_runs').select('*').order('started_at', { ascending: false }).limit(12),
    listTargets(),
  ])
  const items = (itemsRes.data ?? []) as unknown as Json[]
  const runs = (runsRes.data ?? []) as unknown as Json[]

  const wib = new Date(Date.now() + WIB_OFFSET_MS)
  const dayStart = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - WIB_OFFSET_MS
  const today = (iso: unknown) => new Date(String(iso ?? '')).getTime() >= dayStart

  const stats = {
    activeEmployees: employees.filter((e) => e.status === 'active').length,
    totalEmployees: employees.length,
    awaitingApproval: items.filter((i) => i.status === 'awaiting_approval').length,
    openAlerts: items.filter((i) => i.kind === 'alert' && (i.status === 'open' || i.status === 'escalated')).length,
    itemsToday: items.filter((i) => today(i.created_at)).length,
    doneToday: items.filter((i) => i.kind === 'report' && today(i.created_at)).length,
    lastRunAt: runs[0]?.finished_at ?? runs[0]?.started_at ?? null,
  }

  return { configured: aiConfigured(), model: aiModel(), employees, items, runs, targets, stats }
}
