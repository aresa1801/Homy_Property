/**
 * Homy AI Admin — asisten yang "sadar database".
 *
 * Menjalankan model bahasa (DeepSeek) dengan seperangkat TOOL baca yang menyentuh
 * seluruh skema Homy lewat service-role, plus sedikit aksi tulis yang dibatasi &
 * selalu dicatat ke audit_logs. Hanya dipakai admin/super_admin (dijaga di route).
 *
 * Prinsip keamanan:
 *  - Baca: hanya tabel yang di-allow-list, dibatasi limit.
 *  - Tulis: hanya `send_notification` & `reply_inquiry` (aksi yang lazim untuk admin),
 *    keduanya memverifikasi entitas ada, lalu menulis notifikasi ke pengguna + audit.
 */
import { aiChat, aiJson, aiToolChat, AiError, type AiMessage, type AiToolDef } from '@/lib/ai'
import { serviceClient } from '@/lib/visits'

function sb() {
  const admin = serviceClient()
  if (!admin) throw new AiError('Klien database (service role) tidak tersedia', 503)
  return admin
}

const nowIso = () => new Date().toISOString()

type Json = Record<string, unknown>
function clampLimit(value: unknown, max = 50): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 20
  return Math.min(Math.floor(n), max)
}
function str(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const s = String(value).trim()
  return s ? s : undefined
}

/* ------------------------------------------------------------------ */
/* Skema tool untuk model                                              */
/* ------------------------------------------------------------------ */

export const ADMIN_TOOLS: AiToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'db_overview',
      description: 'Ringkasan seluruh database Homy: jumlah baris tiap tabel, komposisi peran pengguna, status listing, dan sanksi aktif. Panggil ini dulu untuk memahami kondisi platform.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_users',
      description: 'Cari/daftar pengguna. Bisa filter berdasarkan peran (user/agent/property_owner/admin/super_admin), atau cari nama/telepon. Mengembalikan id, nama, telepon, email, dan daftar peran.',
      parameters: {
        type: 'object',
        properties: {
          role: { type: 'string', description: 'Filter peran: user|agent|property_owner|admin|super_admin' },
          search: { type: 'string', description: 'Cari di nama atau nomor telepon' },
          limit: { type: 'number', description: 'Maksimum hasil (default 20)' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user',
      description: 'Detail satu pengguna: profil, peran, ringkasan listing/prospek/kunjungan, dan sanksi aktif.',
      parameters: { type: 'object', properties: { userId: { type: 'string' } }, required: ['userId'], additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_properties',
      description: 'Cari listing properti. Filter: status (draft|pending|published|rejected|archived), kota, kecamatan, pemilik (ownerId), jenis (sale|rent), kata kunci judul.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          city: { type: 'string' },
          district: { type: 'string' },
          ownerId: { type: 'string' },
          listingType: { type: 'string' },
          search: { type: 'string' },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_inquiries',
      description: 'Daftar pertanyaan/prospek (inquiries). Filter: status (open|replied|closed…), propertyId, sumber (form|ai).',
      parameters: { type: 'object', properties: { status: { type: 'string' }, propertyId: { type: 'string' }, source: { type: 'string' }, limit: { type: 'number' } }, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_visits',
      description: 'Daftar jadwal kunjungan (visits). Filter status (pending|confirmed|cancelled|completed).',
      parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'number' } }, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_transactions',
      description: 'Laporan transaksi mitra (komisi). Filter status (pending|verified|rejected).',
      parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'number' } }, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_sanctions',
      description: 'Daftar sanksi mitra. Filter status (active|lifted|expired).',
      parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'number' } }, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_partner_leads',
      description: 'Pengajuan kemitraan/partnership (partner_leads). Filter status atau kind.',
      parameters: { type: 'object', properties: { status: { type: 'string' }, kind: { type: 'string' }, limit: { type: 'number' } }, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_ai_conversations',
      description: 'Percakapan pengguna dengan Homy AI. Filter propertyId atau kata kunci di pertanyaan.',
      parameters: { type: 'object', properties: { propertyId: { type: 'string' }, search: { type: 'string' }, limit: { type: 'number' } }, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_notification',
      description: 'Kirim pesan/notifikasi ke seorang pengguna (muncul di lonceng + push). Pakai untuk berinteraksi dengan pengguna. Butuh userId; tulis singkat & jelas.',
      parameters: {
        type: 'object',
        properties: { userId: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, href: { type: 'string', description: 'Tautan opsional di dalam Homy, mis. /dashboard/agent' } },
        required: ['userId', 'title'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reply_inquiry',
      description: 'Balas sebuah pertanyaan/prospek (inquiry) atas nama tim Homy. Menyimpan balasan dan mengirim notifikasi ke penanya.',
      parameters: { type: 'object', properties: { inquiryId: { type: 'string' }, message: { type: 'string' } }, required: ['inquiryId', 'message'], additionalProperties: false },
    },
  },
]

/* ------------------------------------------------------------------ */
/* Eksekutor tool (baca + tulis terbatas)                              */
/* ------------------------------------------------------------------ */

const COUNT_TABLES = [
  'profiles', 'properties', 'inquiries', 'visits', 'transaction_reports', 'partner_leads',
  'partner_verifications', 'role_applications', 'partner_sanctions', 'notifications',
  'ai_conversations', 'ai_analyses', 'reviews', 'favorites', 'listing_alerts', 'payments',
  'rental_requests', 'interest_confirmations', 'moderation_reports', 'partner_agreements', 'notary_requests', 'notaries',
]

async function countRows(table: string): Promise<number> {
  const { count, error } = await sb().from(table).select('*', { count: 'exact', head: true })
  if (error) return -1
  return count ?? 0
}

async function enrichEmails(ids: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  const admin = sb()
  await Promise.all(ids.slice(0, 25).map(async (id) => {
    try {
      const { data } = await admin.auth.admin.getUserById(id)
      out[id] = data?.user?.email ?? null
    } catch { out[id] = null }
  }))
  return out
}

async function propertyTitles(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean))).slice(0, 100)
  if (!unique.length) return {}
  const { data } = await sb().from('properties').select('id,title,city,district').in('id', unique)
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[String(row.id)] = [row.title, row.city, row.district].filter(Boolean).join(' · ')
  return map
}

