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
import { aiConfigured, aiJson, aiModel, AiError } from '@/lib/ai'
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
export type WorkItemKind = 'briefing' | 'report' | 'alert' | 'reply_draft' | 'task' | 'follow_up'
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
    status: 'planned',
    sortOrder: 4,
    jobCard: {
      responsibilities: [
        'Mengubah prospek pasif menjadi pipeline aktif.',
        'Mengusulkan target & kampanye akuisisi seller/buyer.',
        'Menjaga data CRM Prospek tetap bersih dan terkualifikasi.',
      ],
      standards: ['Setiap prospek punya tahap & tindak lanjut berikutnya.', 'Aktivitas patuh aturan platform & kanal resmi.'],
      guardrails: ['Tidak menghubungi pihak eksternal tanpa approval.', 'Tidak memakai kanal pribadi untuk brand.'],
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
    mission: 'Memproduksi konten berkualitas (highlight listing, edukasi properti) dan menjadwalkan tayang untuk menarik minat.',
    autonomy: 'approve',
    status: 'planned',
    sortOrder: 5,
    jobCard: {
      responsibilities: ['Menulis konten untuk highlight listing & edukasi.', 'Menyusun jadwal tayang konten.'],
      standards: ['Konten akurat, menarik, dan sesuai brand Homy.'],
      guardrails: ['Tidak menayangkan konten atas nama brand tanpa approval.'],
      escalates: ['Kanal publikasi & identitas brand'],
    },
    kpis: ['Konten siap tayang', 'Konsistensi jadwal'],
  },
  {
    slug: 'listing',
    name: 'Tono',
    roleTitle: 'Listing Operations',
    department: 'Operasional Listing',
    emoji: '🏠',
    mission: 'Membantu onboarding penjual, melengkapi data listing, dan QC sebelum tayang agar setiap listing siap jual.',
    autonomy: 'approve',
    status: 'planned',
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
    if (have.has(seed.slug)) continue
    const { error } = await admin.from('ai_employees').insert({
      slug: seed.slug,
      name: seed.name,
      role_title: seed.roleTitle,
      department: seed.department,
      emoji: seed.emoji,
      mission: seed.mission,
      job_card: seed.jobCard as unknown as Json,
      kpis: seed.kpis,
      autonomy: seed.autonomy,
      status: seed.status,
      sort_order: seed.sortOrder,
    })
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

async function runSales(snapshot: Snapshot, runId: string | null): Promise<{ draftCount: number; hotCount: number }> {
  const admin = sb()
  // Lewati prospek yang sudah punya draf menunggu keputusan.
  const { data: pending } = await admin.from('ai_work_items').select('target_id').eq('kind', 'reply_draft').in('status', ['open', 'awaiting_approval'])
  const pendingIds = new Set((pending ?? []).map((p) => String(p.target_id)))
  const targets = snapshot.openInquiries.filter((i) => !pendingIds.has(i.id)).slice(0, 5)
  if (!targets.length) return { draftCount: 0, hotCount: 0 }

  const result = await aiJsonRetry<{ drafts: Draft[] }>(
    [
      { role: 'system', content: 'Kamu "Dita", Sales & Customer Success platform properti Homy. Tulis draf balasan yang ramah, profesional, jelas, dan mendorong langkah berikutnya (mis. tawarkan jadwal viewing). Jangan menjanjikan diskon/harga khusus. Bahasa Indonesia santun. Maks 3 kalimat per balasan.' },
      { role: 'user', content: `PROSPEK TERBUKA (JSON): ${JSON.stringify(targets).slice(0, 6000)}\n\nUntuk SETIAP prospek, hasilkan JSON: { "drafts": [ { "inquiry_id": "...", "reply": "...", "intent": "tanya_harga|jadwal_viewing|umum|nego", "urgency": "low|normal|high" } ] }. Balas untuk semua inquiry_id yang diberikan.` },
    ],
    { temperature: 0.5, maxTokens: 2000 },
  )

  const valid = new Map(targets.map((t) => [t.id, t]))
  let draftCount = 0
  let hotCount = 0
  for (const d of result.drafts ?? []) {
    const target = valid.get(String(d.inquiry_id))
    if (!target) continue
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
      payload: { reply: String(d.reply ?? ''), intent: d.intent ?? null, buyer_message: target.message, ageHours: target.ageHours } as Json,
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

async function runCOO(snapshot: Snapshot, analyst: AnalystReport | null, sales: { draftCount: number; hotCount: number }, runId: string | null): Promise<Briefing> {
  let briefing: Briefing
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
    const [a, b] = [analyst?.report_title ? `Laporan "${analyst.report_title}" siap.` : 'Laporan operasional siap.', sales.draftCount ? `${sales.draftCount} draf balasan prospek menunggu persetujuan Anda.` : 'Tidak ada draf balasan baru.']
    briefing = {
      briefing: `Siklus harian selesai. ${a} ${b} ${snapshot.anomalies.length ? `${snapshot.anomalies.length} anomali terdeteksi.` : 'Tidak ada anomali baru.'}`,
      priorities: [],
      escalate: [],
    }
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

export async function runCycle(actorId: string | null, trigger: 'manual' | 'cron' | 'event' = 'manual'): Promise<CycleResult> {
  if (!aiConfigured()) throw new AiError('Fitur AI belum diaktifkan (kunci AI belum diatur).', 503)
  const admin = sb()
  await ensureWorkforce()

  const { data: run } = await admin.from('ai_runs').insert({ trigger, status: 'running', actor_id: actorId }).select('id').maybeSingle()
  const runId = run?.id ? String(run.id) : null
  const employees: CycleResult['employees'] = []
  let itemsCreated = 0

  try {
    const snapshot = await gatherSnapshot()

    const analyst = await runAnalyst(snapshot, runId)
    employees.push({ slug: 'analyst', work: 1 + analyst.alertCount, note: `${analyst.alertCount} anomali` })
    itemsCreated += 1 + analyst.alertCount

    const sales = await runSales(snapshot, runId)
    employees.push({ slug: 'sales', work: sales.draftCount, note: `${sales.draftCount} draf menunggu persetujuan` })
    itemsCreated += sales.draftCount

    const briefing = await runCOO(snapshot, analyst.analysis, sales, runId)
    employees.push({ slug: 'coo', work: 1 + briefing.escalate.length })
    itemsCreated += 1 + briefing.escalate.length

    const summary = briefing.briefing || `Siklus selesai: ${itemsCreated} item kerja dibuat.`
    await admin.from('ai_runs').update({
      status: 'ok', summary, items_created: itemsCreated, employees, finished_at: nowIso(),
    }).eq('id', runId ?? '00000000-0000-0000-0000-000000000000')

    // Beri tahu admin bila ada yang menunggu keputusan.
    const awaiting = sales.draftCount + briefing.escalate.length
    if (awaiting > 0) {
      await notifyAdmins('AI Workforce: item menunggu keputusan', `${awaiting} item menunggu persetujuan Anda (${sales.draftCount} balasan prospek, ${briefing.escalate.length} eskalasi). Buka AI Workforce untuk meninjau.`)
    }

    await audit(actorId, 'workforce.cycle', 'ai_run', runId, { trigger, itemsCreated, employees })
    return { runId, ok: true, employees, itemsCreated, briefing }
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
  const [itemsRes, runsRes] = await Promise.all([
    admin.from('ai_work_items').select('*').order('created_at', { ascending: false }).limit(80),
    admin.from('ai_runs').select('*').order('started_at', { ascending: false }).limit(12),
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

  return { configured: aiConfigured(), model: aiModel(), employees, items, runs, stats }
}
