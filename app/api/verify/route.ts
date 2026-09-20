import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/notifications'
import {
  MAX_IDENTITY_UPLOAD_BYTES,
  REQUIREMENT_LABELS,
  VERIFICATION_BUCKET,
  formatBytes,
  missingRequirements,
  type AvailabilityEntry,
  type VerificationRecord,
  type VerificationRole,
} from '@/lib/verification'

const PARTNER_ROLES: VerificationRole[] = ['agent', 'property_owner']

/** Kolom yang boleh ditulis pemohon (sisanya hanya admin/verifikasi). */
const EDITABLE_FIELDS = [
  'full_name', 'nickname', 'identity_type', 'identity_number', 'identity_expiry', 'nationality',
  'birth_place', 'birth_date',
  'gender', 'marital_status', 'occupation', 'phone', 'whatsapp', 'email',
  'company_name', 'agency_license', 'npwp',
  'address', 'rt_rw', 'village', 'district', 'city', 'province', 'postal_code',
  'bank_name', 'bank_account_number', 'bank_account_name', 'emergency_name', 'emergency_phone',
  'domicile_same_as_ktp', 'ktp_address', 'ktp_city', 'ktp_province',
  'identity_doc_path', 'selfie_doc_path', 'npwp_doc_path', 'supporting_doc_path',
  'notes',
] as const

const DOC_FIELDS = ['identity_doc_path', 'selfie_doc_path', 'npwp_doc_path', 'supporting_doc_path'] as const

/** Foto identitas (KTP/SIM) & selfie dibatasi 1 MB supaya ringan dan konsisten. */
const IDENTITY_DOC_FIELDS = ['identity_doc_path', 'selfie_doc_path'] as const

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function requireUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** Validasi ukuran berkas identitas di server (batas 1 MB) — klien tidak boleh jadi satu-satunya pengawal. */
async function oversizedIdentityDocs(
  admin: ReturnType<typeof serviceClient>,
  userId: string,
  patch: Record<string, unknown>,
): Promise<string[]> {
  const paths = IDENTITY_DOC_FIELDS
    .map((field) => String(patch[field] ?? ''))
    .filter((path) => path.startsWith(`${userId}/`))
  if (!paths.length || !admin) return []
  const { data, error } = await admin.storage.from(VERIFICATION_BUCKET).list(userId)
  if (error || !Array.isArray(data)) return []
  const sizes = new Map<string, number>()
  for (const item of data as { name?: string; metadata?: { size?: number } }[]) {
    if (item?.name) sizes.set(`${userId}/${item.name}`, Number(item.metadata?.size ?? 0))
  }
  return paths.filter((path) => (sizes.get(path) ?? 0) > MAX_IDENTITY_UPLOAD_BYTES)
}

function cleanAvailability(input: unknown, fallback?: AvailabilityEntry[] | null): AvailabilityEntry[] {
  const source = Array.isArray(input) ? input : fallback ?? []
  const rows: AvailabilityEntry[] = []
  for (const raw of source) {
    const row = (raw ?? {}) as Record<string, unknown>
    const weekday = Number(row.weekday)
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue
    const start = String(row.start_time ?? '09:00').slice(0, 5)
    const end = String(row.end_time ?? '17:00').slice(0, 5)
    const mode = ['online', 'onsite', 'both'].includes(String(row.mode)) ? String(row.mode) : 'both'
    const slot = Number(row.slot_minutes)
    rows.push({
      weekday,
      is_active: Boolean(row.is_active),
      start_time: /^\d{2}:\d{2}$/.test(start) ? start : '09:00',
      end_time: /^\d{2}:\d{2}$/.test(end) ? end : '17:00',
      slot_minutes: [30, 45, 60, 90, 120].includes(slot) ? slot : 60,
      mode: mode as AvailabilityEntry['mode'],
      location: row.location ? String(row.location).slice(0, 160) : null,
      notes: row.notes ? String(row.notes).slice(0, 200) : null,
    })
  }
  return rows
}

function sanitizePatch(input: Record<string, unknown>, userId: string) {
  const patch: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (!(field in input)) continue
    const value = input[field]
    if (field === 'domicile_same_as_ktp') {
      patch[field] = Boolean(value)
      continue
    }
    if ((DOC_FIELDS as readonly string[]).includes(field)) {
      const path = value ? String(value).trim() : ''
      // hanya boleh menyimpan berkas di folder milik sendiri
      patch[field] = path && path.startsWith(`${userId}/`) ? path.slice(0, 300) : null
      continue
    }
    const text = value === null || value === undefined ? '' : String(value).trim()
    patch[field] = text ? text.slice(0, 300) : null
  }
  return patch
}