export async function executeTool(name: string, args: Json, actorId: string): Promise<unknown> {
  const admin = sb()

  switch (name) {
    case 'db_overview': {
      const counts: Record<string, number> = {}
      for (const table of COUNT_TABLES) counts[table] = await countRows(table)
      const { data: roles } = await admin.from('user_roles').select('role,status')
      const roleBreakdown: Record<string, number> = {}
      let nonActiveRoles = 0
      for (const row of roles ?? []) {
        roleBreakdown[row.role] = (roleBreakdown[row.role] ?? 0) + 1
        if (row.status && row.status !== 'active') nonActiveRoles += 1
      }
      const { data: props } = await admin.from('properties').select('status,listing_type')
      const statusBreakdown: Record<string, number> = {}
      const typeBreakdown: Record<string, number> = {}
      for (const row of props ?? []) {
        statusBreakdown[row.status] = (statusBreakdown[row.status] ?? 0) + 1
        typeBreakdown[row.listing_type] = (typeBreakdown[row.listing_type] ?? 0) + 1
      }
      const { count: activeSanctions } = await admin.from('partner_sanctions').select('*', { count: 'exact', head: true }).eq('status', 'active')
      return { counts, roleBreakdown, nonActiveRoles, propertyStatus: statusBreakdown, propertyType: typeBreakdown, activeSanctions: activeSanctions ?? 0 }
    }

    case 'query_users': {
      const role = str(args.role)
      const search = str(args.search)
      const limit = clampLimit(args.limit)
      let idFilter: string[] | null = null
      if (role) {
        const { data: roleRows } = await admin.from('user_roles').select('user_id').eq('role', role).limit(300)
        idFilter = (roleRows ?? []).map((r) => String(r.user_id))
        if (!idFilter.length) return { count: 0, users: [] }
      }
      let query = admin.from('profiles').select('id,full_name,phone,role,created_at').order('created_at', { ascending: false }).limit(limit)
      if (idFilter) query = query.in('id', idFilter)
      if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
      const { data, error } = await query
      if (error) throw new AiError('Gagal membaca data pengguna: ' + error.message, 502)
      const ids = (data ?? []).map((r) => String(r.id))
      const [emails, { data: roleRows }] = await Promise.all([
        enrichEmails(ids),
        admin.from('user_roles').select('user_id,role,status').in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
      ])
      const rolesById: Record<string, string[]> = {}
      for (const r of roleRows ?? []) rolesById[String(r.user_id)] = [...(rolesById[String(r.user_id)] ?? []), r.status && r.status !== 'active' ? `${r.role}(${r.status})` : String(r.role)]
      return { count: (data ?? []).length, users: (data ?? []).map((r) => ({ ...r, email: emails[String(r.id)] ?? null, roles: rolesById[String(r.id)] ?? [] })) }
    }

    case 'get_user': {
      const userId = str(args.userId)
      if (!userId) throw new AiError('userId wajib diisi', 400)
      const { data: profile } = await admin.from('profiles').select('id,full_name,phone,role,created_at').eq('id', userId).maybeSingle()
      if (!profile) return { found: false }
      const [roles, email, props, inquiries, visits, transactions, sanctions] = await Promise.all([
        admin.from('user_roles').select('role,status').eq('user_id', userId),
        enrichEmails([userId]),
        admin.from('properties').select('id,title,status,listing_type,price,city,district', { count: 'exact' }).eq('owner_id', userId).limit(50),
        admin.from('inquiries').select('id', { count: 'exact', head: true }).or(`user_id.eq.${userId},agent_id.eq.${userId}`),
        admin.from('visits').select('id', { count: 'exact', head: true }).or(`user_id.eq.${userId},agent_id.eq.${userId}`),
        admin.from('transaction_reports').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        admin.from('partner_sanctions').select('role,level,kind,status,ends_at').eq('user_id', userId).eq('status', 'active'),
      ])
      return {
        found: true,
        profile,
        email: email[userId] ?? null,
        roles: roles.data ?? [],
        counts: {
          properties: props.count ?? 0,
          inquiries: inquiries.count ?? 0,
          visits: visits.count ?? 0,
          transactions: transactions.count ?? 0,
          activeSanctions: (sanctions.data ?? []).length,
        },
        properties: props.data ?? [],
        activeSanctions: sanctions.data ?? [],
      }
    }

    case 'query_properties': {
      const limit = clampLimit(args.limit)
      let query = admin.from('properties')
        .select('id,title,status,listing_type,property_type,price,price_period,city,district,bedrooms,bathrooms,land_area,building_area,owner_id,verified_at,created_at')
        .order('created_at', { ascending: false }).limit(limit)
      if (str(args.status)) query = query.eq('status', String(args.status))
      if (str(args.city)) query = query.ilike('city', `%${String(args.city)}%`)
      if (str(args.district)) query = query.ilike('district', `%${String(args.district)}%`)
      if (str(args.ownerId)) query = query.eq('owner_id', String(args.ownerId))
      if (str(args.listingType)) query = query.eq('listing_type', String(args.listingType))
      if (str(args.search)) query = query.ilike('title', `%${String(args.search)}%`)
      const { data, error } = await query
      if (error) throw new AiError('Gagal membaca listing: ' + error.message, 502)
      return { count: (data ?? []).length, properties: data ?? [] }
    }

    case 'query_inquiries': {
      const limit = clampLimit(args.limit)
      let query = admin.from('inquiries').select('id,property_id,user_id,agent_id,status,source,message,reply_message,created_at,updated_at').order('created_at', { ascending: false }).limit(limit)
      if (str(args.status)) query = query.eq('status', String(args.status))
      if (str(args.propertyId)) query = query.eq('property_id', String(args.propertyId))
      if (str(args.source)) query = query.eq('source', String(args.source))
      const { data, error } = await query
      if (error) throw new AiError('Gagal membaca prospek: ' + error.message, 502)
      const titles = await propertyTitles((data ?? []).map((r) => String(r.property_id ?? '')))
      return { count: (data ?? []).length, inquiries: (data ?? []).map((r) => ({ ...r, property_title: titles[String(r.property_id)] ?? null })) }
    }

    case 'query_visits': {
      const limit = clampLimit(args.limit)
      let query = admin.from('visits').select('id,property_id,user_id,agent_id,scheduled_at,status,interest,created_at').order('scheduled_at', { ascending: false }).limit(limit)
      if (str(args.status)) query = query.eq('status', String(args.status))
      const { data, error } = await query
      if (error) throw new AiError('Gagal membaca kunjungan: ' + error.message, 502)
      const titles = await propertyTitles((data ?? []).map((r) => String(r.property_id ?? '')))
      return { count: (data ?? []).length, visits: (data ?? []).map((r) => ({ ...r, property_title: titles[String(r.property_id)] ?? null })) }
    }

    case 'query_transactions': {
      const limit = clampLimit(args.limit)
      let query = admin.from('transaction_reports').select('id,user_id,role,property_title,buyer_name,sale_price,commission_rate,commission_amount,sold_at,status,created_at').order('created_at', { ascending: false }).limit(limit)
      if (str(args.status)) query = query.eq('status', String(args.status))
      const { data, error } = await query
      if (error) throw new AiError('Gagal membaca transaksi: ' + error.message, 502)
      return { count: (data ?? []).length, transactions: data ?? [] }
    }

    case 'query_sanctions': {
      const limit = clampLimit(args.limit)
      let query = admin.from('partner_sanctions').select('id,user_id,role,level,kind,category,reason,status,starts_at,ends_at,created_at').order('created_at', { ascending: false }).limit(limit)
      if (str(args.status)) query = query.eq('status', String(args.status))
      const { data, error } = await query
      if (error) throw new AiError('Gagal membaca sanksi: ' + error.message, 502)
      return { count: (data ?? []).length, sanctions: data ?? [] }
    }

    case 'query_partner_leads': {
      const limit = clampLimit(args.limit)
      let query = admin.from('partner_leads').select('id,kind,full_name,email,phone,company,city,province,status,created_at').order('created_at', { ascending: false }).limit(limit)
      if (str(args.status)) query = query.eq('status', String(args.status))
      if (str(args.kind)) query = query.eq('kind', String(args.kind))
      const { data, error } = await query
      if (error) throw new AiError('Gagal membaca pengajuan mitra: ' + error.message, 502)
      return { count: (data ?? []).length, leads: data ?? [] }
    }

    case 'query_ai_conversations': {
      const limit = clampLimit(args.limit)
      let query = admin.from('ai_conversations').select('id,property_id,user_id,user_email,mode,question,answer,created_at').order('created_at', { ascending: false }).limit(limit)
      if (str(args.propertyId)) query = query.eq('property_id', String(args.propertyId))
      if (str(args.search)) query = query.ilike('question', `%${String(args.search)}%`)
      const { data, error } = await query
      if (error) throw new AiError('Gagal membaca percakapan AI: ' + error.message, 502)
      const titles = await propertyTitles((data ?? []).map((r) => String(r.property_id ?? '')))
      return { count: (data ?? []).length, conversations: (data ?? []).map((r) => ({ ...r, answer: String(r.answer ?? '').slice(0, 400), property_title: titles[String(r.property_id)] ?? null })) }
    }

    case 'send_notification': {
      const userId = str(args.userId)
      const title = str(args.title)
      if (!userId || !title) throw new AiError('userId dan title wajib diisi', 400)
      const { data: profile } = await admin.from('profiles').select('id,full_name').eq('id', userId).maybeSingle()
      if (!profile) return { ok: false, error: 'Pengguna tidak ditemukan' }
      const body = str(args.body) ? String(args.body).slice(0, 600) : null
      const href = str(args.href) ?? null
      const { error } = await admin.from('notifications').insert({ user_id: userId, kind: 'ai.message', title: title.slice(0, 180), body, href, data: { source: 'ai_admin', actor: actorId } })
      if (error) throw new AiError('Gagal mengirim notifikasi: ' + error.message, 502)
      await admin.from('audit_logs').insert({ actor_id: actorId, action: 'ai.admin.notify', entity_type: 'profile', entity_id: userId, metadata: { title, body, href } }).then(() => {}, () => {})
      return { ok: true, to: profile.full_name ?? userId }
    }

    case 'reply_inquiry': {
      const inquiryId = str(args.inquiryId)
      const message = str(args.message)
      if (!inquiryId || !message) throw new AiError('inquiryId dan message wajib diisi', 400)
      const { data: inquiry } = await admin.from('inquiries').select('id,property_id,user_id,agent_id,status').eq('id', inquiryId).maybeSingle()
      if (!inquiry) return { ok: false, error: 'Pertanyaan tidak ditemukan' }
      const { error } = await admin.from('inquiries').update({ reply_message: message.slice(0, 2000), replied_at: nowIso(), status: 'replied', updated_at: nowIso() }).eq('id', inquiryId)
      if (error) throw new AiError('Gagal menyimpan balasan: ' + error.message, 502)
      if (inquiry.user_id && String(inquiry.user_id) !== String(inquiry.agent_id)) {
        await admin.from('notifications').insert({
          user_id: inquiry.user_id, kind: 'inquiry.reply', title: 'Balasan dari tim Homy',
          body: message.slice(0, 200), href: inquiry.property_id ? `/property/${inquiry.property_id}` : '/dashboard/user/inquiries',
          data: { source: 'ai_admin', inquiry_id: inquiryId },
        }).then(() => {}, () => {})
      }
      await admin.from('audit_logs').insert({ actor_id: actorId, action: 'ai.admin.reply_inquiry', entity_type: 'inquiry', entity_id: inquiryId, metadata: { length: message.length } }).then(() => {}, () => {})
      return { ok: true, inquiryId }
    }

    default:
      return { error: `Tool tidak dikenal: ${name}` }
  }
}

