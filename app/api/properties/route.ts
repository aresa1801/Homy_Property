import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('listing_type')
  const city = searchParams.get('city')
  const supabase = await createClient()
  let query = supabase
    .from('properties')
    .select('id,title,description,listing_type,status,property_type,province,postal_code,negotiable,certificate,year_built,floors,carports,electricity_va,water_source,property_condition,amenities,nearby,min_lease_months,rent_payment_terms,occupancy_status,extra_notes,ai_summary,ai_facts,city,district,price,price_period,bedrooms,bathrooms,land_area,building_area,furnished,utilities_included,available_from,created_at,property_media(storage_path,media_type,sort_order)')
    .eq('status', 'published')
  if (type === 'sale' || type === 'rent') query = query.eq('listing_type', type)
  if (city) query = query.ilike('city', `%${city}%`)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(50)
  if (error) return NextResponse.json({ error: 'Unable to load properties' }, { status: 500 })
  return NextResponse.json({ data })
}

const PARTNER_ROLES = ['agent', 'property_owner']
const ADMIN_ROLES = ['admin', 'super_admin']

/** Kolom yang boleh diisi mitra lewat API. Kolom moderasi/verifikasi hanya admin. */
const ALLOWED_FIELDS = [
  'title', 'description', 'listing_type', 'property_type', 'city', 'district', 'province',
  'postal_code', 'address', 'latitude', 'longitude', 'price', 'price_period', 'negotiable',
  'bedrooms', 'bathrooms', 'land_area', 'building_area', 'furnished', 'utilities_included',
  'deposit_amount', 'service_charge', 'maintenance_fee', 'available_from', 'certificate',
  'year_built', 'floors', 'carports', 'electricity_va', 'water_source', 'property_condition',
  'amenities', 'nearby', 'min_lease_months', 'rent_payment_terms', 'occupancy_status',
  'extra_notes', 'ai_summary', 'ai_facts', 'map_url', 'meeting_point', 'meeting_point_lat',
  'meeting_point_lng',
]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { data: roleRows } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const roles = Array.isArray(roleRows) ? roleRows.map((row: { role: string }) => row.role) : []
  const isAdmin = roles.some((role) => ADMIN_ROLES.includes(role))
  const isPartner = roles.some((role) => PARTNER_ROLES.includes(role))
  if (!isAdmin && !isPartner) {
    return NextResponse.json({ error: 'Daftar dulu sebagai Agen atau Pemilik Properti untuk memasang listing.' }, { status: 403 })
  }

  // Mitra yang sedang disuspend/diblokir tidak boleh memasang listing baru.
  if (!isAdmin) {
    // RPC sanksi hanya dibuka ke service_role (least-privilege) — panggil lewat klien server.
    const svc = serviceClient()
    let sanction: unknown = null
    if (svc) {
      const { data } = await svc.rpc('partner_sanction_state', { p_uid: user.id })
      sanction = data
    }
    const state = String((sanction as Record<string, unknown> | null)?.state ?? 'active')
    if (state === 'suspend' || state === 'blokir') {
      return NextResponse.json({
        error: state === 'blokir'
          ? 'Akun mitra Anda diblokir. Hubungi tim Homy untuk peninjauan.'
          : 'Akun mitra Anda sedang ditangguhkan sementara sehingga belum bisa memasang listing baru.',
        sanction: sanction ?? null,
      }, { status: 403 })
    }
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  // Hanya kolom yang diizinkan — status, owner, dan kolom moderasi tidak bisa dititipkan dari klien.
  const payload: Record<string, unknown> = { owner_id: user.id }
  for (const key of ALLOWED_FIELDS) if (key in body) payload[key] = body[key]
  if (!String(payload.title ?? '').trim() || String(payload.title).trim().length < 5) {
    return NextResponse.json({ error: 'Judul listing minimal 5 karakter.' }, { status: 400 })
  }
  payload.status = isAdmin && ['draft', 'pending', 'published'].includes(String(body.status ?? '')) ? String(body.status) : 'draft'

  const { data, error } = await supabase.from('properties').insert(payload).select('id,title,status').single()
  if (error) return NextResponse.json({ error: 'Unable to create property' }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