export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ authenticated: false, verifications: {}, agreements: [] }, { status: 200 })
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const [verifications, agreements, profile] = await Promise.all([
    admin.from('partner_verifications').select('*').eq('user_id', user.id),
    admin.from('partner_agreements').select('id,role,status,agreement_version,signed_at,verification_id,signature_serial').eq('user_id', user.id),
    admin.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle(),
  ])

  const map: Record<string, VerificationRecord> = {}
  for (const row of (verifications.data ?? []) as VerificationRecord[]) map[String(row.requested_role)] = row

  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, email: user.email ?? '' },
    profile: profile.data ?? null,
    verifications: map,
    agreements: agreements.data ?? [],
  })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  let body: Record<string, unknown> = {}
  try { body = (await request.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'Invalid payload' }, { status: 400 }) }

  const role = String(body.requested_role ?? '') as VerificationRole
  if (!PARTNER_ROLES.includes(role)) return NextResponse.json({ error: 'Peran mitra tidak valid' }, { status: 400 })
  const action = String(body.action ?? 'save')
  const data = (body.data ?? {}) as Record<string, unknown>
  const now = new Date().toISOString()

  const { data: existingRaw } = await admin
    .from('partner_verifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('requested_role', role)
    .maybeSingle()
  const existing = (existingRaw ?? null) as VerificationRecord | null
  if (existing?.status === 'approved') {
    return NextResponse.json({ error: 'Akun mitra Anda sudah terverifikasi.', record: existing }, { status: 409 })
  }

  const patch = sanitizePatch(data, user.id)
  const availability = cleanAvailability(data.availability, existing?.availability ?? null)

  const oversized = await oversizedIdentityDocs(admin, user.id, patch)
  if (oversized.length) {
    return NextResponse.json(
      {
        error: `Ukuran foto identitas melebihi batas ${formatBytes(MAX_IDENTITY_UPLOAD_BYTES)}. Kompres ulang KTP/SIM & selfie lalu unggah kembali.`,
        fields: oversized,
      },
      { status: 413 },
    )
  }

  const draft: VerificationRecord = {
    ...(existing ?? { requested_role: role, status: 'draft' }),
    ...patch,
    requested_role: role,
    availability,
  } as VerificationRecord

  if (action === 'submit') {
    const missing = missingRequirements(draft)
    if (missing.length) {
      return NextResponse.json(
        {
          error: 'Data belum lengkap: ' + missing.map((key) => REQUIREMENT_LABELS[key]).join(', '),
          missing,
        },
        { status: 422 },
      )
    }
  }

  const record: Record<string, unknown> = {
    ...patch,
    user_id: user.id,
    requested_role: role,
    availability,
    updated_at: now,
  }
  if (action === 'submit') {
    record.status = 'pending'
    record.submitted_at = now
    record.reviewed_by = null
    record.reviewed_at = null
    record.reviewer_note = null
  } else if (!existing) {
    record.status = 'draft'
  }

  const { data: saved, error } = await admin
    .from('partner_verifications')
    .upsert(record, { onConflict: 'user_id,requested_role' })
    .select('*')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Simpan ketersediaan ke tabel partner_availability supaya dipakai modul jadwal survey.
  if (data.availability) {
    const activeRows = availability
      .filter((row) => row.is_active)
      .map((row) => ({
        user_id: user.id,
        weekday: row.weekday,
        is_active: true,
        start_time: row.start_time,
        end_time: row.end_time,
        slot_minutes: row.slot_minutes,
        mode: row.mode,
        location: row.location,
        notes: row.notes,
        updated_at: now,
      }))
    try {
      await admin.from('partner_availability').delete().eq('user_id', user.id)
      if (activeRows.length) await admin.from('partner_availability').insert(activeRows)
    } catch { /* jadwal tidak boleh menggagalkan simpan verifikasi */ }
  }

  if (action === 'submit') {
    try {
      await admin.from('audit_logs').insert({
        actor_id: user.id,
        action: 'verification.submitted',
        entity_type: 'partner_verification',
        entity_id: String((saved as VerificationRecord | null)?.id ?? ''),
        metadata: { role, full_name: draft.full_name ?? null, availability_slots: availability.filter((row) => row.is_active).length },
      })
    } catch { /* best effort */ }

    try {
      const { data: admins } = await admin.from('user_roles').select('user_id').in('role', ['admin', 'super_admin'])
      const ids = Array.from(new Set((admins ?? []).map((row: { user_id: string }) => row.user_id))).filter(Boolean)
      await Promise.all(
        ids.map((id) =>
          notifyUser({
            userId: id,
            kind: 'verification.submitted',
            title: `Verifikasi mitra baru — ${role === 'agent' ? 'Agen' : 'Pemilik'}`,
            body: `${draft.full_name ?? 'Mitra'} mengirim data verifikasi untuk ditinjau.`,
            href: '/dashboard/admin/verifications',
            data: { role, verification_id: (saved as VerificationRecord | null)?.id ?? null },
          }),
        ),
      )
    } catch { /* best effort */ }
  }

  return NextResponse.json({ ok: true, record: saved })
}

export const runtime = 'nodejs'
export const maxDuration = 30