/* ------------------------------------------------------------------ */
/* Loop agent: model memanggil tool berulang, lalu menjawab            */
/* ------------------------------------------------------------------ */

export const ADMIN_SYSTEM = `Kamu adalah "Homy AI Admin" — asisten internal platform Homy Property yang bertindak sebagai ADMIN: kamu mengetahui SELURUH isi database Homy dan membantu tim Homy (admin & super admin).

ALAT (TOOLS):
- Kamu punya tool untuk membaca database (pengguna, listing, prospek, kunjungan, transaksi/komisi, sanksi, pengajuan mitra, percakapan AI, ringkasan platform).
- Kamu juga punya dua aksi tulis: send_notification (kirim pesan ke pengguna) dan reply_inquiry (balas pertanyaan pengguna).
- Panggil tool bila perlu data yang belum kamu miliki. Jangan mengarang angka atau nama — kalau tidak ada di tool, katakan belum tersedia.
- Untuk aksi tulis, HANYA lakukan jika permintaan admin jelas. Sebutkan apa yang kamu lakukan.

CARA MENJAWAB:
1. Bahasa Indonesia, ringkas, profesional, seperti rekan analis admin.
2. Sebut angka konkret dari data. Bila menyebut nominal rupiah, pakai pemisah ribuan (Rp 1.500.000.000).
3. Bila relevan, tawarkan analisa lanjutan atau aksi berikutnya.
4. JANGAN pakai sintaks markdown (tanpa bintang/pagar/garis bawah). Kalau merinci, pakai baris diawali "- ".
5. Jangan membocorkan rahasia internal (kunci API, token). Data pengguna hanya untuk keperluan operasional.`

