import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { COMMISSION_RATE, AGREEMENT_VERSION, AGREEMENT_CONSENTS } from '@/lib/partner-agreement'
import { REQUIREMENT_LABELS, missingRequirements, type VerificationRecord, type VerificationRole } from '@/lib/verification'

const PARTNER_ROLES: VerificationRole[] = ['agent', 'property_owner']

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Data form perjanjian diambil dari verifikasi + profil supaya mitra tidak mengetik ulang. */
function agreementPayload(record: VerificationRecord, userId: string, signature: string, email: string) {
  const address = [
    record.address,
    record.rt_rw ? `RT/RW ${record.rt_rw}` : null,
    record.village,
    record.district,
    record.city,
    record.province,
    record.postal_code,
  ].map((part) => String(part ?? '').trim()).filter(Boolean).join(', ')

  return {
    user_id: userId,
    role: record.requested_role,
    full_name: String(record.full_name ?? '').slice(0, 160),
    identity_number: String(record.identity_number ?? '').slice(0, 60),
    phone: String(record.phone ?? record.whatsapp ?? '').slice(0, 40),
    address: address || null,
    company_name: record.company_name ? String(record.company_name).slice(0, 160) : null,
    npwp: record.npwp ? String(record.npwp).slice(0, 40) : null,
    commission_rate: COMMISSION_RATE,
    agreed_commission: true,
    agreed_report_transactions: true,
    agreed_terms: true,
    signature_name: signature.slice(0, 160),
    agreement_version: AGREEMENT_VERSION,
    status: 'active',
    signed_at: new Date().toISOString(),
    verification_id: record.id ?? null,
    identity_type: record.identity_type ?? null,
  }
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  let body: Record<string, unknown> = {}
  try { body = (await request.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'Invalid payload' }, { status: 400 }) }

  const role = String(body.requested_role ?? '') as VerificationRole
  if (!PARTNER_ROLES.includes(role)) return NextResponse.json({ error: 'Peran mitra tidak valid' }, { status: 400 })

  const signature = String(body.signature_name ?? '').trim()
  const consents = (body.consents ?? {}) as Record<string, unknown>
  const missingConsents = AGREEMENT_CONSENTS.filter((item) => consents[item.key] !== true).map((item) => item.key)
  if (missingConsents.length) {
    return NextResponse.json({ error: 'Semua pernyataan persetujuan wajib dicentang.' }, { status: 422 })
  }

  const { data: recordRaw } = await admin
    .from('partner_verifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('requested_role', role)
    .maybeSingle()
  const record = (recordRaw ?? null) as VerificationRecord | null
  if (!record) {
    return NextResponse.json({ error: 'Lengkapi data verifikasi terlebih dahulu sebelum menandatangani perjanjian.' }, { status: 409 })
  }

  const expected = String(record.full_name ?? '').trim().toLowerCase()
  if (signature.length < 3 || signature.toLowerCase() !== expected) {
    return NextResponse.json(
      { error: 'Tanda tangan harus sama dengan nama lengkap pada data verifikasi (' + String(record.full_name ?? '-') + ').' },
      { status: 422 },
    )
  }

  // Perjanjian hanya boleh ditandatangani setelah data wajib lengkap (kecuali poin perjanjian itu sendiri).
  const missing = missingRequirements({ ...record, agreement_id: record.agreement_id ?? 'pending' }).filter((key) => key !== 'agreement')
  if (missing.length) {
    return NextResponse.json(
      { error: 'Data belum lengkap: ' + missing.map((key) => REQUIREMENT_LABELS[key]).join(', '), missing },
      { status: 422 },
    )
  }

  const payload = agreementPayload(record, user.id, signature, user.email ?? '')
  const { data: agreement, error } = await admin
    .from('partner_agreements')
    .upsert(payload, { onConflict: 'user_id,role' })
    .select('*')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: updateError } = await admin
    .from('partner_verifications')
    .update({
      agreement_id: (agreement as { id?: string } | null)?.id ?? null,
      agreement_version: AGREEMENT_VERSION,
      agreement_signed_at: payload.signed_at,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('requested_role', role)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  try {
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'agreement.signed',
      entity_type: 'partner_agreement',
      entity_id: String((agreement as { id?: string } | null)?.id ?? ''),
      metadata: { role, version: AGREEMENT_VERSION, commission_rate: COMMISSION_RATE, verification_id: record.id ?? null },
    })
  } catch { /* best effort */ }

  return NextResponse.json({ ok: true, agreement })
}

export const runtime = 'nodejs'
