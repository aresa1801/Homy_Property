import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureParticipant, getReferralSettings, isActiveAgent, myReferralOverview, referralAdmin, referralLink, referralTerms } from '@/lib/referral'

export const runtime = 'nodejs'
export const maxDuration = 30

/** Dasbor "Referral & Bonus" milik agen: kode, link, klik, referral join, dan buku komisi. */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ authenticated: false }, { status: 200 })

  const [{ data: roleRows }, overview] = await Promise.all([
    supabase.from('user_roles').select('role,status').eq('user_id', user.id),
    myReferralOverview(user.id).catch(() => null),
  ])
  const roles = (roleRows ?? []) as Array<{ role: string; status?: string | null }>
  const isAgent = roles.some((row) => row.role === 'agent' && String(row.status ?? 'active') === 'active')

  let settings = overview?.settings ?? null
  if (!settings) {
    const admin = referralAdmin()
    if (admin) settings = await getReferralSettings(admin)
  }
  return NextResponse.json({
    authenticated: true,
    isAgent,
    agent: isAgent,
    link: overview?.link ?? null,
    participant: overview?.participant ?? null,
    metrics: overview?.metrics ?? {},
    referrals: overview?.referrals ?? [],
    ledger: overview?.ledger ?? [],
    payouts: overview?.payouts ?? [],
    settings,
    terms: referralTerms(settings ?? undefined),
  })
}

/** Aksi mitra: aktifkan kode referral (sekali) setelah menyetujui ketentuan program. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const action = String(body?.action ?? '')
  const admin = referralAdmin()
  if (!admin) return NextResponse.json({ error: 'Konfigurasi server belum lengkap.' }, { status: 500 })

  if (action !== 'activate') return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 })

  if (!(await isActiveAgent(admin, user.id))) {
    return NextResponse.json({ error: 'Program bonus referral hanya untuk Agen yang sudah terverifikasi.' }, { status: 403 })
  }
  if (body?.agree !== true) {
    return NextResponse.json({ error: 'Centang persetujuan Ketentuan Program terlebih dahulu.' }, { status: 400 })
  }

  const { data: profile } = await admin.from('profiles').select('id,full_name').eq('id', user.id).maybeSingle()
  const fullName = (profile as { full_name?: string | null } | null)?.full_name ?? null
  const result = await ensureParticipant(admin, user.id, { acceptTerms: true, fullName })
  if (!result.participant) return NextResponse.json({ error: result.error ?? 'Gagal mengaktifkan kode referral.' }, { status: 500 })

  try {
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'referral.activate',
      entity_type: 'referral_participant',
      entity_id: result.participant.code,
      metadata: { code: result.participant.code },
    })
  } catch { /* best effort */ }

  return NextResponse.json({ ok: true, code: result.participant.code, link: referralLink(result.participant.code) })
}