export type AgentResult = { answer: string; steps: { tool: string; args: Json; result: unknown }[]; usage?: unknown }

/** Jalankan loop tool-calling sampai model menghasilkan jawaban akhir. */
export async function runAdminAgent(history: AiMessage[], question: string, actorId: string): Promise<AgentResult> {
  const messages: AiMessage[] = [{ role: 'system', content: ADMIN_SYSTEM }, ...history.slice(-6), { role: 'user', content: question }]
  const steps: AgentResult['steps'] = []
  let usage: unknown

  for (let round = 0; round < 5; round += 1) {
    const { message, usage: u } = await aiToolChat(messages, ADMIN_TOOLS, { temperature: 0.2, maxTokens: 1100 })
    usage = u
    const calls = message.tool_calls ?? []
    // Dorong balasan sebagai pesan asisten (dengan tool_calls) untuk menjaga konteks.
    messages.push({ role: 'assistant', content: message.content ?? '' })
    if (!calls.length) {
      const answer = (message.content ?? '').trim()
      if (answer) return { answer, steps, usage }
      // tidak ada konten & tidak ada tool → minta model menjawab
      messages.push({ role: 'user', content: 'Jawab sekarang berdasarkan data yang sudah kamu ambil.' })
      continue
    }
    for (const call of calls) {
      let parsed: Json = {}
      try { parsed = JSON.parse(call.function.arguments || '{}') as Json } catch { parsed = {} }
      let result: unknown
      try { result = await executeTool(call.function.name, parsed, actorId) } catch (error) {
        result = { error: error instanceof Error ? error.message : 'tool error' }
      }
      steps.push({ tool: call.function.name, args: parsed, result })
      messages.push({ role: 'user', content: `HASIL TOOL ${call.function.name}: ${JSON.stringify(result).slice(0, 6000)}` })
    }
  }

  const final = await aiChat([...messages, { role: 'user', content: 'Ringkas jawaban akhir untuk admin sekarang.' }], { temperature: 0.2, maxTokens: 900 })
  return { answer: final.text, steps, usage }
}

