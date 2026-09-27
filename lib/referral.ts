/**
 * Homy — Program Bonus Referral (Agent → Agent).
 *
 * Aturan program (disetujui Boss, 27 Sep 2026):
 *  - Hanya AGEN terverifikasi yang boleh menjadi pereferensi (referrer) DAN hanya
 *    bila pihak yang diajak juga mendaftar sebagai AGEN (agent to agent).
 *  - Bonus 0,1% dari NILAI TRANSAKSI, dibatasi (cap) Rp 2.000.000 per transaksi.
 *  - Dibayar HANYA setelah transaksi agen referefensi diverifikasi admin, dengan
 *    masa tahan 30 hari (antisipasi batal/refund), lalu ditransfer manual.
 *  - Satu level saja (tidak berjenjang) — menghindari skema money game.
 *  - Anti-fraud: tidak boleh mereferensikan diri sendiri, tidak boleh identitas /
 *    nomor HP / rekening bank yang sama dengan pereferensi, dan atribusi hanya
 *    lewat tautan resmi (kode) yang tersimpan di cookie 30 hari.
 *
 * Semua penulisan lewat service-role (server-side). Pembacaan mitra dibatasi RLS.
 */
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/notifications'

export const REFERRAL_TERMS_VERSION = '2026-09-27'
export const REFERRAL_RATE = 0.001
export const REFERRAL_CAP = 2_000_000
export const REFERRAL_HOLD_DAYS = 30

export type ReferralSettings = { rate: number; cap_amount: number; hold_days: number; enabled: boolean }

export type ReferralLedgerRow = {
  id: string
  referral_id: string
  referrer_id: string
  referee_id: string
  transaction_report_id: string
  property_id?: string | null
  property_title?: string | null
  basis_amount: number | string
  rate: number | string
  amount: number | string
  capped?: boolean | null
  status: 'hold' | 'approved' | 'paid' | 'void'
  hold_until: string
  approved_at?: string | null
  paid_at?: string | null
  payout_id?: string | null
  note?: string | null
  created_at?: string | null
}

export type ReferralRow = {
  id: string
  referrer_id: string
  code: string
  referee_id?: string | null
  referee_role?: string | null
  status: 'joined' | 'active' | 'rejected' | 'void'
  joined_at?: string | null
  fraud_flag?: string | null
  fraud_note?: string | null
  created_at?: string | null
}

/** Klien service-role (tanpa generic Database — tabel referral belum ada di types.ts). */
export function referralAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function getReferralSettings(admin: SupabaseClient): Promise<ReferralSettings> {
  try {
    const { data } = await admin.from('referral_settings').select('rate,cap_amount,hold_days,enabled').eq('id', true).maybeSingle()
    if (data) {
      return {
        rate: Number(data.rate ?? REFERRAL_RATE),
        cap_amount: Number(data.cap_amount ?? REFERRAL_CAP),
        hold_days: Number(data.hold_days ?? REFERRAL_HOLD_DAYS),
        enabled: Boolean(data.enabled ?? true),
      }
    }
  } catch { /* pakai default */ }
  return { rate: REFERRAL_RATE, cap_amount: REFERRAL_CAP, hold_days: REFERRAL_HOLD_DAYS, enabled: true }
}

/** Bonus = nilai transaksi × tarif, dibatasi cap. */
export function commissionFor(basis: number, rate = REFERRAL_RATE, cap = REFERRAL_CAP) {
  const raw = Math.max(0, Number(basis) || 0) * (Number(rate) || 0)
  const amount = Math.round(Math.min(raw, Number(cap) || 0))
  return { amount, capped: raw > Number(cap || 0) }
}

