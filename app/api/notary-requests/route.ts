import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/visits'
import { rateLimit, clientKey } from '@/lib/rate-limit'
import { notifyUser } from '@/lib/notifications'
import { isTransactReady } from '@/lib/notary'

// Data per-pengguna — jangan di-cache.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const clean = (value: unknown, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

type NotaryRow = { id: string; name: string | null; office_name: string | null; province: string | null; kabupaten: string | null; kecamatan: string | null; whatsapp: string | null; phone: string | null }

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase()
const has = (haystack: unknown, needle: string) => {
  const target = norm(needle)
  return target.length >= 3 && norm(haystack).includes(target)
}

/** Rekomendasi notaris aktif untuk sebuah wilayah (level kecamatan/kabupaten/provinsi). */
async function recommend(admin: ReturnType<typeof serviceClient>, area: { province?: string; kabupaten?: string; kecamatan?: string }) {
  if (!admin) return [] as NotaryRow[]
  const { data } = await admin
    .from('notaries')
    .select('id,name,office_name,province,kabupaten,kecamatan,whatsapp,phone,notary_areas(province,kabupaten,kecamatan)')
    .eq('status', 'active')
    .order('featured', { ascending: false })
    .limit(300)
  const rows = (data ?? []) as Array<NotaryRow & { notary_areas?: Array<{ province: string | null; kabupaten: string | null; kecamatan: string | null }> | null }>
  const kab = area.kabupaten || ''
  const kec = area.kecamatan || ''
  const prov = area.province || ''
  const scored = rows
    .map((row) => {
      const areas = Array.isArray(row.notary_areas) ? row.notary_areas : []
      const values = [row.province, row.kabupaten, row.kecamatan, ...areas.flatMap((entry) => [entry.province, entry.kabupaten, entry.kecamatan])]
      let score = 0
      if (kec && values.some((value) => has(value, kec))) score += 4
      if (kab && values.some((value) => has(value, kab))) score += 3
      if (prov && values.some((value) => has(value, prov))) score += 1
      return { row, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, 3).map((entry) => entry.row)
}

/** GET /api/notary-requests — daftar pengajuan pendampingan notaris milik pengguna. */
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Login diperlukan' }, { status: 401 })
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  const { data, error } = await admin
    .from('notary_requests')
    .select('id,property_id,notary_id,source,intent,province,kabupaten,kecamatan,message,status,buyer_name,contact_phone,contact_email,admin_note,created_at,updated_at,notary:notaries(id,name,office_name,phone,whatsapp,email)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}

/**
 * POST /api/notary-requests — pengajuan pendampingan notaris/PPAT.
 * Aktif untuk pembeli yang sudah menyatakan siap bertransaksi, agen/pemilik properti terkait,
 * atau pengajuan umum (tanpa properti) dari pengguna yang login.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, 'notary-requests'), 6, 60_000)
  if (!limit.ok) return NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' }, { status: 429 })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Login diperlukan' }, { status: 401 })

  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  let body: Record<string, unknown> = {}
  try { body = (await request.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 }) }

  const propertyId = clean(body.property_id, 40) || null
  const province = clean(body.province, 80)
  const kabupaten = clean(body.kabupaten, 80)
  const kecamatan = clean(body.kecamatan, 80)
  const intentRaw = clean(body.intent, 16).toLowerCase()
  const intent = ['buy', 'rent'].includes(intentRaw) ? intentRaw : null
  const message = clean(body.message, 1000)

  if (!propertyId && !province && !kabupaten && !kecamatan) {
    return NextResponse.json({ error: 'Pilih minimal wilayah (kecamatan/kabupaten) atau properti terkait' }, { status: 400 })
  }

  const { data: roleRows } = await admin.from('user_roles').select('role').eq('user_id', user.id)
  const roles = (roleRows ?? []).map((row: { role: string }) => row.role)
  const staffRole = roles.includes('agent') || roles.includes('property_owner')

  let source = 'buyer'
  if (propertyId) {
    const { data: property } = await admin.from('properties').select('id,owner_id,title,city,district,province,listing_type').eq('id', propertyId).maybeSingle()
    if (!property) return NextResponse.json({ error: 'Properti tidak ditemukan' }, { status: 404 })
    const isOwner = Boolean(property.owner_id && property.owner_id === user.id)
    if (isOwner) source = 'owner'
    else if (staffRole) source = 'agent'
    else {
      const { data: interest } = await admin
        .from('interest_confirmations')
        .select('readiness,stage')
        .eq('property_id', propertyId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!isTransactReady(interest)) {
        return NextResponse.json(
          { error: 'Pengajuan notaris aktif setelah Anda menyatakan minat dan siap bertransaksi pada properti ini.', code: 'not_ready' },
          { status: 409 },
        )
      }
    }
  } else if (staffRole) {
    source = 'agent'
  }

  const { data: profile } = await admin.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle()

  const { data, error } = await admin
    .from('notary_requests')
    .insert({
      user_id: user.id,
      property_id: propertyId,
      notary_id: clean(body.notary_id, 40) || null,
      source,
      intent,
      buyer_name: clean(body.buyer_name, 160) || profile?.full_name || null,
      contact_phone: clean(body.contact_phone, 40) || profile?.phone || null,
      contact_email: clean(body.contact_email, 200) || user.email || null,
      province: province || null,
      kabupaten: kabupaten || null,
      kecamatan: kecamatan || null,
      message: message || null,
      status: 'submitted',
    })
    .select('id,status,province,kabupaten,kecamatan,created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const recommended = await recommend(admin, { province, kabupaten, kecamatan })

  // Kabari tim Homy (in-app) supaya bisa menindaklanjuti.
  try {
    const { data: admins } = await admin.from('user_roles').select('user_id').in('role', ['admin', 'super_admin'])
    const unique = Array.from(new Set((admins ?? []).map((row: { user_id: string }) => row.user_id)))
    await Promise.all(unique.map((id) => notifyUser({
      userId: id,
      kind: 'notary.request',
      title: 'Pengajuan pendampingan notaris baru',
      body: `${kecamatan || kabupaten || province || 'Wilayah belum diisi'} · ${source === 'buyer' ? 'calon pembeli/penyewa' : source === 'owner' ? 'pemilik properti' : 'agen'}`,
      href: '/dashboard/super-admin/partnership',
      data: { notary_request_id: data.id, property_id: propertyId },
    })))
  } catch { /* notifikasi best effort */ }

  // Kabari pengaju: rekomendasi notaris (opsional) sudah disiapkan.
  try {
    await notifyUser({
      userId: user.id,
      kind: 'notary.recommended',
      title: recommended.length ? 'Rekomendasi notaris/PPAT siap' : 'Pengajuan notaris diterima',
      body: recommended.length
        ? `${recommended.length} notaris/PPAT mitra Homy untuk wilayah Anda. Tim Homy juga akan menghubungi Anda.`
        : 'Tim Homy akan menghubungi Anda dan mengarahkan notaris/PPAT terdekat.',
      href: recommended.length ? '/notaris' : '/notaris',
      data: { notary_request_id: data.id },
    })
  } catch { /* notifikasi best effort */ }

  return NextResponse.json({ data, recommended, optional: true }, { status: 201 })
}