/* ------------------------------------------------------------------ */
/* Mode ANALISA: susun laporan untuk target tertentu                    */
/* ------------------------------------------------------------------ */

export type AnalysisTarget = { type: 'platform' | 'agent' | 'owner' | 'property' | 'partner' | 'user'; id?: string }

export type AnalysisResult = {
  title: string
  summary: string
  metrics: Json
  insights: string[]
  recommendations: string[]
  risks: string[]
}

async function gatherTargetContext(target: AnalysisTarget): Promise<{ label: string; context: string }> {
  const admin = sb()
  if (target.type === 'platform' || !target.id) {
    const counts: Record<string, number> = {}
    for (const table of ['profiles', 'properties', 'inquiries', 'visits', 'transaction_reports', 'partner_leads', 'partner_sanctions']) counts[table] = await countRows(table)
    const { data: props } = await admin.from('properties').select('status,listing_type,city,price')
    const byCity: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    let saleSum = 0, saleN = 0, rentSum = 0, rentN = 0
    for (const p of props ?? []) {
      byCity[p.city || '—'] = (byCity[p.city || '—'] ?? 0) + 1
      byStatus[p.status || '—'] = (byStatus[p.status || '—'] ?? 0) + 1
      const price = Number(p.price) || 0
      if (p.listing_type === 'rent') { rentSum += price; rentN += 1 } else if (p.listing_type === 'sale') { saleSum += price; saleN += 1 }
    }
    return {
      label: 'Platform Homy (keseluruhan)',
      context: JSON.stringify({ counts, byStatus, byCity, avgSalePrice: saleN ? Math.round(saleSum / saleN) : null, avgRentPrice: rentN ? Math.round(rentSum / rentN) : null, saleCount: saleN, rentCount: rentN }),
    }
  }

  if (target.type === 'property') {
    const { data: property } = await admin.from('properties').select('*').eq('id', target.id).maybeSingle()
    if (!property) throw new AiError('Properti tidak ditemukan', 404)
    const [inq, visits, conv] = await Promise.all([
      admin.from('inquiries').select('id,status,source,message,created_at').eq('property_id', target.id).limit(100),
      admin.from('visits').select('id,status,scheduled_at,interest').eq('property_id', target.id).limit(100),
      admin.from('ai_conversations').select('id,question,created_at').eq('property_id', target.id).limit(100),
    ])
    return {
      label: `Properti: ${property.title}`,
      context: JSON.stringify({ property: { id: property.id, title: property.title, status: property.status, listing_type: property.listing_type, price: property.price, price_period: property.price_period, city: property.city, district: property.district, bedrooms: property.bedrooms, bathrooms: property.bathrooms, land_area: property.land_area, building_area: property.building_area, created_at: property.created_at }, inquiries: inq.data ?? [], visits: visits.data ?? [], aiQuestionCount: (conv.data ?? []).length, aiQuestions: (conv.data ?? []).slice(0, 15) }),
    }
  }

  // agent/owner/partner/user → profil + aset + kinerja
  const { data: profile } = await admin.from('profiles').select('id,full_name,phone,role,created_at').eq('id', target.id).maybeSingle()
  if (!profile) throw new AiError('Pengguna tidak ditemukan', 404)
  const [emails, roles, props, inq, visits, trx, sanctions] = await Promise.all([
    enrichEmails([String(target.id)]),
    admin.from('user_roles').select('role,status').eq('user_id', target.id),
    admin.from('properties').select('id,title,status,listing_type,price,city,district,created_at').eq('owner_id', target.id).limit(100),
    admin.from('inquiries').select('id,status,source,created_at').or(`user_id.eq.${target.id},agent_id.eq.${target.id}`).limit(200),
    admin.from('visits').select('id,status,scheduled_at').or(`user_id.eq.${target.id},agent_id.eq.${target.id}`).limit(200),
    admin.from('transaction_reports').select('id,status,commission_amount,sale_price,sold_at').eq('user_id', target.id).limit(100),
    admin.from('partner_sanctions').select('level,kind,status,ends_at').eq('user_id', target.id).eq('status', 'active'),
  ])
  const commissionVerified = (trx.data ?? []).filter((t) => t.status === 'verified').reduce((sum, t) => sum + (Number(t.commission_amount) || 0), 0)
  return {
    label: `Pengguna: ${profile.full_name ?? target.id} (${roles.data?.map((r) => r.role).join(', ') || 'user'})`,
    context: JSON.stringify({
      profile: { id: profile.id, full_name: profile.full_name, phone: profile.phone, email: emails[String(target.id)] ?? null, created_at: profile.created_at },
      roles: roles.data ?? [],
      properties: props.data ?? [],
      inquiries: { total: (inq.data ?? []).length, open: (inq.data ?? []).filter((i) => i.status === 'open').length, fromAi: (inq.data ?? []).filter((i) => i.source === 'ai').length },
      visits: { total: (visits.data ?? []).length, confirmed: (visits.data ?? []).filter((v) => v.status === 'confirmed').length, completed: (visits.data ?? []).filter((v) => v.status === 'completed').length },
      transactions: trx.data ?? [],
      commissionVerified,
      activeSanctions: sanctions.data ?? [],
    }),
  }
}