function slugSeed(input?: string | null) {
  const base = String(input ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
    .slice(0, 6)
  return base || 'AGEN'
}

function randomBlock(size = 5) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < size; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export function makeReferralCode(name?: string | null) {
  return `${slugSeed(name)}-${randomBlock(5)}`
}

export function referralLink(code: string, origin = 'https://homyproperty.id') {
  return `${origin.replace(/\/$/, '')}/r/${code}`
}

export async function resolveParticipantByCode(admin: SupabaseClient, code: string) {
  const clean = String(code ?? '').trim().toUpperCase()
  if (!clean) return null
  const { data } = await admin.from('referral_participants').select('user_id,code,status').eq('code', clean).maybeSingle()
  return data && data.status === 'active' ? data : null
}

/** Aktifkan kode referral agen (idempoten). */
export async function ensureParticipant(
  admin: SupabaseClient,
  userId: string,
  opts: { acceptTerms?: boolean; fullName?: string | null } = {},
): Promise<{ participant: { user_id: string; code: string } | null; error?: string }> {
  const { data: existing } = await admin.from('referral_participants').select('user_id,code,status').eq('user_id', userId).maybeSingle()
  if (existing?.code) return { participant: { user_id: existing.user_id, code: existing.code } }

  let name = opts.fullName ?? null
  if (!name) {
    const { data: profile } = await admin.from('profiles').select('full_name').eq('id', userId).maybeSingle()
    name = profile?.full_name ?? null
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = makeReferralCode(name)
    const { data, error } = await admin
      .from('referral_participants')
      .insert({
        user_id: userId,
        code,
        status: 'active',
        terms_version: REFERRAL_TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('user_id,code')
      .maybeSingle()
    if (!error && data) return { participant: data }
    if (error && !/duplicate|unique/i.test(error.message)) return { participant: null, error: error.message }
  }
  return { participant: null, error: 'Gagal membuat kode referral, coba lagi.' }
}

/** Cek apakah user memang agen aktif. */
export async function isActiveAgent(admin: SupabaseClient, userId: string) {
  const { data } = await admin.from('user_roles').select('role,status').eq('user_id', userId).eq('role', 'agent').maybeSingle()
  return Boolean(data) && String(data?.status ?? 'active') === 'active'
}

type FraudInput = { identity_number?: string | null; phone?: string | null; email?: string | null; bank_account_number?: string | null }

function normalize(value?: string | null) {
  const text = String(value ?? '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase()
  return text.length >= 5 ? text : ''
}

/** Bandingkan identitas pereferensi vs referefensi → deteksi self-referral / akun ganda. */
export async function fraudCheck(admin: SupabaseClient, referrerId: string, refereeId: string): Promise<{ flag: string | null; note: string | null }> {
  try {
    const [{ data: referrer }, { data: referee }] = await Promise.all([
      admin.from('partner_verifications').select('identity_number,phone,email,bank_account_number').eq('user_id', referrerId).limit(5),
      admin.from('partner_verifications').select('identity_number,phone,email,bank_account_number').eq('user_id', refereeId).limit(5),
    ])
    const pick = (rows: FraudInput[] | null | undefined) => {
      const list = Array.isArray(rows) ? rows : []
      return {
        identity: list.map((row) => normalize(row.identity_number)).filter(Boolean),
        phone: list.map((row) => normalize(row.phone)).filter(Boolean),
        bank: list.map((row) => normalize(row.bank_account_number)).filter(Boolean),
        email: list.map((row) => normalize(row.email)).filter(Boolean),
      }
    }
    const a = pick(referrer as FraudInput[])
    const b = pick(referee as FraudInput[])
    const overlap = (x: string[], y: string[]) => x.filter((item) => y.includes(item))
    const identity = overlap(a.identity, b.identity)
    if (identity.length) return { flag: 'identitas_sama', note: 'Nomor identitas (KTP/SIM) sama dengan pereferensi.' }
    const bank = overlap(a.bank, b.bank)
    if (bank.length) return { flag: 'rekening_sama', note: 'Nomor rekening bank sama dengan pereferensi.' }
    const phone = overlap(a.phone, b.phone)
    if (phone.length) return { flag: 'hp_sama', note: 'Nomor HP/WhatsApp sama dengan pereferensi.' }
    const email = overlap(a.email, b.email)
    if (email.length) return { flag: 'email_sama', note: 'Email sama dengan pereferensi.' }
  } catch { /* pemeriksaan best-effort */ }
  return { flag: null, note: null }
}

/**
 * Simpan atribusi saat calon MITRA mengirim verifikasi (dipanggil dari /api/verify).
 * Syarat: kode valid, pereferensi adalah agen aktif, pendaftar juga agen, bukan orang yang sama.
 */
export async function attachReferralForReferee(
  admin: SupabaseClient,
  args: { refereeId: string; role: string; code: string | null | undefined },
): Promise<{ attached: boolean; status?: string; reason?: string }> {
  const code = String(args.code ?? '').trim().toUpperCase()
  if (!code) return { attached: false, reason: 'tanpa_kode' }
  if (args.role !== 'agent') return { attached: false, reason: 'bukan_agent' }

  const participant = await resolveParticipantByCode(admin, code)
  if (!participant) return { attached: false, reason: 'kode_tidak_valid' }
  if (participant.user_id === args.refereeId) return { attached: false, reason: 'diri_sendiri' }
  if (!(await isActiveAgent(admin, participant.user_id))) return { attached: false, reason: 'pereferensi_bukan_agen' }

  const { data: existing } = await admin.from('referrals').select('id,referrer_id').eq('referee_id', args.refereeId).maybeSingle()
  if (existing) return { attached: false, reason: 'sudah_tercatat' }

  const fraud = await fraudCheck(admin, participant.user_id, args.refereeId)
  const now = new Date().toISOString()
  const { error } = await admin.from('referrals').insert({
    referrer_id: participant.user_id,
    code: participant.code,
    referee_id: args.refereeId,
    referee_role: args.role,
    status: fraud.flag ? 'rejected' : 'joined',
    source: 'verification_submit',
    cookie_code: code,
    joined_at: now,
    fraud_flag: fraud.flag,
    fraud_note: fraud.note,
    updated_at: now,
  })
  if (error) return { attached: false, reason: error.message }

  try {
    await admin.from('audit_logs').insert({
      actor_id: args.refereeId,
      action: fraud.flag ? 'referral.flagged' : 'referral.joined',
      entity_type: 'referral',
      entity_id: participant.code,
      metadata: { referrer_id: participant.user_id, referee_id: args.refereeId, code: participant.code, fraud_flag: fraud.flag },
    })
  } catch { /* best effort */ }

  if (!fraud.flag) {
    try {
      await notifyUser({
        userId: participant.user_id,
        kind: 'referral.joined',
        title: 'Agen baru bergabung dari kode referral Anda 🎉',
        body: 'Agen yang Anda referensikan sudah mendaftar. Bonus 0,1% dibayarkan setelah transaksi pertamanya diverifikasi Homy.',
        href: '/dashboard/agent/referral',
        data: { code: participant.code },
      })
    } catch { /* best effort */ }
  }

  return { attached: true, status: fraud.flag ? 'rejected' : 'joined' }
}

/** Catat bonus referral ketika laporan transaksi diverifikasi admin (dipanggil dari /api/admin/ops). */
export async function accrueReferralForTransaction(
  admin: SupabaseClient,
  report: { id: string; user_id: string; property_id?: string | null; property_title?: string | null; sale_price: number | string | null; verified_at?: string | null },
): Promise<{ created: boolean; amount?: number; reason?: string }> {
  const basis = Number(report.sale_price ?? 0)
  if (!(basis > 0)) return { created: false, reason: 'nilai_kosong' }

  const { data: referral } = await admin
    .from('referrals')
    .select('id,referrer_id,referee_id,status,fraud_flag,code')
    .eq('referee_id', report.user_id)
    .maybeSingle()
  if (!referral) return { created: false, reason: 'bukan_referral' }
  if (referral.fraud_flag || referral.status === 'rejected') return { created: false, reason: 'terindikasi_fraud' }

  const settings = await getReferralSettings(admin)
  if (!settings.enabled) return { created: false, reason: 'nonaktif' }

  const { amount, capped } = commissionFor(basis, settings.rate, settings.cap_amount)
  const verifiedAt = report.verified_at ? new Date(report.verified_at) : new Date()
  const holdUntil = new Date(verifiedAt.getTime() + settings.hold_days * 24 * 60 * 60 * 1000)
  const now = new Date().toISOString()

  const { data: inserted, error } = await admin
    .from('referral_ledger')
    .insert({
      referral_id: referral.id,
      referrer_id: referral.referrer_id,
      referee_id: report.user_id,
      transaction_report_id: report.id,
      property_id: report.property_id ?? null,
      property_title: report.property_title ?? null,
      basis_amount: basis,
      rate: settings.rate,
      amount,
      capped,
      status: 'hold',
      hold_until: holdUntil.toISOString(),
      created_at: now,
      updated_at: now,
    })
    .select('id,amount,hold_until')
    .maybeSingle()

  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { created: false, reason: 'sudah_ada' }
    return { created: false, reason: error.message }
  }

  await admin.from('referrals').update({ status: 'active', updated_at: now }).eq('id', referral.id)

  try {
    await admin.from('audit_logs').insert({
      actor_id: null,
      action: 'referral.commission',
      entity_type: 'referral_ledger',
      entity_id: String(inserted?.id ?? report.id),
      metadata: { referrer_id: referral.referrer_id, referee_id: report.user_id, basis_amount: basis, amount, hold_until: holdUntil.toISOString(), transaction_report_id: report.id },
    })
  } catch { /* best effort */ }

  try {
    await notifyUser({
      userId: referral.referrer_id,
      kind: 'referral.commission',
      title: 'Bonus referral masuk 💰',
      body: `Transaksi mitra yang Anda referensikan sudah diverifikasi. Bonus ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)} ditahan ${settings.hold_days} hari sebelum bisa dibayarkan.`,
      href: '/dashboard/agent/referral',
      data: { amount, hold_until: holdUntil.toISOString(), transaction_report_id: report.id },
    })
  } catch { /* best effort */ }

  return { created: true, amount }
}

/** Ubah bonus yang masa tahannya sudah lewat menjadi siap dibayar. */
export async function releaseDueHolds(admin: SupabaseClient): Promise<number> {
  try {
    const now = new Date().toISOString()
    const { data } = await admin
      .from('referral_ledger')
      .update({ status: 'approved', approved_at: now, updated_at: now })
      .eq('status', 'hold')
      .lte('hold_until', now)
      .select('id')
    return Array.isArray(data) ? data.length : 0
  } catch {
    return 0
  }
}

/** Pembungkus aman: dipakai route server yang butuh data referral tanpa mengurus klien. */
export async function myReferralOverview(userId: string) {
  const admin = referralAdmin()
  if (!admin) return null
  return referralOverview(admin, userId)
}

export async function referralsForAdmin() {
  const admin = referralAdmin()
  if (!admin) return null
  await releaseDueHolds(admin)
  return adminReferralOverview(admin)
}

/** Ringkasan program untuk agen (dipakai dasbor "Referral & Bonus"). */
export async function referralOverview(admin: SupabaseClient, userId: string) {
  const settings = await getReferralSettings(admin)
  const [{ data: participant }, { data: clicks }, { data: referrals }, { data: ledger }, { data: payouts }] = await Promise.all([
    admin.from('referral_participants').select('code,status,terms_version,terms_accepted_at,created_at').eq('user_id', userId).maybeSingle(),
    admin.from('referral_clicks').select('created_at').eq('referrer_id', userId).order('created_at', { ascending: false }).limit(1000),
    admin.from('referrals').select('id,referee_id,referee_role,status,fraud_flag,joined_at').eq('referrer_id', userId).order('joined_at', { ascending: false }).limit(200),
    admin.from('referral_ledger').select('*').eq('referrer_id', userId).order('created_at', { ascending: false }).limit(200),
    admin.from('referral_payouts').select('*').eq('referrer_id', userId).order('created_at', { ascending: false }).limit(50),
  ])

  const names = await profileNames(admin, (referrals ?? []).map((row: { referee_id?: string | null }) => String(row.referee_id ?? '')))
  const rows = (ledger ?? []) as ReferralLedgerRow[]
  const sum = (status: string) => rows.filter((row) => row.status === status).reduce((total, row) => total + Number(row.amount ?? 0), 0)

  return {
    settings,
    participant: participant ?? null,
    link: participant?.code ? referralLink(participant.code) : null,
    metrics: {
      clicks: (clicks ?? []).length,
      clicks30d: (clicks ?? []).filter((row: { created_at?: string }) => Date.parse(String(row.created_at)) > Date.now() - 30 * 24 * 60 * 60 * 1000).length,
      joined: (referrals ?? []).filter((row: { status?: string }) => row.status !== 'rejected' && row.status !== 'void').length,
      flagged: (referrals ?? []).filter((row: { status?: string; fraud_flag?: string | null }) => row.status === 'rejected' || row.fraud_flag).length,
      commissionHold: sum('hold'),
      commissionApproved: sum('approved'),
      commissionPaid: sum('paid'),
      commissionVoid: sum('void'),
    },
    referrals: (referrals ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      referee_name: names[String(row.referee_id ?? '')] ?? null,
    })),
    ledger: rows.map((row) => ({ ...row })),
    payouts: payouts ?? [],
  }
}

async function profileNames(admin: SupabaseClient, ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  const map: Record<string, string> = {}
  if (!unique.length) return map
  const { data } = await admin.from('profiles').select('id,full_name').in('id', unique)
  for (const row of data ?? []) map[String((row as { id: string }).id)] = String((row as { full_name?: string | null }).full_name ?? '')
  return map
}

export async function profileContacts(admin: SupabaseClient, ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  const map: Record<string, { name?: string | null; phone?: string | null }> = {}
  if (!unique.length) return map
  const { data } = await admin.from('profiles').select('id,full_name,phone').in('id', unique)
  for (const row of data ?? []) {
    const item = row as { id: string; full_name?: string | null; phone?: string | null }
    map[item.id] = { name: item.full_name ?? null, phone: item.phone ?? null }
  }
  return map
}

/** Ringkasan program untuk admin/super admin (dipakai dasbor "Program Referral"). */
export async function adminReferralOverview(admin: SupabaseClient) {
  const settings = await getReferralSettings(admin)
  const [{ data: participants }, { data: clicks }, { data: referrals }, { data: ledger }, { data: payouts }] = await Promise.all([
    admin.from('referral_participants').select('user_id,code,status,terms_accepted_at').order('created_at', { ascending: false }).limit(500),
    admin.from('referral_clicks').select('code,referrer_id,created_at').order('created_at', { ascending: false }).limit(2000),
    admin.from('referrals').select('id,referrer_id,code,referee_id,referee_role,status,fraud_flag,fraud_note,joined_at').order('joined_at', { ascending: false }).limit(300),
    admin.from('referral_ledger').select('*').order('created_at', { ascending: false }).limit(300),
    admin.from('referral_payouts').select('*').order('created_at', { ascending: false }).limit(200),
  ])

  const ids = [
    ...(referrals ?? []).flatMap((row: { referrer_id?: string; referee_id?: string | null }) => [String(row.referrer_id ?? ''), String(row.referee_id ?? '')]),
    ...(ledger ?? []).map((row: { referrer_id?: string }) => String(row.referrer_id ?? '')),
    ...(payouts ?? []).map((row: { referrer_id?: string }) => String(row.referrer_id ?? '')),
  ]
  const contacts = await profileContacts(admin, ids)
  const name = (id?: string | null) => (id && contacts[id]?.name) || (id ? id.slice(0, 8) : '—')
  const rows = (ledger ?? []) as ReferralLedgerRow[]
  const sum = (status: string) => rows.filter((row) => row.status === status).reduce((total, row) => total + Number(row.amount ?? 0), 0)

  return {
    settings,
    metrics: {
      participants: (participants ?? []).length,
      clicks: (clicks ?? []).length,
      clicks30d: (clicks ?? []).filter((row: { created_at?: string }) => Date.parse(String(row.created_at)) > Date.now() - 30 * 24 * 60 * 60 * 1000).length,
      joined: (referrals ?? []).filter((row: { status?: string }) => row.status !== 'rejected' && row.status !== 'void').length,
      flagged: (referrals ?? []).filter((row: { status?: string; fraud_flag?: string | null }) => row.status === 'rejected' || row.fraud_flag).length,
      commissionHold: sum('hold'),
      commissionApproved: sum('approved'),
      commissionPaid: sum('paid'),
      commissionVoid: sum('void'),
    },
    participants: (participants ?? []).map((row: { user_id: string; code: string; status: string; terms_accepted_at?: string | null }) => ({
      ...row,
      name: name(row.user_id),
      phone: contacts[row.user_id]?.phone ?? null,
    })),
    referrals: (referrals ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      referrer_name: name(String(row.referrer_id ?? '')),
      referee_name: row.referee_id ? name(String(row.referee_id)) : null,
    })),
    ledger: rows.map((row) => ({ ...row, referrer_name: name(row.referrer_id), referee_name: name(row.referee_id) })),
    payouts: (payouts ?? []).map((row: Record<string, unknown>) => ({ ...row, referrer_name: name(String(row.referrer_id ?? '')) })),
  }
}

