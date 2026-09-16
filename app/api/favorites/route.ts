import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Favorit properti (ikon hati pada kartu listing).
 *
 * GET  /api/favorites            → daftar properti favorit milik pengguna yang login
 * POST /api/favorites            → { propertyId, action?: 'add' | 'remove' | 'toggle' }
 *
 * Akses data dibatasi RLS `favorites_own_all` (user_id = auth.uid()), jadi
 * pengguna hanya bisa membaca/menulis favoritnya sendiri.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ authenticated: false, ids: [], favorites: [] }, { status: 200 })

  const { data, error } = await supabase
    .from('favorites')
    .select('property_id,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    console.error('[homy] gagal memuat favorit:', error.message)
    return NextResponse.json({ error: 'Gagal memuat favorit.' }, { status: 502 })
  }
  const favorites = (data ?? []) as unknown as { property_id: string; created_at: string }[]
  return NextResponse.json({
    authenticated: true,
    ids: favorites.map((row) => String(row.property_id)),
    favorites,
    count: favorites.length,
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Masuk dulu untuk menyimpan favorit.' }, { status: 401 })

  let body: { propertyId?: string; action?: string } = {}
  try { body = (await request.json()) as typeof body } catch { /* body kosong */ }

  const propertyId = String(body.propertyId ?? '').trim()
  if (!UUID.test(propertyId)) return NextResponse.json({ error: 'ID properti tidak valid.' }, { status: 400 })

  // Pastikan propertinya benar-benar ada (favorit hanya untuk listing nyata).
  const { data: property } = await supabase.from('properties').select('id').eq('id', propertyId).maybeSingle()
  if (!property) return NextResponse.json({ error: 'Properti tidak ditemukan.' }, { status: 404 })

  const { data: existing } = await supabase
    .from('favorites')
    .select('property_id')
    .eq('user_id', user.id)
    .eq('property_id', propertyId)
    .maybeSingle()

  const isSaved = Boolean(existing)
  const action = String(body.action ?? 'toggle')
  const shouldSave = action === 'add' ? true : action === 'remove' ? false : !isSaved

  if (shouldSave === isSaved) {
    return NextResponse.json({ ok: true, favorite: isSaved, unchanged: true })
  }

  if (shouldSave) {
    const { error } = await supabase.from('favorites').insert({ user_id: user.id, property_id: propertyId })
    if (error && error.code !== '23505') {
      console.error('[homy] gagal menyimpan favorit:', error.message)
      return NextResponse.json({ error: 'Gagal menyimpan favorit.' }, { status: 502 })
    }
  } else {
    const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('property_id', propertyId)
    if (error) {
      console.error('[homy] gagal menghapus favorit:', error.message)
      return NextResponse.json({ error: 'Gagal menghapus favorit.' }, { status: 502 })
    }
  }

  return NextResponse.json({ ok: true, favorite: shouldSave })
}
