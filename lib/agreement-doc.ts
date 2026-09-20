/**
 * Homy — pemuat data bersama untuk dokumen Perjanjian Kerja Sama (server-only).
 *
 * Dipakai oleh:
 *  - `app/api/agreement/pdf/route.ts`   → dokumen final bertanda tangan
 *  - `app/api/agreement/draft/route.ts` → Draf Perjanjian (belum ditandatangani)
 *
 * Semua logika pemetaan record `partner_verifications` + `partner_agreements`
 * ke payload PDF dikumpulkan di sini supaya kedua route tetap tipis dan konsisten.
 */

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { AGREEMENT_VERSION } from '@/lib/partner-agreement'
import { MAX_IDENTITY_UPLOAD_BYTES, VERIFICATION_BUCKET, defaultAvailability, type AvailabilityEntry, type VerificationRecord, type VerificationRole } from '@/lib/verification'
import type { AgreementPartner } from '@/lib/agreement-pdf'

export const ADMIN_ROLES = ['admin', 'super_admin']
export const PARTNER_ROLES: VerificationRole[] = ['agent', 'property_owner']

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

type SupabaseLike = { from: (table: string) => any }

/** Mitra boleh mengunduh dokumennya sendiri; admin boleh mengunduh arsip mitra lain. */
export async function resolveAgreementTarget(
  supabase: SupabaseLike,
  user: { id: string },
  requestedUserId: string,
): Promise<{ ok: true; targetUserId: string } | { ok: false; status: number; error: string }> {
  if (!requestedUserId || requestedUserId === user.id) return { ok: true, targetUserId: user.id }
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const list = Array.isArray(roles) ? roles.map((row: { role: string }) => row.role) : []
  if (!list.some((item) => ADMIN_ROLES.includes(item))) {
    return { ok: false, status: 403, error: 'Anda tidak punya akses untuk dokumen mitra lain' }
  }
  return { ok: true, targetUserId: requestedUserId }
}

export type AgreementSource = {
  role: VerificationRole
  partner: AgreementPartner
  availability: AvailabilityEntry[]
  userId: string
  verificationId: string | null
  agreementId: string | null
  signedAt: string
  version: string
  serial: string | null
  signedIp: string | null
  userAgent: string | null
  record: VerificationRecord | null
  agreement: Record<string, unknown> | null
}

/** Ambil & petakan data perjanjian mitra dari database. */
export async function loadAgreementSource(
  admin: NonNullable<ReturnType<typeof serviceClient>>,
  targetUserId: string,
  role: VerificationRole,
): Promise<AgreementSource | null> {
  const [{ data: recordRaw }, { data: agreementRaw }] = await Promise.all([
    admin.from('partner_verifications').select('*').eq('user_id', targetUserId).eq('requested_role', role).maybeSingle(),
    admin.from('partner_agreements').select('*').eq('user_id', targetUserId).eq('role', role).maybeSingle(),
  ])
  const record = (recordRaw ?? null) as VerificationRecord | null
  const agreement = (agreementRaw ?? null) as Record<string, unknown> | null
  if (!record && !agreement) return null

  const signedAt = String(record?.agreement_signed_at ?? agreement?.signed_at ?? new Date().toISOString())
  const availability = Array.isArray(record?.availability) && record?.availability?.length
    ? (record?.availability as AvailabilityEntry[])
    : defaultAvailability()

  return {
    role,
    userId: targetUserId,
    availability,
    signedAt,
    version: String(record?.agreement_version ?? agreement?.agreement_version ?? AGREEMENT_VERSION),
    serial: (agreement?.signature_serial as string | undefined) ?? null,
    signedIp: (agreement?.signed_ip as string | undefined) ?? null,
    userAgent: (agreement?.signed_user_agent as string | undefined) ?? null,
    verificationId: record?.id ?? null,
    agreementId: (agreement?.id as string | undefined) ?? record?.agreement_id ?? null,
    record,
    agreement,
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
      nationality: record?.nationality ?? null,
      identityExpiry: record?.identity_expiry ?? null,
      bankName: record?.bank_name ?? null,
      bankAccountNumber: record?.bank_account_number ?? null,
      bankAccountName: record?.bank_account_name ?? null,
      emergencyName: record?.emergency_name ?? null,
      emergencyPhone: record?.emergency_phone ?? null,
    },
  }
}

/** Baca dimensi gambar JPEG dari header (tanpa dependensi). */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) break
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (length < 2) break
    const isSof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)
    if (isSof) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6]
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8]
      if (!width || !height) return null
      return { width, height }
    }
    offset += 2 + length
  }
  return null
}

/** Unduh salinan foto identitas (JPEG) dari storage agar bisa dilampirkan ke Draf Perjanjian. */
export async function downloadIdentityImage(
  admin: NonNullable<ReturnType<typeof serviceClient>>,
  record: VerificationRecord | null,
): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  const path = String(record?.identity_doc_path ?? '').trim()
  if (!path || !/\.jpe?g$/i.test(path)) return null
  try {
    const { data, error } = await admin.storage.from(VERIFICATION_BUCKET).download(path)
    if (error || !data) return null
    const bytes = new Uint8Array(await data.arrayBuffer())
    if (!bytes.length || bytes.length > MAX_IDENTITY_UPLOAD_BYTES) return null
    const size = jpegSize(bytes)
    if (!size) return null
    return { data: bytes, ...size }
  } catch {
    return null
  }
}

/** Nama berkas unduhan yang aman. */
export function slug(value: string) {
  return value
    .toString()
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'mitra'
}

export function roleSlug(role: VerificationRole) {
  return role === 'agent' ? 'Agen' : 'Pemilik'
}