/** Teks ketentuan program — dipakai UI mitra & halaman publik /referral/ketentuan. */
export function referralTerms(settings?: Partial<ReferralSettings>): { title: string; version: string; points: string[] } {
  const rate = ((settings?.rate ?? REFERRAL_RATE) * 100).toFixed(2).replace('.', ',')
  const cap = new Intl.NumberFormat('id-ID').format(settings?.cap_amount ?? REFERRAL_CAP)
  const hold = settings?.hold_days ?? REFERRAL_HOLD_DAYS
  return {
    title: 'Ketentuan Program Bonus Referral (Agent → Agent)',
    version: REFERRAL_TERMS_VERSION,
    points: [
      `Peserta: hanya Agen terverifikasi Homy yang boleh memiliki kode referral, dan hanya Agen yang mendaftar sebagai Agen yang dihitung sebagai referral (agent to agent).`,
      `Bonus: ${rate}% dari NILAI TRANSAKSI properti, maksimal Rp ${cap} per transaksi.`,
      `Pemicu pembayaran: laporan transaksi Agen yang direferensikan sudah DIVERIFIKASI oleh Homy (bukan saat mendaftar, bukan saat listing tayang).`,
      `Masa tahan: ${hold} hari setelah verifikasi transaksi — untuk mengantisipasi transaksi batal/refund. Setelah itu bonus berstatus siap dibayar.`,
      `Pembayaran: ditransfer ke rekening Agen pada rekening yang terdaftar di data verifikasi, dengan rekap resmi. Biaya pajak mengikuti ketentuan perpajakan yang berlaku.`,
      `Satu level saja: Agen A → Agen B. Jika Agen B mengajak Agen C, bonus Agen C hanya untuk Agen B, bukan untuk Agen A (tidak berjenjang).`,
      `Anti-fraud: dilarang mereferensikan diri sendiri, memakai identitas/nomor HP/rekening bank yang sama dengan pereferensi, atau membuat akun palsu. Pelanggaran = bonus dibatalkan, kode dinonaktifkan, dan dapat dikenakan sanksi mitra.`,
      `Homy berhak menyesuaikan tarif, cap, dan ketentuan program dengan pemberitahuan di dasbor mitra.`,
    ],
  }
}
