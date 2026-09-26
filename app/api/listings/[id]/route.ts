import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { parseMapPoint, resolveMapPoint } from '@/lib/homy-maps'

export const runtime = 'nodejs'

const TEXT_FIELDS = [
  'title', 'description', 'listing_type', 'property_type', 'price_period', 'furnished', 'certificate',
  'water_source', 'property_condition', 'city', 'district', 'province', 'postal_code', 'address',
  'map_url', 'meeting_point', 'extra_notes', 'rent_payment_terms', 'occupancy_status', 'available_from',
] as const

const NUMBER_FIELDS = [
  'price', 'bedrooms', 'bathrooms', 'land_area', 'building_area', 'year_built', 'floors', 'carports',
  'electricity_va', 'min_lease_months', 'deposit_amount', 'service_charge', 'maintenance_fee',
  'latitude', 'longitude', 'meeting_point_lat', 'meeting_point_lng',
] as const

const BOOL_FIELDS = ['negotiable', 'utilities_included'] as const

type Row = Record<string, unknown>

async function loadOwned(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, property: null as Row | null, error: 'auth' as const }
  const { data: property, error } = await supabase
    .from('properties')
    .select('id,owner_id,title,status,listing_type')
    .eq('id', id)
    .maybeSingle()
  if (error) return { supabase, user, property: null, error: 'query' as const }
  if (!property) return { supabase, user, property: null, error: 'missing' as const }
  if (property.owner_id !== user.id) return { supabase, user, property, error: 'forbidden' as const }
  return { supabase, user, property, error: null }
}

/** GET /api/listings/[id] — data lengkap listing milik sendiri (untuk halaman edit). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, error, user } = await loadOwned(id)
  if (error === 'auth') return NextResponse.json({ error: 'Masuk dulu untuk mengubah listing.', needsAuth: true }, { status: 401 })
  if (error === 'missing') return NextResponse.json({ error: 'Listing tidak ditemukan.' }, { status: 404 })
  if (error === 'forbidden') return NextResponse.json({ error: 'Listing ini bukan milik Anda.' }, { status: 403 })
  if (error === 'query') return NextResponse.json({ error: 'Gagal memuat listing.' }, { status: 502 })

  const { data, error: fetchError } = await supabase
    .from('properties')
    .select('*, property_media(id,storage_path,media_type,sort_order)')
    .eq('id', id)
    .eq('owner_id', user!.id)
    .maybeSingle()
  if (fetchError || !data) return NextResponse.json({ error: 'Gagal memuat listing.' }, { status: 502 })

  const raw = data as Row
  const media = Array.isArray(raw.property_media) ? raw.property_media : []
  return NextResponse.json({ ok: true, property: { ...raw, media } })
}

/** PATCH /api/listings/[id] — simpan perubahan listing (foto ditangani route terpisah). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, error, user } = await loadOwned(id)
  if (error === 'auth') return NextResponse.json({ error: 'Masuk dulu untuk mengubah listing.', needsAuth: true }, { status: 401 })
  if (error === 'missing') return NextResponse.json({ error: 'Listing tidak ditemukan.' }, { status: 404 })
  if (error === 'forbidden') return NextResponse.json({ error: 'Listing ini bukan milik Anda.' }, { status: 403 })
  if (error === 'query') return NextResponse.json({ error: 'Gagal memuat listing.' }, { status: 502 })
  if (!user) return NextResponse.json({ error: 'Masuk dulu untuk mengubah listing.', needsAuth: true }, { status: 401 })

  // Mitra yang sedang disuspend/diblokir tidak boleh mengubah listing.
  {
    const svc = serviceClient()
    let sancState: unknown = null
    if (svc) {
      const { data } = await svc.rpc('partner_sanction_state', { p_uid: user.id })
      sancState = data
    }
    const pstate = String((sancState as Record<string, unknown> | null)?.state ?? 'active')
    if (pstate === 'suspend' || pstate === 'blokir') {
      return NextResponse.json({
        error: pstate === 'blokir'
          ? 'Akun mitra Anda diblokir sehingga belum bisa mengubah listing. Hubungi tim Homy.'
          : 'Akun mitra Anda sedang ditangguhkan sementara sehingga belum bisa mengubah listing.',
        needsReview: true,
      }, { status: 403 })
    }
  }

  let body: Row = {}
  try { body = (await request.json()) as Row } catch { /* kosong */ }

  const patch: Row = { updated_at: new Date().toISOString() }

  for (const key of TEXT_FIELDS) {
    if (!(key in body)) continue
    const value = String(body[key] ?? '').trim()
    patch[key] = value || null
  }
  for (const key of NUMBER_FIELDS) {
    if (!(key in body)) continue
    const value = body[key]
    if (value === '' || value == null) { patch[key] = null; continue }
    const num = Number(value)
    patch[key] = Number.isFinite(num) ? num : null
  }
  for (const key of BOOL_FIELDS) {
    if (!(key in body)) continue
    patch[key] = Boolean(body[key])
  }
  if (Array.isArray(body.amenities)) patch.amenities = (body.amenities as unknown[]).map((item) => String(item)).slice(0, 40)
  if (Array.isArray(body.nearby)) patch.nearby = (body.nearby as unknown[]).map((item) => String(item)).slice(0, 40)

  if (patch.title != null && String(patch.title).length < 5) {
    return NextResponse.json({ error: 'Judul listing minimal 5 karakter.' }, { status: 400 })
  }
  if (patch.price != null && Number(patch.price) < 0) {
    return NextResponse.json({ error: 'Harga tidak boleh negatif.' }, { status: 400 })
  }

  // Titik temu: kalau pengguna menempel link Google Maps baru, ambil koordinatnya.
  // Link share pendek (maps.app.goo.gl) diselesaikan dulu lewat resolveMapPoint.
  const mapLink = String(body.map_url ?? '').trim()
  if (mapLink) {
    const point = parseMapPoint(mapLink) ?? (await resolveMapPoint(mapLink))
    if (point) {
      if (body.meeting_point_lat == null || body.meeting_point_lat === '') patch.meeting_point_lat = point.lat
      if (body.meeting_point_lng == null || body.meeting_point_lng === '') patch.meeting_point_lng = point.lng
    }
  }

  const { data, error: updateError } = await supabase
    .from('properties')
    .update(patch)
    .eq('id', id)
    .eq('owner_id', user!.id)
    .select('id,title,status,updated_at,latitude,longitude,map_url,meeting_point,meeting_point_lat,meeting_point_lng')
    .maybeSingle()
  if (updateError) {
    console.error('[homy-listings] gagal update:', updateError.message)
    return NextResponse.json({ error: 'Gagal menyimpan perubahan listing.' }, { status: 502 })
  }

  await supabase.from('audit_logs').insert({
    actor_id: user!.id,
    action: 'listing.updated',
    entity_type: 'property',
    entity_id: id,
    metadata: { fields: Object.keys(patch).filter((key) => key !== 'updated_at') },
  }).then(() => undefined, () => undefined)

  return NextResponse.json({ ok: true, property: data })
}