/** Hasilkan analisa terstruktur untuk target tertentu (JSON terjamin). */
export async function generateAnalysis(target: AnalysisTarget, actorId: string, audience?: string): Promise<AnalysisResult & { targetLabel: string }> {
  const { label, context } = await gatherTargetContext(target)
  const audienceText = audience === 'agent' ? 'Agen' : audience === 'property_owner' || audience === 'owner' ? 'Pemilik Properti' : audience === 'partner' ? 'Mitra' : audience === 'admin' || audience === 'super_admin' ? 'Tim Admin' : 'pengguna'
  const result = await aiJson<AnalysisResult>(
    [
      { role: 'system', content: `Kamu analis data platform properti Homy. Susun ANALISA untuk audiens: ${audienceText}. Gunakan HANYA data yang diberikan. Bahasa Indonesia, actionable, jujur (jangan melebih-lebihkan).` },
      { role: 'user', content: `Target: ${label}\nDATA (JSON): ${context.slice(0, 12000)}\n\nHasilkan objek JSON dengan kunci: title (judul laporan singkat), summary (ringkasan 2-4 kalimat), metrics (objek angka penting), insights (array 3-6 temuan), recommendations (array 3-6 saran konkret), risks (array 0-4 risiko/peringatan).` },
    ],
    { temperature: 0.3, maxTokens: 1200 },
  )
  // Rapikan bentuk minimal agar UI tak pernah pecah.
  return {
    title: String(result.title ?? label).slice(0, 180),
    summary: String(result.summary ?? '').slice(0, 2000),
    metrics: (result.metrics && typeof result.metrics === 'object' ? result.metrics : {}) as Json,
    insights: Array.isArray(result.insights) ? result.insights.map((x) => String(x)) : [],
    recommendations: Array.isArray(result.recommendations) ? result.recommendations.map((x) => String(x)) : [],
    risks: Array.isArray(result.risks) ? result.risks.map((x) => String(x)) : [],
    targetLabel: label,
  }
}

