import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { referralAdmin, referralTerms, referralsForAdmin, releaseDueHolds } from '@/lib/referral'

export const runtime = 'nodejs'
export const maxDuration = 60

const ADMIN_ROLES = ['admin', 'super_admin']

async function requireAdmin(): Promise<{ userId: string } | { error: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 }) }
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const list = (roles ?? []).map((row: { role: string }) => row.role)
  if (!list.some((role) => ADMIN_ROLES.includes(role))) {
    return { error: NextResponse.json({ error: 'Hanya admin yang dapat mengakses Program Referral.' }, { status: 403 }) }
  }
  return { userId: user.id }
}

/** Dasbor admin: peserta, atribusi, buku komisi, batch payout, dan pengaturan program. */
export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const payload = await referralsForAdmin().catch(() => null)
  return NextResponse.json({
    authenticated: true,
    metrics: payload?.metrics ?? {},
    participants: payload?.participants ?? [],
    referrals: payload?.referrals ?? [],
    ledger: payload?.ledger ?? [],
    payouts: payload?.payouts ?? [],
    settings: payload?.settings ?? null,
    terms: referralTerms(payload?.settings ?? undefined),
  })
}

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const admin = referralAdmin()
  if (!admin) return NextResponse.json({ error: 'Konfigurasi server belum lengkap.' }, { status: 500 })
  const db: SupabaseClient = admin
  const actorId = guard.userId

  const body = await request.json().catch(() => ({}))
  const action = String(body?.action ?? '')
  const now = new Date().toISOString()

  async function audit(actionName: string, entityId: string | null, metadata: Record<string, unknown>) {
    try {
      await db.from('audit_logs').insert({ actor_id: actorId, action: actionName, entity_type: 'referral', entity_id: entityId, metadata })
    } catch { /* best effort */ }
  }

  // Selesaikan masa tahan yang sudah jatuh tempo → bonus siap dibayar.
  if (action === 'release') {
    const released = await releaseDueHolds(admin)
    await audit('referral.release_holds', null, { released })
    return NextResponse.json({ ok: true, released })
  }

  // Tinjau atribusi yang terindikasi fraud / salah pasang.
  if (action === 'review') {
    const id = String(body?.id ?? '')
    const status = String(body?.status ?? '')
    if (!id) return NextResponse.json({ error: 'ID referral wajib' }, { status: 400 })
    if (!['active', 'rejected', 'void'].includes(status)) return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : ''
    const { error } = await admin
      .from('referrals')
      .update({ status, fraud_note: note || null, reviewed_by: actorId, reviewed_at: now, updated_at: now })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (status === 'rejected' || status === 'void') {
      await admin.from('referral_ledger').update({ status: 'void', note: note || 'Atribusi referral dibatalkan admin', updated_at: now }).eq('referral_id', id).in('status', ['hold', 'approved'])
    }
    await audit('referral.review', id, { status, note })
    return NextResponse.json({ ok: true, status })
  }

  // Bayar bonus: buat batch pembayaran untuk satu agen dari baris berstatus "approved".
  if (action === 'payout') {
    const referrerId = String(body?.referrerId ?? '')
    if (!referrerId) return NextResponse.json({ error: 'ID agen wajib' }, { status: 400 })
    const { data: rows } = await admin
      .from('referral_ledger')
      .select('id,amount')
      .eq('referrer_id', referrerId)
      .eq('status', 'approved')
    const list = (rows ?? []) as Array<{ id: string; amount: number | string }>
    if (!list.length) return NextResponse.json({ error: 'Tidak ada bonus berstatus siap dibayar untuk agen ini.' }, { status: 409 })
    const total = list.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)

    const { data: payout, error: payoutError } = await admin
      .from('referral_payouts')
      .insert({
        referrer_id: referrerId,
        period: typeof body?.period === 'string' && body.period ? body.period.slice(0, 40) : now.slice(0, 7),
        total_amount: total,
        entries: list.length,
        method: typeof body?.method === 'string' && body.method ? body.method.slice(0, 40) : 'transfer',
        bank_name: typeof body?.bankName === 'string' ? body.bankName.slice(0, 80) : null,
        account_name: typeof body?.accountName === 'string' ? body.accountName.slice(0, 120) : null,
        account_number: typeof body?.accountNumber === 'string' ? body.accountNumber.slice(0, 40) : null,
        reference: typeof body?.reference === 'string' ? body.reference.slice(0, 120) : null,
        note: typeof body?.note === 'string' ? body.note.slice(0, 500) : null,
        status: 'paid',
        created_by: actorId,
        created_at: now,
        paid_at: now,
      })
      .select('id,total_amount,entries')
      .maybeSingle()
    if (payoutError || !payout) return NextResponse.json({ error: payoutError?.message ?? 'Gagal membuat batch pembayaran.' }, { status: 500 })

    const { error: ledgerError } = await admin
      .from('referral_ledger')
      .update({ status: 'paid', paid_at: now, payout_id: payout.id, updated_at: now })
      .in('id', list.map((row) => row.id))
    if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 500 })

    try {
      const { data: profile } = await admin.from('profiles').select('full_name').eq('id', referrerId).maybeSingle()
      await admin.from('notifications').insert({
        user_id: referrerId,
        kind: 'referral.payout',
        title: 'Bonus referral sudah dibayarkan 💸',
        body: `Bonus referral ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total)} (${list.length} transaksi) sudah ditransfer${body?.reference ? ` (ref: ${String(body.reference).slice(0, 40)})` : ''}.`,
        href: '/dashboard/agent/referral',
        data: { total, entries: list.length, payout_id: payout.id },
      })
      await audit('referral.payout', String(payout.id), { referrer_id: referrerId, referrer_name: profile?.full_name ?? null, total, entries: list.length })
    } catch { /* notifikasi opsional */ }

    return NextResponse.json({ ok: true, payout })
  }

  // Ubah parameter program (tarif, cap, masa tahan, aktif/nonaktif).
  if (action === 'settings') {
    const patch: Record<string, unknown> = { updated_at: now, updated_by: actorId }
    if (body?.rate !== undefined) {
      const rate = Number(body.rate)
      if (!Number.isFinite(rate) || rate < 0 || rate > 0.05) return NextResponse.json({ error: 'Tarif harus antara 0% dan 5%.' }, { status: 400 })
      patch.rate = rate
    }
    if (body?.cap_amount !== undefined) {
      const cap = Number(body.cap_amount)
      if (!Number.isFinite(cap) || cap < 0) return NextResponse.json({ error: 'Cap bonus tidak valid.' }, { status: 400 })
      patch.cap_amount = Math.round(cap)
    }
    if (body?.hold_days !== undefined) {
      const days = Number(body.hold_days)
      if (!Number.isFinite(days) || days < 0 || days > 180) return NextResponse.json({ error: 'Masa tahan harus 0–180 hari.' }, { status: 400 })
      patch.hold_days = Math.round(days)
    }
    if (body?.enabled !== undefined) patch.enabled = Boolean(body.enabled)

    const { error } = await admin.from('referral_settings').update(patch).eq('id', true)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await audit('referral.settings', null, patch)
    const payload = await referralsForAdmin().catch(() => null)
    return NextResponse.json({ ok: true, settings: payload?.settings ?? null })
  }

  return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 })
}
