import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/visits'
import { isTransactReady } from '@/lib/notary'

// Direktori harus selalu segar (data bergantung pada status aktif notaris) — jangan pernah di-cache.
export const dynamic = 'force-dynamic'
export const revalidate = 0

type NotaryAreaRow = { province: string | null; kabupaten: string | null; kecamatan: string | null }
type NotaryRow = {
  id: string
  name: string | null
  office_name: string | null
  province: string | null
  kabupaten: string | null
  kecamatan: string | null
  services: string | null
  focus_areas: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  address: string | null
  featured: boolean | null
  status: string | null
  notary_areas?: NotaryAreaRow[] | null
}

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase()
const has = (haystack: unknown, needle: string) => norm(haystack).includes(needle)

/** Cocokkan notaris dengan filter wilayah (kecamatan/kabupaten/provinsi) + kata kunci. */
function matches(row: NotaryRow, filters: { province?: string; kabupaten?: string; kecamatan?: string; q?: string }) {
  const areas = Array.isArray(row.notary_areas) ? row.notary_areas : []
  const base = [row.province, row.kabupaten, row.kecamatan]
  const areaValues = areas.flatMap((area) => [area.province, area.kabupaten, area.kecamatan])
  const all = [...base, ...areaValues].filter(Boolean) as string[]

  if (filters.province && !all.some((value) => has(value, filters.province!))) return false
  if (filters.kabupaten) {
    const byKabupaten = all.some((value) => has(value, filters.kabupaten!))
    const byKecamatan = all.some((value) => has(value, filters.kecamatan || filters.kabupaten!))
    if (!byKabupaten && !byKecamatan) return false
  }
  if (filters.kecamatan && !all.some((value) => has(value, filters.kecamatan!))) return false
  if (filters.q) {
    const haystack = [row.name, row.office_name, row.services, row.focus_areas, ...all].filter(Boolean).join(' ').toLowerCase()
    if (!filters.q.toLowerCase().split(/\s+/).some((token) => token.length >= 2 && haystack.includes(token))) return false
  }
  return true
}

/**
 * GET /api/notaries — direktori notaris/PPAT (publik, hanya yang aktif).
 * Query: province, kabupaten, kecamatan, q, property_id (opsional, untuk status "siap transaksi"), limit.
 */
export async function GET(request: Request) {
  const admin = serviceClient()
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const url = new URL(request.url)
  const province = (url.searchParams.get('province') ?? '').trim()
  const kabupaten = (url.searchParams.get('kabupaten') ?? '').trim()
  const kecamatan = (url.searchParams.get('kecamatan') ?? '').trim()
  const q = (url.searchParams.get('q') ?? '').trim()
  const propertyId = (url.searchParams.get('property_id') ?? '').trim()
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 60) || 60, 1), 200)

  const { data, error } = await admin
    .from('notaries')
    .select('id,name,office_name,province,kabupaten,kecamatan,services,focus_areas,phone,whatsapp,email,website,address,featured,status,notary_areas(province,kabupaten,kecamatan)')
    .eq('status', 'active')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(400)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = ((data ?? []) as NotaryRow[]).filter((row) => matches(row, { province, kabupaten, kecamatan, q })).slice(0, limit)

  // Status "siap transaksi" untuk pengguna yang sedang login (memengaruhi tombol ajukan notaris).
  let authenticated = false
  let can_request = false
  let reason: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    authenticated = Boolean(user)
    if (user) {
      const rolesResult = await admin.from('user_roles').select('role').eq('user_id', user.id)
      const roles = (rolesResult.data ?? []).map((row: { role: string }) => row.role)
      const staffRole = roles.includes('agent') || roles.includes('property_owner')
      if (!propertyId) {
        can_request = true
      } else {
        const { data: property } = await admin.from('properties').select('id,owner_id').eq('id', propertyId).maybeSingle()
        const isOwner = Boolean(property?.owner_id && property.owner_id === user.id)
        const { data: interest } = await admin
          .from('interest_confirmations')
          .select('readiness,stage')
          .eq('property_id', propertyId)
          .eq('user_id', user.id)
          .maybeSingle()
        can_request = isOwner || staffRole || isTransactReady(interest)
        if (!can_request) reason = 'not_ready'
      }
    }
  } catch {
    /* status opsional — langsung balas direktori */
  }

  return NextResponse.json({ data: rows, authenticated, can_request, reason, optional: true }, { headers: { 'Cache-Control': 'no-store' } })
}