/** Simpan analisa; opsional kirim notifikasi ke target. */
export async function saveAnalysis(input: {
  target: AnalysisTarget
  audience?: string
  analysis: AnalysisResult
  actorId: string
  model: string
  notify?: boolean
}): Promise<{ id: string | null; notified: boolean }> {
  const admin = sb()
  const { data, error } = await admin.from('ai_analyses').insert({
    target_type: input.target.type,
    target_id: input.target.id ?? null,
    audience_role: input.audience ?? null,
    title: input.analysis.title,
    summary: input.analysis.summary,
    payload: input.analysis as unknown as Json,
    model: input.model,
    created_by: input.actorId,
  }).select('id').maybeSingle()
  if (error) throw new AiError('Gagal menyimpan analisa: ' + error.message, 502)

  let notified = false
  if (input.notify && input.target.id && input.target.type !== 'platform') {
    const href = input.target.type === 'property' ? `/property/${input.target.id}` : input.target.type === 'agent' ? '/dashboard/agent' : '/dashboard/property-owner'
    const { error: notifyError } = await admin.from('notifications').insert({
      user_id: input.target.id, kind: 'ai.analysis', title: 'Analisa Homy AI untuk Anda',
      body: input.analysis.summary.slice(0, 200), href, data: { source: 'ai_admin', analysis_id: data?.id ?? null },
    })
    notified = !notifyError
    await admin.from('audit_logs').insert({ actor_id: input.actorId, action: 'ai.admin.analyze.notify', entity_type: input.target.type, entity_id: input.target.id, metadata: { analysis_id: data?.id ?? null } }).then(() => {}, () => {})
  }
  await admin.from('audit_logs').insert({ actor_id: input.actorId, action: 'ai.admin.analyze', entity_type: input.target.type, entity_id: input.target.id ?? null, metadata: { analysis_id: data?.id ?? null, audience: input.audience ?? null } }).then(() => {}, () => {})
  return { id: data?.id ?? null, notified }
}
