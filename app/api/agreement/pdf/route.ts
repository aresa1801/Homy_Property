import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { buildAgreementPdf } from '@/lib/agreement-pdf'
import { AGREEMENT_VERSION } from '@/lib/partner-agreement'
import { defaultAvailability, type AvailabilityEntry, type VerificationRecord, type VerificationRole } from '@/lib/verification'

const ADMIN_ROLES = ['admin', 'super_admin']
const PARTNER_ROLES: VerificationRole[] = ['agent', 'property_owner']

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function slug(value: string) {
  return value.toString().normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'mitra'
}

/**
 * Unduh PDF Perjanjian Kerja Sama.
 *  - Mitra: `GET /api/agreement/pdf?role=agent`
 *  - Admin: `GET /api/agreement/pdf?role=agent&user_id=<uuid>` (mengunduh arsip mitra)
 */
export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const url = new URL(request.url)
  const role = String(url.searchParams.get('role') ?? '') as VerificationRole
  if (!PARTNER_ROLES.includes(role)) return NextResponse.json({ error: 'Peran mitra tidak valid' }, { status: 400 })

  let targetUserId = user.id
  const requestedUserId = String(url.searchParams.get('user_id') ?? '').trim()
  if (requestedUserId && requestedUserId !== user.id) {
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const list = Array.isArray(roles) ? roles.map((row: { role: string }) => row.role) : []
    if (!list.some((item) => ADMIN_ROLES.includes(item))) {
      return NextResponse.json({ error: 'Anda tidak punya akses untuk dokumen mitra lain' }, { status: 403 })
    }
    targetUserId = requestedUserId
  }

  const [{ data: recordRaw }, { data: agreementRaw }] = await Promise.all([
    admin.from('partner_verifications').select('*').eq('user_id', targetUserId).eq('requested_role', role).maybeSingle(),
    admin.from('partner_agreements').select('*').eq('user_id', targetUserId).eq('role', role).maybeSingle(),
  ])
  const record = (recordRaw ?? null) as VerificationRecord | null
  const agreement = (agreementRaw ?? null) as Record<string, unknown> | null
  if (!record && !agreement) {
    return NextResponse.json({ error: 'Data perjanjian tidak ditemukan' }, { status: 404 })
  }

  const signedAt = String(record?.agreement_signed_at ?? agreement?.signed_at ?? new Date().toISOString())
  const availability = (Array.isArray(record?.availability) && record?.availability?.length
    ? (record?.availability as AvailabilityEntry[])
    : defaultAvailability())

  const pdf = buildAgreementPdf({
    role,
    partner: {
      fullName: String(record?.full_name ?? agreement?.full_name ?? 'Mitra Homy'),
      nickname: record?.nickname ?? null,
      identityType: String(record?.identity_type ?? agreement?.identity_type ?? 'ktp'),
      identityNumber: String(record?.identity_number ?? agreement?.identity_number ?? '-'),
      birthPlace: record?.birth_place ?? null,
      birthDate: record?.birth_date ?? null,
      gender: record?.gender ?? null,
      occupation: record?.occupation ?? null,
      phone: String(record?.phone ?? agreement?.phone ?? '-'),
      whatsapp: record?.whatsapp ?? null,
      email: record?.email ?? null,
      companyName: String(record?.company_name ?? agreement?.company_name ?? '') || null,
      agencyLicense: record?.agency_license ?? null,
      npwp: String(record?.npwp ?? agreement?.npwp ?? '') || null,
      address: String(record?.address ?? agreement?.address ?? '') || null,
      rtRw: record?.rt_rw ?? null,
      village: record?.village ?? null,
      district: record?.district ?? null,
      city: record?.city ?? null,
      province: record?.province ?? null,
      postalCode: record?.postal_code ?? null,
    },
    availability,
    userId: targetUserId,
    verificationId: record?.id ?? null,
    agreementId: (agreement?.id as string | undefined) ?? record?.agreement_id ?? null,
    signedAt,
    version: String(record?.agreement_version ?? agreement?.agreement_version ?? AGREEMENT_VERSION),
  })

  const fileName = `Perjanjian-Kerja-Sama-Homy-${slug(role === 'agent' ? 'Agen' : 'Pemilik')}-${slug(String(record?.full_name ?? agreement?.full_name ?? 'Mitra'))}.pdf`

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

export const runtime = 'nodejs'
